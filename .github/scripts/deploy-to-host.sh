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
# its healthcheck. If the new image never gets healthy, the host goes back to
# the image it was running, so a bad build costs a failed pipeline rather
# than the site; the previous image is still local because pruning only runs
# after a successful rollout.
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

# The same checks a visitor would make, from outside, over the real
# certificate. --resolve pins the domain to this host's IP so the result
# does not depend on DNS caches.
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
