'use client';

import type { StoreReview, StoreStatus, StoreSummaryPage } from '@marketplace/contracts';
import Link from 'next/link';
import { useState } from 'react';
import { SelectField } from '@/features/shared/components/fields';
import { ResourceGate, useResource } from '@/features/shared/components/resource';
import { apiMessage } from '@/features/shared/lib/messages';
import { History } from '@/features/store/components/history';
import { checklist, type Requirement } from '@/features/store/lib/documents';
import { storeStatusLabel } from '@/features/store/lib/status';
import { post } from '@/lib/client-api';
import { availableDecisions } from '../lib/decisions';
import { DecisionPanel } from './decision-panel';

const FILTERS: StoreStatus[] = ['SUBMITTED', 'IN_REVIEW', 'NEEDS_INFO', 'APPROVED', 'SUSPENDED', 'REJECTED'];

export function StoreReviewList({ locale, initialStatus = '' }: { locale: string; initialStatus?: string }) {
  const [status, setStatus] = useState<string>(initialStatus);
  const [page, setPage] = useState(1);
  const { result } = useResource<StoreSummaryPage>(`/api/admin/store-reviews?page=${page}${status ? `&status=${status}` : ''}`);
  return (
    <>
      <div className="max-w-64">
        <SelectField
          label="Estado"
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          placeholder="Todos"
          options={FILTERS.map((value) => ({ value, label: storeStatusLabel(value) }))}
        />
      </div>
      <ResourceGate result={result}>
        {({ items, hasMore }) => (
          <>
            {items.length === 0 && <p className="text-lg">No hay tiendas en este estado.</p>}
            <ul>
              {items.map(({ id, name, status: current, updatedAt }) => (
                <li key={id} className="group relative flex flex-wrap items-baseline justify-between gap-x-4 border-b-2 border-surface py-4">
                  <Link href={`/admin/tiendas/${id}`} className="text-lg font-bold after:absolute after:inset-0 group-hover:underline">
                    {name}
                  </Link>
                  <span>
                    {storeStatusLabel(current)}, {new Date(updatedAt).toLocaleDateString(locale)}
                  </span>
                </li>
              ))}
            </ul>
            {(page > 1 || hasMore) && (
              <div className="flex gap-4">
                <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)} className="min-h-12 cursor-pointer rounded-xl border-2 border-ink px-5 font-bold disabled:opacity-40">
                  Anterior
                </button>
                <button type="button" disabled={!hasMore} onClick={() => setPage(page + 1)} className="min-h-12 cursor-pointer rounded-xl border-2 border-ink px-5 font-bold disabled:opacity-40">
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}
      </ResourceGate>
    </>
  );
}

function Facts({ store }: { store: StoreReview }) {
  const rows = [
    ['Nombre legal', store.legalName],
    ['Identificación fiscal', store.taxId],
    ['Teléfono', store.phone],
    ['Dirección', store.address],
    ['Presentación', store.about],
    ...store.owners.map(({ name, email }) => ['Propietario', `${name}, ${email}`]),
  ].filter(([, value]) => value !== '');
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 border-t-2 border-surface">
      {rows.map(([label, value]) => (
        <div key={`${label}-${value}`} className="col-span-2 grid grid-cols-subgrid border-b-2 border-surface py-2.5">
          <dt>{label}</dt>
          <dd className="text-right font-bold break-words whitespace-pre-line">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

interface Me {
  platformRole: string;
}

export function StoreReviewDetail({ id, requirements, locale }: { id: string; requirements: readonly Requirement[]; locale: string }) {
  const review = useResource<StoreReview>(`/api/admin/store-reviews/${id}`);
  const me = useResource<Me>('/api/me');
  const role = me.result.state === 'ready' ? me.result.data.platformRole : '';

  return (
    <ResourceGate result={review.result}>
      {(store) => (
        <div className="flex flex-col gap-10">
          <p className="text-xl">
            <span className="font-bold">{store.name}.</span> {storeStatusLabel(store.status)}
          </p>
          <Facts store={store} />
          <section aria-labelledby="documents-title" className="flex flex-col gap-3">
            <h2 id="documents-title" className="font-display text-2xl font-extrabold">
              Documentos
            </h2>
            <p>Se descargan como archivo. Cada consulta queda registrada a tu nombre.</p>
            <ul>
              {checklist(requirements, store.documents).map(({ key, label, required, document }) => (
                <li key={key} className="flex flex-wrap items-baseline justify-between gap-4 border-b-2 border-surface py-3">
                  <span className="font-bold">{label}</span>
                  {document ? (
                    <a href={`/api/admin/store-reviews/${id}/documents/${document.id}`} className="font-bold underline">
                      Descargar
                    </a>
                  ) : (
                    <span>{required ? 'Falta' : 'No aportado'}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <DecisionPanel
            key={store.status}
            decisions={availableDecisions(store.status, role)}
            onDecide={async (action, reason) => {
              const result = await post<StoreReview>(`/api/admin/store-reviews/${id}/decision`, { action, reason });
              if (!result.ok) return apiMessage(result);
              review.replace(result.data);
              return null;
            }}
          />
          <History events={store.events} locale={locale} />
        </div>
      )}
    </ResourceGate>
  );
}
