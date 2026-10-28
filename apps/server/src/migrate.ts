import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  databaseOptions,
  type EnvLookup,
  readDatabaseConfig,
} from './database';

export const MIGRATION_COMMAND_PREFIX = 'migrate:';
export const SUCCESS_EXIT_CODE = 0;
export const USAGE_ERROR_EXIT_CODE = 2;

const logger = new Logger('Migrations');

const MIGRATION_COMMANDS: Record<
  string,
  (dataSource: DataSource) => Promise<void>
> = {
  show: showMigrations,
  run: runPendingMigrations,
  revert: revertLastMigration,
};

export function isMigrationCommand(
  argument: string | undefined,
): argument is string {
  return argument?.startsWith(MIGRATION_COMMAND_PREFIX) ?? false;
}

export async function runMigrationCommand(
  argument: string,
  env: EnvLookup,
): Promise<number> {
  const commandName = argument.slice(MIGRATION_COMMAND_PREFIX.length);
  const command = MIGRATION_COMMANDS[commandName];
  if (!command) {
    logger.error(
      `Unknown command "${argument}"; use ${Object.keys(MIGRATION_COMMANDS)
        .map((name) => MIGRATION_COMMAND_PREFIX + name)
        .join(', ')}`,
    );
    return USAGE_ERROR_EXIT_CODE;
  }

  const dataSource = await connect(env);
  try {
    await command(dataSource);
    return SUCCESS_EXIT_CODE;
  } finally {
    await dataSource.destroy();
  }
}

function connect(env: EnvLookup): Promise<DataSource> {
  return new DataSource({
    ...databaseOptions(readDatabaseConfig(env), { allowLongQueries: true }),
    logging: ['error', 'schema', 'migration'],
  }).initialize();
}

async function showMigrations(dataSource: DataSource): Promise<void> {
  const hasPendingMigrations = await dataSource.showMigrations();
  logger.log(
    hasPendingMigrations
      ? 'Migrations are pending.'
      : 'The schema is up to date.',
  );
}

async function runPendingMigrations(dataSource: DataSource): Promise<void> {
  const appliedMigrations = await dataSource.runMigrations({
    transaction: 'each',
  });
  logger.log(
    appliedMigrations.length === 0
      ? 'No migrations were pending.'
      : `Applied ${appliedMigrations.map((migration) => migration.name).join(', ')}`,
  );
}

async function revertLastMigration(dataSource: DataSource): Promise<void> {
  await dataSource.undoLastMigration({ transaction: 'each' });
}
