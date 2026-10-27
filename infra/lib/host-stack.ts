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
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { CONFIG } from './config';
import { hostUserData } from './host-user-data';

export interface HostStackProps extends StackProps {
  readonly repository: ecr.IRepository;
  readonly eipAllocationId: string;
  readonly alerts: sns.ITopic;
}

/**
 * The server itself. Everything here is replaceable: the public IP, DNS and
 * images live in the foundation stack, so rebuilding the host moves the IP to
 * the new instance and the next deploy puts the site back.
 */
export class HostStack extends Stack {
  constructor(scope: Construct, id: string, props: HostStackProps) {
    super(scope, id, props);

    // Public subnet only and no NAT gateway: the host needs inbound web
    // traffic and outbound internet, and a NAT gateway would cost more per
    // month than the instance.
    const vpc = new ec2.Vpc(this, 'Vpc', {
      ipAddresses: ec2.IpAddresses.cidr('10.40.0.0/24'),
      availabilityZones: [`${CONFIG.region}a`],
      natGateways: 0,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 26 },
      ],
    });
    Validations.of(vpc).acknowledge({
      id: 'AwsSolutions::AwsSolutions-VPC7',
      reason:
        'One public host whose only inbound ports are 80 and 443; Caddy access logs cover the traffic that matters, and flow logs would cost more than they reveal here.',
    });

    // Web ports only. There is no SSH rule: shell access is SSM Session
    // Manager, which needs no inbound port at all.
    const securityGroup = new ec2.SecurityGroup(this, 'WebSecurityGroup', {
      vpc,
      description: 'HTTP and HTTPS from anywhere; nothing else inbound',
      allowAllOutbound: true,
    });
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'HTTP');
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'HTTPS',
    );
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.udp(443),
      'HTTP/3',
    );

    Validations.of(securityGroup).acknowledge({
      id: 'AwsSolutions::AwsSolutions-EC23',
      reason: 'A public website: 80 and 443 must be reachable from anywhere.',
    });

    const userData = ec2.UserData.forLinux();
    userData.addCommands(...hostUserData());

    const instance = new ec2.Instance(this, 'Web', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: new ec2.InstanceType(CONFIG.instanceType),
      // Standard credits: under sustained load the instance slows to its
      // baseline instead of billing for surplus CPU. A predictable bill
      // matters more than peak speed for a personal site.
      creditSpecification: ec2.CpuCredits.STANDARD,
      // Resolved once and cached in cdk.context.json. Left uncached, every
      // deploy after an Amazon Linux release would silently replace the host.
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        cpuType: ec2.AmazonLinuxCpuType.ARM_64,
        cachedInContext: true,
      }),
      securityGroup,
      ssmSessionPermissions: true,
      requireImdsv2: true,
      userData,
      // User data only runs on first boot, so a change to it is applied by
      // replacing the instance rather than silently ignored. Safe while the
      // host holds no data of its own.
      userDataCausesReplacement: true,
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(20, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true,
          }),
        },
      ],
    });
    Tags.of(instance).add(CONFIG.hostTag.key, CONFIG.hostTag.value);
    Tags.of(instance).add('Name', 'wayfinder-web');

    props.repository.grantPull(instance.role);
    Validations.of(instance).acknowledge(
      {
        id: 'AwsSolutions::AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/AmazonSSMManagedInstanceCore]',
        reason:
          'The AWS-maintained policy for Session Manager and Run Command; a hand-copied version would drift as SSM evolves.',
      },
      {
        id: 'AwsSolutions::AwsSolutions-IAM5[Resource::*]',
        reason:
          'ecr:GetAuthorizationToken does not support resource-level permissions; image pulls themselves are scoped to the one repository.',
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

    new ec2.CfnEIPAssociation(this, 'WebIpAssociation', {
      allocationId: props.eipAllocationId,
      instanceId: instance.instanceId,
    });

    this.addAlarms(instance, props.alerts);

    new CfnOutput(this, 'InstanceId', { value: instance.instanceId });
  }

  /**
   * Status-check alarms that fix the host rather than only reporting it: a
   * failed system check (AWS hardware or network) recovers the instance onto
   * new hardware, keeping its ID, IP and disk; a failed instance check (a hung
   * kernel, exhausted memory) reboots it, and the containers restart with
   * Docker. Each also emails, as does running low on CPU credits.
   */
  private addAlarms(instance: ec2.Instance, alerts: sns.ITopic): void {
    const notify = new actions.SnsAction(alerts);
    const metric = (metricName: string, statistic = 'Maximum') =>
      new cloudwatch.Metric({
        namespace: 'AWS/EC2',
        metricName,
        dimensionsMap: { InstanceId: instance.instanceId },
        statistic,
        period: Duration.minutes(1),
      });

    const failed = {
      threshold: 1,
      comparisonOperator:
        cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.MISSING,
    };

    const system = new cloudwatch.Alarm(this, 'SystemCheckFailed', {
      ...failed,
      alarmName: 'wayfinder-web-system-check',
      alarmDescription: 'AWS-side failure under the web host; recovering it',
      metric: metric('StatusCheckFailed_System'),
    });
    system.addAlarmAction(
      new actions.Ec2Action(actions.Ec2InstanceAction.RECOVER),
      notify,
    );
    system.addOkAction(notify);

    const guest = new cloudwatch.Alarm(this, 'InstanceCheckFailed', {
      ...failed,
      // Three minutes, so a slow boot after the reboot below does not
      // trigger another one.
      evaluationPeriods: 3,
      alarmName: 'wayfinder-web-instance-check',
      alarmDescription: 'The web host OS is unresponsive; rebooting it',
      metric: metric('StatusCheckFailed_Instance'),
    });
    guest.addAlarmAction(
      new actions.Ec2Action(actions.Ec2InstanceAction.REBOOT),
      notify,
    );
    guest.addOkAction(notify);

    // Credits run out only under sustained load, i.e. something unusual:
    // a traffic spike, a scraper or a runaway process.
    const credits = new cloudwatch.Alarm(this, 'CpuCreditsLow', {
      alarmName: 'wayfinder-web-cpu-credits',
      alarmDescription:
        'The web host is nearly out of CPU credits and will be throttled',
      metric: metric('CPUCreditBalance', 'Minimum').with({
        period: Duration.minutes(5),
      }),
      threshold: 20,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods: 3,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    credits.addAlarmAction(notify);
    credits.addOkAction(notify);
  }
}
