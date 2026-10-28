import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import type { TestProject } from 'vitest/node';
import {
  type DatabaseConfig,
  databaseOptions,
  readDatabaseConfig,
} from '../database';
import {
  dropTestDatabase,
  onMaintenanceDatabase,
  quoteTestDatabaseName,
  TEMPLATE_DATABASE,
  TEST_DATABASE_PREFIX,
} from './test-database-server';

declare module 'vitest' {
  export interface ProvidedContext {
    testDatabaseServer: DatabaseConfig;
  }
}

const LOCAL_ENV_FILE = join(__dirname, '../../../../.env');

export default async function setup(
  project: TestProject,
): Promise<() => Promise<void>> {
  const server = readTestDatabaseServer();
  await dropAllTestDatabases(server);
  await createMigratedTemplate(server);
  project.provide('testDatabaseServer', server);
  return () => dropAllTestDatabases(server);
}

function readTestDatabaseServer(): DatabaseConfig {
  if (existsSync(LOCAL_ENV_FILE)) {
    process.loadEnvFile(LOCAL_ENV_FILE);
  }
  return readDatabaseConfig((name) => process.env[name]);
}

async function createMigratedTemplate(server: DatabaseConfig): Promise<void> {
  await onMaintenanceDatabase(server, (maintenance) =>
    maintenance.query(
      `CREATE DATABASE ${quoteTestDatabaseName(TEMPLATE_DATABASE)}`,
    ),
  );
  const template = await new DataSource(
    databaseOptions(
      { ...server, database: TEMPLATE_DATABASE },
      { allowLongQueries: true },
    ),
  ).initialize();
  try {
    await template.runMigrations({ transaction: 'each' });
  } finally {
    await template.destroy();
  }
}

async function dropAllTestDatabases(server: DatabaseConfig): Promise<void> {
  const testDatabases = await onMaintenanceDatabase(
    server,
    (maintenance): Promise<{ datname: string }[]> =>
      maintenance.query(
        'SELECT datname FROM pg_database WHERE starts_with(datname, $1)',
        [TEST_DATABASE_PREFIX],
      ),
  );
  for (const { datname } of testDatabases) {
    await dropTestDatabase(server, datname);
  }
}
