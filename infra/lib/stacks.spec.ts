import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CONFIG } from './config';
import { FoundationStack } from './foundation-stack';
import { HostStack } from './host-stack';
import { UptimeStack } from './uptime-stack';

interface SynthesizedTemplates {
  foundation: Template;
  host: Template;
  uptime: Template;
}

function synthesizeTemplates(): SynthesizedTemplates {
  const app = new App();
  const homeEnvironment = { account: CONFIG.account, region: CONFIG.region };
  const foundationStack = new FoundationStack(app, 'Foundation', {
    env: homeEnvironment,
  });
  const hostStack = new HostStack(app, 'Host', {
    env: homeEnvironment,
    repository: foundationStack.repository,
    elasticIpAllocationId: foundationStack.elasticIpAllocationId,
    alerts: foundationStack.alerts,
  });
  const uptimeStack = new UptimeStack(app, 'Uptime', {
    env: { account: CONFIG.account, region: CONFIG.uptimeRegion },
  });
  return {
    foundation: Template.fromStack(foundationStack),
    host: Template.fromStack(hostStack),
    uptime: Template.fromStack(uptimeStack),
  };
}

const { foundation, host, uptime } = synthesizeTemplates();

describe('FoundationStack', () => {
  it('lets only the production environment of this repo assume the deploy role', () => {
    foundation.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'wayfinder-github-deploy',
      AssumeRolePolicyDocument: {
        Statement: [
          Match.objectLike({
            Action: 'sts:AssumeRoleWithWebIdentity',
            Condition: {
              StringEquals: {
                'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
                'token.actions.githubusercontent.com:sub':
                  'repo:gregunderwood@313113/wayfinder@1435180502:environment:production',
              },
            },
          }),
        ],
      },
    });
  });

  it('limits SendCommand on instances to the tagged web host', () => {
    foundation.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Sid: 'RunCommandsOnTheWebHostOnly',
            Action: 'ssm:SendCommand',
            Condition: {
              StringEquals: { 'ssm:resourceTag/wayfinder:role': 'web' },
            },
          }),
        ]),
      },
    });
  });

  it('lets the deploy role check whether an image was already built', () => {
    foundation.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({ Action: 'ecr:DescribeImages' }),
        ]),
      },
    });
  });

  it('keeps the IP and image repository if the stack is ever deleted', () => {
    foundation.hasResource('AWS::EC2::EIP', { DeletionPolicy: 'Retain' });
    foundation.hasResource('AWS::ECR::Repository', {
      DeletionPolicy: 'Retain',
      Properties: Match.objectLike({ ImageTagMutability: 'IMMUTABLE' }),
    });
  });

  it('sends budget alerts to the alerts topic', () => {
    foundation.hasResourceProperties('AWS::Budgets::Budget', {
      Budget: Match.objectLike({ BudgetLimit: { Amount: 30, Unit: 'USD' } }),
      NotificationsWithSubscribers: Match.arrayWith([
        Match.objectLike({
          Notification: Match.objectLike({ NotificationType: 'FORECASTED' }),
          Subscribers: [Match.objectLike({ SubscriptionType: 'SNS' })],
        }),
      ]),
    });
  });

  it('restricts certificate issuance to Let’s Encrypt', () => {
    foundation.hasResourceProperties('AWS::Route53::RecordSet', {
      Type: 'CAA',
      ResourceRecords: ['0 issue "letsencrypt.org"', '0 issuewild ";"'],
    });
  });
});

describe('HostStack', () => {
  it('opens only the web ports, and no SSH', () => {
    const securityGroups = host.findResources('AWS::EC2::SecurityGroup');
    const ingressRules = Object.values(securityGroups).flatMap(
      (securityGroup) => securityGroup.Properties.SecurityGroupIngress ?? [],
    );
    const ports = ingressRules.map(
      (rule: { IpProtocol: string; FromPort: number }) =>
        `${rule.IpProtocol}/${rule.FromPort}`,
    );
    expect(ports.sort()).toEqual(['tcp/443', 'tcp/80', 'udp/443']);
  });

  it('runs a tagged, IMDSv2-only Graviton instance on an encrypted disk', () => {
    host.hasResourceProperties('AWS::EC2::Instance', {
      InstanceType: 't4g.small',
      BlockDeviceMappings: [
        Match.objectLike({ Ebs: Match.objectLike({ Encrypted: true }) }),
      ],
      Tags: Match.arrayWith([{ Key: 'wayfinder:role', Value: 'web' }]),
    });
    host.hasResourceProperties('AWS::EC2::LaunchTemplate', {
      LaunchTemplateData: { MetadataOptions: { HttpTokens: 'required' } },
    });
  });

  it('verifies the Compose download before installing it', () => {
    const [instance] = Object.values(host.findResources('AWS::EC2::Instance'));
    const userData = JSON.stringify(instance.Properties.UserData);
    expect(userData).toContain(`${CONFIG.compose.sha256}  `);
    expect(userData).toContain('sha256sum -c -');
  });

  it('recovers on a system check failure and reboots on an instance check failure', () => {
    const alarmActionsFor = (metricName: string): string => {
      const [alarm] = Object.values(
        host.findResources('AWS::CloudWatch::Alarm', {
          Properties: { MetricName: metricName },
        }),
      );
      return JSON.stringify(alarm.Properties.AlarmActions);
    };
    expect(alarmActionsFor('StatusCheckFailed_System')).toContain(
      ':ec2:recover',
    );
    expect(alarmActionsFor('StatusCheckFailed_Instance')).toContain(
      ':ec2:reboot',
    );
  });

  it('uses standard CPU credits so load cannot run up the bill', () => {
    host.hasResourceProperties('AWS::EC2::Instance', {
      CreditSpecification: { CPUCredits: 'standard' },
    });
  });
});

describe('UptimeStack', () => {
  it('checks the public HTTPS site and alarms when it is down', () => {
    uptime.hasResourceProperties('AWS::Route53::HealthCheck', {
      HealthCheckConfig: Match.objectLike({
        Type: 'HTTPS',
        FullyQualifiedDomainName: CONFIG.domain,
        EnableSNI: true,
      }),
    });
    uptime.hasResourceProperties('AWS::CloudWatch::Alarm', {
      Namespace: 'AWS/Route53',
      MetricName: 'HealthCheckStatus',
      TreatMissingData: 'breaching',
    });
  });
});
