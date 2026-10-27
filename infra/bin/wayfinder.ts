import { App, Validations } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { CONFIG } from '../lib/config';
import { FoundationStack } from '../lib/foundation-stack';
import { HostStack } from '../lib/host-stack';

const app = new App();
const env = { account: CONFIG.account, region: CONFIG.region };

const foundation = new FoundationStack(app, 'WayfinderFoundation', { env });
new HostStack(app, 'WayfinderHost', {
  env,
  repository: foundation.repository,
  eipAllocationId: foundation.eipAllocationId,
});

// Every synth is checked against the AWS Solutions rules; anything accepted
// deliberately is acknowledged next to the resource, with its reason.
Validations.of(app).addPlugins(new AwsSolutionsChecks(app, { verbose: true }));
