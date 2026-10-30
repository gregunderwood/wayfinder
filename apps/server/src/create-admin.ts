import { parseArgs } from 'node:util';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  AdminAccountError,
  AdminAccountsService,
} from './app/auth/admin-accounts.service';
import { AdminUserEntity } from './app/auth/models';
import { SystemClock } from './app/common/clock';
import { DataCipher, readDataEncryptionKey } from './app/common/data-cipher';
import {
  databaseOptions,
  type EnvLookup,
  readDatabaseConfig,
} from './database';
import { SUCCESS_EXIT_CODE, USAGE_ERROR_EXIT_CODE } from './migrate';

export const CREATE_ADMIN_COMMAND = 'create-admin';

const ACCOUNT_ERROR_EXIT_CODE = 1;
const USAGE = `Usage: ${CREATE_ADMIN_COMMAND} --email <address> [--reset-password] (password on stdin)`;

const logger = new Logger('CreateAdmin');

export type PasswordReader = () => Promise<string>;

interface CreateAdminRequest {
  email: string;
  isPasswordReset: boolean;
}

export async function runCreateAdminCommand(
  commandArguments: string[],
  env: EnvLookup,
  readPassword: PasswordReader,
): Promise<number> {
  const request = parseCreateAdminArguments(commandArguments);
  if (!request) {
    logger.error(USAGE);
    return USAGE_ERROR_EXIT_CODE;
  }

  const cipher = new DataCipher(readDataEncryptionKey(env));
  const password = await readPassword();
  const dataSource = await new DataSource(
    databaseOptions(readDatabaseConfig(env)),
  ).initialize();
  try {
    const adminAccounts = new AdminAccountsService(
      dataSource.getRepository(AdminUserEntity),
      cipher,
      new SystemClock(),
    );
    return await applyRequest(adminAccounts, request, password);
  } finally {
    await dataSource.destroy();
  }
}

function parseCreateAdminArguments(
  commandArguments: string[],
): CreateAdminRequest | null {
  try {
    const { values } = parseArgs({
      args: commandArguments,
      options: {
        email: { type: 'string' },
        'reset-password': { type: 'boolean', default: false },
      },
      strict: true,
    });
    return values.email
      ? { email: values.email, isPasswordReset: values['reset-password'] }
      : null;
  } catch {
    return null;
  }
}

async function applyRequest(
  adminAccounts: AdminAccountsService,
  { email, isPasswordReset }: CreateAdminRequest,
  password: string,
): Promise<number> {
  try {
    if (isPasswordReset) {
      await adminAccounts.resetPassword(email, password);
      logger.log('Password replaced; every session has been signed out.');
    } else {
      await adminAccounts.createAdmin(email, password);
      logger.log('Admin created.');
    }
    return SUCCESS_EXIT_CODE;
  } catch (error: unknown) {
    if (error instanceof AdminAccountError) {
      logger.error(error.message);
      return ACCOUNT_ERROR_EXIT_CODE;
    }
    throw error;
  }
}
