import { loadSamples } from '@marketplace/verticals/samples';
import { getVertical } from '../../lib/vertical';
import { formatMoney } from './lib/money';
import { monthLabel } from './lib/months';
import type { ArrivalView } from './model';

/** Los datos ficticios exigen una activación explícita, para que nunca aparezcan en producción por descuido. */
export function samplesEnabled(): boolean {
  return process.env.SHOW_SAMPLES === 'true';
}

/** Llegadas abiertas. Hasta que exista el catálogo (F3) solo hay muestras. */
export function getArrivals(now: Date = new Date()): ArrivalView[] {
  if (!samplesEnabled()) return [];
  const { id, currency, locale } = getVertical();
  return loadSamples(id).map(({ slug, priceMinor, depositMinor, ...sample }) => ({
    ...sample,
    id: slug,
    monthName: monthLabel(now, sample.monthsAhead, locale),
    price: formatMoney(priceMinor, currency, locale),
    deposit: depositMinor > 0 ? formatMoney(depositMinor, currency, locale) : null,
  }));
}

export function getArrival(id: string): ArrivalView | undefined {
  return getArrivals().find((arrival) => arrival.id === id);
}
