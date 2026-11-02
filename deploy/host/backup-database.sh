#!/usr/bin/env bash
# Usage: backup-database.sh [label]: nightly from wayfinder-backup.timer, or labelled before a release.
# Needs BACKUP_BUCKET and AWS_REGION.
set -euo pipefail
: "${BACKUP_BUCKET:?}" "${AWS_REGION:?}"

app_directory=${APP_DIRECTORY:-/opt/wayfinder}
# The timestamp leads, so "latest" in restore-database.sh still sorts by time.
backup_key="postgres/$(date -u +%Y-%m-%dT%H%M%SZ)${1:+-$1}.dump"
data_directory=${DATA_DIRECTORY:-/var/lib/wayfinder}
staging_file=$data_directory/backup-in-progress.dump

# Backups take turns, so one fixed staging file serves them all and an interrupted one cannot pile up.
exec {backup_lock}>"$data_directory/backup.lock"
flock "$backup_lock"

cd "$app_directory"
trap 'rm -f "$staging_file"' EXIT

docker compose exec -T postgres \
  pg_dump --username wayfinder --format custom wayfinder >"$staging_file"
# Uploads only a dump that pg_restore can read, so the newest backup is never a truncated one.
docker compose exec -T postgres pg_restore --list <"$staging_file" >/dev/null
aws s3 cp "$staging_file" "s3://$BACKUP_BUCKET/$backup_key" \
  --region "$AWS_REGION" --sse AES256 --only-show-errors

echo "Backed up to s3://$BACKUP_BUCKET/$backup_key ($(stat -c %s "$staging_file") bytes)"
