import type { ListingKind } from './input.js';

export type ReservationStatus =
  | 'PENDING_REVIEW'
  | 'AWAITING_CUSTOMER'
  | 'AWAITING_DEPOSIT'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'READY'
  | 'COMPLETED'
  | 'NO_SHOW'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface Terms {
  priceMinor: number;
  depositMinor: number;
  availableOn: string | null;
}

export interface ReservationEventView {
  at: string;
  action: string;
  toStatus: ReservationStatus;
  actor: 'CUSTOMER' | 'STORE' | 'PLATFORM' | 'SYSTEM';
  reason: string;
}

export interface PaymentView {
  id: string;
  at: string;
  kind: 'DEPOSIT' | 'BALANCE' | 'REFUND';
  /** Negativo en los reversos. */
  amountMinor: number;
  method: 'CASH' | 'TRANSFER' | 'TERMINAL' | 'OTHER';
  reference: string;
  note: string;
  reversesId: string | null;
  reversed: boolean;
}

export interface ReservationSummary {
  id: string;
  code: string;
  status: ReservationStatus;
  productTitle: string;
  productSlug: string;
  coverId: string | null;
  kind: ListingKind;
  storeName: string;
  priceMinor: number;
  currency: string;
  /** Vencimiento de la espera actual. */
  expiresAt: string | null;
  createdAt: string;
  /** Hay dinero del cliente por devolver. */
  refundPending: boolean;
}

interface ReservationData extends ReservationSummary {
  version: number;
  /** Lo acordado hoy. */
  agreed: Terms;
  /** Lo que vio el cliente al solicitar. */
  requested: Terms;
  /** Propuesta de la tienda, mientras el cliente decide. */
  offer: Terms | null;
  termsVersion: string;
  note: string;
  payments: PaymentView[];
  paid: { deposit: number; net: number };
  events: ReservationEventView[];
}

export interface CustomerReservation extends ReservationData {
  /** Cómo contactar y recoger; solo tras la aprobación. */
  pickupInfo: string | null;
}

export interface StoreReservation extends ReservationData {
  customer: {
    name: string;
    /** Solo tras la aprobación. */
    email: string | null;
    phone: string | null;
    /** Reservas anteriores que no llegaron a buen fin, solo como conteo. */
    rejected: number;
    noShow: number;
    completed: number;
  };
}

export interface ReservationPage<T = ReservationSummary> {
  items: T[];
  page: number;
  hasMore: boolean;
}
