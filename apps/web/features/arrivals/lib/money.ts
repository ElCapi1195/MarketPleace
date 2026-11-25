/** Formatea un importe en unidades menores; los decimales dependen de la moneda. */
export function formatMoney(minor: number, currency: string, locale: string): string {
  const format = new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol', trailingZeroDisplay: 'stripIfInteger' });
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
  return format.format(minor / 10 ** digits);
}
