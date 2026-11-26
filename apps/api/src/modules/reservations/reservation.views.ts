import { summarizePayments, type PaymentEntry } from '@marketplace/core';
import type { CustomerReservation, ListingKind, PaymentView, ReservationSummary, StoreReservation, Terms } from '@marketplace/contracts';
import type { PaymentRecord } from '../../generated/prisma/client.js';
import type { ReservationRow } from './reservation.repository.js';

const dateOnly = (date: Date | null) => date?.toISOString().slice(0, 10) ?? null;
const terms = (priceMinor: number, depositMinor: number, availableOn: Date | null): Terms => ({
  priceMinor,
  depositMinor,
  availableOn: dateOnly(availableOn),
});

/** Los importes ya pasaron por las restricciones de la base. */
export const entries = (payments: readonly PaymentRecord[]): PaymentEntry[] =>
  payments.map(({ kind, amountMinor }) => ({ kind: kind as PaymentEntry['kind'], amountMinor }));

const CLOSED_WITHOUT_DELIVERY = ['CANCELLED', 'EXPIRED', 'REJECTED'];

/** Queda dinero del cliente en una reserva que no siguió adelante. */
export const refundPending = ({ status, payments }: Pick<ReservationRow, 'status' | 'payments'>): boolean =>
  CLOSED_WITHOUT_DELIVERY.includes(status) && summarizePayments(entries(payments)).net > 0;

/** Quién anotó cada pago es un dato interno: queda en la auditoría. */
function paymentViews(payments: readonly PaymentRecord[]): PaymentView[] {
  const reversed = new Set(payments.flatMap(({ reversesId }) => reversesId ?? []));
  return payments.map((payment) => ({
    id: payment.id,
    at: payment.at.toISOString(),
    kind: payment.kind as PaymentView['kind'],
    amountMinor: payment.amountMinor,
    method: payment.method as PaymentView['method'],
    reference: payment.reference,
    note: payment.note,
    reversesId: payment.reversesId,
    reversed: reversed.has(payment.id),
  }));
}

export function summaryView(row: ReservationRow): ReservationSummary {
  const visible = row.product.status === 'PUBLISHED' && row.store.status === 'APPROVED';
  return {
    id: row.id,
    code: row.code,
    status: row.status as ReservationSummary['status'],
    productTitle: row.productTitle,
    productSlug: row.product.slug,
    coverId: visible ? (row.product.media[0]?.id ?? null) : null,
    kind: row.kind as ListingKind,
    storeName: row.store.name,
    priceMinor: row.priceMinor,
    currency: row.currency,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    refundPending: refundPending(row),
  };
}

function details(row: ReservationRow) {
  const { deposit, net } = summarizePayments(entries(row.payments));
  return {
    ...summaryView(row),
    version: row.version,
    agreed: terms(row.priceMinor, row.depositMinor, row.availableOn),
    requested: terms(row.requestedPriceMinor, row.requestedDepositMinor, row.requestedAvailableOn),
    offer:
      row.offerPriceMinor === null || row.offerDepositMinor === null
        ? null
        : terms(row.offerPriceMinor, row.offerDepositMinor, row.offerAvailableOn),
    termsVersion: row.termsVersion,
    note: row.note,
    payments: paymentViews(row.payments),
    paid: { deposit, net },
    events: row.events.map(({ at, action, toStatus, actor, reason }) => ({
      at: at.toISOString(),
      action,
      toStatus: toStatus as ReservationSummary['status'],
      actor: actor as CustomerReservation['events'][number]['actor'],
      reason,
    })),
  };
}

export const customerView = (row: ReservationRow): CustomerReservation => ({
  ...details(row),
  pickupInfo: row.approvedAt ? row.store.pickupInfo : null,
});

export const storeView = (row: ReservationRow, counts: { rejected: number; noShow: number; completed: number }): StoreReservation => ({
  ...details(row),
  customer: {
    name: row.customer.name,
    email: row.approvedAt ? row.customer.email : null,
    phone: row.approvedAt ? row.phone : null,
    ...counts,
  },
});
