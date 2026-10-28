import { CONFIG } from './config';

const COMPOSE_PLUGIN_DIRECTORY = '/usr/local/lib/docker/cli-plugins';
const COMPOSE_PLUGIN_PATH = `${COMPOSE_PLUGIN_DIRECTORY}/docker-compose`;

// Prepares the machine only; the compose file, Caddyfile and image arrive with each deploy.
export function buildHostUserData(): string[] {
  return [
    'set -euxo pipefail',
    ...installDocker(),
    ...installComposePlugin(),
    ...letDockerPullFromEcrWithTheInstanceRole(),
    ...enableAutomaticSecurityUpdates(),
    ...addSwapFile(),
    `mkdir -p ${CONFIG.appDirectory}`,
  ];
}

function installDocker(): string[] {
  return [
    'dnf install -y docker amazon-ecr-credential-helper dnf-automatic',
    'systemctl enable --now docker',
  ];
}

function installComposePlugin(): string[] {
  const { version, sha256 } = CONFIG.compose;
  return [
    `mkdir -p ${COMPOSE_PLUGIN_DIRECTORY}`,
    `curl -fsSL -o ${COMPOSE_PLUGIN_PATH} https://github.com/docker/compose/releases/download/${version}/docker-compose-linux-aarch64`,
    `echo "${sha256}  ${COMPOSE_PLUGIN_PATH}" | sha256sum -c -`,
    `chmod 0755 ${COMPOSE_PLUGIN_PATH}`,
  ];
}

function letDockerPullFromEcrWithTheInstanceRole(): string[] {
  // Deploys run as root through SSM, so root's Docker config is the one that matters.
  return [
    'mkdir -p /root/.docker',
    `echo '{"credsStore":"ecr-login"}' > /root/.docker/config.json`,
  ];
}

function enableAutomaticSecurityUpdates(): string[] {
  return [
    "sed -i 's/^upgrade_type.*/upgrade_type = security/; s/^apply_updates.*/apply_updates = yes/' /etc/dnf/automatic.conf",
    'systemctl enable --now dnf-automatic.timer',
  ];
}

function addSwapFile(): string[] {
  return [
    'fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile',
    "echo '/swapfile none swap sw 0 0' >> /etc/fstab",
  ];
}
