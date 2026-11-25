/** Nombre del mes que está `ahead` meses después de `from`. Parte del día 1 para no saltarse meses cortos. */
export function monthLabel(from: Date, ahead: number, locale: string): string {
  const month = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + ahead, 1));
  const name = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(month);
  return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
}
