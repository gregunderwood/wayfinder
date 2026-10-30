import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app/app.module';
import { configureApp } from './app/configure-app';
import { CREATE_ADMIN_COMMAND, runCreateAdminCommand } from './create-admin';
import type { EnvLookup } from './database';
import {
  isMigrationCommand,
  MIGRATION_COMMAND_PREFIX,
  runMigrationCommand,
  USAGE_ERROR_EXIT_CODE,
} from './migrate';
import { readPasswordFromStdin } from './read-password';

const DEFAULT_PORT = 3000;
const FAILURE_EXIT_CODE = 1;

async function serveApi(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  app.enableShutdownHooks();

  const port = Number(process.env['PORT'] ?? DEFAULT_PORT);
  await app.listen(port);
  Logger.log(`API listening on http://localhost:${port}/api`, 'Bootstrap');
}

async function runFromCommandLine(): Promise<void> {
  const [, , command, ...commandArguments] = process.argv;
  if (command === undefined) {
    return serveApi();
  }
  try {
    process.exit(await runCommand(command, commandArguments));
  } catch (error: unknown) {
    Logger.error(`${command} failed: ${String(error)}`, 'Command');
    process.exit(FAILURE_EXIT_CODE);
  }
}

function runCommand(
  command: string,
  commandArguments: string[],
): Promise<number> {
  const env: EnvLookup = (name) => process.env[name];
  if (command === CREATE_ADMIN_COMMAND) {
    return runCreateAdminCommand(commandArguments, env, readPasswordFromStdin);
  }
  if (isMigrationCommand(command)) {
    return runMigrationCommand(command, env);
  }
  Logger.error(
    `Unknown command "${command}"; use ${CREATE_ADMIN_COMMAND} or ${MIGRATION_COMMAND_PREFIX}show|run|revert`,
    'Command',
  );
  return Promise.resolve(USAGE_ERROR_EXIT_CODE);
}

void runFromCommandLine();
