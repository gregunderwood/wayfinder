import { Duration, Stack, StackProps, Validations } from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { CONFIG } from './config';

const HTTPS_PORT = 443;
const HEALTHY = 1;

export class UptimeStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const siteHealthCheck = this.checkTheSiteLikeAVisitor();
    const uptimeAlerts = this.createUptimeAlertsTopic();
    this.alarmWhenTheSiteIsDown(siteHealthCheck, uptimeAlerts);
  }

  private checkTheSiteLikeAVisitor(): route53.HealthCheck {
    return new route53.HealthCheck(this, 'Site', {
      type: route53.HealthCheckType.HTTPS,
      fqdn: CONFIG.domain,
      port: HTTPS_PORT,
      resourcePath: '/',
      enableSNI: true,
      requestInterval: Duration.seconds(30),
      failureThreshold: 3,
    });
  }

  private createUptimeAlertsTopic(): sns.Topic {
    const uptimeAlerts = new sns.Topic(this, 'Alerts', {
      topicName: 'wayfinder-uptime-alerts',
      displayName: 'wayfinder uptime',
      enforceSSL: true,
    });
    Validations.of(uptimeAlerts).acknowledge({
      id: 'AwsSolutions::AwsSolutions-SNS2',
      reason:
        'Carries alarm state changes only, nothing sensitive; a customer managed KMS key would cost more than the rest of the alerting.',
    });
    return uptimeAlerts;
  }

  private alarmWhenTheSiteIsDown(
    siteHealthCheck: route53.HealthCheck,
    uptimeAlerts: sns.ITopic,
  ): void {
    const siteDownAlarm = new cloudwatch.Alarm(this, 'SiteDown', {
      alarmName: 'wayfinder-site-down',
      alarmDescription: `https://${CONFIG.domain}/ is not answering from most checker regions`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Route53',
        metricName: 'HealthCheckStatus',
        dimensionsMap: { HealthCheckId: siteHealthCheck.healthCheckId },
        statistic: 'Minimum',
        period: Duration.minutes(1),
      }),
      threshold: HEALTHY,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      // Two minutes, so a deploy's few seconds of restart never pages.
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });
    const notifyAlerts = new actions.SnsAction(uptimeAlerts);
    siteDownAlarm.addAlarmAction(notifyAlerts);
    siteDownAlarm.addOkAction(notifyAlerts);
  }
}
