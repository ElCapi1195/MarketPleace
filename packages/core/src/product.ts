export const productStatuses = ['DRAFT', 'PENDING_MODERATION', 'PUBLISHED', 'REJECTED', 'ARCHIVED'] as const;
export type ProductStatus = (typeof productStatuses)[number];

/** `publish` es de la plataforma; `submit`, de la tienda; `remoderate`, automática al editar. */
export const productActions = ['submit', 'approve', 'reject', 'publish', 'archive', 'remoderate'] as const;
export type ProductAction = (typeof productActions)[number];

const rules = new Map<string, { from: readonly ProductStatus[]; to: ProductStatus }>([
  ['submit', { from: ['DRAFT', 'REJECTED', 'ARCHIVED'], to: 'PENDING_MODERATION' }],
  ['approve', { from: ['PENDING_MODERATION'], to: 'PUBLISHED' }],
  ['reject', { from: ['PENDING_MODERATION'], to: 'REJECTED' }],
  ['publish', { from: ['DRAFT', 'PENDING_MODERATION', 'REJECTED', 'ARCHIVED'], to: 'PUBLISHED' }],
  ['archive', { from: ['DRAFT', 'PENDING_MODERATION', 'PUBLISHED', 'REJECTED'], to: 'ARCHIVED' }],
  ['remoderate', { from: ['PUBLISHED'], to: 'PENDING_MODERATION' }],
]);

export function productTransition(status: string, action: ProductAction): ProductStatus | null {
  const rule = rules.get(action);
  return rule && (rule.from as readonly string[]).includes(status) ? rule.to : null;
}

/** Estados desde los que se admite una acción. */
export function productSources(action: ProductAction): readonly ProductStatus[] {
  return rules.get(action)?.from ?? [];
}

export type ModerationRule = 'title' | 'category' | 'price' | 'images';

interface Watched {
  title: string;
  categorySlug: string;
  priceMinor: number;
}

/** Indica si un cambio obliga a revisar de nuevo un producto publicado. */
export function remoderates(before: Watched, after: Watched, watched: readonly ModerationRule[]): boolean {
  return (
    (watched.includes('title') && before.title !== after.title) ||
    (watched.includes('category') && before.categorySlug !== after.categorySlug) ||
    (watched.includes('price') && before.priceMinor !== after.priceMinor)
  );
}
