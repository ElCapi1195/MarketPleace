'use client';

import type { CustomerReservation } from '@marketplace/contracts';
import Link from 'next/link';
import { useState } from 'react';
import { formatMoney } from '@/features/catalog/lib/money';
import { TextArea } from '@/features/shared/components/fields';
import { ResourceGate, useResource } from '@/features/shared/components/resource';
import { apiMessage } from '@/features/shared/lib/messages';
import { post } from '@/lib/client-api';
import { ReportButton } from '@/features/reports/components/report-button';
import { customerCan } from '../lib/actions';
import { deadlineText } from '../lib/deadline';
import { customerStatus } from '../lib/status';
import { Cover, EventList, PaymentList, ProgressBar, RefundNotice, TermsTable } from './parts';

interface ActionsProps {
  reservation: CustomerReservation;
  onChange: (reservation: CustomerReservation) => void;
  reload: () => Promise<void>;
}

function Actions({ reservation, onChange, reload }: ActionsProps) {
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const can = customerCan(reservation.status);

  const act = async (action: 'accept' | 'decline' | 'cancel') => {
    if (action === 'cancel' && reason.trim() === '') return setError('Cuéntale a la tienda por qué cancelas.');
    const result = await post<CustomerReservation>(`/api/reservations/${reservation.id}/${action}`, { version: reservation.version, reason });
    if (result.ok) {
      setCancelling(false);
      setError(null);
      onChange(result.data);
    } else {
      setError(apiMessage(result));
      if (result.status === 409) await reload();
    }
  };

  return (
    <>
      {can.accept && (
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => act('accept')} className="min-h-13 cursor-pointer rounded-xl bg-accent px-6 font-bold text-ink">
            Aceptar propuesta
          </button>
          <button type="button" onClick={() => act('decline')} className="min-h-13 cursor-pointer rounded-xl border-2 border-ink px-6 font-bold">
            No aceptar
          </button>
        </div>
      )}
      {can.cancel && !cancelling && (
        <button type="button" onClick={() => setCancelling(true)} className="min-h-12 cursor-pointer self-start font-bold underline">
          Cancelar la reserva
        </button>
      )}
      {can.cancel && cancelling && (
        <div className="flex flex-col gap-3 rounded-3xl bg-surface p-5">
          <TextArea label="Motivo" value={reason} onChange={setReason} maxLength={1000} />
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => act('cancel')} className="min-h-12 cursor-pointer rounded-xl bg-ink px-5 font-bold text-background">
              Cancelar la reserva
            </button>
            <button type="button" onClick={() => setCancelling(false)} className="min-h-12 cursor-pointer px-3 font-bold underline">
              Mejor no
            </button>
          </div>
        </div>
      )}
      {reservation.status === 'IN_PROGRESS' && <p>La tienda ya compró o empezó tu pedido. Para cancelarla, habla con ella.</p>}
      {error && (
        <p role="alert" className="rounded-xl border-2 border-ink p-3 font-medium">
          {error}
        </p>
      )}
    </>
  );
}

export function CustomerReservationDetail({ id, locale }: { id: string; locale: string }) {
  const { result, reload, replace } = useResource<CustomerReservation>(`/api/reservations/${id}`);
  return (
    <ResourceGate result={result}>
      {(reservation) => {
        const { currency, agreed, offer, paid } = reservation;
        const status = customerStatus(reservation.status);
        const deadline = deadlineText(reservation.expiresAt, new Date());
        return (
          <div className="flex flex-col gap-10">
            <div className="flex items-center gap-4">
              <Cover coverId={reservation.coverId} className="size-24 rounded-2xl sm:size-32" />
              <div className="min-w-0">
                <Link href={`/producto/${reservation.productSlug}`} className="text-xl font-bold underline sm:text-2xl">
                  {reservation.productTitle}
                </Link>
                <p>{reservation.storeName}</p>
                <p>Reserva {reservation.code}</p>
              </div>
            </div>
            <section aria-label="Estado" className="flex flex-col gap-5 rounded-3xl bg-surface p-5 sm:p-7">
              <div>
                <h2 className="font-display text-2xl font-extrabold">{status.title}</h2>
                <p className="text-lg">{status.text}</p>
                {deadline && <p className="font-bold">{deadline}</p>}
              </div>
              <ProgressBar reservation={reservation} depositMinor={agreed.depositMinor} />
            </section>
            {reservation.refundPending && <RefundNotice text={`La tienda debe devolverte ${formatMoney(paid.net, currency, locale)}.`} />}
            <section aria-labelledby="terms-title" className="flex flex-col gap-4">
              <h2 id="terms-title" className="font-display text-2xl font-extrabold">
                {offer ? 'Propuesta de la tienda' : reservation.status === 'PENDING_REVIEW' ? 'Lo que pediste' : 'Lo acordado'}
              </h2>
              <TermsTable terms={offer ?? agreed} previous={offer ? agreed : reservation.requested} currency={currency} locale={locale} />
              <Actions reservation={reservation} onChange={replace} reload={reload} />
            </section>
            {reservation.pickupInfo && (
              <section aria-labelledby="pickup-title" className="flex flex-col gap-2">
                <h2 id="pickup-title" className="font-display text-2xl font-extrabold">
                  Contacto y recogida
                </h2>
                <p className="text-lg whitespace-pre-line">{reservation.pickupInfo}</p>
              </section>
            )}
            {reservation.payments.length > 0 && (
              <section aria-labelledby="payments-title" className="flex flex-col gap-2">
                <h2 id="payments-title" className="font-display text-2xl font-extrabold">
                  Pagos anotados por la tienda
                </h2>
                <PaymentList payments={reservation.payments} currency={currency} locale={locale} />
                <p className="text-lg">
                  Has pagado <strong>{formatMoney(paid.net, currency, locale)}</strong> de {formatMoney(agreed.priceMinor, currency, locale)}.
                </p>
              </section>
            )}
            <EventList events={reservation.events} locale={locale} />
            <ReportButton target={{ reservationId: reservation.id }} label="Tengo un problema con esta reserva" />
          </div>
        );
      }}
    </ResourceGate>
  );
}
