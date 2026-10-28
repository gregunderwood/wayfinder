import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { databaseOptions, readDatabaseConfig } from './database';

// For the TypeORM CLI (`npm run migration:generate`) only. The API reads the
// same file through @nestjs/config.
const envFile = join(__dirname, '../../../.env');
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

/**
 * The CLI discovers migrations by glob because it runs from source, unlike the
 * bundle. Only the timestamped files: a plain `*` also matches the
 * `migrations/index.ts` barrel, and every migration is then seen twice
 * ("Duplicate migrations").
 */
export default new DataSource({
  ...databaseOptions(readDatabaseConfig((name) => process.env[name])),
  migrations: [join(__dirname, 'migrations/[0-9]*.ts')],
});
