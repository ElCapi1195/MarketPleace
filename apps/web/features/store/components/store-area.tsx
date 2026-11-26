'use client';

import type { StoreDetail } from '@marketplace/contracts';
import { storeCan, storeEditable } from '@marketplace/core';
import { useState, type ReactNode } from 'react';
import { ResourceGate, useResource } from '@/features/shared/components/resource';
import { SectionNav } from '@/features/shared/components/section-nav';
import { apiMessage } from '@/features/shared/lib/messages';
import { patch, post } from '@/lib/client-api';
import type { Requirement } from '../lib/documents';
import { ApplicationForm } from './application-form';
import { DocumentList } from './document-list';
import { History } from './history';
import { Progress } from './progress';

export function StoreNav({ store }: { store: StoreDetail }) {
  const links = [{ href: `/tienda/${store.id}`, label: 'Tienda' }];
  if (storeCan(store.role, 'product.manage')) links.push({ href: `/tienda/${store.id}/productos`, label: 'Productos' });
  if (storeCan(store.role, 'member.manage')) links.push({ href: `/tienda/${store.id}/equipo`, label: 'Equipo' });
  return (
    <div className="flex flex-col gap-3">
      <p className="text-lg font-bold">{store.name}</p>
      <SectionNav label="Tu tienda" links={links} />
    </div>
  );
}

/** Carga la tienda y muestra sus pestañas sobre el contenido. */
export function StoreShell({ id, children }: { id: string; children: (store: StoreDetail, reload: () => Promise<void>) => ReactNode }) {
  const { result, reload } = useResource<StoreDetail>(`/api/stores/${id}`);
  return (
    <ResourceGate result={result}>
      {(store) => (
        <>
          <StoreNav store={store} />
          {children(store, reload)}
        </>
      )}
    </ResourceGate>
  );
}

function Submit({ store, onChange }: { store: StoreDetail; onChange: () => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    const result = await post(`/api/stores/${store.id}/submit`, {});
    setError(result.ok ? null : apiMessage(result));
    if (result.ok) await onChange();
  };
  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-surface p-5 sm:p-7">
      <p className="text-lg">Cuando todo esté completo, envíala. Mientras la revisamos no podrás cambiarla.</p>
      <button type="button" onClick={send} className="min-h-13 cursor-pointer self-start rounded-xl bg-accent px-6 font-bold text-ink">
        Enviar a revisión
      </button>
      {error && (
        <p role="alert" className="font-medium">
          {error}
        </p>
      )}
    </div>
  );
}

function Summary({ store }: { store: StoreDetail }) {
  const rows = [
    ['Presentación', store.about],
    ['Nombre legal', store.legalName],
    ['Identificación fiscal', store.taxId],
    ['Teléfono', store.phone],
    ['Dirección', store.address],
  ].filter(([, value]) => value !== '');
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 border-t-2 border-surface">
      {rows.map(([label, value]) => (
        <div key={label} className="col-span-2 grid grid-cols-subgrid border-b-2 border-surface py-2.5">
          <dt>{label}</dt>
          <dd className="text-right font-bold whitespace-pre-line">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function StoreHome({ id, requirements, locale }: { id: string; requirements: readonly Requirement[]; locale: string }) {
  return (
    <StoreShell id={id}>
      {(store, reload) => {
        const canEdit = storeCan(store.role, 'store.edit');
        const editable = canEdit && storeEditable(store.status);
        return (
          <div className="flex flex-col gap-10">
            <Progress store={store} />
            {editable ? (
              <ApplicationForm
                initial={{ name: store.name, about: store.about, legalName: store.legalName, taxId: store.taxId, phone: store.phone, address: store.address }}
                submitLabel="Guardar datos"
                onSave={async (input) => {
                  const result = await patch(`/api/stores/${id}`, input);
                  if (!result.ok) return apiMessage(result);
                  await reload();
                  return null;
                }}
              />
            ) : (
              canEdit && <Summary store={store} />
            )}
            {canEdit && <DocumentList store={store} requirements={requirements} editable={editable} onChange={reload} />}
            {editable && <Submit store={store} onChange={reload} />}
            <History events={store.events} locale={locale} />
          </div>
        );
      }}
    </StoreShell>
  );
}
