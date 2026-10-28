import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  databaseOptions,
  type EnvLookup,
  readDatabaseConfig,
} from './database';

const logger = new Logger('Migrations');

/**
 * `node main.js migrate:show|run|revert`, run inside the shipped image.
 *
 * The TypeORM CLI needs ts-node and the TypeScript source, which the runtime
 * image deliberately does not carry. This uses the DataSource already in the
 * bundle instead. It never runs on its own: a deploy restarts containers, and a
 * schema change is a separate, deliberate command with `show` read first.
 */
export async function runMigrationCommand(
  command: string,
  env: EnvLookup,
): Promise<number> {
  if (!['show', 'run', 'revert'].includes(command)) {
    logger.error(`Unknown migration command "${command}"; use show|run|revert`);
    return 2;
  }
  const source = await new DataSource({
    ...databaseOptions(readDatabaseConfig(env)),
    logging: ['error', 'schema', 'migration'],
  }).initialize();
  try {
    if (command === 'show') {
      // Logs every migration and whether it has been applied; resolves true
      // when any are pending.
      const pending = await source.showMigrations();
      logger.log(
        pending ? 'Migrations are pending.' : 'The schema is up to date.',
      );
    } else if (command === 'run') {
      const applied = await source.runMigrations({ transaction: 'each' });
      logger.log(
        applied.length === 0
          ? 'No migrations were pending.'
          : `Applied ${applied.map((m) => m.name).join(', ')}`,
      );
    } else {
      await source.undoLastMigration({ transaction: 'each' });
    }
    return 0;
  } finally {
    await source.destroy();
  }
}
