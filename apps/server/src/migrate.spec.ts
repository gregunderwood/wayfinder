import { Logger } from '@nestjs/common';
import { inject } from 'vitest';
import {
  isMigrationCommand,
  runMigrationCommand,
  SUCCESS_EXIT_CODE,
  USAGE_ERROR_EXIT_CODE,
} from './migrate';
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
});
