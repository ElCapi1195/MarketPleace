import type { StoreEventView } from '@marketplace/contracts';
import { eventLabel } from '../lib/status';

export function History({ events, locale }: { events: readonly StoreEventView[]; locale: string }) {
  if (events.length === 0) return null;
  const format = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <section aria-labelledby="history-title" className="flex flex-col gap-3">
      <h2 id="history-title" className="font-display text-2xl font-extrabold">
        Historial
      </h2>
      <ol className="flex flex-col">
        {events.map(({ at, action, reason }) => (
          <li key={`${at}-${action}`} className="border-b-2 border-surface py-3">
            <p className="flex flex-wrap justify-between gap-x-4">
              <span className="font-bold">{eventLabel(action)}</span>
              <time dateTime={at}>{format.format(new Date(at))}</time>
            </p>
            {reason && <p className="whitespace-pre-line">{reason}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}
