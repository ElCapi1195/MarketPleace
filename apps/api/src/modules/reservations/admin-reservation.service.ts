import type { InterventionInput, ReservationPage, StoreReservation } from '@marketplace/contracts';
import type { ReservationStatus } from '@marketplace/core';
import { Inject, Injectable } from '@nestjs/common';
import type { ActorData } from '../../common/actor.js';
import { AuditService } from '../audit/audit.service.js';
import { ReservationEngine } from './reservation.engine.js';
import { notFound } from './reservation.errors.js';
import { ReservationRepository, type ReservationRow } from './reservation.repository.js';
import { refundPending, storeView, summaryView } from './reservation.views.js';

const PAGE_SIZE = 30;
const PLATFORM = { platform: true } as const;

export interface AdminFilter {
  status?: ReservationStatus | undefined;
  refund?: 'pending' | undefined;
  code?: string | undefined;
  page: number;
}

/** Supervisión de la plataforma. Toda consulta de una reserva concreta queda registrada. */
@Injectable()
export class AdminReservationService {
  constructor(
    @Inject(ReservationRepository) private readonly reservations: ReservationRepository,
    @Inject(ReservationEngine) private readonly engine: ReservationEngine,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list({ status, refund, code, page }: AdminFilter): Promise<ReservationPage> {
    const rows = await this.reservations.findPage(PLATFORM, { status, code, withPayments: refund === 'pending' }, page, PAGE_SIZE + 1);
    const items = rows.slice(0, PAGE_SIZE).filter((row) => refund !== 'pending' || refundPending(row));
    return { items: items.map(summaryView), page, hasMore: rows.length > PAGE_SIZE };
  }

  async get(actor: ActorData, id: string): Promise<StoreReservation> {
    const row = await this.reservations.find(PLATFORM, id);
    if (!row) throw notFound();
    await this.audit.record({ ...actor, action: 'reservation.viewed', targetType: 'reservation', targetId: id });
    return this.view(row);
  }

  async cancel(actor: ActorData, id: string, { version, reason }: InterventionInput): Promise<StoreReservation> {
    const row = await this.reservations.change(PLATFORM, id, version, (current) =>
      this.engine.plan(current, { action: 'cancel', actor: 'PLATFORM', actorId: actor.actorId, reason }),
    );
    if (!row) throw notFound();
    await this.engine.announce(actor, row, 'cancel', 'PLATFORM', reason);
    return this.view(row);
  }

  /** La plataforma ve el contacto aunque la tienda aún no haya aprobado. */
  private async view(row: ReservationRow): Promise<StoreReservation> {
    const [rejected, noShow, completed] = await Promise.all(
      (['REJECTED', 'NO_SHOW', 'COMPLETED'] as const).map((status) => this.reservations.countBy(row.customerId, status)),
    );
    return storeView({ ...row, approvedAt: row.approvedAt ?? row.createdAt }, { rejected: rejected ?? 0, noShow: noShow ?? 0, completed: completed ?? 0 });
  }
}
