import { paymentKinds, paymentProblem, type PaymentKind } from '@marketplace/core';
import type { ListingKind, ReservationOffer, ReservationStatus, Terms } from '@marketplace/contracts';
import { parseMoney } from '@/features/catalog/lib/money';

interface OfferValues {
  price: string;
  deposit: string;
  availableOn: string;
}

type OfferResult = { ok: true; offer: ReservationOffer } | { ok: false; error: string };

export function offerFrom({ price, deposit, availableOn }: OfferValues, kind: ListingKind, currency: string): OfferResult {
  const priceMinor = parseMoney(price, currency);
  if (priceMinor === null) return { ok: false, error: 'Revisa el precio. Ejemplo: 549,90' };
  const depositMinor = deposit.trim() === '' ? 0 : parseMoney(deposit, currency);
  if (depositMinor === null) return { ok: false, error: 'Revisa el depósito. Ejemplo: 100' };
  if (depositMinor > priceMinor) return { ok: false, error: 'El depósito no puede superar el precio.' };
  if (kind === 'PREORDER' && availableOn === '') return { ok: false, error: 'Una preventa necesita la fecha estimada.' };
  return { ok: true, offer: { priceMinor, depositMinor, availableOn: kind === 'PREORDER' ? availableOn : null } };
}

interface Payable {
  status: ReservationStatus;
  agreed: Terms;
  paid: { deposit: number; net: number };
}

/** Movimientos que se pueden anotar ahora y el importe que falta en cada uno. */
export function paymentOptions({ status, agreed, paid }: Payable): { kind: PaymentKind; suggestedMinor: number }[] {
  const suggested: Record<PaymentKind, number> = {
    DEPOSIT: agreed.depositMinor - paid.deposit,
    BALANCE: agreed.priceMinor - paid.net,
    REFUND: paid.net,
  };
  const summary = { deposit: paid.deposit, received: paid.net, refunded: 0, net: paid.net };
  return paymentKinds
    .map((kind) => ({ kind, suggestedMinor: suggested[kind] }))
    .filter(({ kind, suggestedMinor }) => paymentProblem(kind, suggestedMinor, { status, ...agreed, summary }) === null);
}
