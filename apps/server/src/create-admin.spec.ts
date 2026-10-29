import { Logger } from '@nestjs/common';
import { inject } from 'vitest';
import { AdminUserEntity } from './app/auth/models';
import { verifyPassword } from './app/auth/passwords';
import { CREATE_ADMIN_COMMAND, runCreateAdminCommand } from './create-admin';
import { SUCCESS_EXIT_CODE, USAGE_ERROR_EXIT_CODE } from './migrate';
import { useTestDatabase } from './testing/test-database';
import { TEST_DATA_ENCRYPTION_KEY } from './testing/test-secrets';

const EMAIL = 'owner@example.com';
const PASSWORD = 'correct horse battery staple';
const NEW_PASSWORD = 'a different long passphrase';
const ACCOUNT_ERROR_EXIT_CODE = 1;

describe(CREATE_ADMIN_COMMAND, () => {
  const database = useTestDatabase();

  function testEnv(name: string): string | undefined {
    const server = inject('testDatabaseServer');
    return {
      DATABASE_HOST: server.host,
      DATABASE_PORT: String(server.port),
      DATABASE_USER: server.username,
      DATABASE_PASSWORD: server.password,
      DATABASE_NAME: String(database.dataSource.options.database),
      DATA_ENCRYPTION_KEY: TEST_DATA_ENCRYPTION_KEY.toString('hex'),
    }[name];
  }

  function run(
    commandArguments: string[],
    password = PASSWORD,
  ): Promise<number> {
    return runCreateAdminCommand(commandArguments, testEnv, () =>
      Promise.resolve(password),
    );
  }

  async function storedPasswordHash(): Promise<string> {
    const [admin] = await database.dataSource
      .getRepository(AdminUserEntity)
      .find();
    return admin.passwordHash;
  }

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('creates the admin with the password it was given', async () => {
    expect(await run(['--email', EMAIL])).toBe(SUCCESS_EXIT_CODE);

    expect(await verifyPassword(await storedPasswordHash(), PASSWORD)).toBe(
      true,
    );
  });

  it('refuses to create a second admin', async () => {
    await run(['--email', EMAIL]);

    expect(await run(['--email', 'someone@example.com'])).toBe(
      ACCOUNT_ERROR_EXIT_CODE,
    );
  });

  it('replaces the password with --reset-password', async () => {
    await run(['--email', EMAIL]);

    expect(
      await run(['--email', EMAIL, '--reset-password'], NEW_PASSWORD),
    ).toBe(SUCCESS_EXIT_CODE);
    expect(await verifyPassword(await storedPasswordHash(), NEW_PASSWORD)).toBe(
      true,
    );
  });

  it.each([[[]], [['--email']], [['--email', EMAIL, '--password', 'x']]])(
    'shows usage for %j without asking for a password',
    async (commandArguments) => {
      const readPassword = vi.fn();

      expect(
        await runCreateAdminCommand(commandArguments, testEnv, readPassword),
      ).toBe(USAGE_ERROR_EXIT_CODE);
      expect(readPassword).not.toHaveBeenCalled();
    },
  );
});
