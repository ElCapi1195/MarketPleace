import { containsCardNumber, paymentProblem, summarizePayments, type ReservationStatus } from '@marketplace/core';
import type { PaymentInput, ReservationOffer, ReservationPage, StoreDecision, StoreReservation } from '@marketplace/contracts';
import { Inject, Injectable } from '@nestjs/common';
import type { ActorData } from '../../common/actor.js';
import { AuditService } from '../audit/audit.service.js';
import type { CurrentStoreData } from '../identity/access.js';
import { notApproved } from '../stores/store.errors.js';
import { ReservationEngine } from './reservation.engine.js';
import {
  alreadyReversed,
  cardNumber,
  invalid,
  notFound,
  notReversible,
  ownReservation,
  paymentRejected,
  pickupInfoRequired,
  tooEarly,
} from './reservation.errors.js';
import { ReservationRepository, type Change, type ReservationRow } from './reservation.repository.js';
import { entries, refundPending, storeView, summaryView } from './reservation.views.js';

const PAGE_SIZE = 20;

export interface StoreFilter {
  status?: ReservationStatus | undefined;
  refund?: 'pending' | undefined;
  page: number;
}

/** La reserva vista por la tienda. Todo queda limitado a esa tienda. */
@Injectable()
export class StoreReservationService {
  constructor(
    @Inject(ReservationRepository) private readonly reservations: ReservationRepository,
    @Inject(ReservationEngine) private readonly engine: ReservationEngine,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(storeId: string, { status, refund, page }: StoreFilter): Promise<ReservationPage> {
    const rows = await this.reservations.findPage({ storeId }, { status, withPayments: refund === 'pending' }, page, PAGE_SIZE + 1);
    const items = rows.slice(0, PAGE_SIZE).filter((row) => refund !== 'pending' || refundPending(row));
    return { items: items.map(summaryView), page, hasMore: rows.length > PAGE_SIZE };
  }

  async get(storeId: string, id: string): Promise<StoreReservation> {
    const row = await this.reservations.find({ storeId }, id);
    if (!row) throw notFound();
    return this.view(row);
  }

  async decide(actor: ActorData, store: CurrentStoreData, id: string, decision: StoreDecision): Promise<StoreReservation> {
    this.assertActive(store);
    const reason = 'reason' in decision ? decision.reason : '';
    const row = await this.reservations.change({ storeId: store.id }, id, decision.version, (current) => {
      this.assertNotOwn(actor, current);
      return this.plan(actor, current, decision, reason);
    });
    if (!row) throw notFound();
    await this.engine.announce(actor, row, decision.action, 'STORE', reason);
    return this.view(row);
  }

  /** Anota dinero recibido o devuelto fuera de la web. Con el depósito completo, la reserva se confirma. */
  async pay(actor: ActorData, store: CurrentStoreData, id: string, input: PaymentInput): Promise<StoreReservation> {
    this.assertActive(store);
    if (containsCardNumber(input.reference) || containsCardNumber(input.note)) throw cardNumber();
    let confirmed = false;
    const row = await this.reservations.withLock({ storeId: store.id }, id, async (current, tx) => {
      this.assertNotOwn(actor, current);
      const summary = summarizePayments(entries(current.payments));
      const problem = paymentProblem(input.kind, input.amountMinor, { ...current, summary });
      if (problem) throw paymentRejected(problem);
      await this.reservations.addPayment(tx, { ...input, reservationId: id, currency: current.currency, recordedBy: actor.actorId });
      confirmed = current.status === 'AWAITING_DEPOSIT' && input.kind === 'DEPOSIT' && summary.deposit + input.amountMinor >= current.depositMinor;
      return confirmed ? this.engine.plan(current, { action: 'confirm', actor: 'STORE', actorId: actor.actorId }) : null;
    });
    await this.record(actor, 'reservation.payment_recorded', id, { kind: input.kind, amountMinor: input.amountMinor });
    if (confirmed) await this.engine.announce(actor, row, 'confirm', 'STORE');
    return this.view(row);
  }

  /** Corrige un movimiento con otro de signo contrario; el original no se toca. */
  async reverse(actor: ActorData, store: CurrentStoreData, id: string, paymentId: string, reason: string): Promise<StoreReservation> {
    this.assertActive(store);
    if (containsCardNumber(reason)) throw cardNumber();
    const row = await this.reservations.withLock({ storeId: store.id }, id, async (current, tx) => {
      this.assertNotOwn(actor, current);
      const payment = current.payments.find((item) => item.id === paymentId);
      if (!payment) throw notFound();
      if (payment.reversesId !== null) throw notReversible();
      if (current.payments.some(({ reversesId }) => reversesId === paymentId)) throw alreadyReversed();
      const { net } = summarizePayments(entries(current.payments));
      // Anular un cobro ya devuelto dejaría al cliente debiendo dinero.
      if (payment.kind !== 'REFUND' && payment.amountMinor > net) throw paymentRejected('REFUND_EXCEEDED');
      const { kind, currency, method, reference } = payment;
      await this.reservations.addPayment(tx, {
        reservationId: id,
        kind,
        currency,
        method,
        reference,
        amountMinor: -payment.amountMinor,
        note: reason,
        recordedBy: actor.actorId,
        reversesId: paymentId,
      });
      return null;
    });
    await this.record(actor, 'reservation.payment_reversed', id, { payment: paymentId });
    return this.view(row);
  }

  private plan(actor: ActorData, row: ReservationRow, decision: StoreDecision, reason: string): Change {
    const base = { actor: 'STORE' as const, actorId: actor.actorId, reason };
    if (decision.action === 'approve') return this.planApproval(base, row, decision.offer);
    if (decision.action === 'no_show' && row.status === 'READY' && row.expiresAt !== null && row.expiresAt > new Date()) throw tooEarly();
    return this.engine.plan(row, { ...base, action: decision.action });
  }

  private planApproval(base: { actor: 'STORE'; actorId: string; reason: string }, row: ReservationRow, offer: ReservationOffer | null): Change {
    if (row.store.pickupInfo === '') throw pickupInfoRequired();
    const approvedAt = new Date();
    if (offer === null) return this.engine.plan(row, { ...base, action: 'approve', data: { approvedAt } });
    if ((row.kind === 'PREORDER') !== (offer.availableOn !== null)) throw invalid('offer.availableOn');
    const availableOn = offer.availableOn === null ? null : new Date(offer.availableOn);
    const same =
      offer.priceMinor === row.priceMinor &&
      offer.depositMinor === row.depositMinor &&
      availableOn?.getTime() === row.availableOn?.getTime();
    if (same) return this.engine.plan(row, { ...base, action: 'approve', data: { approvedAt } });
    return this.engine.plan(row, {
      ...base,
      action: 'approve',
      offer: true,
      data: { approvedAt, offerPriceMinor: offer.priceMinor, offerDepositMinor: offer.depositMinor, offerAvailableOn: availableOn },
    });
  }

  private assertActive(store: CurrentStoreData): void {
    if (store.status !== 'APPROVED') throw notApproved();
  }

  private assertNotOwn(actor: ActorData, row: ReservationRow): void {
    if (row.customerId === actor.actorId) throw ownReservation();
  }

  private async view(row: ReservationRow): Promise<StoreReservation> {
    const [rejected, noShow, completed] = await Promise.all(
      (['REJECTED', 'NO_SHOW', 'COMPLETED'] as const).map((status) => this.reservations.countBy(row.customerId, status)),
    );
    return storeView(row, { rejected: rejected ?? 0, noShow: noShow ?? 0, completed: completed ?? 0 });
  }

  private record(actor: ActorData, action: string, targetId: string, metadata: Record<string, string | number>): Promise<void> {
    return this.audit.record({ ...actor, action, targetType: 'reservation', targetId, metadata });
  }
}
