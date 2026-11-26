const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Cuánto queda de la espera actual; null si no hay plazo. */
export function deadlineText(expiresAt: string | null, now: Date): string | null {
  if (expiresAt === null) return null;
  const left = new Date(expiresAt).getTime() - now.getTime();
  if (left <= 0) return 'Plazo vencido';
  if (left >= DAY) return `Vence en ${plural(Math.floor(left / DAY), 'día', 'días')}`;
  if (left >= HOUR) return `Vence en ${plural(Math.floor(left / HOUR), 'hora', 'horas')}`;
  return `Vence en ${plural(Math.max(1, Math.floor(left / MINUTE)), 'minuto', 'minutos')}`;
}
