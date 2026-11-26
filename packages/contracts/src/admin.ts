import { z } from 'zod';
import { block, line } from './text.js';

export const reportReasons = ['FRAUD', 'PROHIBITED', 'MISLEADING', 'IMPERSONATION', 'NO_DELIVERY', 'PAYMENT_ISSUE', 'OTHER'] as const;
export type ReportReason = (typeof reportReasons)[number];

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80);

/** Se denuncia un producto (por su dirección) o una reserva propia, nunca las dos cosas. */
export const reportInput = z.union([
  z.strictObject({ productSlug: slug, reason: z.enum(reportReasons), details: block(2000) }),
  z.strictObject({ reservationId: z.uuid(), reason: z.enum(reportReasons), details: block(2000) }),
]);
export type ReportInput = z.output<typeof reportInput>;

export const reportResolution = z.strictObject({ outcome: z.enum(['RESOLVED', 'DISMISSED']), note: block(1000).min(3) });
export type ReportResolution = z.output<typeof reportResolution>;

export const interventionInput = z.strictObject({ version: z.number().int().min(1), reason: block(1000).min(3) });
export type InterventionInput = z.output<typeof interventionInput>;

export const suspensionInput = z.strictObject({ reason: line(500).min(3) });
export type SuspensionInput = z.output<typeof suspensionInput>;

export interface ReportView {
  id: string;
  targetType: 'PRODUCT' | 'RESERVATION';
  title: string;
  reason: ReportReason;
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED';
  resolution: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface ReportDetail extends ReportView {
  details: string;
  reporter: { id: string; name: string; email: string };
  target: { id: string; storeId: string; storeName: string; slug?: string; code?: string; status: string };
}

export interface ReportPage {
  items: ReportView[];
  page: number;
  hasMore: boolean;
}

export interface AdminUserView {
  id: string;
  name: string;
  email: string;
  platformRole: string;
  twoFactorEnabled: boolean;
  createdAt: string;
  suspendedAt: string | null;
  suspensionReason: string;
}

export interface AdminUserDetail extends AdminUserView {
  stores: { id: string; name: string; role: string }[];
  reservations: { total: number; completed: number; noShow: number; cancelled: number };
  reports: number;
}

export interface Overview {
  pendingStores?: number;
  pendingProducts?: number;
  openReports?: number;
  reservationReports?: number;
  refundsPending?: number;
}

export interface AuditItem {
  id: string;
  at: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  ipAddress: string | null;
  metadata: unknown;
  actor: { id: string; name: string; email: string } | null;
  /** Autor que no es una persona: la semilla, el sistema. */
  actorId: string | null;
}
