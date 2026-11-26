import { reportReasons, type ReportReason } from '@marketplace/contracts';

export { reportReasons };

const REASONS: Record<ReportReason, string> = {
  FRAUD: 'Posible fraude',
  PROHIBITED: 'Producto prohibido',
  MISLEADING: 'Información engañosa',
  IMPERSONATION: 'Suplanta a una marca o tienda',
  NO_DELIVERY: 'No me entregaron',
  PAYMENT_ISSUE: 'Problema con un pago',
  OTHER: 'Otro motivo',
};

export const reportReasonLabel = (reason: ReportReason) => REASONS[reason];

/** Razones que tienen sentido para cada objetivo. */
export const reasonsFor = (target: 'PRODUCT' | 'RESERVATION'): ReportReason[] =>
  target === 'PRODUCT' ? ['MISLEADING', 'PROHIBITED', 'FRAUD', 'IMPERSONATION', 'OTHER'] : ['PAYMENT_ISSUE', 'NO_DELIVERY', 'FRAUD', 'OTHER'];

const STATUS = { OPEN: 'Abierta', RESOLVED: 'Resuelta', DISMISSED: 'Desestimada' } as const;

export const reportStatusLabel = (status: keyof typeof STATUS) => STATUS[status];
