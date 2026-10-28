import { App, Validations } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { CONFIG } from '../lib/config';
import { FoundationStack } from '../lib/foundation-stack';
import { HostStack } from '../lib/host-stack';
import { UptimeStack } from '../lib/uptime-stack';

const app = new App();
const homeEnvironment = { account: CONFIG.account, region: CONFIG.region };

const foundationStack = new FoundationStack(app, 'WayfinderFoundation', {
  env: homeEnvironment,
});
new HostStack(app, 'WayfinderHost', {
  env: homeEnvironment,
  repository: foundationStack.repository,
  elasticIpAllocationId: foundationStack.elasticIpAllocationId,
  alerts: foundationStack.alerts,
});
new UptimeStack(app, 'WayfinderUptime', {
  env: { account: CONFIG.account, region: CONFIG.uptimeRegion },
});

Validations.of(app).addPlugins(new AwsSolutionsChecks(app, { verbose: true }));
