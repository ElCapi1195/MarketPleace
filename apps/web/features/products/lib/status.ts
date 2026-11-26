import type { ProductStatus } from '@marketplace/contracts';

const LABELS: Record<ProductStatus, string> = { DRAFT: 'Borrador', PENDING_MODERATION: 'En revisión', PUBLISHED: 'Publicado', REJECTED: 'Rechazado', ARCHIVED: 'Archivado' };

export const statusLabel = (status: ProductStatus) => LABELS[status];
