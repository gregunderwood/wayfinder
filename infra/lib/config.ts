/**
 * Everything environment-specific about the deployment, in one place. None of
 * it is secret: account IDs, domains and repo names are identifiers, not
 * credentials.
 */
export const CONFIG = {
  account: '742188596859',
  region: 'ca-central-1',
  domain: 'underwoodstyles.ca',
  /**
   * The only repository, and GitHub environment, allowed to deploy. GitHub
   * issues this repo's OIDC tokens with immutable subjects, which carry the
   * numeric owner and repo IDs: a repo deleted and recreated under the same
   * name gets a new ID and cannot assume the deploy role.
   */
  github: {
    subject: 'repo:gregunderwood@313113/wayfinder@1435180502',
    environment: 'production',
  },
  instanceType: 't4g.small',
  /** Alerts at 80% spent and when the month is forecast to go over. */
  monthlyBudgetUsd: 30,
  /**
   * Deploys find the host by this tag, and the deploy role may only run
   * commands on instances carrying it. That indirection keeps the CI role from
   * referencing the instance directly, so the instance can be replaced without
   * touching the foundation stack.
   */
  hostTag: { key: 'wayfinder:role', value: 'web' },
  /** Where the compose stack lives on the host. */
  appDir: '/opt/wayfinder',
  /**
   * Amazon Linux does not package the Compose plugin, so it is downloaded and
   * checked against the release's published SHA-256 before it is installed.
   */
  compose: {
    version: 'v5.6.1',
    sha256: '42cfa75f51ad0ccf290bad37899e0038a8c10a0069e85233ecc1d53e3ff1347d',
  },
} as const;
