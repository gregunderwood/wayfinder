import * as pg from 'pg';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import * as migrations from './migrations';

export type EnvLookup = (name: string) => string | undefined;

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export interface DatabaseOptionsOverrides {
  allowLongQueries?: boolean;
}

const DEFAULT_PORT = 5432;
const HIGHEST_PORT = 65535;
const CONNECTION_TIMEOUT_MS = 5_000;
const QUERY_TIMEOUT_MS = 5_000;

// Listed by hand: the API is a webpack bundle with no directory to glob.
export const ENTITIES: NonNullable<PostgresConnectionOptions['entities']> = [];

export function readDatabaseConfig(env: EnvLookup): DatabaseConfig {
  return {
    host: env('DATABASE_HOST') ?? '127.0.0.1',
    port: readPort(env('DATABASE_PORT')),
    username: env('DATABASE_USER') ?? 'wayfinder',
    password: readRequiredPassword(env('DATABASE_PASSWORD')),
    database: env('DATABASE_NAME') ?? 'wayfinder',
  };
}

export function databaseOptions(
  config: DatabaseConfig,
  { allowLongQueries = false }: DatabaseOptionsOverrides = {},
): PostgresConnectionOptions {
  return {
    type: 'postgres',
    // TypeORM's own require('pg') by name is invisible to the bundler, so the
    // image would ship without the driver.
    driver: pg,
    ...config,
    // gen_random_uuid() is built in; the default needs the uuid-ossp extension.
    uuidExtension: 'pgcrypto',
    synchronize: false,
    migrationsRun: false,
    entities: ENTITIES,
    migrations: Object.values(migrations),
    extra: {
      connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
      query_timeout: allowLongQueries ? undefined : QUERY_TIMEOUT_MS,
    },
  };
}

function readPort(configuredPort: string | undefined): number {
  const port = Number(configuredPort ?? DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 1 || port > HIGHEST_PORT) {
    throw new Error(
      `DATABASE_PORT must be a port number, got "${configuredPort}"`,
    );
  }
  return port;
}

function readRequiredPassword(password: string | undefined): string {
  if (!password) {
    throw new Error('DATABASE_PASSWORD is not set; see .env.example');
  }
  return password;
}
