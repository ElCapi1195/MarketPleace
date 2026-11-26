'use client';

import type { ReservationPage, ReservationStatus } from '@marketplace/contracts';
import Link from 'next/link';
import { useState } from 'react';
import { formatMoney } from '@/features/catalog/lib/money';
import { SelectField } from '@/features/shared/components/fields';
import { ResourceGate, useResource } from '@/features/shared/components/resource';
import { StoreShell } from '@/features/store/components/store-area';
import { deadlineText } from '../lib/deadline';
import { storeStatus } from '../lib/status';
import { Pager } from './my-reservations';
import { Cover } from './parts';

const FILTERS: ReservationStatus[] = ['PENDING_REVIEW', 'AWAITING_CUSTOMER', 'AWAITING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS', 'READY', 'COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED', 'NO_SHOW'];
const REFUND = 'refund';

function List({ storeId, locale }: { storeId: string; locale: string }) {
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const query = filter === REFUND ? '&refund=pending' : filter ? `&status=${filter}` : '';
  const { result } = useResource<ReservationPage>(`/api/stores/${storeId}/reservations?page=${page}${query}`);
  return (
    <>
      <div className="max-w-72">
        <SelectField
          label="Mostrar"
          value={filter}
          onChange={(value) => {
            setFilter(value);
            setPage(1);
          }}
          placeholder="Todas"
          options={[{ value: REFUND, label: 'Devolución pendiente' }, ...FILTERS.map((value) => ({ value, label: storeStatus(value) }))]}
        />
      </div>
      <ResourceGate result={result}>
        {({ items, hasMore }) => (
          <>
            {items.length === 0 && <p className="text-lg">No hay reservas aquí.</p>}
            <ul>
              {items.map((item) => {
                const deadline = deadlineText(item.expiresAt, new Date());
                return (
                  <li key={item.id} className="group relative flex items-center gap-4 border-b-2 border-surface py-4">
                    <Cover coverId={item.coverId} className="size-16 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <Link href={`/tienda/${storeId}/reservas/${item.id}`} className="block font-bold after:absolute after:inset-0 group-hover:underline">
                        {item.productTitle}
                      </Link>
                      <p className="text-sm">{item.code}</p>
                      {item.refundPending && <p className="font-bold">Devolución pendiente</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{storeStatus(item.status)}</p>
                      {deadline && <p className="text-sm">{deadline}</p>}
                      <p className="hidden sm:block">{formatMoney(item.priceMinor, item.currency, locale)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <Pager page={page} hasMore={hasMore} onChange={setPage} />
          </>
        )}
      </ResourceGate>
    </>
  );
}

export function StoreReservations({ id, locale }: { id: string; locale: string }) {
  return (
    <StoreShell id={id}>
      {(store) => (
        <>
          {store.pickupInfo === '' && store.status === 'APPROVED' && (
            <p className="rounded-2xl bg-accent p-4 font-bold text-ink">
              Antes de aprobar, explica cómo contactarte y dónde se recoge.{' '}
              <Link href={`/tienda/${id}`} className="underline">
                Escribirlo
              </Link>
            </p>
          )}
          <List storeId={id} locale={locale} />
        </>
      )}
    </StoreShell>
  );
}
