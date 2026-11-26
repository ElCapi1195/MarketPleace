import type { ProductStatus } from '@marketplace/contracts';

const LABELS: Record<ProductStatus, string> = { DRAFT: 'Borrador', PUBLISHED: 'Publicado', ARCHIVED: 'Archivado' };

export const statusLabel = (status: ProductStatus) => LABELS[status];
