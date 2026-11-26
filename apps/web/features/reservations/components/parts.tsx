'use client';

import type { PaymentView, ReservationEventView, ReservationSummary, Terms } from '@marketplace/contracts';
import { formatMoney } from '@/features/catalog/lib/money';
import { mediaUrl } from '@/features/catalog/lib/media';
import { eventText, paymentKindLabel, paymentMethodLabel, progressOf } from '../lib/status';

export function Cover({ coverId, className }: { coverId: string | null; className: string }) {
  return (
    <span className={`shrink-0 overflow-hidden bg-surface ${className}`}>
      {coverId && <img src={mediaUrl({ id: coverId }, 'sm')} alt="" loading="lazy" className="size-full object-cover" />}
    </span>
  );
}

export function ProgressBar({ reservation, depositMinor }: { reservation: Pick<ReservationSummary, 'status' | 'kind'>; depositMinor: number }) {
  const progress = progressOf({ ...reservation, depositMinor });
  if (!progress) return null;
  const finished = reservation.status === 'COMPLETED';
  return (
    <ol className="grid gap-2 sm:auto-cols-fr sm:grid-flow-col sm:gap-4">
      {progress.steps.map((step, index) => {
        const done = finished || index < progress.current;
        const current = !finished && index === progress.current;
        return (
          <li key={step} aria-current={current ? 'step' : undefined} className="flex items-center gap-3 sm:flex-col sm:items-start">
            <span aria-hidden="true" className={`h-2 w-10 rounded-full sm:w-full ${done ? 'bg-ink' : current ? 'bg-accent' : 'bg-ink/20'}`} />
            <span className={current ? 'font-bold' : ''}>
              {step}
              {done && <span className="sr-only"> (hecho)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

interface TermsTableProps {
  terms: Terms;
  /** Lo anterior, para señalar qué cambia. */
  previous?: Terms | undefined;
  currency: string;
  locale: string;
}

export function TermsTable({ terms, previous, currency, locale }: TermsTableProps) {
  const date = (value: string | null) =>
    value === null ? '' : new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(value));
  const money = (value: number) => formatMoney(value, currency, locale);
  const rows = [
    { label: 'Precio', value: money(terms.priceMinor), before: previous && money(previous.priceMinor) },
    { label: 'Depósito', value: terms.depositMinor > 0 ? money(terms.depositMinor) : 'Sin depósito', before: previous && (previous.depositMinor > 0 ? money(previous.depositMinor) : 'Sin depósito') },
    { label: 'Llegada estimada', value: date(terms.availableOn), before: previous && date(previous.availableOn) },
  ].filter(({ value, before }) => value !== '' || before);
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 border-t-2 border-surface">
      {rows.map(({ label, value, before }) => (
        <div key={label} className="col-span-2 grid grid-cols-subgrid border-b-2 border-surface py-2.5">
          <dt>{label}</dt>
          <dd className="text-right font-bold">
            {before !== undefined && before !== value && <s className="mr-3 font-normal">{before}</s>}
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

interface PaymentListProps {
  payments: readonly PaymentView[];
  currency: string;
  locale: string;
  onReverse?: ((payment: PaymentView) => void) | undefined;
}

export function PaymentList({ payments, currency, locale, onReverse }: PaymentListProps) {
  if (payments.length === 0) return <p>Todavía no hay movimientos anotados.</p>;
  const format = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <ul>
      {payments.map((payment) => (
        <li key={payment.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b-2 border-surface py-3">
          <div className="min-w-48 flex-1">
            <p className="font-bold">
              {payment.reversesId ? `Corrección de ${paymentKindLabel(payment.kind).toLowerCase()}` : paymentKindLabel(payment.kind)}
              {payment.reversed && <span className="font-normal"> (anulado)</span>}
            </p>
            <p className="text-sm">
              {[paymentMethodLabel(payment.method), payment.reference, payment.note].filter(Boolean).join('. ')}
            </p>
            <time dateTime={payment.at} className="text-sm">
              {format.format(new Date(payment.at))}
            </time>
          </div>
          <span className="font-display text-lg font-extrabold">
            {formatMoney(payment.kind === 'REFUND' ? -payment.amountMinor : payment.amountMinor, currency, locale)}
          </span>
          {onReverse && !payment.reversed && payment.reversesId === null && (
            <button type="button" onClick={() => onReverse(payment)} className="min-h-11 cursor-pointer font-bold underline">
              Anular
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function EventList({ events, locale }: { events: readonly ReservationEventView[]; locale: string }) {
  const format = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <section aria-labelledby="events-title" className="flex flex-col gap-3">
      <h2 id="events-title" className="font-display text-2xl font-extrabold">
        Historial
      </h2>
      <ol>
        {events.map((event) => (
          <li key={`${event.at}-${event.action}`} className="border-b-2 border-surface py-3">
            <p className="flex flex-wrap justify-between gap-x-4">
              <span className="font-bold">{eventText(event)}</span>
              <time dateTime={event.at}>{format.format(new Date(event.at))}</time>
            </p>
            {event.reason && <p className="whitespace-pre-line">{event.reason}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function RefundNotice({ text }: { text: string }) {
  return <p className="rounded-2xl bg-accent p-4 font-bold text-ink">{text}</p>;
}
