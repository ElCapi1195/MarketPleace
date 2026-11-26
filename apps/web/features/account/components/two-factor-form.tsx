'use client';

import { useState } from 'react';
import { withBasePath } from '@/lib/base-path';
import { post } from '@/lib/client-api';
import { messageFor } from '../lib/messages';
import { Field, Form } from './form';

export function TwoFactorForm({ next }: { next: string }) {
  const [backup, setBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = async ({ code = '' }: Record<string, string>) => {
    setError(null);
    const result = await post(`/api/auth/two-factor/${backup ? 'verify-backup-code' : 'verify-totp'}`, { code: code.trim() });
    if (result.ok) window.location.assign(withBasePath(next));
    else setError(messageFor(result.code, result.message));
  };

  return (
    <>
      <Form key={String(backup)} submitLabel="Continuar" error={error} onSubmit={verify}>
        {backup ? (
          <Field label="Código de respaldo" name="code" autoComplete="off" maxLength={32} hint="Cada código sirve una sola vez." />
        ) : (
          <Field label="Código de 6 cifras" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} autoFocus />
        )}
      </Form>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setBackup(!backup);
        }}
        className="min-h-11 cursor-pointer self-start font-bold underline"
      >
        {backup ? 'Usar la aplicación de códigos' : 'Usar un código de respaldo'}
      </button>
    </>
  );
}
