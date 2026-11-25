import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../identity/access.js';
import { HealthService, type Readiness } from './health.service.js';

@Public()
@Controller('health')
export class HealthController {
  constructor(@Inject(HealthService) private readonly health: HealthService) {}

  /** Vida del proceso: no consulta dependencias, para no reiniciar la API si cae la base. */
  @Get()
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response): Promise<Readiness> {
    const readiness = await this.health.readiness();
    if (readiness.status === 'error') res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return readiness;
  }
}
