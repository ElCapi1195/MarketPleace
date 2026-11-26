const MAX_SLUG = 60;

/** Texto comparable: sin tildes, mayúsculas ni signos. Tampoco deja comodines de búsqueda. */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function slugify(text: string): string {
  const slug = fold(text)
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, MAX_SLUG)
    .replace(/^-+|-+$/g, '');
  return slug || 'articulo';
}
