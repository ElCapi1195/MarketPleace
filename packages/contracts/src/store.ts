import { z } from 'zod';
import { line, block } from './text.js';

export const documentTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/** Datos para verificar una tienda. Solo `name` y `about` son públicos. */
export const storeApplicationInput = z.strictObject({
  name: line(80).min(2),
  about: block(1000),
  legalName: line(120),
  taxId: line(40),
  phone: line(30),
  address: line(200),
});
export type StoreApplicationInput = z.output<typeof storeApplicationInput>;

/** Lo que debe estar completo para enviar la solicitud. */
export const requiredStoreFields = ['legalName', 'taxId', 'phone', 'address'] as const;

export const storeDecisionInput = z.strictObject({
  action: z.enum(['start_review', 'request_info', 'approve', 'reject', 'suspend', 'reinstate']),
  reason: block(1000).default(''),
});
export type StoreDecisionInput = z.output<typeof storeDecisionInput>;

export const invitableRoles = ['MANAGER', 'STAFF'] as const;

export const invitationInput = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  role: z.enum(invitableRoles),
});
export type InvitationInput = z.output<typeof invitationInput>;

export const invitationAccept = z.strictObject({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });

export const memberPatch = z.strictObject({ role: z.enum(['OWNER', 'MANAGER', 'STAFF']) });
export type MemberPatch = z.output<typeof memberPatch>;

export const moderationInput = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('approve'), version: z.number().int().min(1) }),
  z.strictObject({ action: z.literal('reject'), version: z.number().int().min(1), reason: block(1000).min(3) }),
]);
export type ModerationInput = z.output<typeof moderationInput>;
