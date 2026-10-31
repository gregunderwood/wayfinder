#!/usr/bin/env bash
# Usage: backup-database.sh [label]: nightly from wayfinder-backup.timer, or labelled before a release.
# Needs BACKUP_BUCKET and AWS_REGION.
set -euo pipefail
: "${BACKUP_BUCKET:?}" "${AWS_REGION:?}"

app_directory=${APP_DIRECTORY:-/opt/wayfinder}
# The timestamp leads, so "latest" in restore-database.sh still sorts by time.
backup_key="postgres/$(date -u +%Y-%m-%dT%H%M%SZ)${1:+-$1}.dump"
# One file per kind, so a release's backup and the nightly one cannot overwrite each other.
staging_kind=${1:+release}
staging_file=${DATA_DIRECTORY:-/var/lib/wayfinder}/backup-in-progress-${staging_kind:-nightly}.dump

cd "$app_directory"
trap 'rm -f "$staging_file"' EXIT

docker compose exec -T postgres \
  pg_dump --username wayfinder --format custom wayfinder >"$staging_file"
# Uploads only a dump that pg_restore can read, so the newest backup is never a truncated one.
docker compose exec -T postgres pg_restore --list <"$staging_file" >/dev/null
aws s3 cp "$staging_file" "s3://$BACKUP_BUCKET/$backup_key" \
  --region "$AWS_REGION" --sse AES256 --only-show-errors

echo "Backed up to s3://$BACKUP_BUCKET/$backup_key ($(stat -c %s "$staging_file") bytes)"
