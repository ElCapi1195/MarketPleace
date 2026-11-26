const MAX_MINOR = 2_000_000_000;

function digitsOf(currency: string): number {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

/** Formatea un importe en unidades menores; los decimales dependen de la moneda. */
export function formatMoney(minor: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    trailingZeroDisplay: 'stripIfInteger',
  }).format(minor / 10 ** digitsOf(currency));
}

/**
 * Interpreta un importe escrito a mano, con coma o punto, y lo devuelve en unidades menores.
 * El último separador es decimal salvo que le sigan tres cifras. Null si no es un importe exacto.
 */
export function parseMoney(text: string, currency: string): number | null {
  const clean = text.trim();
  const digits = digitsOf(currency);
  const match = /^(\d+|[1-9]\d{0,2}(?:([.,])\d{3})(?:\2\d{3})*)(?:([.,])(\d{1,2}))?$/.exec(clean);
  if (!match) return null;
  const [, whole = '', thousands, decimal, fraction = ''] = match;
  if (thousands !== undefined && thousands === decimal) return null;
  if (fraction.length > digits) return null;
  // Se opera con enteros: 0,1 en coma flotante no es exacto.
  const minor = Number(whole.replace(/[.,]/g, '') + fraction.padEnd(digits, '0'));
  return minor <= MAX_MINOR ? minor : null;
}
