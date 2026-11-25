import { z } from 'zod';

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug en minúsculas con guiones');
const label = z.string().trim().min(1).max(80);
const positiveInt = z.number().int().positive();

// XXX significa "sin moneda" en ISO 4217, aunque Intl la liste.
const currencies = new Set(Intl.supportedValuesOf('currency').filter((code) => code !== 'XXX'));

const attributeBase = {
  key: z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'clave en camelCase'),
  label,
  required: z.boolean().default(false),
  filterable: z.boolean().default(false),
};

const attributeSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...attributeBase, type: z.literal('text'), maxLength: positiveInt.max(500).default(120) }),
  z.strictObject({ ...attributeBase, type: z.literal('number'), min: z.number().optional(), max: z.number().optional() }),
  z.strictObject({ ...attributeBase, type: z.literal('boolean') }),
  z.strictObject({
    ...attributeBase,
    type: z.literal('select'),
    options: z.array(z.strictObject({ value: slug, label })).min(1),
  }),
]);

const categorySchema = z.strictObject({
  slug,
  name: label,
  parent: slug.optional(),
  attributes: z.array(attributeSchema).superRefine((attributes, ctx) => {
    const seen = new Set<string>();
    attributes.forEach(({ key }, index) => {
      if (seen.has(key)) ctx.addIssue({ code: 'custom', path: [index, 'key'], message: `atributo ${key} repetido` });
      seen.add(key);
    });
  }),
});

const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i, 'color #rrggbb');

export const reservationKinds = ['PREORDER', 'IN_STOCK', 'SERVICE'] as const;

export const verticalSchema = z
  .strictObject({
    id: slug,
    locale: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/),
    currency: z.string().refine((code) => currencies.has(code), 'moneda ISO 4217 no válida'),
    brand: z.strictObject({
      name: label,
      tagline: z.string().trim().min(1).max(160),
      colors: z.strictObject({ background: hexColor, surface: hexColor, text: hexColor, accent: hexColor }),
    }),
    categories: z.array(categorySchema).min(1),
    reservations: z.strictObject({
      kinds: z.array(z.enum(reservationKinds)).min(1),
      reviewHours: positiveInt,
      customerResponseHours: positiveInt,
      depositHours: positiveInt,
      pickupHours: positiveInt,
      maxActivePerCustomer: positiveInt,
    }),
    listings: z.strictObject({
      remoderateOn: z.array(z.enum(['title', 'category', 'price', 'images'])),
      maxImages: positiveInt.max(30),
    }),
    storeVerification: z.strictObject({
      documents: z.array(z.strictObject({ key: slug, label, required: z.boolean() })).min(1),
    }),
  })
  .superRefine(({ categories }, ctx) => {
    const bySlug = new Map(categories.map((category) => [category.slug, category]));
    const seen = new Set<string>();

    categories.forEach((category, index) => {
      if (seen.has(category.slug)) {
        ctx.addIssue({ code: 'custom', path: ['categories', index, 'slug'], message: `categoría ${category.slug} duplicada` });
      }
      seen.add(category.slug);

      if (category.parent && !bySlug.has(category.parent)) {
        ctx.addIssue({ code: 'custom', path: ['categories', index, 'parent'], message: `el padre ${category.parent} no existe` });
      }

      const visited = new Set<string>();
      for (let current: string | undefined = category.slug; current; current = bySlug.get(current)?.parent) {
        if (visited.has(current)) {
          ctx.addIssue({ code: 'custom', path: ['categories', index, 'parent'], message: `ciclo en ${category.slug}` });
          break;
        }
        visited.add(current);
      }
    });
  });

export type VerticalConfig = z.output<typeof verticalSchema>;
export type VerticalInput = z.input<typeof verticalSchema>;
export type AttributeInput = VerticalInput['categories'][number]['attributes'][number];
