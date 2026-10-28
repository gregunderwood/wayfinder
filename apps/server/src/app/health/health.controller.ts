import { Controller, Get } from '@nestjs/common';
import type { HealthStatus } from '@wayfinder/domain';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /**
   * 200 even when degraded. The container healthcheck reads this, and
   * restarting the API cannot fix a database that is down; it would only take
   * away the endpoint that says so.
   */
  @Get()
  check(): Promise<HealthStatus> {
    return this.health.check();
  }
}
