#!/usr/bin/env bash
# Usage: build-broken-release.sh <tag>: an API image that never becomes healthy, with two extra migrations.
set -euo pipefail
tag=${1:?image tag}
migrations=apps/server/src/migrations

migration_list_copy=$(mktemp)
cp "$migrations/index.ts" "$migration_list_copy"
trap 'rm -f "$migrations"/999999999999?-ci-*.ts; mv "$migration_list_copy" "$migrations/index.ts"' EXIT

add_probe_migration() {
  local class_name=$1 file_name=$2 table=$3
  cat >"$migrations/$file_name.ts" <<TS
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class $class_name implements MigrationInterface {
  name = '$class_name';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TABLE $table (id integer)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE $table');
  }
}
TS
  echo "export { $class_name } from './$file_name';" >>"$migrations/index.ts"
}

add_probe_migration CiEarlierProbe9999999999998 9999999999998-ci-earlier-probe ci_earlier_probe
# Creating ci_rollback_probe before releasing makes this one fail after the earlier one applied.
add_probe_migration CiRollbackProbe9999999999999 9999999999999-ci-rollback-probe ci_rollback_probe

docker build -q -f Dockerfile.server -t "$tag-migrations" . >/dev/null
docker build -q -t "$tag" - >/dev/null <<DOCKERFILE
FROM $tag-migrations
CMD ["node", "-e", "process.exit(1)"]
DOCKERFILE
echo "Built $tag"
