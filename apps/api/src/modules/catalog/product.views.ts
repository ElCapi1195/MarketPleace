import type { AdminProduct, ListingKind, ProductCard, ProductDetail, ProductStatus } from '@marketplace/contracts';
import type { Product, ProductMedia, Store } from '../../generated/prisma/client.js';
import { mediaView } from '../media/media.views.js';

export type ProductRow = Product & { store: Store; media: ProductMedia[] };

const dateOnly = (date: Date | null) => date?.toISOString().slice(0, 10) ?? null;
// La base garantiza con restricciones los valores de estas columnas.
const kindOf = (row: ProductRow) => row.kind as ListingKind;
const attributesOf = (row: ProductRow) => row.attributes as ProductDetail['attributes'];
const imagesOf = (row: ProductRow) => row.media.filter(({ kind }) => kind === 'IMAGE').map(mediaView);

export function cardView(row: ProductRow): ProductCard {
  return {
    slug: row.slug,
    title: row.title,
    categorySlug: row.categorySlug,
    kind: kindOf(row),
    priceMinor: row.priceMinor,
    units: row.units,
    availableOn: dateOnly(row.availableOn),
    storeName: row.store.name,
    cover: imagesOf(row)[0] ?? null,
    hasModel: row.media.some(({ kind }) => kind === 'MODEL'),
  };
}

export function detailView(row: ProductRow): ProductDetail {
  const model = row.media.find(({ kind }) => kind === 'MODEL');
  return {
    ...cardView(row),
    description: row.description,
    depositMinor: row.depositMinor,
    attributes: attributesOf(row),
    images: imagesOf(row),
    model: model ? mediaView(model) : null,
  };
}

export function adminView(row: ProductRow): AdminProduct {
  return {
    id: row.id,
    version: row.version,
    slug: row.slug,
    status: row.status as ProductStatus,
    store: { id: row.store.id, name: row.store.name },
    title: row.title,
    description: row.description,
    categorySlug: row.categorySlug,
    kind: kindOf(row),
    priceMinor: row.priceMinor,
    depositMinor: row.depositMinor,
    units: row.units,
    availableOn: dateOnly(row.availableOn),
    attributes: attributesOf(row),
    featured: row.featured,
    rejection: row.rejection,
    media: row.media.map(mediaView),
    updatedAt: row.updatedAt.toISOString(),
  };
}
