import { Inject, Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { HEALTH_PROBES, type HealthProbe } from './health.probes.js';

const PROBE_TIMEOUT_MS = 1500;

export interface Readiness {
  status: 'ok' | 'error';
  checks: Record<string, 'up' | 'down'>;
}

async function withTimeout(task: Promise<void>): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('tiempo agotado')), PROBE_TIMEOUT_MS);
  });
  try {
    await Promise.race([task, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

@Injectable()
export class HealthService implements OnApplicationShutdown {
  private readonly logger = new Logger(HealthService.name);

  constructor(@Inject(HEALTH_PROBES) private readonly probes: HealthProbe[]) {}

  async readiness(): Promise<Readiness> {
    const entries = await Promise.all(
      this.probes.map(async (probe): Promise<[string, 'up' | 'down']> => {
        try {
          await withTimeout(probe.check());
          return [probe.name, 'up'];
        } catch (error) {
          this.logger.warn(`Dependencia ${probe.name} no disponible: ${error instanceof Error ? error.message : 'error'}`);
          return [probe.name, 'down'];
        }
      }),
    );
    const status = entries.every(([, state]) => state === 'up') ? 'ok' : 'error';
    return { status, checks: Object.fromEntries(entries) };
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.allSettled(this.probes.map((probe) => probe.close()));
  }
}
