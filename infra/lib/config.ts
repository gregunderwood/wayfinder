// Identifiers, not credentials: nothing here is secret.
export const CONFIG = {
  account: '742188596859',
  region: 'ca-central-1',
  // The data volume and the host must share one zone; an EBS volume cannot attach across zones.
  availabilityZone: 'ca-central-1a',
  // Route 53 publishes health check metrics only here, and an alarm can notify only a topic in its own region.
  uptimeRegion: 'us-east-1',
  domain: 'underwoodstyles.ca',
  github: {
    // Immutable OIDC subject with numeric owner and repo IDs, so a recreated repo of the same name cannot deploy.
    subject: 'repo:gregunderwood@313113/wayfinder@1435180502',
    environment: 'production',
  },
  instanceType: 't4g.small',
  monthlyBudgetUsd: 30,
  // The deploy role finds the host by tag rather than by ID, so the instance can be replaced without touching the foundation stack.
  hostTag: { key: 'wayfinder:role', value: 'web' },
  appDirectory: '/opt/wayfinder',
  dataDirectory: '/var/lib/wayfinder',
  dataVolumeGib: 10,
  databasePasswordParameter: '/wayfinder/production/database-password',
  backupBucketName: 'wayfinder-backups-742188596859',
  backupRetentionDays: 30,
  // Amazon Linux does not package the Compose plugin, so the release binary is downloaded and verified.
  compose: {
    version: 'v5.6.1',
    sha256: '42cfa75f51ad0ccf290bad37899e0038a8c10a0069e85233ecc1d53e3ff1347d',
  },
} as const;
