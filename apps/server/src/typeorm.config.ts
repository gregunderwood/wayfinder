import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { databaseOptions, readDatabaseConfig } from './database';

const LOCAL_ENV_FILE = join(__dirname, '../../../.env');
if (existsSync(LOCAL_ENV_FILE)) {
  process.loadEnvFile(LOCAL_ENV_FILE);
}

export default new DataSource({
  ...databaseOptions(
    readDatabaseConfig((name) => process.env[name]),
    {
      allowLongQueries: true,
    },
  ),
  // Timestamped files only: `*` also matches the index.ts barrel, and every
  // migration is then loaded twice.
  migrations: [join(__dirname, 'migrations/[0-9]*.ts')],
});
