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

const WEB_RECORD_TTL = Duration.minutes(5);
const IMAGES_KEPT = 20;
const GITHUB_OIDC_ISSUER = 'token.actions.githubusercontent.com';
const STS_AUDIENCE = 'sts.amazonaws.com';
const ACTUAL_SPEND_ALERT_PERCENT = 80;
const FORECAST_SPEND_ALERT_PERCENT = 100;

export class FoundationStack extends Stack {
  readonly repository: ecr.IRepository;
  readonly elasticIpAllocationId: string;
  readonly alerts: sns.ITopic;

  constructor(scope: Construct, id: string, props: StackProps) {
    // Recreating the zone changes its nameservers at the registrar, and recreating the IP breaks DNS.
    super(scope, id, { ...props, terminationProtection: true });

    const zone = new route53.PublicHostedZone(this, 'Zone', {
      zoneName: CONFIG.domain,
    });
    const elasticIp = this.createElasticIp();
    this.elasticIpAllocationId = elasticIp.attrAllocationId;
    this.pointDomainAt(zone, elasticIp);
    this.allowOnlyLetsEncryptCertificates(zone);

    this.repository = this.createImageRepository();
    const deployRole = this.createGitHubDeployRole(this.repository);

    const alerts = this.createAlertsTopic();
    this.alerts = alerts;
    this.addMonthlyBudget(alerts);

    this.addOutputs(zone, elasticIp, deployRole, alerts);
  }

  private createElasticIp(): ec2.CfnEIP {
    const elasticIp = new ec2.CfnEIP(this, 'WebIp', {
      domain: 'vpc',
      tags: [{ key: 'Name', value: 'wayfinder-web' }],
    });
    elasticIp.applyRemovalPolicy(RemovalPolicy.RETAIN);
    return elasticIp;
  }

  private pointDomainAt(
    zone: route53.IHostedZone,
    elasticIp: ec2.CfnEIP,
  ): void {
    const target = route53.RecordTarget.fromIpAddresses(elasticIp.attrPublicIp);
    new route53.ARecord(this, 'Apex', { zone, target, ttl: WEB_RECORD_TTL });
    new route53.ARecord(this, 'Www', {
      zone,
      recordName: 'www',
      target,
      ttl: WEB_RECORD_TTL,
    });
  }

  private allowOnlyLetsEncryptCertificates(zone: route53.IHostedZone): void {
    new route53.CaaRecord(this, 'Caa', {
      zone,
      values: [
        { flag: 0, tag: route53.CaaTag.ISSUE, value: 'letsencrypt.org' },
        // ';' is the CAA way of saying no CA may issue wildcard certificates.
        { flag: 0, tag: route53.CaaTag.ISSUEWILD, value: ';' },
      ],
    });
  }

  private createImageRepository(): ecr.Repository {
    return new ecr.Repository(this, 'WebRepository', {
      repositoryName: 'wayfinder/web',
      // Tags are git SHAs; rollback by SHA relies on a tag never moving.
      imageTagMutability: ecr.TagMutability.IMMUTABLE,
      imageScanOnPush: true,
      lifecycleRules: [
        { description: 'Keep the last 20 images', maxImageCount: IMAGES_KEPT },
      ],
      removalPolicy: RemovalPolicy.RETAIN,
    });
  }

  private createGitHubDeployRole(repository: ecr.IRepository): iam.Role {
    const githubOidcProvider = new iam.OidcProviderNative(this, 'GitHubOidc', {
      url: `https://${GITHUB_OIDC_ISSUER}`,
      clientIds: [STS_AUDIENCE],
    });

    const deployRole = new iam.Role(this, 'GitHubDeployRole', {
      roleName: 'wayfinder-github-deploy',
      description: 'Assumed by GitHub Actions to publish and roll out the site',
      maxSessionDuration: Duration.hours(1),
      // Without the subject condition, any GitHub repository could assume this role.
      assumedBy: new iam.WebIdentityPrincipal(
        githubOidcProvider.oidcProviderArn,
        {
          StringEquals: {
            [`${GITHUB_OIDC_ISSUER}:aud`]: STS_AUDIENCE,
            [`${GITHUB_OIDC_ISSUER}:sub`]: `${CONFIG.github.subject}:environment:${CONFIG.github.environment}`,
          },
        },
      ),
    });

    repository.grantPullPush(deployRole);
    // A deploy skips the build when the SHA is already pushed; pushing an immutable tag again fails.
    repository.grant(deployRole, 'ecr:DescribeImages');
    this.allowRunningCommandsOnTheWebHost(deployRole);
    this.acknowledgeDeployRoleWildcards(deployRole);
    return deployRole;
  }

  private allowRunningCommandsOnTheWebHost(deployRole: iam.Role): void {
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
        // None of these actions support resource-level permissions.
        actions: [
          'ssm:GetCommandInvocation',
          'ssm:ListCommandInvocations',
          'ec2:DescribeInstances',
        ],
        resources: ['*'],
      }),
    );
  }

  private acknowledgeDeployRoleWildcards(deployRole: iam.Role): void {
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
  }

  private createAlertsTopic(): sns.Topic {
    // Subscribed from the CLI (docs/Deployment.md) so the email address stays out of the public repository.
    const alerts = new sns.Topic(this, 'Alerts', {
      topicName: 'wayfinder-alerts',
      displayName: 'wayfinder alerts',
      enforceSSL: true,
    });
    Validations.of(alerts).acknowledge({
      id: 'AwsSolutions::AwsSolutions-SNS2',
      reason:
        'Carries alarm state changes only, nothing sensitive; a customer managed KMS key would cost more than the rest of the alerting.',
    });
    return alerts;
  }

  private addMonthlyBudget(alerts: sns.Topic): void {
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
            threshold: ACTUAL_SPEND_ALERT_PERCENT,
            thresholdType: 'PERCENTAGE',
          },
          subscribers,
        },
        {
          notification: {
            notificationType: 'FORECASTED',
            comparisonOperator: 'GREATER_THAN',
            threshold: FORECAST_SPEND_ALERT_PERCENT,
            thresholdType: 'PERCENTAGE',
          },
          subscribers,
        },
      ],
    });
  }

  private addOutputs(
    zone: route53.PublicHostedZone,
    elasticIp: ec2.CfnEIP,
    deployRole: iam.Role,
    alerts: sns.Topic,
  ): void {
    new CfnOutput(this, 'NameServers', {
      description: 'Set these as custom DNS nameservers at Namecheap',
      value: Fn.join(', ', zone.hostedZoneNameServers ?? []),
    });
    new CfnOutput(this, 'PublicIp', { value: elasticIp.attrPublicIp });
    new CfnOutput(this, 'RepositoryUri', {
      value: this.repository.repositoryUri,
    });
    new CfnOutput(this, 'DeployRoleArn', { value: deployRole.roleArn });
    new CfnOutput(this, 'AlertsTopicArn', { value: alerts.topicArn });
  }
}
