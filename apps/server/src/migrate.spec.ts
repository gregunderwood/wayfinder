import { Logger } from '@nestjs/common';
import { inject } from 'vitest';
import {
  isMigrationCommand,
  runMigrationCommand,
  SUCCESS_EXIT_CODE,
  USAGE_ERROR_EXIT_CODE,
} from './migrate';
import * as migrations from './migrations';
import { useTestDatabase } from './testing/test-database';

describe('migration commands', () => {
  const database = useTestDatabase();

  function testDatabaseEnv(name: string): string | undefined {
    const server = inject('testDatabaseServer');
    return {
      DATABASE_HOST: server.host,
      DATABASE_PORT: String(server.port),
      DATABASE_USER: server.username,
      DATABASE_PASSWORD: server.password,
      DATABASE_NAME: String(database.dataSource.options.database),
    }[name];
  }

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('recognises only the migrate: prefix', () => {
    expect(isMigrationCommand('migrate:run')).toBe(true);
    expect(isMigrationCommand('serve')).toBe(false);
    expect(isMigrationCommand(undefined)).toBe(false);
  });

  it('refuses an unknown command without connecting', async () => {
    const exitCode = await runMigrationCommand('migrate:bogus', () => {
      throw new Error('should not read the environment');
    });
    expect(exitCode).toBe(USAGE_ERROR_EXIT_CODE);
  });

  it.each(['migrate:show', 'migrate:run'])(
    'runs %s against a real database',
    async (command) => {
      expect(await runMigrationCommand(command, testDatabaseEnv)).toBe(
        SUCCESS_EXIT_CODE,
      );
    },
  );

  it('seeds today’s projects as published, and takes only them back out', async () => {
    const SEEDED_SLUGS = ['gateway', 'lvcc', 'tempestas', 'wayfinder'];
    const projects = (): Promise<{ slug: string; status: string }[]> =>
      database.dataSource.query(
        'SELECT slug, status FROM projects ORDER BY sort_order, slug',
      );
    const runCommand = (command: string): Promise<number> =>
      runMigrationCommand(command, testDatabaseEnv);
    // Every test starts on emptied tables, so the seed is taken out and put back first.
    expect(await runCommand('migrate:revert')).toBe(SUCCESS_EXIT_CODE);
    expect(await runCommand('migrate:run')).toBe(SUCCESS_EXIT_CODE);

    expect(await projects()).toEqual(
      SEEDED_SLUGS.map((slug) => ({ slug, status: 'published' })),
    );

    await database.dataSource.query(
      "INSERT INTO projects (slug, name, tagline, kind, role, period, body_markdown, sort_order) VALUES ('written-later', 'Later', 'Later.', 'personal', 'Sole developer', '2027', 'Later.', 9)",
    );
    expect(await runCommand('migrate:revert')).toBe(SUCCESS_EXIT_CODE);
    expect(await projects()).toEqual([
      { slug: 'written-later', status: 'draft' },
    ]);
    expect(await runCommand('migrate:run')).toBe(SUCCESS_EXIT_CODE);
  });

  it('reverts every migration and applies them all again', async () => {
    const tableNames = async (): Promise<string[]> =>
      (
        await database.dataSource.query<{ tablename: string }[]>(
          "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'migrations' ORDER BY tablename",
        )
      ).map(({ tablename }) => tablename);
    const tablesWhenMigrated = await tableNames();

    const migrationCount = Object.values(migrations).length;
    for (let reverted = 0; reverted < migrationCount; reverted++) {
      expect(await runMigrationCommand('migrate:revert', testDatabaseEnv)).toBe(
        SUCCESS_EXIT_CODE,
      );
    }
    expect(await tableNames()).toEqual([]);

    expect(await runMigrationCommand('migrate:run', testDatabaseEnv)).toBe(
      SUCCESS_EXIT_CODE,
    );
    expect(await tableNames()).toEqual(tablesWhenMigrated);
  });
});
