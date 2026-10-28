import { Logger } from '@nestjs/common';
import { useTestDatabase } from '../../testing/test-database';
import { HealthService } from './health.service';

describe('HealthService', () => {
  const database = useTestDatabase();

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('reports ok when the database answers', async () => {
    const health = new HealthService(database.dataSource);

    expect(await health.check()).toEqual({
      status: 'ok',
      databaseReachable: true,
    });
  });

  it('reports degraded instead of failing when the database is gone', async () => {
    const health = new HealthService(database.dataSource);
    await database.takeOffline();

    expect(await health.check()).toEqual({
      status: 'degraded',
      databaseReachable: false,
    });
  });

  it('logs when reachability changes, not on every check', async () => {
    const health = new HealthService(database.dataSource);

    await health.check();
    await health.check();
    await database.takeOffline();
    await health.check();
    await health.check();
    await database.bringBackOnline();
    await health.check();

    expect(Logger.prototype.log).toHaveBeenCalledTimes(2);
    expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
  });
});
