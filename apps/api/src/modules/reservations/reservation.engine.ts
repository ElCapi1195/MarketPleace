import { deadlineHours, reservationTransition, summarizePayments, type ReservationAction, type ReservationActor } from '@marketplace/core';
import type { VerticalConfig } from '@marketplace/verticals';
import { Inject, Injectable } from '@nestjs/common';
import type { ActorData } from '../../common/actor.js';
import { VERTICAL } from '../../config/vertical.js';
import { AuditService } from '../audit/audit.service.js';
import { RESERVATION_EMAILS, type ReservationEmails } from './reservation.emails.js';
import { invalidTransition } from './reservation.errors.js';
import { ReservationRepository, type Change, type ReservationRow } from './reservation.repository.js';
import { entries } from './reservation.views.js';

const HOUR = 60 * 60 * 1000;

interface Step {
  action: ReservationAction;
  actor: ReservationActor;
  actorId: string | null;
  reason?: string;
  /** Depósito que regirá tras el cambio, si difiere del acordado. */
  depositMinor?: number;
  offer?: boolean;
  data?: Change['data'];
}

/** Traduce una acción en el cambio que aplica el repositorio, y avisa después. */
@Injectable()
export class ReservationEngine {
  constructor(
    @Inject(ReservationRepository) private readonly reservations: ReservationRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(RESERVATION_EMAILS) private readonly emails: ReservationEmails,
    @Inject(VERTICAL) private readonly vertical: VerticalConfig,
  ) {}

  deadline(status: Change['to'], now = new Date()): Date | null {
    const hours = deadlineHours(status, this.vertical.reservations);
    return hours === null ? null : new Date(now.getTime() + hours * HOUR);
  }

  plan(row: ReservationRow, { action, actor, actorId, reason = '', depositMinor, offer = false, data }: Step): Change {
    const { deposit } = summarizePayments(entries(row.payments));
    const depositDue = (depositMinor ?? row.depositMinor) > deposit;
    const to = reservationTransition(row.status, action, actor, { offer, depositDue });
    if (to === null) throw invalidTransition();
    return { action, to, actor, actorId, reason, expiresAt: this.deadline(to), ...(data && { data }) };
  }

  /** Avisa a la otra parte y deja rastro. Se llama con el cambio ya guardado. */
  async announce(actor: ActorData | null, row: ReservationRow, event: ReservationAction | 'request', by: ReservationActor, reason = ''): Promise<void> {
    if (actor) await this.audit.record({ ...actor, action: `reservation.${event}`, targetType: 'reservation', targetId: row.id });
    if (by !== 'CUSTOMER') this.emails.customer(row, event, reason, by);
    if (by !== 'STORE') this.emails.store(await this.reservations.deciders(row.storeId), row, event, reason, by);
  }
}
