import { z } from 'zod';
import { block, line } from './text.js';

export const listingKinds = ['PREORDER', 'IN_STOCK', 'SERVICE'] as const;
export type ListingKind = (typeof listingKinds)[number];

export const productStatuses = ['DRAFT', 'PENDING_MODERATION', 'PUBLISHED', 'REJECTED', 'ARCHIVED'] as const;
export type ProductStatus = (typeof productStatuses)[number];

export const catalogSorts = ['recent', 'price_asc', 'price_desc', 'soonest'] as const;
export type CatalogSort = (typeof catalogSorts)[number];

/** Archivos admitidos al subir. El servidor comprueba además el contenido real. */
export const imageTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const modelType = 'model/gltf-binary';
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_MODEL_BYTES = 15 * 1024 * 1024;

const MAX_MINOR = 2_000_000_000;
const MAX_ATTRIBUTES = 40;
const MAX_QUERY = 80;

const minor = z.number().int().min(0).max(MAX_MINOR);
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60);

export const productInput = z
  .strictObject({
    storeId: z.uuid(),
    title: line(120).min(3),
    description: block(4000),
    categorySlug: slug,
    kind: z.enum(listingKinds),
    priceMinor: minor,
    depositMinor: minor,
    /** Unidades o cupos; null si no aplica. */
    units: z.number().int().min(0).max(100_000).nullable(),
    /** Fecha estimada de llegada, solo en preventas. */
    availableOn: z.iso.date().nullable(),
    attributes: z
      .record(z.string().max(60), z.union([line(500), z.number(), z.boolean()]))
      .refine((value) => Object.keys(value).length <= MAX_ATTRIBUTES, 'demasiados atributos'),
    featured: z.boolean(),
  })
  .superRefine(({ kind, availableOn, priceMinor, depositMinor }, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    if (depositMinor > priceMinor) issue('depositMinor', 'no puede superar el precio');
    if (kind === 'PREORDER' && availableOn === null) issue('availableOn', 'una preventa necesita fecha');
    if (kind !== 'PREORDER' && availableOn !== null) issue('availableOn', 'solo las preventas llevan fecha');
  });
export type ProductInput = z.output<typeof productInput>;

export const productPatch = z.strictObject({ version: z.number().int().min(1), product: productInput });
export type ProductPatch = z.output<typeof productPatch>;

export const storeInput = z.strictObject({ name: line(80).min(2) });
export type StoreInput = z.output<typeof storeInput>;

export const mediaPatch = z
  .strictObject({ alt: line(160).optional(), position: z.number().int().min(0).max(30).optional() })
  .refine(({ alt, position }) => alt !== undefined || position !== undefined, 'sin cambios');
export type MediaPatch = z.output<typeof mediaPatch>;

/** Parámetros de una URL pública: un valor absurdo equivale a no enviarlo. */
export const catalogQuery = z.object({
  q: z
    .string()
    .transform((value) => value.trim().slice(0, MAX_QUERY))
    .catch(''),
  category: slug.optional().catch(undefined),
  kind: z.enum(listingKinds).optional().catch(undefined),
  sort: z.enum(catalogSorts).catch('recent'),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
});
export type CatalogQuery = z.output<typeof catalogQuery>;
