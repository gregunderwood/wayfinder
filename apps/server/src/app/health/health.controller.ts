import { Controller, Get } from '@nestjs/common';
import type { HealthStatus } from '@wayfinder/domain';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  // 200 even when degraded: the container healthcheck reads this, and
  // restarting the API cannot bring the database back.
  @Get()
  check(): Promise<HealthStatus> {
    return this.health.check();
  }
}
