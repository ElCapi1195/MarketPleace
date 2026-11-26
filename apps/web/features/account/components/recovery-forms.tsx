'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { post } from '@/lib/client-api';
import { messageFor } from '../lib/messages';
import { Field, Form } from './form';

export function ForgotForm() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const request = async ({ email = '' }: Record<string, string>) => {
    setError(null);
    const result = await post('/api/auth/request-password-reset', { email });
    if (result.ok) setSent(true);
    else setError(messageFor(result.code, result.message));
  };

  if (sent) {
    return (
      <p role="status" className="rounded-xl bg-surface p-5">
        Si hay una cuenta con ese correo, recibirás un enlace para elegir otra contraseña. Vence en 1 hora.
      </p>
    );
  }
  return (
    <Form submitLabel="Enviar enlace" error={error} onSubmit={request}>
      <Field label="Correo" name="email" type="email" autoComplete="username" maxLength={254} />
    </Form>
  );
}

export function ResetForm() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const found = new URLSearchParams(window.location.hash.slice(1)).get('token');
    // El efecto puede repetirse y la segunda vez el token ya no está en la URL: se conserva el primero.
    setToken((current) => current ?? found);
    // El token deja de estar a la vista y fuera del historial.
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const reset = async ({ newPassword = '' }: Record<string, string>) => {
    setError(null);
    const result = await post('/api/auth/reset-password', { newPassword, token });
    if (result.ok) setDone(true);
    else setError(messageFor(result.code, result.message));
  };

  if (token === undefined) return null;
  if (done) {
    return (
      <p role="status" className="rounded-xl bg-surface p-5">
        Contraseña cambiada. Cerramos todas tus sesiones.{' '}
        <Link href="/entrar" className="font-bold underline">
          Entrar
        </Link>
      </p>
    );
  }
  if (token === null) {
    return (
      <p>
        Este enlace está incompleto.{' '}
        <Link href="/recuperar" className="font-bold underline">
          Pedir otro
        </Link>
      </p>
    );
  }
  return (
    <Form submitLabel="Cambiar contraseña" error={error} onSubmit={reset}>
      <Field
        label="Contraseña nueva"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        minLength={12}
        maxLength={128}
        hint="Al menos 12 caracteres."
      />
    </Form>
  );
}
