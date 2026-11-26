import type { AdminProduct, ListingKind, ProductInput } from '@marketplace/contracts';
import { parseMoney, writeMoney } from '@/features/catalog/lib/money';

export interface FormAttribute {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  required: boolean;
  options?: readonly { value: string; label: string }[] | undefined;
}

export interface FormContext {
  currency: string;
  categories: readonly { slug: string; name: string; attributes: readonly FormAttribute[] }[];
}

/** Campos tal como se escriben. Las características van como `attributes.<clave>`. */
export type Values = Record<string, string>;

type Result = { ok: true; input: ProductInput } | { ok: false; error: string };

const field = (key: string) => `attributes.${key}`;

export function emptyValues({ categories }: FormContext): Values {
  return {
    storeId: '',
    title: '',
    description: '',
    categorySlug: categories[0]?.slug ?? '',
    kind: 'IN_STOCK',
    price: '',
    deposit: '',
    units: '',
    availableOn: '',
    featured: '',
  };
}

type Saved = Omit<ProductInput, 'storeId'> & Pick<AdminProduct, 'store'>;

export function toValues(product: Saved, { currency }: FormContext): Values {
  const values: Values = {
    storeId: product.store.id,
    title: product.title,
    description: product.description,
    categorySlug: product.categorySlug,
    kind: product.kind,
    price: writeMoney(product.priceMinor, currency),
    deposit: product.depositMinor > 0 ? writeMoney(product.depositMinor, currency) : '',
    units: product.units === null ? '' : String(product.units),
    availableOn: product.availableOn ?? '',
    featured: product.featured ? 'on' : '',
  };
  for (const [key, value] of Object.entries(product.attributes)) {
    values[field(key)] = typeof value === 'boolean' ? (value ? 'on' : '') : typeof value === 'number' ? String(value).replace('.', ',') : value;
  }
  return values;
}

function readAttributes(definitions: readonly FormAttribute[], values: Values): ProductInput['attributes'] | string {
  const attributes: ProductInput['attributes'] = {};
  for (const { key, label, type, required } of definitions) {
    const text = (values[field(key)] ?? '').trim();
    if (type === 'boolean') {
      attributes[key] = text !== '';
    } else if (text === '') {
      if (required) return `Completa «${label}».`;
    } else if (type === 'number') {
      const value = Number(text.replace(',', '.'));
      if (!Number.isFinite(value)) return `Revisa «${label}»: debe ser un número.`;
      attributes[key] = value;
    } else attributes[key] = text;
  }
  return attributes;
}

/** Convierte lo escrito en la entrada de la API o explica el primer problema. */
export function toInput(values: Values, { currency, categories }: FormContext): Result {
  const fail = (error: string): Result => ({ ok: false, error });
  const text = (key: string) => (values[key] ?? '').trim();
  const kind = text('kind') as ListingKind;

  if (text('storeId') === '') return fail('Elige la tienda.');
  if (text('title').length < 3) return fail('El título necesita al menos 3 caracteres.');
  const priceMinor = parseMoney(text('price'), currency);
  if (priceMinor === null) return fail('Revisa el precio. Ejemplo: 549,90');
  const depositMinor = text('deposit') === '' ? 0 : parseMoney(text('deposit'), currency);
  if (depositMinor === null) return fail('Revisa el depósito. Ejemplo: 100');
  if (depositMinor > priceMinor) return fail('El depósito no puede superar el precio.');
  const units = kind === 'SERVICE' || text('units') === '' ? null : Number(text('units'));
  if (units !== null && !(Number.isInteger(units) && units >= 0)) return fail('Las unidades deben ser un número entero.');
  if (kind === 'PREORDER' && text('availableOn') === '') return fail('Una preventa necesita la fecha estimada de llegada.');

  const category = categories.find(({ slug }) => slug === text('categorySlug'));
  if (!category) return fail('Elige la categoría.');
  const attributes = readAttributes(category.attributes, values);
  if (typeof attributes === 'string') return fail(attributes);

  return {
    ok: true,
    input: {
      storeId: text('storeId'),
      title: text('title'),
      description: text('description'),
      categorySlug: category.slug,
      kind,
      priceMinor,
      depositMinor,
      units,
      availableOn: kind === 'PREORDER' ? text('availableOn') : null,
      attributes,
      featured: text('featured') !== '',
    },
  };
}
