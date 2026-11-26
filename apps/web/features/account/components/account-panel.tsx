'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { get, post } from '@/lib/client-api';
import { messageFor } from '../lib/messages';
import { describeAgent } from '../lib/user-agent';
import { Field, Form, Screen } from './form';
import { MyReports } from '@/features/reports/components/my-reports';
import { TwoFactorSetup } from './two-factor-setup';

interface Me {
  name: string;
  email: string;
  platformRole: string;
  twoFactorEnabled: boolean;
  twoFactorRequired: boolean;
}

interface SessionItem {
  id: string;
  userAgent?: string | null;
  createdAt: string;
}

const secondary = 'min-h-12 cursor-pointer rounded-lg border-2 border-ink px-5 font-bold';

function Sessions() {
  const [sessions, setSessions] = useState<SessionItem[] | null>(null);
  const load = useCallback(async () => {
    const result = await get<SessionItem[]>('/api/auth/list-sessions');
    if (result.ok) setSessions(result.data);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (!sessions) return null;
  return (
    <section aria-labelledby="sessions-title" className="flex flex-col gap-3">
      <h2 id="sessions-title" className="text-xl font-bold">
        Sesiones abiertas
      </h2>
      <ul className="flex flex-col">
        {sessions.map(({ id, userAgent, createdAt }) => (
          <li key={id} className="border-b-2 border-surface py-2">
            {describeAgent(userAgent)}, desde el {new Date(createdAt).toLocaleDateString()}
          </li>
        ))}
      </ul>
      {sessions.length > 1 && (
        <button
          type="button"
          className={`${secondary} self-start`}
          onClick={async () => {
            await post('/api/auth/revoke-other-sessions', {});
            await load();
          }}
        >
          Cerrar las demás sesiones
        </button>
      )}
    </section>
  );
}

function PasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const change = async ({ currentPassword = '', newPassword = '' }: Record<string, string>) => {
    setError(null);
    setDone(false);
    const result = await post('/api/auth/change-password', { currentPassword, newPassword, revokeOtherSessions: true });
    if (result.ok) setDone(true);
    else setError(messageFor(result.code, result.message));
  };

  return (
    <section aria-labelledby="password-title" className="flex flex-col gap-4">
      <h2 id="password-title" className="text-xl font-bold">
        Cambiar contraseña
      </h2>
      {done && <p role="status">Contraseña cambiada. Cerramos tus demás sesiones.</p>}
      <Form key={String(done)} submitLabel="Cambiar contraseña" error={error} onSubmit={change}>
        <Field label="Contraseña actual" name="currentPassword" type="password" autoComplete="current-password" />
        <Field label="Contraseña nueva" name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} hint="Al menos 12 caracteres." />
      </Form>
    </section>
  );
}

export function AccountPanel() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await get<Me>('/api/me');
    if (result.ok) setMe(result.data);
    else if (result.status === 401) window.location.replace('/entrar?siguiente=/cuenta');
    else setError(messageFor(result.code, result.message));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <Screen title="Tu cuenta">{<p role="alert">{error}</p>}</Screen>;
  if (!me) return <Screen title="Tu cuenta">{<p role="status">Cargando…</p>}</Screen>;

  return (
    <Screen title={`Hola, ${me.name}`} intro={<span className="break-all">{me.email}</span>}>
      <Link href="/tienda" className="self-start py-2 font-bold underline">
        Mis tiendas
      </Link>
      <TwoFactorSetup enabled={me.twoFactorEnabled} required={me.twoFactorRequired} onChange={load} />
      <Sessions />
      <MyReports />
      <PasswordForm />
      <button
        type="button"
        className={secondary}
        onClick={async () => {
          await post('/api/auth/sign-out', {});
          window.location.assign('/');
        }}
      >
        Cerrar sesión
      </button>
    </Screen>
  );
}
