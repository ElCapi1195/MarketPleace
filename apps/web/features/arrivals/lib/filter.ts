const MAX_QUERY = 80;

interface Searchable {
  name: string;
  storeName: string;
  categorySlug: string;
}

const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Normaliza un parámetro de URL, que puede faltar o venir repetido. */
export function normalizeSearch(value: string | string[] | undefined): string {
  const first = Array.isArray(value) ? value[0] : value;
  return (first ?? '').trim().slice(0, MAX_QUERY);
}

export function filterArrivals<T extends Searchable>(
  arrivals: readonly T[],
  { query = '', categories = [] }: { query?: string; categories?: readonly string[] },
): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  return arrivals.filter((arrival) => {
    if (categories.length > 0 && !categories.includes(arrival.categorySlug)) return false;
    const haystack = fold(`${arrival.name} ${arrival.storeName}`);
    return words.every((word) => haystack.includes(word));
  });
}

/** Categoría y todas sus descendientes; vacío si no existe, es decir, sin filtro. */
export function categoryBranch(categories: readonly { slug: string; parent?: string | undefined }[], root: string): string[] {
  if (!categories.some(({ slug }) => slug === root)) return [];
  const branch = [root];
  // El nicho se valida sin ciclos, así que el recorrido siempre termina.
  for (const current of branch) {
    for (const { slug, parent } of categories) if (parent === current) branch.push(slug);
  }
  return branch;
}
