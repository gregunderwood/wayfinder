#!/usr/bin/env bash
# Needs IMAGE (registry/repo:sha), SITE_DOMAIN and deploy-role credentials.
set -euo pipefail
: "${IMAGE:?}" "${SITE_DOMAIN:?}"

host_tag='tag:wayfinder:role'
app_dir=/opt/wayfinder

read -r instance public_ip < <(aws ec2 describe-instances \
  --filters "Name=$host_tag,Values=web" Name=instance-state-name,Values=running \
  --query 'Reservations[].Instances[].[InstanceId,PublicIpAddress]' --output text)
[ -n "${instance:-}" ] || { echo "no running web host found"; exit 1; }
echo "Deploying $IMAGE to $instance ($public_ip)"

compose_b64=$(base64 -w0 docker-compose.yml)
caddyfile_b64=$(base64 -w0 Caddyfile)

# A failed rollout restores the previous image, which is still local because
# pruning runs only after success.
remote=$(cat <<SCRIPT
set -euo pipefail
cd $app_dir
previous=\$(sed -n 's/^WEB_IMAGE=//p' .env 2>/dev/null || true)
write_env() { printf 'WEB_IMAGE=%s\nSITE_DOMAIN=%s\n' "\$1" '$SITE_DOMAIN' > .env; }
echo '$compose_b64' | base64 -d > docker-compose.yml
echo '$caddyfile_b64' | base64 -d > Caddyfile
write_env '$IMAGE'
docker compose pull --quiet
if ! docker compose up -d --wait --wait-timeout 120 --remove-orphans; then
  docker compose logs --tail 50 web || true
  if [ -n "\$previous" ] && [ "\$previous" != '$IMAGE' ]; then
    echo "New image never became healthy; rolling back to \$previous"
    write_env "\$previous"
    docker compose up -d --wait --wait-timeout 120 --remove-orphans
  fi
  exit 1
fi
docker image prune -af >/dev/null
docker compose ps --format '{{.Service}}: {{.Status}}'
SCRIPT
)

command_id=$(aws ssm send-command \
  --instance-ids "$instance" \
  --document-name AWS-RunShellScript \
  --comment "deploy ${IMAGE##*:}" \
  --parameters "$(jq -n --arg s "$remote" '{commands: [$s], executionTimeout: ["600"]}')" \
  --query Command.CommandId --output text)

# The built-in waiter gives up after 100 s; a cold image pull takes longer.
for _ in $(seq 1 120); do
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
check() {
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 \
    --resolve "$SITE_DOMAIN:80:$public_ip" --resolve "$SITE_DOMAIN:443:$public_ip" "$2")
  echo "$code $2"
  [ "$code" = "$1" ]
}
check 200 "https://$SITE_DOMAIN/"
check 200 "https://$SITE_DOMAIN/sitemap.xml"
check 404 "https://$SITE_DOMAIN/no-such-page"
check 308 "http://$SITE_DOMAIN/"
