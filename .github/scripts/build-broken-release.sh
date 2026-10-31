#!/usr/bin/env bash
# Usage: build-broken-release.sh <tag>: an API image with one extra migration, ci_rollback_probe,
# that never becomes healthy. Creating that table first makes the migration fail instead.
set -euo pipefail
tag=${1:?image tag}
migrations=apps/server/src/migrations
probe_migration=$migrations/9999999999999-ci-rollback-probe.ts

migration_list_copy=$(mktemp)
cp "$migrations/index.ts" "$migration_list_copy"
trap 'rm -f "$probe_migration"; mv "$migration_list_copy" "$migrations/index.ts"' EXIT
cat >"$probe_migration" <<'TS'
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CiRollbackProbe9999999999999 implements MigrationInterface {
  name = 'CiRollbackProbe9999999999999';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TABLE ci_rollback_probe (id integer)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE ci_rollback_probe');
  }
}
TS
echo "export { CiRollbackProbe9999999999999 } from './9999999999999-ci-rollback-probe';" \
  >>"$migrations/index.ts"

docker build -q -f Dockerfile.server -t "$tag-migrations" . >/dev/null
docker build -q -t "$tag" - >/dev/null <<DOCKERFILE
FROM $tag-migrations
CMD ["node", "-e", "process.exit(1)"]
DOCKERFILE
echo "Built $tag"
