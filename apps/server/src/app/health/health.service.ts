import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { HealthStatus } from '@wayfinder/domain';
import { DataSource } from 'typeorm';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private wasDatabaseReachable: boolean | null = null;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async check(): Promise<HealthStatus> {
    const databaseReachable = await this.isDatabaseReachable();
    this.logIfReachabilityChanged(databaseReachable);
    return {
      status: databaseReachable ? 'ok' : 'degraded',
      databaseReachable,
    };
  }

  private async isDatabaseReachable(): Promise<boolean> {
    try {
      await this.dataSource.query('select 1');
      return true;
    } catch {
      return false;
    }
  }

  private logIfReachabilityChanged(databaseReachable: boolean): void {
    if (databaseReachable === this.wasDatabaseReachable) {
      return;
    }
    this.wasDatabaseReachable = databaseReachable;
    if (databaseReachable) {
      this.logger.log('Database reachable');
    } else {
      this.logger.error('Database unreachable');
    }
  }
}
