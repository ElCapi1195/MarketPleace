'use client';

import type { ReservationPage } from '@marketplace/contracts';
import Link from 'next/link';
import { useState } from 'react';
import { formatMoney } from '@/features/catalog/lib/money';
import { ResourceGate, useResource } from '@/features/shared/components/resource';
import { deadlineText } from '../lib/deadline';
import { customerStatus } from '../lib/status';
import { Cover } from './parts';

export function MyReservations({ locale }: { locale: string }) {
  const [page, setPage] = useState(1);
  const { result } = useResource<ReservationPage>(`/api/reservations?page=${page}`);
  return (
    <ResourceGate result={result}>
      {({ items, hasMore }) =>
        items.length === 0 && page === 1 ? (
          <p className="text-lg">
            Todavía no has reservado nada.{' '}
            <Link href="/catalogo" className="font-bold underline">
              Mira el catálogo
            </Link>
            .
          </p>
        ) : (
          <>
            <ul>
              {items.map((item) => (
                <li key={item.id} className="group relative flex items-center gap-4 border-b-2 border-surface py-4">
                  <Cover coverId={item.coverId} className="size-18 rounded-xl sm:size-22" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/reservas/${item.id}`} className="block text-lg leading-tight font-bold after:absolute after:inset-0 group-hover:underline">
                      {item.productTitle}
                    </Link>
                    <p className="text-sm">{item.storeName}</p>
                    <p className="font-medium">
                      {customerStatus(item.status).title}
                      {item.status !== 'READY' && item.expiresAt && `. ${deadlineText(item.expiresAt, new Date())}`}
                    </p>
                    {item.refundPending && <p className="font-bold">Devolución pendiente</p>}
                  </div>
                  <span className="hidden font-display text-xl font-extrabold sm:block">{formatMoney(item.priceMinor, item.currency, locale)}</span>
                </li>
              ))}
            </ul>
            <Pager page={page} hasMore={hasMore} onChange={setPage} />
          </>
        )
      }
    </ResourceGate>
  );
}

export function Pager({ page, hasMore, onChange }: { page: number; hasMore: boolean; onChange: (page: number) => void }) {
  if (page === 1 && !hasMore) return null;
  const button = 'min-h-12 cursor-pointer rounded-xl border-2 border-ink px-5 font-bold disabled:opacity-40';
  return (
    <div className="flex gap-4">
      <button type="button" disabled={page === 1} onClick={() => onChange(page - 1)} className={button}>
        Anterior
      </button>
      <button type="button" disabled={!hasMore} onClick={() => onChange(page + 1)} className={button}>
        Siguiente
      </button>
    </div>
  );
}
