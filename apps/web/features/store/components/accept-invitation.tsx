'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiMessage } from '@/features/shared/lib/messages';
import { post } from '@/lib/client-api';

const KEY = 'invitation';

/** El token llega en el fragmento y se guarda en la pestaña mientras la persona entra en su cuenta. */
function takeToken(): string | null {
  const found = new URLSearchParams(window.location.hash.slice(1)).get('token');
  try {
    if (found) sessionStorage.setItem(KEY, found);
    return found ?? sessionStorage.getItem(KEY);
  } catch {
    return found;
  }
}

function forget(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Sin almacenamiento no hay nada que olvidar.
  }
}

export function AcceptInvitation() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);

  useEffect(() => {
    const found = takeToken();
    setToken((current) => current ?? found);
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const accept = async () => {
    setError(null);
    setNeedsTwoFactor(false);
    const result = await post<{ storeId: string }>('/api/store-invitations/accept', { token });
    if (result.ok) {
      forget();
      window.location.assign(`/tienda/${result.data.storeId}`);
    } else if (result.status === 401) window.location.assign('/entrar?siguiente=/invitacion');
    else if (result.code === 'TWO_FACTOR_REQUIRED') setNeedsTwoFactor(true);
    else {
      if (result.code === 'INVITATION_INVALID') forget();
      setError(result.code === 'VALIDATION_ERROR' ? 'El enlace está incompleto. Ábrelo de nuevo desde el correo.' : apiMessage(result));
    }
  };

  if (token === undefined) return <p role="status">Cargando…</p>;
  if (token === null) return <p className="text-lg">Abre la invitación desde el enlace de tu correo.</p>;
  return (
    <div className="flex flex-col gap-5">
      <p className="text-lg">Entra con el correo que recibió la invitación y acéptala para trabajar en la tienda.</p>
      <button type="button" onClick={accept} className="min-h-13 cursor-pointer self-start rounded-xl bg-accent px-6 font-bold text-ink">
        Aceptar invitación
      </button>
      {needsTwoFactor && (
        <p role="alert">
          Antes necesitas activar el segundo paso.{' '}
          <Link href="/cuenta" className="font-bold underline">
            Actívalo en tu cuenta
          </Link>{' '}
          y vuelve a abrir el enlace del correo.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl border-2 border-ink p-3 font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
