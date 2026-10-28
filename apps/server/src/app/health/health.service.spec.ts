import { Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { HealthService } from './health.service';

function fakeDataSource(reachable: () => boolean): DataSource {
  return {
    query: async (): Promise<unknown[]> => {
      if (!reachable()) {
        throw new Error('connect ECONNREFUSED 127.0.0.1:5432');
      }
      return [{ '?column?': 1 }];
    },
  } as unknown as DataSource;
}

describe('HealthService', () => {
  it('reports ok when the database answers', async () => {
    const health = new HealthService(fakeDataSource(() => true));
    expect(await health.check()).toEqual({ status: 'ok', db: true });
  });

  it('reports degraded instead of throwing when the database is down', async () => {
    const health = new HealthService(fakeDataSource(() => false));
    expect(await health.check()).toEqual({ status: 'degraded', db: false });
  });

  it('logs when the database state changes, not on every check', async () => {
    let up = true;
    const health = new HealthService(fakeDataSource(() => up));
    const log = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const error = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    await health.check();
    await health.check();
    up = false;
    await health.check();
    await health.check();
    up = true;
    await health.check();

    expect(log).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledTimes(1);
  });
});
