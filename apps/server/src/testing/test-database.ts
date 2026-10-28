import { DataSource } from 'typeorm';
import { inject } from 'vitest';
import { databaseOptions } from '../database';
import {
  createFromTemplate,
  dropTestDatabase,
  uniqueTestDatabaseName,
} from './test-database-server';

export interface TestDatabase {
  readonly dataSource: DataSource;
  takeOffline(): Promise<void>;
  bringBackOnline(): Promise<void>;
}

export function useTestDatabase(): TestDatabase {
  const server = inject('testDatabaseServer');
  const name = uniqueTestDatabaseName();
  let dataSource: DataSource | undefined;
  let isOffline = false;

  async function takeOffline(): Promise<void> {
    await dropTestDatabase(server, name);
    isOffline = true;
  }

  async function bringBackOnline(): Promise<void> {
    await createFromTemplate(server, name);
    isOffline = false;
  }

  function requireDataSource(): DataSource {
    if (!dataSource) {
      throw new Error('useTestDatabase() is only usable inside a test');
    }
    return dataSource;
  }

  beforeAll(async () => {
    await createFromTemplate(server, name);
    dataSource = await new DataSource(
      databaseOptions({ ...server, database: name }),
    ).initialize();
  });

  afterEach(async () => {
    if (isOffline) {
      await bringBackOnline();
    }
    await truncateAllTables(requireDataSource());
  });

  afterAll(async () => {
    await dataSource?.destroy();
    await dropTestDatabase(server, name);
  });

  return {
    get dataSource(): DataSource {
      return requireDataSource();
    },
    takeOffline,
    bringBackOnline,
  };
}

async function truncateAllTables(dataSource: DataSource): Promise<void> {
  const tables: { tablename: string }[] = await dataSource.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'migrations'",
  );
  if (tables.length === 0) {
    return;
  }
  const tableList = tables
    .map(({ tablename }) => `"public"."${tablename}"`)
    .join(', ');
  await dataSource.query(`TRUNCATE ${tableList} RESTART IDENTITY CASCADE`);
}
