import {
  CfnOutput,
  Duration,
  Stack,
  StackProps,
  Tags,
  Validations,
} from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { CONFIG } from './config';
import { buildHostUserData } from './host-user-data';

const VPC_CIDR = '10.40.0.0/24';
const PUBLIC_SUBNET_CIDR_MASK = 26;
const HTTP_PORT = 80;
const HTTPS_PORT = 443;
const AMAZON_LINUX_ROOT_DEVICE = '/dev/xvda';
const ROOT_VOLUME_GIB = 20;
const LOW_CPU_CREDIT_BALANCE = 20;

export interface HostStackProps extends StackProps {
  readonly webRepository: ecr.IRepository;
  readonly apiRepository: ecr.IRepository;
  readonly elasticIpAllocationId: string;
  readonly alerts: sns.ITopic;
  readonly dataVolume: ec2.IVolume;
}

export class HostStack extends Stack {
  constructor(scope: Construct, id: string, props: HostStackProps) {
    super(scope, id, props);

    const vpc = this.createPublicOnlyVpc();
    const securityGroup = this.createWebOnlySecurityGroup(vpc);
    const instance = this.createWebInstance(
      vpc,
      securityGroup,
      props.dataVolume,
    );
    this.grantWhatTheHostNeeds(instance.role, props);
    this.acknowledgeInstanceFindings(instance);

    new ec2.CfnEIPAssociation(this, 'WebIpAssociation', {
      allocationId: props.elasticIpAllocationId,
      instanceId: instance.instanceId,
    });

    const notifyAlerts = new actions.SnsAction(props.alerts);
    this.recoverOnSystemCheckFailure(instance, notifyAlerts);
    this.rebootOnInstanceCheckFailure(instance, notifyAlerts);
    this.alertOnLowCpuCredits(instance, notifyAlerts);

    new CfnOutput(this, 'InstanceId', { value: instance.instanceId });
  }

  private createPublicOnlyVpc(): ec2.Vpc {
    // No NAT gateway: it would cost more per month than the instance.
    const vpc = new ec2.Vpc(this, 'Vpc', {
      ipAddresses: ec2.IpAddresses.cidr(VPC_CIDR),
      availabilityZones: [CONFIG.availabilityZone],
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: PUBLIC_SUBNET_CIDR_MASK,
        },
      ],
    });
    Validations.of(vpc).acknowledge({
      id: 'AwsSolutions::AwsSolutions-VPC7',
      reason:
        'One public host whose only inbound ports are 80 and 443; Caddy access logs cover the traffic that matters, and flow logs would cost more than they reveal here.',
    });
    return vpc;
  }

  private createWebOnlySecurityGroup(vpc: ec2.IVpc): ec2.SecurityGroup {
    // No SSH rule: shell access is SSM Session Manager, which needs no inbound port.
    const securityGroup = new ec2.SecurityGroup(this, 'WebSecurityGroup', {
      vpc,
      description: 'HTTP and HTTPS from anywhere; nothing else inbound',
      allowAllOutbound: true,
    });
    const anywhere = ec2.Peer.anyIpv4();
    securityGroup.addIngressRule(anywhere, ec2.Port.tcp(HTTP_PORT), 'HTTP');
    securityGroup.addIngressRule(anywhere, ec2.Port.tcp(HTTPS_PORT), 'HTTPS');
    securityGroup.addIngressRule(anywhere, ec2.Port.udp(HTTPS_PORT), 'HTTP/3');
    Validations.of(securityGroup).acknowledge({
      id: 'AwsSolutions::AwsSolutions-EC23',
      reason: 'A public website: 80 and 443 must be reachable from anywhere.',
    });
    return securityGroup;
  }

  private createWebInstance(
    vpc: ec2.IVpc,
    securityGroup: ec2.ISecurityGroup,
    dataVolume: ec2.IVolume,
  ): ec2.Instance {
    const userData = ec2.UserData.forLinux();
    userData.addCommands(...buildHostUserData(dataVolume.volumeId));

    const instance = new ec2.Instance(this, 'Web', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: new ec2.InstanceType(CONFIG.instanceType),
      // Standard credits throttle to baseline under sustained load instead of billing for surplus CPU.
      creditSpecification: ec2.CpuCredits.STANDARD,
      // Uncached, every deploy after an Amazon Linux release would silently replace the host.
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        cpuType: ec2.AmazonLinuxCpuType.ARM_64,
        cachedInContext: true,
      }),
      securityGroup,
      ssmSessionPermissions: true,
      requireImdsv2: true,
      userData,
      // User data runs only on first boot; replacing is safe because the data lives on the separate data volume.
      userDataCausesReplacement: true,
      blockDevices: [
        {
          deviceName: AMAZON_LINUX_ROOT_DEVICE,
          volume: ec2.BlockDeviceVolume.ebs(ROOT_VOLUME_GIB, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true,
          }),
        },
      ],
    });
    Tags.of(instance).add(CONFIG.hostTag.key, CONFIG.hostTag.value);
    Tags.of(instance).add('Name', 'wayfinder-web');
    return instance;
  }

  private grantWhatTheHostNeeds(role: iam.IRole, props: HostStackProps): void {
    props.webRepository.grantPull(role);
    props.apiRepository.grantPull(role);
    this.allowWritingAndRestoringBackups(role);
    props.alerts.grantPublish(role);
    this.allowAttachingTheDataVolume(role, props.dataVolume);
    role.addToPrincipalPolicy(
      new iam.PolicyStatement({
        sid: 'ReadTheAppSecrets',
        actions: ['ssm:GetParameter'],
        resources: CONFIG.secretParameters.map(
          (parameterName) =>
            `arn:aws:ssm:${this.region}:${this.account}:parameter${parameterName}`,
        ),
      }),
    );
  }

  // Write and read, never delete: versioning plus a 30-day expiry is the only way a backup goes away.
  private allowWritingAndRestoringBackups(role: iam.IRole): void {
    role.addToPrincipalPolicy(
      new iam.PolicyStatement({
        sid: 'WriteAndRestoreBackups',
        actions: ['s3:PutObject', 's3:GetObject'],
        resources: [`arn:aws:s3:::${CONFIG.backupBucketName}/*`],
      }),
    );
    role.addToPrincipalPolicy(
      new iam.PolicyStatement({
        sid: 'FindTheLatestBackup',
        actions: ['s3:ListBucket'],
        resources: [`arn:aws:s3:::${CONFIG.backupBucketName}`],
      }),
    );
  }

  // The host attaches the volume itself: on replacement CloudFormation starts the new host before
  // terminating the old one, so an attachment resource would fail while the old host still holds it.
  private allowAttachingTheDataVolume(
    role: iam.IRole,
    dataVolume: ec2.IVolume,
  ): void {
    role.addToPrincipalPolicy(
      new iam.PolicyStatement({
        sid: 'AttachTheDataVolume',
        actions: ['ec2:AttachVolume'],
        resources: [
          `arn:aws:ec2:${this.region}:${this.account}:volume/${dataVolume.volumeId}`,
        ],
      }),
    );
    role.addToPrincipalPolicy(
      new iam.PolicyStatement({
        sid: 'ToTheWebHostOnly',
        actions: ['ec2:AttachVolume'],
        resources: [`arn:aws:ec2:${this.region}:${this.account}:instance/*`],
        conditions: {
          StringEquals: {
            [`aws:ResourceTag/${CONFIG.hostTag.key}`]: CONFIG.hostTag.value,
          },
        },
      }),
    );
  }

  private acknowledgeInstanceFindings(instance: ec2.Instance): void {
    Validations.of(instance).acknowledge(
      {
        id: 'AwsSolutions::AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/AmazonSSMManagedInstanceCore]',
        reason:
          'The AWS-maintained policy for Session Manager and Run Command; a hand-copied version would drift as SSM evolves.',
      },
      {
        id: 'AwsSolutions::AwsSolutions-IAM5[Resource::*]',
        reason:
          'ecr:GetAuthorizationToken does not support resource-level permissions; image pulls themselves are scoped to the two repositories.',
      },
      {
        id: `AwsSolutions::AwsSolutions-IAM5[Resource::arn:aws:ec2:${CONFIG.region}:${CONFIG.account}:instance/*]`,
        reason:
          'AttachVolume is narrowed by an aws:ResourceTag condition to the web host, so a replacement host can attach the data volume.',
      },
      {
        id: `AwsSolutions::AwsSolutions-IAM5[Resource::arn:aws:s3:::${CONFIG.backupBucketName}/*]`,
        reason:
          'Backups are written under a timestamped key per run; the object wildcard is limited to the one backup bucket.',
      },
      {
        id: 'AwsSolutions::AwsSolutions-EC28',
        reason:
          'Basic five-minute metrics are enough for a single personal site; detailed monitoring is billed per metric.',
      },
      {
        id: 'AwsSolutions::AwsSolutions-EC29',
        reason:
          'The host is disposable by design: DNS, the IP and images live in the termination-protected foundation stack, and a deploy rebuilds the site.',
      },
    );
  }

  private recoverOnSystemCheckFailure(
    instance: ec2.Instance,
    notifyAlerts: actions.SnsAction,
  ): void {
    const systemCheckAlarm = new cloudwatch.Alarm(this, 'SystemCheckFailed', {
      ...statusCheckFailedAlarmProps(),
      alarmName: 'wayfinder-web-system-check',
      alarmDescription: 'AWS-side failure under the web host; recovering it',
      metric: instanceMetric(instance, 'StatusCheckFailed_System'),
    });
    systemCheckAlarm.addAlarmAction(
      new actions.Ec2Action(actions.Ec2InstanceAction.RECOVER),
      notifyAlerts,
    );
    systemCheckAlarm.addOkAction(notifyAlerts);
  }

  private rebootOnInstanceCheckFailure(
    instance: ec2.Instance,
    notifyAlerts: actions.SnsAction,
  ): void {
    const instanceCheckAlarm = new cloudwatch.Alarm(
      this,
      'InstanceCheckFailed',
      {
        ...statusCheckFailedAlarmProps(),
        // Three minutes, so a slow boot after the reboot does not trigger another one.
        evaluationPeriods: 3,
        alarmName: 'wayfinder-web-instance-check',
        alarmDescription: 'The web host OS is unresponsive; rebooting it',
        metric: instanceMetric(instance, 'StatusCheckFailed_Instance'),
      },
    );
    instanceCheckAlarm.addAlarmAction(
      new actions.Ec2Action(actions.Ec2InstanceAction.REBOOT),
      notifyAlerts,
    );
    instanceCheckAlarm.addOkAction(notifyAlerts);
  }

  private alertOnLowCpuCredits(
    instance: ec2.Instance,
    notifyAlerts: actions.SnsAction,
  ): void {
    const cpuCreditsAlarm = new cloudwatch.Alarm(this, 'CpuCreditsLow', {
      alarmName: 'wayfinder-web-cpu-credits',
      alarmDescription:
        'The web host is nearly out of CPU credits and will be throttled',
      metric: instanceMetric(instance, 'CPUCreditBalance', 'Minimum').with({
        period: Duration.minutes(5),
      }),
      threshold: LOW_CPU_CREDIT_BALANCE,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods: 3,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    cpuCreditsAlarm.addAlarmAction(notifyAlerts);
    cpuCreditsAlarm.addOkAction(notifyAlerts);
  }
}

function instanceMetric(
  instance: ec2.Instance,
  metricName: string,
  statistic = 'Maximum',
): cloudwatch.Metric {
  return new cloudwatch.Metric({
    namespace: 'AWS/EC2',
    metricName,
    dimensionsMap: { InstanceId: instance.instanceId },
    statistic,
    period: Duration.minutes(1),
  });
}

function statusCheckFailedAlarmProps(): Pick<
  cloudwatch.AlarmProps,
  'threshold' | 'comparisonOperator' | 'evaluationPeriods' | 'treatMissingData'
> {
  return {
    threshold: 1,
    comparisonOperator:
      cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    evaluationPeriods: 2,
    treatMissingData: cloudwatch.TreatMissingData.MISSING,
  };
}
