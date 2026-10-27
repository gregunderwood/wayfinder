import { Duration, Stack, StackProps, Validations } from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { CONFIG } from './config';

/**
 * Checks the site the way a visitor reaches it — DNS, TLS, Caddy and the app —
 * from several AWS regions, and emails when it stops answering. The host's own
 * alarms cannot see a wedged container or an expired certificate; this can.
 *
 * Deployed to us-east-1 because Route 53 publishes health check metrics only
 * there, and an alarm can notify only a topic in its own region.
 */
export class UptimeStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const check = new route53.HealthCheck(this, 'Site', {
      type: route53.HealthCheckType.HTTPS,
      fqdn: CONFIG.domain,
      port: 443,
      resourcePath: '/',
      enableSNI: true,
      requestInterval: Duration.seconds(30),
      failureThreshold: 3,
    });

    const alerts = new sns.Topic(this, 'Alerts', {
      topicName: 'wayfinder-uptime-alerts',
      displayName: 'wayfinder uptime',
      enforceSSL: true,
    });
    Validations.of(alerts).acknowledge({
      id: 'AwsSolutions::AwsSolutions-SNS2',
      reason:
        'Carries alarm state changes only, nothing sensitive; a customer managed KMS key would cost more than the rest of the alerting.',
    });

    const down = new cloudwatch.Alarm(this, 'SiteDown', {
      alarmName: 'wayfinder-site-down',
      alarmDescription: `https://${CONFIG.domain}/ is not answering from most checker regions`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Route53',
        metricName: 'HealthCheckStatus',
        dimensionsMap: { HealthCheckId: check.healthCheckId },
        statistic: 'Minimum',
        period: Duration.minutes(1),
      }),
      threshold: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      // Two minutes down, so a deploy's few seconds of restart never pages.
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });
    const notify = new actions.SnsAction(alerts);
    down.addAlarmAction(notify);
    down.addOkAction(notify);
  }
}
