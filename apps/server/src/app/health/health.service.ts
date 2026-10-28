import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { HealthStatus } from '@wayfinder/domain';
import { DataSource } from 'typeorm';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  /** Null until the first check, so the first outcome is always logged. */
  private lastDb: boolean | null = null;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async check(): Promise<HealthStatus> {
    let db = true;
    try {
      await this.dataSource.query('select 1');
    } catch {
      db = false;
    }
    // The container healthcheck polls every 30 s; logging each poll would bury
    // the one line that matters, which is the moment the state flipped.
    if (db !== this.lastDb) {
      if (db) {
        this.logger.log('Database reachable');
      } else {
        this.logger.error('Database unreachable');
      }
      this.lastDb = db;
    }
    return { status: db ? 'ok' : 'degraded', db };
  }
}
