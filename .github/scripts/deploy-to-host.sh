#!/usr/bin/env bash
# Needs REGISTRY, IMAGE_TAG (a git SHA), SITE_DOMAIN, AWS_REGION, BACKUP_BUCKET,
# ALERTS_TOPIC_ARN and deploy-role credentials.
set -euo pipefail
: "${REGISTRY:?}" "${IMAGE_TAG:?}" "${SITE_DOMAIN:?}" "${AWS_REGION:?}" \
  "${BACKUP_BUCKET:?}" "${ALERTS_TOPIC_ARN:?}"

host_tag='tag:wayfinder:role'
app_directory=/opt/wayfinder
data_directory=/var/lib/wayfinder
secret_parameters=/wayfinder/production

read -r instance public_ip < <(aws ec2 describe-instances \
  --filters "Name=$host_tag,Values=web" Name=instance-state-name,Values=running \
  --query 'Reservations[].Instances[].[InstanceId,PublicIpAddress]' --output text)
[ -n "${instance:-}" ] || { echo "no running web host found"; exit 1; }
echo "Deploying $IMAGE_TAG to $instance ($public_ip)"

release_bundle=$(tar czf - docker-compose.yml docker-compose.production.yml \
  caddy deploy/host | base64 -w0)

# A failed rollout restores the previous tag, whose images are still local
# because pruning runs only after success.
remote=$(cat <<SCRIPT
set -euo pipefail
mountpoint -q $data_directory || { echo "the data volume is not mounted at $data_directory"; exit 1; }
cd $app_directory
previous_tag=\$(sed -n 's/^IMAGE_TAG=//p' .env 2>/dev/null || true)
read_secret() {
  aws ssm get-parameter --region $AWS_REGION --name "$secret_parameters/\$1" \
    --with-decryption --query Parameter.Value --output text
}
database_password=\$(read_secret database-password)
jwt_secret=\$(read_secret jwt-secret)
data_encryption_key=\$(read_secret data-encryption-key)

write_env() {
  (umask 077 && cat > .env <<ENV
COMPOSE_FILE=docker-compose.yml:docker-compose.production.yml
IMAGE_TAG=\$1
WEB_IMAGE=$REGISTRY/wayfinder/web:\$1
API_IMAGE=$REGISTRY/wayfinder/api:\$1
SITE_DOMAIN=$SITE_DOMAIN
DATABASE_PASSWORD=\$database_password
JWT_SECRET=\$jwt_secret
DATA_ENCRYPTION_KEY=\$data_encryption_key
ENV
  )
}

install_backups() {
  mkdir -p /etc/wayfinder
  (umask 077 && printf 'BACKUP_BUCKET=%s\nAWS_REGION=%s\nALERTS_TOPIC_ARN=%s\n' \
    '$BACKUP_BUCKET' '$AWS_REGION' '$ALERTS_TOPIC_ARN' > /etc/wayfinder/backup.env)
  rm -rf host && mv deploy/host host && rm -rf deploy
  cp host/*.service host/*.timer /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable --now wayfinder-backup.timer
}

echo '$release_bundle' | base64 -d | tar xzf -
install_backups
write_env '$IMAGE_TAG'
docker compose pull --quiet
if ! docker compose up -d --wait --wait-timeout 180 --remove-orphans; then
  docker compose logs --tail 50 || true
  if [ -n "\$previous_tag" ] && [ "\$previous_tag" != '$IMAGE_TAG' ]; then
    echo "The new images never became healthy; rolling back to \$previous_tag"
    write_env "\$previous_tag"
    docker compose up -d --wait --wait-timeout 180 --remove-orphans
  fi
  exit 1
fi
# A reload validates the new Caddyfile first and keeps serving the old one if it is invalid.
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
docker image prune -af >/dev/null
docker compose ps --format '{{.Service}}: {{.Status}}'
SCRIPT
)

command_id=$(aws ssm send-command \
  --instance-ids "$instance" \
  --document-name AWS-RunShellScript \
  --comment "deploy $IMAGE_TAG" \
  --parameters "$(jq -n --arg s "$remote" '{commands: [$s], executionTimeout: ["900"]}')" \
  --query Command.CommandId --output text)

# The built-in waiter gives up after 100 s; a cold image pull takes longer.
for _ in $(seq 1 180); do
  status=$(aws ssm get-command-invocation --command-id "$command_id" \
    --instance-id "$instance" --query Status --output text 2>/dev/null || echo Pending)
  case "$status" in
    Pending | InProgress | Delayed) sleep 5 ;;
    *) break ;;
  esac
done

aws ssm get-command-invocation --command-id "$command_id" --instance-id "$instance" \
  --query '[StandardOutputContent, StandardErrorContent]' --output text
echo "SSM status: $status"
[ "$status" = Success ] || exit 1

# --resolve pins the domain to this host, so DNS caches cannot skew the result.
fetch_from_host() {
  curl -s --max-time 15 \
    --resolve "$SITE_DOMAIN:80:$public_ip" --resolve "$SITE_DOMAIN:443:$public_ip" "$@"
}
expect_status() {
  code=$(fetch_from_host -o /dev/null -w '%{http_code}' "$2")
  echo "$code $2"
  [ "$code" = "$1" ]
}
expect_status 200 "https://$SITE_DOMAIN/"
expect_status 200 "https://$SITE_DOMAIN/sitemap.xml"
expect_status 404 "https://$SITE_DOMAIN/no-such-page"
expect_status 308 "http://$SITE_DOMAIN/"
fetch_from_host -o /dev/null -D - "https://$SITE_DOMAIN/admin/login" |
  grep -qi '^x-robots-tag: noindex' || { echo "/admin is missing X-Robots-Tag"; exit 1; }
fetch_from_host "https://$SITE_DOMAIN/api/health" | tee /dev/stderr |
  jq -e '.databaseReachable' >/dev/null
