import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { ReservationEngine } from './reservation.engine.js';
import { ReservationRepository } from './reservation.repository.js';

export const SWEEP_INTERVAL = Symbol('SWEEP_INTERVAL');

const BATCH = 100;

/**
 * Cierra las reservas vencidas. El vencimiento está en la base, no en una cola: un barrido perdido
 * lo recupera el siguiente, y varias instancias pueden barrer a la vez sin repetirse.
 */
@Injectable()
export class ExpirySweep implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ExpirySweep.name);
  private timer: NodeJS.Timeout | undefined;
  private running: Promise<unknown> = Promise.resolve();

  constructor(
    @Inject(ReservationRepository) private readonly reservations: ReservationRepository,
    @Inject(ReservationEngine) private readonly engine: ReservationEngine,
    /** Milisegundos entre barridos; 0 los desactiva. */
    @Inject(SWEEP_INTERVAL) private readonly interval: number,
  ) {}

  onApplicationBootstrap(): void {
    if (this.interval <= 0) return;
    this.timer = setInterval(() => {
      this.running = this.run(new Date()).catch((error: unknown) => {
        this.logger.error(`Falló el barrido: ${error instanceof Error ? error.name : 'error'}`);
      });
    }, this.interval);
    this.timer.unref();
  }

  async onApplicationShutdown(): Promise<void> {
    clearInterval(this.timer);
    await this.running;
  }

  /** Devuelve cuántas cerró. */
  async run(now: Date): Promise<number> {
    let closed = 0;
    for (const id of await this.reservations.overdue(now, BATCH)) {
      const row = await this.reservations.expire(id, now, { action: 'expire', to: 'EXPIRED', actor: 'SYSTEM', actorId: null, reason: '' });
      if (!row) continue;
      closed += 1;
      await this.engine.announce(null, row, 'expire', 'SYSTEM');
    }
    return closed;
  }
}
