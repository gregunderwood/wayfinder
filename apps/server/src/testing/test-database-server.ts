import { randomBytes } from 'node:crypto';
import { DataSource } from 'typeorm';
import { type DatabaseConfig, databaseOptions } from '../database';

export const TEST_DATABASE_PREFIX = 'wayfinder_test_';
export const TEMPLATE_DATABASE = `${TEST_DATABASE_PREFIX}template`;
const MAINTENANCE_DATABASE = 'postgres';

export function uniqueTestDatabaseName(): string {
  return `${TEST_DATABASE_PREFIX}${randomBytes(6).toString('hex')}`;
}

export function quoteTestDatabaseName(name: string): string {
  if (!name.startsWith(TEST_DATABASE_PREFIX) || !/^[a-z0-9_]+$/.test(name)) {
    throw new Error(`Refusing to touch non-test database "${name}"`);
  }
  return `"${name}"`;
}

export async function onMaintenanceDatabase<T>(
  server: DatabaseConfig,
  work: (maintenance: DataSource) => Promise<T>,
): Promise<T> {
  const maintenance = await new DataSource(
    databaseOptions(
      { ...server, database: MAINTENANCE_DATABASE },
      { allowLongQueries: true },
    ),
  ).initialize();
  try {
    return await work(maintenance);
  } finally {
    await maintenance.destroy();
  }
}

export function createFromTemplate(
  server: DatabaseConfig,
  name: string,
): Promise<void> {
  return onMaintenanceDatabase(server, async (maintenance) => {
    await maintenance.query(
      `CREATE DATABASE ${quoteTestDatabaseName(name)} TEMPLATE ${quoteTestDatabaseName(TEMPLATE_DATABASE)}`,
    );
  });
}

export function dropTestDatabase(
  server: DatabaseConfig,
  name: string,
): Promise<void> {
  return onMaintenanceDatabase(server, async (maintenance) => {
    await maintenance.query(
      `DROP DATABASE IF EXISTS ${quoteTestDatabaseName(name)} WITH (FORCE)`,
    );
  });
}
