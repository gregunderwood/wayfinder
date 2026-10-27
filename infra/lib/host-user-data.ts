import { CONFIG } from './config';

/**
 * First-boot setup for the web host: Docker, the Compose plugin, ECR login and
 * unattended security updates. It prepares the machine only; the compose file,
 * Caddyfile and image arrive with each deploy, so a deploy never depends on
 * what happened to be baked in at launch.
 */
export function hostUserData(): string[] {
  const { appDir, compose } = CONFIG;
  const pluginDir = '/usr/local/lib/docker/cli-plugins';

  return [
    'set -euxo pipefail',

    'dnf install -y docker amazon-ecr-credential-helper dnf-automatic',
    'systemctl enable --now docker',

    `mkdir -p ${pluginDir}`,
    `curl -fsSL -o ${pluginDir}/docker-compose https://github.com/docker/compose/releases/download/${compose.version}/docker-compose-linux-aarch64`,
    `echo "${compose.sha256}  ${pluginDir}/docker-compose" | sha256sum -c -`,
    `chmod 0755 ${pluginDir}/docker-compose`,

    // Deploys run as root through SSM; the credential helper lets Docker pull
    // from ECR with the instance role, so no registry password exists anywhere.
    'mkdir -p /root/.docker',
    `echo '{"credsStore":"ecr-login"}' > /root/.docker/config.json`,

    // Security patches only, applied automatically. Feature updates stay a
    // deliberate act.
    "sed -i 's/^upgrade_type.*/upgrade_type = security/; s/^apply_updates.*/apply_updates = yes/' /etc/dnf/automatic.conf",
    'systemctl enable --now dnf-automatic.timer',

    // 1 GB of swap so a build-time or traffic spike slows the box down instead
    // of waking the OOM killer.
    'fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile',
    "echo '/swapfile none swap sw 0 0' >> /etc/fstab",

    // The deploy writes .env alongside the compose file, so settings such as
    // the ACME contact address stay out of the repository.
    `mkdir -p ${appDir}`,
  ];
}
