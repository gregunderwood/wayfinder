import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CONFIG } from './config';
import { FoundationStack } from './foundation-stack';
import { HostStack } from './host-stack';

function synth() {
  const app = new App();
  const env = { account: CONFIG.account, region: CONFIG.region };
  const foundation = new FoundationStack(app, 'Foundation', { env });
  const host = new HostStack(app, 'Host', {
    env,
    repository: foundation.repository,
    eipAllocationId: foundation.eipAllocationId,
  });
  return {
    foundation: Template.fromStack(foundation),
    host: Template.fromStack(host),
  };
}

const { foundation, host } = synth();

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
                  'repo:gregunderwood/wayfinder:environment:production',
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

  it('keeps the IP and image repository if the stack is ever deleted', () => {
    foundation.hasResource('AWS::EC2::EIP', { DeletionPolicy: 'Retain' });
    foundation.hasResource('AWS::ECR::Repository', {
      DeletionPolicy: 'Retain',
      Properties: Match.objectLike({ ImageTagMutability: 'IMMUTABLE' }),
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
    const groups = host.findResources('AWS::EC2::SecurityGroup');
    const ingress = Object.values(groups).flatMap(
      (g) => g.Properties.SecurityGroupIngress ?? [],
    );
    const ports = ingress.map(
      (r: { IpProtocol: string; FromPort: number }) =>
        `${r.IpProtocol}/${r.FromPort}`,
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
});
