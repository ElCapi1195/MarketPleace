import { z } from 'zod';
import { block, line } from './text.js';

const minor = z.number().int().min(0).max(2_000_000_000);
const version = z.number().int().min(1);

/** Lo que el cliente vio al solicitar: si ya cambió, se le avisa en lugar de aceptarlo. */
export const reservationInput = z.strictObject({
  productSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  expected: z.strictObject({ priceMinor: minor, depositMinor: minor, availableOn: z.iso.date().nullable() }),
  termsVersion: z.string().max(40),
  phone: line(30),
  note: block(1000),
});
export type ReservationInput = z.output<typeof reservationInput>;

export const idempotencyKey = z.uuid();

export const customerDecision = z.strictObject({ version, reason: block(1000).default('') });
export type CustomerDecision = z.output<typeof customerDecision>;

/** Cambios que propone la tienda; null conserva lo solicitado. */
export const reservationOffer = z
  .strictObject({ priceMinor: minor, depositMinor: minor, availableOn: z.iso.date().nullable() })
  .refine(({ priceMinor, depositMinor }) => depositMinor <= priceMinor, 'el depósito no puede superar el precio');
export type ReservationOffer = z.output<typeof reservationOffer>;

export const storeDecision = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('approve'), version, offer: reservationOffer.nullable() }),
  z.strictObject({ action: z.enum(['reject', 'cancel']), version, reason: block(1000).min(3) }),
  z.strictObject({ action: z.enum(['start', 'ready', 'complete', 'no_show']), version }),
]);
export type StoreDecision = z.output<typeof storeDecision>;

export const paymentInput = z.strictObject({
  kind: z.enum(['DEPOSIT', 'BALANCE', 'REFUND']),
  amountMinor: z.number().int().min(1).max(2_000_000_000),
  method: z.enum(['CASH', 'TRANSFER', 'TERMINAL', 'OTHER']),
  reference: line(80),
  note: line(200),
});
export type PaymentInput = z.output<typeof paymentInput>;

export const paymentReversal = z.strictObject({ reason: line(200).min(3) });
export type PaymentReversal = z.output<typeof paymentReversal>;

export const pickupInput = z.strictObject({ pickupInfo: block(500).min(5) });
export type PickupInput = z.output<typeof pickupInput>;
