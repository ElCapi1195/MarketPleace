'use client';

import { useState } from 'react';
import { post } from '@/lib/client-api';
import { messageFor } from '../lib/messages';
import { Field, Form } from './form';

export function SignInForm({ next }: { next: string }) {
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const signIn = async ({ email = '', password = '' }: Record<string, string>) => {
    setError(null);
    setUnverified(null);
    const result = await post<{ twoFactorRedirect?: boolean }>('/api/auth/sign-in/email', { email, password });
    if (!result.ok) {
      setError(messageFor(result.code, result.message));
      if (result.code === 'EMAIL_NOT_VERIFIED') setUnverified(email);
      return;
    }
    // Navegación completa: descarta el estado de la sesión anterior.
    window.location.assign(result.data.twoFactorRedirect ? `/segundo-paso?siguiente=${encodeURIComponent(next)}` : next);
  };

  const resend = async () => {
    await post('/api/auth/send-verification-email', { email: unverified, callbackURL: '/entrar?verificado=1' });
    setResent(true);
  };

  return (
    <>
      <Form submitLabel="Entrar" error={error} onSubmit={signIn}>
        <Field label="Correo" name="email" type="email" autoComplete="username" maxLength={254} />
        <Field label="Contraseña" name="password" type="password" autoComplete="current-password" maxLength={128} />
      </Form>
      {unverified &&
        (resent ? (
          <p role="status">Si la cuenta está pendiente, acabamos de enviar otro enlace.</p>
        ) : (
          <button type="button" onClick={resend} className="min-h-11 cursor-pointer self-start font-bold underline">
            Enviar otro enlace de verificación
          </button>
        ))}
    </>
  );
}
