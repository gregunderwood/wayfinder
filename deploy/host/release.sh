#!/usr/bin/env bash
# Usage: release.sh <backup label> [<previous web image> <previous api image>]
# Run from the compose project directory, with WEB_IMAGE and API_IMAGE naming the new release.
# Needs BACKUP_BUCKET and AWS_REGION, for the backup taken before migrating.
set -euo pipefail
backup_label=${1:?backup label}
previous_web_image=${2:-}
previous_api_image=${3:-}

host_directory=$(dirname "$(readlink -f "$0")")
healthy_timeout_seconds=180

main() {
  docker compose up -d --no-recreate --wait postgres
  "$host_directory/backup-database.sh" "$backup_label"

  local migrations_before
  migrations_before=$(count_applied_migrations)
  # Each migration commits on its own, so a failure can leave earlier ones from this run applied.
  if ! run_in_new_api migrate:run; then
    echo "A migration failed; the current release keeps serving."
    revert_migrations_since "$migrations_before"
    exit 1
  fi

  if ! docker compose up -d --wait --wait-timeout "$healthy_timeout_seconds" --remove-orphans; then
    docker compose logs --tail 50 || true
    echo "The new release never became healthy."
    revert_migrations_since "$migrations_before"
    restore_previous_images
    exit 1
  fi
}

# Only the new image knows the `down` of the migrations it brought, so it reverts them.
revert_migrations_since() {
  local migrations_to_revert reverted_migrations
  migrations_to_revert=$(($(count_applied_migrations) - $1))
  [ "$migrations_to_revert" -gt 0 ] || return 0
  reverted_migrations=$(newest_migrations "$migrations_to_revert")
  for _ in $(seq 1 "$migrations_to_revert"); do
    if ! run_in_new_api migrate:revert; then
      echo "Reverting failed. The restore point is the backup labelled $backup_label."
      return
    fi
  done
  echo "Rolled back: reverted migrations [${reverted_migrations//$'\n'/, }]"
}

restore_previous_images() {
  if [ -n "$previous_web_image" ]; then
    WEB_IMAGE=$previous_web_image API_IMAGE=$previous_api_image \
      docker compose up -d --wait --wait-timeout "$healthy_timeout_seconds" --remove-orphans
    echo "Rolled back: restored $previous_web_image and $previous_api_image"
  fi
}

run_in_new_api() {
  docker compose run --rm --no-deps -T api node main.js "$@"
}

count_applied_migrations() {
  if [ -z "$(query_database "SELECT to_regclass('public.migrations')")" ]; then
    echo 0
  else
    query_database 'SELECT count(*) FROM migrations'
  fi
}

newest_migrations() {
  query_database "SELECT name FROM migrations ORDER BY id DESC LIMIT $1"
}

query_database() {
  docker compose exec -T postgres psql --username wayfinder --dbname wayfinder \
    --tuples-only --no-align --command "$1"
}

main
