'use client';

import { useState } from 'react';
import { encode } from 'uqr';
import { post } from '../lib/api';
import { messageFor } from '../lib/messages';
import { parseTotpUri } from '../lib/totp';
import { Field, Form } from './form';

/** QR como un único trazado SVG, generado en el navegador: la clave no sale de esta página. */
function QrCode({ value }: { value: string }) {
  const { data, size } = encode(value, { border: 2 });
  const path = data.flatMap((row, y) => row.flatMap((dark, x) => (dark ? [`M${x} ${y}h1v1h-1z`] : []))).join('');
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Código QR para tu aplicación" className="w-52 rounded-lg bg-white" shapeRendering="crispEdges">
      <path d={path} fill="#000000" />
    </svg>
  );
}

interface Setup {
  uri: string;
  groups: string[];
  backupCodes: string[];
}

export function TwoFactorSetup({ enabled, required, onChange }: { enabled: boolean; required: boolean; onChange: () => void }) {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async ({ password = '' }: Record<string, string>) => {
    setError(null);
    const result = await post<{ totpURI: string; backupCodes: string[] }>('/api/auth/two-factor/enable', { password });
    if (!result.ok) return setError(messageFor(result.code, result.message));
    const totp = parseTotpUri(result.data.totpURI);
    if (totp) setSetup({ ...totp, backupCodes: result.data.backupCodes });
    else setError(messageFor(undefined));
  };

  const confirm = async ({ code = '' }: Record<string, string>) => {
    setError(null);
    const result = await post('/api/auth/two-factor/verify-totp', { code });
    if (!result.ok) return setError(messageFor(result.code, result.message));
    setCodes(setup?.backupCodes ?? []);
    setSetup(null);
    onChange();
  };

  const disable = async ({ password = '' }: Record<string, string>) => {
    setError(null);
    const result = await post('/api/auth/two-factor/disable', { password });
    if (!result.ok) return setError(messageFor(result.code, result.message));
    setCodes(null);
    onChange();
  };

  return (
    <section aria-labelledby="two-factor-title" className="flex flex-col gap-4 rounded-xl bg-surface p-5">
      <h2 id="two-factor-title" className="text-xl font-bold">
        Segundo paso {enabled ? 'activado' : 'desactivado'}
      </h2>
      {!enabled && required && <p className="font-medium">Tu rol lo exige: actívalo para usar las funciones de administración.</p>}

      {codes && (
        <div role="status" className="flex flex-col gap-3">
          <p>Guarda estos códigos de respaldo. No volverás a verlos y cada uno sirve una vez si pierdes el teléfono.</p>
          <ul className="grid grid-cols-2 gap-2 font-bold">
            {codes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
        </div>
      )}

      {enabled ? (
        <Form submitLabel="Desactivar" error={error} onSubmit={disable}>
          <Field label="Contraseña actual" name="password" type="password" autoComplete="current-password" />
        </Form>
      ) : setup ? (
        <>
          <p>Escanea el código con tu aplicación de códigos, o escribe la clave a mano.</p>
          <QrCode value={setup.uri} />
          <p className="font-bold break-all">{setup.groups.join(' ')}</p>
          <Form submitLabel="Activar" error={error} onSubmit={confirm}>
            <Field label="Código de 6 cifras" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} />
          </Form>
        </>
      ) : (
        <Form submitLabel="Configurar" error={error} onSubmit={start}>
          <Field label="Contraseña actual" name="password" type="password" autoComplete="current-password" />
        </Form>
      )}
    </section>
  );
}
