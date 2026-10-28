import * as pg from 'pg';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import * as migrations from './migrations';

/** Reads one variable by name: `process.env`, a `ConfigService`, or a test map. */
export type EnvLookup = (name: string) => string | undefined;

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

/**
 * The connection settings, read the same way by the running API, the migration
 * runner bundled into it, and the TypeORM CLI, so the three cannot drift.
 *
 * The password has no default. A fallback would let a production container
 * that lost its secret start against a database with a guessable password
 * instead of refusing to boot.
 */
export function readDatabaseConfig(env: EnvLookup): DatabaseConfig {
  const password = env('DATABASE_PASSWORD');
  if (!password) {
    throw new Error('DATABASE_PASSWORD is not set; see .env.example');
  }
  const port = Number(env('DATABASE_PORT') ?? 5432);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(
      `DATABASE_PORT must be a port number, got "${env('DATABASE_PORT')}"`,
    );
  }
  return {
    host: env('DATABASE_HOST') ?? '127.0.0.1',
    port,
    username: env('DATABASE_USER') ?? 'wayfinder',
    password,
    database: env('DATABASE_NAME') ?? 'wayfinder',
  };
}

/**
 * Every entity, listed rather than globbed: a webpack bundle has no directory
 * to scan, so a glob finds entities in development and none in the image.
 */
export const ENTITIES: NonNullable<PostgresConnectionOptions['entities']> = [];

export function databaseOptions(
  config: DatabaseConfig,
): PostgresConnectionOptions {
  return {
    type: 'postgres',
    // TypeORM otherwise loads the driver with a runtime require() by name,
    // which the generated package.json cannot see; the image then ships
    // without pg and the API dies on its first connection.
    driver: pg,
    ...config,
    // gen_random_uuid() is built into Postgres 13+; the default,
    // uuid_generate_v4(), needs the uuid-ossp extension installed first.
    uuidExtension: 'pgcrypto',
    // Never true. Schema changes go through reviewed migrations only.
    synchronize: false,
    migrationsRun: false,
    entities: ENTITIES,
    migrations: Object.values(migrations),
    // pg waits forever for a connection by default, so an unreachable
    // database would hang /api/health instead of reporting it.
    extra: { connectionTimeoutMillis: 5_000 },
  };
}
