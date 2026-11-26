'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { get, type ApiResult } from '@/lib/client-api';
import { adminMessage } from '../lib/messages';

type Failure = Extract<ApiResult<unknown>, { ok: false }>;

export type Loaded<T> = { state: 'loading' } | { state: 'error'; failure: Failure } | { state: 'ready'; data: T };

/** Carga un recurso de administración; sin sesión, lleva a entrar y vuelve aquí. */
export function useAdmin<T>(path: string): { result: Loaded<T>; reload: () => Promise<void>; replace: (data: T) => void } {
  const [result, setResult] = useState<Loaded<T>>({ state: 'loading' });
  const reload = useCallback(async () => {
    const response = await get<T>(path);
    if (response.ok) setResult({ state: 'ready', data: response.data });
    else if (response.status === 401) {
      window.location.replace(`/entrar?siguiente=${encodeURIComponent(window.location.pathname)}`);
    } else setResult({ state: 'error', failure: response });
  }, [path]);
  useEffect(() => {
    void reload();
  }, [reload]);
  const replace = useCallback((data: T) => setResult({ state: 'ready', data }), []);
  return { result, reload, replace };
}

function Problem({ failure }: { failure: Failure }) {
  if (failure.code === 'TWO_FACTOR_REQUIRED') {
    return (
      <p role="alert" className="text-lg">
        Para administrar necesitas activar el segundo paso.{' '}
        <Link href="/cuenta" className="font-bold underline">
          Actívalo en tu cuenta
        </Link>
        .
      </p>
    );
  }
  return (
    <p role="alert" className="text-lg">
      {failure.code === 'FORBIDDEN' ? 'Tu cuenta no tiene permiso para administrar productos.' : adminMessage(failure)}
    </p>
  );
}

export function AdminGate<T>({ result, children }: { result: Loaded<T>; children: (data: T) => ReactNode }) {
  if (result.state === 'loading') return <p role="status">Cargando…</p>;
  if (result.state === 'error') return <Problem failure={result.failure} />;
  return children(result.data);
}
