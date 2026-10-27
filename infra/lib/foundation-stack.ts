import {
  CfnOutput,
  Duration,
  Fn,
  RemovalPolicy,
  Stack,
  StackProps,
  Validations,
} from 'aws-cdk-lib';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { CONFIG } from './config';

/**
 * The long-lived identity of the site: its DNS zone, its public IP, its image
 * registry and the role GitHub deploys with. These outlive any one server —
 * recreating the zone would change its nameservers at the registrar, and
 * recreating the IP would break DNS — so they live apart from the host and the
 * stack is termination-protected.
 */
export class FoundationStack extends Stack {
  readonly repository: ecr.IRepository;
  readonly eipAllocationId: string;
  readonly alerts: sns.ITopic;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, { ...props, terminationProtection: true });

    const zone = new route53.PublicHostedZone(this, 'Zone', {
      zoneName: CONFIG.domain,
    });

    const eip = new ec2.CfnEIP(this, 'WebIp', {
      domain: 'vpc',
      tags: [{ key: 'Name', value: 'wayfinder-web' }],
    });
    eip.applyRemovalPolicy(RemovalPolicy.RETAIN);
    this.eipAllocationId = eip.attrAllocationId;

    const target = route53.RecordTarget.fromIpAddresses(eip.attrPublicIp);
    new route53.ARecord(this, 'Apex', {
      zone,
      target,
      ttl: Duration.minutes(5),
    });
    new route53.ARecord(this, 'Www', {
      zone,
      recordName: 'www',
      target,
      ttl: Duration.minutes(5),
    });
    // Only Let's Encrypt may issue certificates for the domain, so a
    // mis-issued certificate from any other CA is refused at the source.
    new route53.CaaRecord(this, 'Caa', {
      zone,
      values: [
        { flag: 0, tag: route53.CaaTag.ISSUE, value: 'letsencrypt.org' },
        { flag: 0, tag: route53.CaaTag.ISSUEWILD, value: ';' },
      ],
    });

    this.repository = new ecr.Repository(this, 'WebRepository', {
      repositoryName: 'wayfinder/web',
      // Tags are git SHAs; immutability means a tag always names the exact
      // image that was tested, and rollback by SHA is trustworthy.
      imageTagMutability: ecr.TagMutability.IMMUTABLE,
      imageScanOnPush: true,
      lifecycleRules: [
        { description: 'Keep the last 20 images', maxImageCount: 20 },
      ],
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const github = new iam.OidcProviderNative(this, 'GitHubOidc', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    const deployRole = new iam.Role(this, 'GitHubDeployRole', {
      roleName: 'wayfinder-github-deploy',
      description: 'Assumed by GitHub Actions to publish and roll out the site',
      maxSessionDuration: Duration.hours(1),
      // Without the subject condition, any GitHub repository could assume this
      // role. Pinning it to one repo's protected environment means only a
      // workflow job running in that environment can deploy.
      assumedBy: new iam.WebIdentityPrincipal(github.oidcProviderArn, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          'token.actions.githubusercontent.com:sub': `${CONFIG.github.subject}:environment:${CONFIG.github.environment}`,
        },
      }),
    });

    this.repository.grantPullPush(deployRole);

    deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'RunCommandsOnTheWebHostOnly',
        actions: ['ssm:SendCommand'],
        resources: [`arn:aws:ec2:${this.region}:${this.account}:instance/*`],
        conditions: {
          StringEquals: {
            [`ssm:resourceTag/${CONFIG.hostTag.key}`]: CONFIG.hostTag.value,
          },
        },
      }),
    );
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'OnlyTheShellScriptDocument',
        actions: ['ssm:SendCommand'],
        resources: [`arn:aws:ssm:${this.region}::document/AWS-RunShellScript`],
      }),
    );
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'FollowTheDeploy',
        // Neither action supports resource-level permissions.
        actions: [
          'ssm:GetCommandInvocation',
          'ssm:ListCommandInvocations',
          'ec2:DescribeInstances',
        ],
        resources: ['*'],
      }),
    );

    Validations.of(deployRole).acknowledge(
      {
        id: 'AwsSolutions::AwsSolutions-IAM5[Resource::*]',
        reason:
          'ecr:GetAuthorizationToken, ssm:GetCommandInvocation, ssm:ListCommandInvocations and ec2:DescribeInstances do not support resource-level permissions.',
      },
      {
        id: `AwsSolutions::AwsSolutions-IAM5[Resource::arn:aws:ec2:${CONFIG.region}:${CONFIG.account}:instance/*]`,
        reason:
          'Narrowed by the ssm:resourceTag condition to instances tagged as the web host, so the host can be replaced without changing this role.',
      },
    );

    // Every alarm in this region notifies here. It lives with the foundation
    // so the email subscription survives a host rebuild. Subscriptions are
    // added from the CLI (see docs/Deployment.md), which keeps the address
    // out of a public repository.
    const alerts = new sns.Topic(this, 'Alerts', {
      topicName: 'wayfinder-alerts',
      displayName: 'wayfinder alerts',
      enforceSSL: true,
    });
    this.alerts = alerts;
    Validations.of(alerts).acknowledge({
      id: 'AwsSolutions::AwsSolutions-SNS2',
      reason:
        'Carries alarm state changes only, nothing sensitive; a customer managed KMS key would cost more than the rest of the alerting.',
    });

    // The expected bill is about US$20 a month. Warn at 80% of the budget
    // actually spent, and as soon as the month is forecast to exceed it, so a
    // runaway resource is caught days in rather than on the invoice.
    alerts.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowBudgetsToPublish',
        principals: [new iam.ServicePrincipal('budgets.amazonaws.com')],
        actions: ['sns:Publish'],
        resources: [alerts.topicArn],
        conditions: { StringEquals: { 'aws:SourceAccount': this.account } },
      }),
    );
    const subscribers = [{ subscriptionType: 'SNS', address: alerts.topicArn }];
    new budgets.CfnBudget(this, 'MonthlyBudget', {
      budget: {
        budgetName: 'wayfinder-monthly',
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: CONFIG.monthlyBudgetUsd, unit: 'USD' },
      },
      notificationsWithSubscribers: [
        {
          notification: {
            notificationType: 'ACTUAL',
            comparisonOperator: 'GREATER_THAN',
            threshold: 80,
            thresholdType: 'PERCENTAGE',
          },
          subscribers,
        },
        {
          notification: {
            notificationType: 'FORECASTED',
            comparisonOperator: 'GREATER_THAN',
            threshold: 100,
            thresholdType: 'PERCENTAGE',
          },
          subscribers,
        },
      ],
    });

    new CfnOutput(this, 'NameServers', {
      description: 'Set these as custom DNS nameservers at Namecheap',
      value: Fn.join(', ', zone.hostedZoneNameServers ?? []),
    });
    new CfnOutput(this, 'PublicIp', { value: eip.attrPublicIp });
    new CfnOutput(this, 'RepositoryUri', {
      value: this.repository.repositoryUri,
    });
    new CfnOutput(this, 'DeployRoleArn', { value: deployRole.roleArn });
    new CfnOutput(this, 'AlertsTopicArn', { value: alerts.topicArn });
  }
}
