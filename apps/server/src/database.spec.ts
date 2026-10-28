import {
  databaseOptions,
  type EnvLookup,
  readDatabaseConfig,
} from './database';

function env(vars: Record<string, string>): EnvLookup {
  return (name) => vars[name];
}

describe('readDatabaseConfig', () => {
  it('needs only a password locally', () => {
    expect(readDatabaseConfig(env({ DATABASE_PASSWORD: 'secret' }))).toEqual({
      host: '127.0.0.1',
      port: 5432,
      username: 'wayfinder',
      password: 'secret',
      database: 'wayfinder',
    });
  });

  it('refuses to start without a password rather than guessing one', () => {
    expect(() => readDatabaseConfig(env({}))).toThrow(/DATABASE_PASSWORD/);
    expect(() => readDatabaseConfig(env({ DATABASE_PASSWORD: '' }))).toThrow(
      /DATABASE_PASSWORD/,
    );
  });

  it.each(['five', '0', '65536', '54.32'])(
    'rejects "%s" as a port',
    (configuredPort) => {
      expect(() =>
        readDatabaseConfig(
          env({ DATABASE_PASSWORD: 'x', DATABASE_PORT: configuredPort }),
        ),
      ).toThrow(/DATABASE_PORT/);
    },
  );

  it('reads every setting from the environment', () => {
    expect(
      readDatabaseConfig(
        env({
          DATABASE_HOST: 'postgres',
          DATABASE_PORT: '6543',
          DATABASE_USER: 'u',
          DATABASE_PASSWORD: 'p',
          DATABASE_NAME: 'd',
        }),
      ),
    ).toEqual({
      host: 'postgres',
      port: 6543,
      username: 'u',
      password: 'p',
      database: 'd',
    });
  });
});

describe('databaseOptions', () => {
  it('never lets TypeORM change the schema by itself', () => {
    const options = databaseOptions(
      readDatabaseConfig(env({ DATABASE_PASSWORD: 'x' })),
    );
    expect(options.synchronize).toBe(false);
    expect(options.migrationsRun).toBe(false);
  });

  it('limits query time for the API but not for migrations', () => {
    const config = readDatabaseConfig(env({ DATABASE_PASSWORD: 'x' }));
    expect(databaseOptions(config).extra.query_timeout).toBeGreaterThan(0);
    expect(
      databaseOptions(config, { allowLongQueries: true }).extra.query_timeout,
    ).toBeUndefined();
  });
});
