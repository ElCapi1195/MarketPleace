'use client';

import { storeCan } from '@marketplace/core';
import type { StoreDetail, StoreReservation } from '@marketplace/contracts';
import { useState } from 'react';
import { formatMoney } from '@/features/catalog/lib/money';
import { TextArea } from '@/features/shared/components/fields';
import { ResourceGate, useResource } from '@/features/shared/components/resource';
import { apiMessage } from '@/features/shared/lib/messages';
import { StoreShell } from '@/features/store/components/store-area';
import { post } from '@/lib/client-api';
import { storeActions } from '../lib/actions';
import { deadlineText } from '../lib/deadline';
import { storeStatus } from '../lib/status';
import { ApprovalPanel } from './approval-panel';
import { PaymentPanel } from './payment-panel';
import { Cover, EventList, ProgressBar, RefundNotice, TermsTable } from './parts';

function Customer({ customer }: { customer: StoreReservation['customer'] }) {
  const history = [
    customer.completed > 0 && `${customer.completed} completadas`,
    customer.rejected > 0 && `${customer.rejected} rechazadas`,
    customer.noShow > 0 && `${customer.noShow} sin presentarse`,
  ].filter(Boolean);
  return (
    <section aria-labelledby="customer-title" className="flex flex-col gap-1">
      <h2 id="customer-title" className="font-display text-2xl font-extrabold">
        Cliente
      </h2>
      <p className="text-lg font-bold">{customer.name}</p>
      {customer.email === null ? <p>Verás su contacto cuando apruebes la reserva.</p> : <p className="break-all">{[customer.email, customer.phone].filter(Boolean).join(', ')}</p>}
      <p>{history.length > 0 ? `Reservas anteriores: ${history.join(', ')}.` : 'Sin reservas anteriores.'}</p>
    </section>
  );
}

function Decisions({ base, reservation, onChange, reload }: { base: string; reservation: StoreReservation; onChange: (value: StoreReservation) => void; reload: () => Promise<void> }) {
  const [closing, setClosing] = useState<{ action: string; label: string } | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const actions = storeActions(reservation, new Date());

  const send = async (body: object) => {
    const result = await post<StoreReservation>(`${base}/actions`, { version: reservation.version, ...body });
    if (result.ok) {
      setClosing(null);
      setReason('');
      setError(null);
      onChange(result.data);
    } else {
      setError(apiMessage(result));
      if (result.code === 'VERSION_CONFLICT' || result.code === 'INVALID_TRANSITION') await reload();
    }
  };

  if (actions.length === 0 && !error) return null;
  const advance = actions.filter(({ action, needsReason }) => !needsReason && action !== 'approve');
  const stop = actions.filter(({ needsReason }) => needsReason);
  return (
    <section aria-labelledby="decision-title" className="flex flex-col gap-4 rounded-3xl bg-surface p-5 sm:p-7">
      <h2 id="decision-title" className="font-display text-2xl font-extrabold">
        Siguiente paso
      </h2>
      {reservation.status === 'AWAITING_DEPOSIT' && <p>Cuando recibas el depósito, anótalo en «Dinero» y la reserva se confirmará sola.</p>}
      {reservation.status === 'AWAITING_CUSTOMER' && <p>El cliente está decidiendo sobre tu propuesta.</p>}
      {actions.some(({ action }) => action === 'approve') && (
        <ApprovalPanel key={reservation.version} reservation={reservation} onApprove={(offer) => send({ action: 'approve', offer })} />
      )}
      <div className="flex flex-wrap gap-3">
        {advance.map(({ action, label }, index) => (
          <button key={action} type="button" onClick={() => send({ action })} className={`min-h-13 cursor-pointer rounded-xl px-6 font-bold ${index === 0 ? 'bg-accent text-ink' : 'border-2 border-ink'}`}>
            {label}
          </button>
        ))}
        {!closing &&
          stop.map((item) => (
            <button key={item.action} type="button" onClick={() => setClosing(item)} className="min-h-13 cursor-pointer px-3 font-bold underline">
              {item.label}
            </button>
          ))}
      </div>
      {closing && (
        <div className="flex flex-col gap-3">
          <TextArea label="Motivo" value={reason} onChange={setReason} maxLength={1000} hint="El cliente lo leerá." />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => (reason.trim().length < 3 ? setError('Explica el motivo.') : send({ action: closing.action, reason }))}
              className="min-h-12 cursor-pointer rounded-xl bg-ink px-5 font-bold text-background"
            >
              {closing.label}
            </button>
            <button type="button" onClick={() => setClosing(null)} className="min-h-12 cursor-pointer px-3 font-bold underline">
              Volver
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="font-medium">
          {error}
        </p>
      )}
    </section>
  );
}

function Detail({ store, id, locale }: { store: StoreDetail; id: string; locale: string }) {
  const base = `/api/stores/${store.id}/reservations/${id}`;
  const { result, reload, replace } = useResource<StoreReservation>(base);
  const canDecide = storeCan(store.role, 'reservation.approve') && store.status === 'APPROVED';
  return (
    <ResourceGate result={result}>
      {(reservation) => {
        const deadline = deadlineText(reservation.expiresAt, new Date());
        return (
          <div className="flex flex-col gap-10">
            <div className="flex items-center gap-4">
              <Cover coverId={reservation.coverId} className="size-20 rounded-2xl" />
              <div className="min-w-0">
                <p className="text-xl font-bold">{reservation.productTitle}</p>
                <p>Reserva {reservation.code}</p>
                <p className="font-bold">
                  {storeStatus(reservation.status)}
                  {deadline && `. ${deadline}`}
                </p>
              </div>
            </div>
            <ProgressBar reservation={reservation} depositMinor={reservation.agreed.depositMinor} />
            {reservation.refundPending && (
              <RefundNotice text={`Debes devolver ${formatMoney(reservation.paid.net, reservation.currency, locale)} al cliente. Anótalo cuando lo hagas.`} />
            )}
            {canDecide && <Decisions base={base} reservation={reservation} onChange={replace} reload={reload} />}
            <section aria-labelledby="terms-title" className="flex flex-col gap-3">
              <h2 id="terms-title" className="font-display text-2xl font-extrabold">
                {reservation.offer ? 'Tu propuesta' : reservation.status === 'PENDING_REVIEW' ? 'Lo que pide' : 'Lo acordado'}
              </h2>
              <TermsTable terms={reservation.offer ?? reservation.agreed} previous={reservation.offer ? reservation.agreed : reservation.requested} currency={reservation.currency} locale={locale} />
              {reservation.note && <p className="whitespace-pre-line">Mensaje del cliente: {reservation.note}</p>}
            </section>
            <Customer customer={reservation.customer} />
            <PaymentPanel base={base} reservation={reservation} locale={locale} canWrite={canDecide} onChange={replace} />
            <EventList events={reservation.events} locale={locale} />
          </div>
        );
      }}
    </ResourceGate>
  );
}

export function StoreReservationDetail({ storeId, id, locale }: { storeId: string; id: string; locale: string }) {
  return <StoreShell id={storeId}>{(store) => <Detail store={store} id={id} locale={locale} />}</StoreShell>;
}
