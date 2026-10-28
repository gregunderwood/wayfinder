import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app/app.module';
import { isMigrationCommand, runMigrationCommand } from './migrate';

const DEFAULT_PORT = 3000;
const FAILURE_EXIT_CODE = 1;

async function serveApi(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  app.disable('x-powered-by');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();

  const port = Number(process.env['PORT'] ?? DEFAULT_PORT);
  await app.listen(port);
  Logger.log(`API listening on http://localhost:${port}/api`, 'Bootstrap');
}

async function runFromCommandLine(): Promise<void> {
  const [, , command] = process.argv;
  if (!isMigrationCommand(command)) {
    return serveApi();
  }
  try {
    process.exit(
      await runMigrationCommand(command, (name) => process.env[name]),
    );
  } catch (error: unknown) {
    Logger.error(`Migration failed: ${String(error)}`, 'Migrations');
    process.exit(FAILURE_EXIT_CODE);
  }
}

void runFromCommandLine();
