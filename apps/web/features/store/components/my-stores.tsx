'use client';

import type { StoreDetail, StoreSummary } from '@marketplace/contracts';
import Link from 'next/link';
import { ResourceGate, useResource } from '@/features/shared/components/resource';
import { apiMessage } from '@/features/shared/lib/messages';
import { post } from '@/lib/client-api';
import { roleLabel, storeStatusLabel } from '../lib/status';
import { ApplicationForm, emptyApplication } from './application-form';

export function MyStores() {
  const { result } = useResource<StoreSummary[]>('/api/stores/mine');
  return (
    <ResourceGate result={result}>
      {(stores) =>
        stores.length === 0 ? (
          <p className="text-lg">
            Todavía no formas parte de ninguna tienda.{' '}
            <Link href="/vender" className="font-bold underline">
              Conoce cómo vender aquí
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col">
            {stores.map(({ id, name, role, status }) => (
              <li key={id} className="group relative flex flex-wrap items-baseline justify-between gap-x-4 border-b-2 border-surface py-4">
                <Link href={`/tienda/${id}`} className="text-lg font-bold after:absolute after:inset-0 group-hover:underline">
                  {name}
                </Link>
                <span>
                  {roleLabel(role)}. {storeStatusLabel(status)}
                </span>
              </li>
            ))}
          </ul>
        )
      }
    </ResourceGate>
  );
}

interface Me {
  twoFactorEnabled: boolean;
}

export function NewStoreApplication() {
  const { result } = useResource<Me>('/api/me');
  return (
    <ResourceGate result={result}>
      {({ twoFactorEnabled }) =>
        twoFactorEnabled ? (
          <ApplicationForm
            initial={emptyApplication}
            submitLabel="Guardar y seguir con los documentos"
            onSave={async (input) => {
              const response = await post<StoreDetail>('/api/stores', input);
              if (!response.ok) return apiMessage(response);
              window.location.assign(`/tienda/${response.data.id}`);
              return null;
            }}
          />
        ) : (
          <p className="text-lg">
            Para proteger a tus clientes, todo el personal de una tienda usa el segundo paso.{' '}
            <Link href="/cuenta" className="font-bold underline">
              Actívalo en tu cuenta
            </Link>{' '}
            y vuelve aquí.
          </p>
        )
      }
    </ResourceGate>
  );
}
