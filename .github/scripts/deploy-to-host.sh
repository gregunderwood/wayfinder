#!/usr/bin/env bash
# Rolls the web host forward to one image over SSM Run Command. The compose
# file and Caddyfile travel with the command, so the host always runs the
# configuration from the same commit as the image.
#
# Needs: IMAGE (registry/repo:sha), SITE_DOMAIN, AWS credentials for the
# deploy role. Exits non-zero if the stack does not come up healthy.
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

# Runs on the host as root. `up --wait` blocks until every container passes
# its healthcheck, so an image that cannot serve fails the deploy loudly. On
# one host there is a brief gap while the web container is swapped; rollback
# is redeploying the previous SHA.
remote=$(cat <<SCRIPT
set -euo pipefail
cd $app_dir
echo '$compose_b64' | base64 -d > docker-compose.yml
echo '$caddyfile_b64' | base64 -d > Caddyfile
printf 'WEB_IMAGE=%s\nSITE_DOMAIN=%s\n' '$IMAGE' '$SITE_DOMAIN' > .env
docker compose pull --quiet
docker compose up -d --wait --wait-timeout 120 --remove-orphans
docker image prune -af >/dev/null
docker compose ps --format '{{.Service}}: {{.Status}}'
code=\$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: $SITE_DOMAIN' http://localhost/)
[ "\$code" = 308 ] || { echo "Caddy returned \$code on :80, expected a 308 to HTTPS"; exit 1; }
SCRIPT
)

command_id=$(aws ssm send-command \
  --instance-ids "$instance" \
  --document-name AWS-RunShellScript \
  --comment "deploy ${IMAGE##*:}" \
  --parameters "$(jq -n --arg s "$remote" '{commands: [$s], executionTimeout: ["600"]}')" \
  --query Command.CommandId --output text)

# The built-in waiter gives up after 100 seconds; a cold image pull can take
# longer, so poll for up to ten minutes.
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

# The same check from outside, through the security group and Elastic IP.
code=$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $SITE_DOMAIN" "http://$public_ip/")
echo "Public :80 returned $code"
[ "$code" = 308 ]
