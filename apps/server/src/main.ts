import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app/app.module';
import { runMigrationCommand } from './migrate';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  // Advertising the framework only helps someone matching it against a CVE list.
  app.disable('x-powered-by');

  // Without this pipe, class-validator decorators on a DTO are decorative.
  // `forbidNonWhitelisted` rejects unknown keys rather than silently dropping
  // them, so a client sending a misspelt field finds out.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Closes the Postgres pool on SIGTERM, so a deploy does not leave the
  // database holding connections from a container that no longer exists.
  app.enableShutdownHooks();

  // The dev proxy (apps/web/proxy.conf.json) and the Caddyfile both expect 3000.
  const port = Number(process.env['PORT'] ?? 3000);
  await app.listen(port);
  Logger.log(`API listening on http://localhost:${port}/api`, 'Bootstrap');
}

const [, , command] = process.argv;
if (command?.startsWith('migrate:')) {
  void runMigrationCommand(
    command.slice('migrate:'.length),
    (name) => process.env[name],
  )
    .then((code) => process.exit(code))
    .catch((err: unknown) => {
      Logger.error(`Migration failed: ${String(err)}`, 'Migrations');
      process.exit(1);
    });
} else {
  void bootstrap();
}
