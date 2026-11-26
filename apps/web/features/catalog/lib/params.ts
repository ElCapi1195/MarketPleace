import { catalogSorts, type CatalogSort, type ListingKind } from '@marketplace/contracts';

const MAX_QUERY = 80;

/** Nombres de la URL, en español, y su valor en la API. */
export const kinds = [
  { value: 'disponible', label: 'Disponible', api: 'IN_STOCK' },
  { value: 'preventa', label: 'Preventa', api: 'PREORDER' },
  { value: 'servicio', label: 'Servicio', api: 'SERVICE' },
] as const satisfies readonly { value: string; label: string; api: ListingKind }[];

export const sorts = [
  { value: 'reciente', label: 'Más reciente', api: 'recent' },
  { value: 'precio-asc', label: 'Precio más bajo', api: 'price_asc' },
  { value: 'precio-desc', label: 'Precio más alto', api: 'price_desc' },
  { value: 'llegada', label: 'Llega antes', api: 'soonest' },
] as const satisfies readonly { value: string; label: string; api: CatalogSort }[];

export interface Filters {
  q: string;
  category: string;
  kind: string;
  sort: string;
  page: number;
}

type Params = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => ((Array.isArray(value) ? value[0] : value) ?? '').trim().slice(0, MAX_QUERY);
const known = (options: readonly { value: string }[], value: string) => (options.some((option) => option.value === value) ? value : '');

export function readFilters(params: Params): Filters {
  const page = Number(first(params.pagina));
  return {
    q: first(params.q),
    category: first(params.categoria),
    kind: known(kinds, first(params.tipo)),
    sort: known(sorts, first(params.orden)),
    page: Number.isInteger(page) && page > 1 && page <= 1000 ? page : 1,
  };
}

export function catalogHref({ q, category, kind, sort, page }: Partial<Filters>): string {
  const query = new URLSearchParams();
  if (q) query.set('q', q);
  if (category) query.set('categoria', category);
  if (kind) query.set('tipo', kind);
  if (sort) query.set('orden', sort);
  if (page !== undefined && page > 1) query.set('pagina', String(page));
  return query.size > 0 ? `/catalogo?${query}` : '/catalogo';
}

export function toApiQuery({ q, category, kind, sort, page }: Filters): string {
  const query = new URLSearchParams();
  if (q) query.set('q', q);
  if (category) query.set('category', category);
  const apiKind = kinds.find(({ value }) => value === kind)?.api;
  if (apiKind) query.set('kind', apiKind);
  query.set('sort', sorts.find(({ value }) => value === sort)?.api ?? catalogSorts[0]);
  query.set('page', String(page));
  return query.toString();
}
