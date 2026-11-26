import type { ProductCard } from '@marketplace/contracts';

const FEW = 3;

/** Texto corto sobre cuándo se puede tener el producto. */
export function availability({ kind, units, availableOn }: Pick<ProductCard, 'kind' | 'units' | 'availableOn'>, now: Date, locale: string): string {
  if (kind === 'SERVICE') return 'Servicio';
  if (kind === 'IN_STOCK') {
    if (units === 0) return 'Agotado';
    if (units === null || units > FEW) return 'Disponible';
    return units === 1 ? 'Queda 1' : `Quedan ${units}`;
  }
  // Las fechas son días sin hora: se comparan como texto, sin zona horaria.
  if (availableOn === null || availableOn < now.toISOString().slice(0, 10)) return 'Fecha por confirmar';
  const date = new Date(availableOn);
  const month = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(date);
  return date.getUTCFullYear() === now.getUTCFullYear() ? `Llega en ${month}` : `Llega en ${month} de ${date.getUTCFullYear()}`;
}
