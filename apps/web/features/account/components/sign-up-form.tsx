'use client';

import { useState } from 'react';
import { post } from '@/lib/client-api';
import { messageFor } from '../lib/messages';
import { Field, Form } from './form';

export function SignUpForm() {
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const signUp = async ({ name = '', email = '', password = '' }: Record<string, string>) => {
    setError(null);
    const result = await post('/api/auth/sign-up/email', { name, email, password, callbackURL: '/entrar?verificado=1' });
    if (result.ok) setSentTo(email);
    else setError(messageFor(result.code, result.message));
  };

  if (sentTo) {
    return (
      <div role="status" className="flex flex-col gap-3 rounded-xl bg-surface p-5">
        <h2 className="text-xl font-bold">Revisa tu correo</h2>
        <p>
          Enviamos un mensaje a <strong className="break-all">{sentTo}</strong>. Abre el enlace para activar tu cuenta; vence en 24 horas.
        </p>
      </div>
    );
  }

  return (
    <Form submitLabel="Crear cuenta" error={error} onSubmit={signUp}>
      <Field label="Nombre" name="name" autoComplete="name" maxLength={80} />
      <Field label="Correo" name="email" type="email" autoComplete="username" maxLength={254} />
      <Field
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={12}
        maxLength={128}
        hint="Al menos 12 caracteres. Una frase que solo tú usarías funciona bien."
      />
    </Form>
  );
}
