#!/usr/bin/env bash
# Usage: restore-database.sh <backup key | latest> <target database>
# Restoring over the live `wayfinder` database means stopping the API first.
set -euo pipefail
: "${BACKUP_BUCKET:?}" "${AWS_REGION:?}"
requested_backup=${1:?backup key or "latest"}
target_database=${2:?target database}

app_directory=${APP_DIRECTORY:-/opt/wayfinder}
download_file=$(mktemp "${DATA_DIRECTORY:-/var/lib/wayfinder}/restore-XXXXXX.dump")
trap 'rm -f "$download_file"' EXIT

if [ "$requested_backup" = latest ]; then
  backup_key=$(aws s3api list-objects-v2 --region "$AWS_REGION" \
    --bucket "$BACKUP_BUCKET" --prefix postgres/ \
    --query 'sort_by(Contents, &Key)[-1].Key' --output text)
else
  backup_key=$requested_backup
fi
echo "Restoring s3://$BACKUP_BUCKET/$backup_key into $target_database"

aws s3 cp "s3://$BACKUP_BUCKET/$backup_key" "$download_file" \
  --region "$AWS_REGION" --only-show-errors
cd "$app_directory"
database_exists=$(docker compose exec -T postgres psql --username wayfinder \
  --dbname postgres --tuples-only --no-align \
  --command "SELECT 1 FROM pg_database WHERE datname = '$target_database'")
if [ "$database_exists" != 1 ]; then
  docker compose exec -T postgres createdb --username wayfinder "$target_database"
fi
docker compose exec -T postgres pg_restore --username wayfinder \
  --dbname "$target_database" --clean --if-exists --no-owner <"$download_file"
echo "Restored $backup_key into $target_database"
