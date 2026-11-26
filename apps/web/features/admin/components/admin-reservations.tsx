'use client';

import type { ReservationPage, ReservationStatus, StoreReservation } from '@marketplace/contracts';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { formatMoney } from '@/features/catalog/lib/money';
import { Pager } from '@/features/reservations/components/my-reservations';
import { Cover, EventList, PaymentList, ProgressBar, RefundNotice, TermsTable } from '@/features/reservations/components/parts';
import { storeStatus } from '@/features/reservations/lib/status';
import { SelectField, TextArea, TextField } from '@/features/shared/components/fields';
import { ResourceGate, useResource } from '@/features/shared/components/resource';
import { apiMessage } from '@/features/shared/lib/messages';
import { post } from '@/lib/client-api';

const STATUSES: ReservationStatus[] = ['PENDING_REVIEW', 'AWAITING_CUSTOMER', 'AWAITING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS', 'READY', 'COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED', 'NO_SHOW'];
const REFUND = 'refund';

export function AdminReservationList({ locale, refundOnly }: { locale: string; refundOnly: boolean }) {
  const [filter, setFilter] = useState(refundOnly ? REFUND : '');
  const [code, setCode] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const query = [`page=${page}`, filter === REFUND ? 'refund=pending' : filter && `status=${filter}`, search && `code=${encodeURIComponent(search)}`].filter(Boolean).join('&');
  const { result } = useResource<ReservationPage>(`/api/admin/reservations?${query}`);

  const find = (event: FormEvent) => {
    event.preventDefault();
    setSearch(code.trim());
    setPage(1);
  };

  return (
    <>
      <form onSubmit={find} className="grid items-end gap-4 sm:grid-cols-[16rem_14rem_auto]">
        <SelectField
          label="Mostrar"
          value={filter}
          onChange={(value) => {
            setFilter(value);
            setPage(1);
          }}
          placeholder="Todas"
          options={[{ value: REFUND, label: 'Devolución pendiente' }, ...STATUSES.map((value) => ({ value, label: storeStatus(value) }))]}
        />
        <TextField label="Código" value={code} onChange={setCode} maxLength={9} placeholder="ABCD-2345" />
        <button type="submit" className="h-12 cursor-pointer rounded-xl bg-ink px-5 font-bold text-background">
          Buscar
        </button>
      </form>
      <ResourceGate result={result}>
        {({ items, hasMore }) => (
          <>
            {items.length === 0 && <p className="text-lg">No hay reservas con esos filtros.</p>}
            <ul>
              {items.map((item) => (
                <li key={item.id} className="group relative flex items-center gap-4 border-b-2 border-surface py-3">
                  <Cover coverId={item.coverId} className="size-14 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/reservas/${item.id}`} className="block font-bold after:absolute after:inset-0 group-hover:underline">
                      {item.productTitle}
                    </Link>
                    <p className="text-sm">
                      {item.code}. {item.storeName}
                    </p>
                    {item.refundPending && <p className="font-bold">Devolución pendiente</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{storeStatus(item.status)}</p>
                    <p className="hidden text-sm sm:block">{formatMoney(item.priceMinor, item.currency, locale)}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Pager page={page} hasMore={hasMore} onChange={setPage} />
          </>
        )}
      </ResourceGate>
    </>
  );
}

function CancelPanel({ reservation, onChange }: { reservation: StoreReservation; onChange: (value: StoreReservation) => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const cancel = async () => {
    if (reason.trim().length < 3) return setError('Explica el motivo: ambas partes lo recibirán.');
    const result = await post<StoreReservation>(`/api/admin/reservations/${reservation.id}/cancel`, { version: reservation.version, reason });
    if (result.ok) onChange(result.data);
    else setError(apiMessage(result));
  };
  return (
    <section aria-labelledby="intervene-title" className="flex flex-col gap-3 rounded-3xl bg-surface p-5 sm:p-7">
      <h2 id="intervene-title" className="font-display text-2xl font-extrabold">
        Intervenir
      </h2>
      <p>Cancelar desde la plataforma libera la unidad y avisa al cliente y a la tienda. Queda a tu nombre en el historial.</p>
      <TextArea label="Motivo" value={reason} onChange={setReason} maxLength={1000} />
      {error && (
        <p role="alert" className="font-medium">
          {error}
        </p>
      )}
      <button type="button" onClick={cancel} className="min-h-12 cursor-pointer self-start rounded-xl bg-ink px-5 font-bold text-background">
        Cancelar la reserva
      </button>
    </section>
  );
}

const CANCELLABLE = ['PENDING_REVIEW', 'AWAITING_CUSTOMER', 'AWAITING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS', 'READY'];

export function AdminReservationDetail({ id, locale }: { id: string; locale: string }) {
  const { result, replace } = useResource<StoreReservation>(`/api/admin/reservations/${id}`);
  return (
    <ResourceGate result={result}>
      {(reservation) => (
        <div className="flex flex-col gap-10">
          <p className="rounded-2xl border-2 border-ink p-4">Esta consulta queda registrada a tu nombre.</p>
          <div className="flex items-center gap-4">
            <Cover coverId={reservation.coverId} className="size-20 rounded-2xl" />
            <div>
              <p className="text-xl font-bold">{reservation.productTitle}</p>
              <p>
                {reservation.code}. {reservation.storeName}
              </p>
              <p className="font-bold">{storeStatus(reservation.status)}</p>
            </div>
          </div>
          <ProgressBar reservation={reservation} depositMinor={reservation.agreed.depositMinor} />
          {reservation.refundPending && (
            <RefundNotice text={`La tienda conserva ${formatMoney(reservation.paid.net, reservation.currency, locale)} del cliente.`} />
          )}
          <section className="flex flex-col gap-3">
            <h2 className="font-display text-2xl font-extrabold">Lo acordado</h2>
            <TermsTable terms={reservation.agreed} previous={reservation.requested} currency={reservation.currency} locale={locale} />
          </section>
          <section className="flex flex-col gap-1">
            <h2 className="font-display text-2xl font-extrabold">Cliente</h2>
            <p className="font-bold">{reservation.customer.name}</p>
            <p className="break-all">{[reservation.customer.email, reservation.customer.phone].filter(Boolean).join(', ')}</p>
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="font-display text-2xl font-extrabold">Dinero</h2>
            <PaymentList payments={reservation.payments} currency={reservation.currency} locale={locale} />
          </section>
          {CANCELLABLE.includes(reservation.status) && <CancelPanel key={reservation.version} reservation={reservation} onChange={replace} />}
          <EventList events={reservation.events} locale={locale} />
        </div>
      )}
    </ResourceGate>
  );
}
