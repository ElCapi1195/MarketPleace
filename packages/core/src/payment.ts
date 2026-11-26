export const paymentKinds = ['DEPOSIT', 'BALANCE', 'REFUND'] as const;
export type PaymentKind = (typeof paymentKinds)[number];

export const paymentMethods = ['CASH', 'TRANSFER', 'TERMINAL', 'OTHER'] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

/** Movimiento anotado. Un reverso repite el tipo con el importe negativo. */
export interface PaymentEntry {
  kind: PaymentKind;
  amountMinor: number;
}

export interface PaymentSummary {
  deposit: number;
  received: number;
  refunded: number;
  /** Dinero del cliente que la tienda conserva. */
  net: number;
}

export function summarizePayments(entries: readonly PaymentEntry[]): PaymentSummary {
  const total = (kinds: readonly PaymentKind[]) =>
    entries.reduce((sum, { kind, amountMinor }) => (kinds.includes(kind) ? sum + amountMinor : sum), 0);
  const deposit = total(['DEPOSIT']);
  const received = deposit + total(['BALANCE']);
  const refunded = total(['REFUND']);
  return { deposit, received, refunded, net: received - refunded };
}

export type PaymentProblem = 'INVALID_AMOUNT' | 'NOT_PAYABLE' | 'DEPOSIT_EXCEEDED' | 'PRICE_EXCEEDED' | 'REFUND_EXCEEDED';

interface PaymentContext {
  status: string;
  priceMinor: number;
  depositMinor: number;
  summary: PaymentSummary;
}

const DEPOSIT_STATUSES: readonly string[] = ['AWAITING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS', 'READY'];
const BALANCE_STATUSES: readonly string[] = ['CONFIRMED', 'IN_PROGRESS', 'READY', 'COMPLETED'];

/** Motivo por el que un movimiento no se puede anotar; null si se puede. */
export function paymentProblem(kind: PaymentKind, amountMinor: number, context: PaymentContext): PaymentProblem | null {
  const { status, priceMinor, depositMinor, summary } = context;
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return 'INVALID_AMOUNT';
  if (kind === 'REFUND') return amountMinor > summary.net ? 'REFUND_EXCEEDED' : null;
  if (!(kind === 'DEPOSIT' ? DEPOSIT_STATUSES : BALANCE_STATUSES).includes(status)) return 'NOT_PAYABLE';
  if (kind === 'DEPOSIT' && summary.deposit + amountMinor > depositMinor) return 'DEPOSIT_EXCEEDED';
  return summary.net + amountMinor > priceMinor ? 'PRICE_EXCEEDED' : null;
}

function luhn(digits: string): boolean {
  let sum = 0;
  for (const [index, char] of [...digits].toReversed().entries()) {
    const digit = Number(char) * (index % 2 === 1 ? 2 : 1);
    sum += digit > 9 ? digit - 9 : digit;
  }
  return sum % 10 === 0;
}

/** Detecta números de tarjeta en un texto libre: no deben guardarse nunca. */
export function containsCardNumber(text: string): boolean {
  const candidates = text.match(/\d(?:[ -]?\d){12,18}/g) ?? [];
  return candidates.some((candidate) => luhn(candidate.replace(/\D/g, '')));
}
