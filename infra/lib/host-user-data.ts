import { CONFIG } from './config';

const COMPOSE_PLUGIN_DIRECTORY = '/usr/local/lib/docker/cli-plugins';
const COMPOSE_PLUGIN_PATH = `${COMPOSE_PLUGIN_DIRECTORY}/docker-compose`;

// Prepares the machine only; the compose files, Caddyfile and images arrive with each deploy.
export function buildHostUserData(dataVolumeId: string): string[] {
  return [
    'set -euxo pipefail',
    ...installDocker(),
    ...installComposePlugin(),
    ...letDockerPullFromEcrWithTheInstanceRole(),
    ...enableAutomaticSecurityUpdates(),
    ...addSwapFile(),
    `mkdir -p ${CONFIG.appDirectory}`,
    ...attachAndMountDataVolume(dataVolumeId),
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

function attachAndMountDataVolume(dataVolumeId: string): string[] {
  // Nitro instances expose EBS as NVMe; the by-id path names the volume whatever its device number.
  const device = `/dev/disk/by-id/nvme-Amazon_Elastic_Block_Store_$(echo ${dataVolumeId} | tr -d -)`;
  return [
    'imds_token=$(curl -sX PUT http://169.254.169.254/latest/api/token -H "X-aws-ec2-metadata-token-ttl-seconds: 300")',
    'instance_id=$(curl -s -H "X-aws-ec2-metadata-token: $imds_token" http://169.254.169.254/latest/meta-data/instance-id)',
    `device=${device}`,
    // The old host releases the volume only when CloudFormation terminates it, after this host is up.
    `for attempt in $(seq 1 180); do aws ec2 attach-volume --region ${CONFIG.region} --volume-id ${dataVolumeId} --instance-id "$instance_id" --device /dev/sdf && break; sleep 10; done`,
    'for attempt in $(seq 1 60); do [ -e "$device" ] && break; sleep 5; done',
    '[ -e "$device" ]',
    // Formats only a blank volume; an existing filesystem is the database.
    'blkid "$device" || mkfs.ext4 -L wayfinder-data "$device"',
    `mkdir -p ${CONFIG.dataDirectory}`,
    `echo 'LABEL=wayfinder-data ${CONFIG.dataDirectory} ext4 defaults,nofail 0 2' >> /etc/fstab`,
    `mount ${CONFIG.dataDirectory}`,
  ];
}
