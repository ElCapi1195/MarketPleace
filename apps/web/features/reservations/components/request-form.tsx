'use client';

import type { CustomerReservation, Terms } from '@marketplace/contracts';
import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { TextArea, TextField } from '@/features/shared/components/fields';
import { ResourceGate, useResource } from '@/features/shared/components/resource';
import { apiMessage } from '@/features/shared/lib/messages';
import { withBasePath } from '@/lib/base-path';
import { post } from '@/lib/client-api';

interface RequestFormProps {
  slug: string;
  expected: Terms;
  conditions: { version: string; text: string };
}

function Form({ slug, expected, conditions }: RequestFormProps) {
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<{ text: string; code: string | undefined } | null>(null);
  const [busy, setBusy] = useState(false);
  // La misma clave en cada reintento: repetir no crea otra reserva.
  const key = useRef<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!accepted) return setError({ text: 'Acepta las condiciones para enviar la solicitud.', code: undefined });
    setBusy(true);
    key.current ??= crypto.randomUUID();
    const body = { productSlug: slug, expected, termsVersion: conditions.version, phone, note };
    const result = await post<CustomerReservation>('/api/reservations', body, { 'idempotency-key': key.current });
    if (result.ok) {
      window.location.assign(withBasePath(`/reservas/${result.data.id}`));
      return;
    }
    setError({ text: apiMessage(result), code: result.code });
    setBusy(false);
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <TextField label="Teléfono (opcional)" type="tel" value={phone} onChange={setPhone} maxLength={30} hint="La tienda lo verá solo si aprueba tu reserva." />
      <TextArea label="Mensaje para la tienda (opcional)" value={note} onChange={setNote} maxLength={1000} />
      <details className="rounded-2xl bg-surface p-4">
        <summary className="cursor-pointer font-bold">Leer las condiciones</summary>
        <p className="mt-3 whitespace-pre-line">{conditions.text}</p>
      </details>
      <label className="flex items-start gap-3 font-bold">
        <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1 size-5 accent-ink" />
        Acepto las condiciones
      </label>
      {error && (
        <p role="alert" className="rounded-xl border-2 border-ink p-3 font-medium">
          {error.text}{' '}
          {(error.code === 'PRODUCT_CHANGED' || error.code === 'TERMS_CHANGED') && (
            <a href={withBasePath(`/producto/${slug}`)} className="font-bold underline">
              Ver el producto
            </a>
          )}
          {error.code === 'ALREADY_RESERVED' && (
            <Link href="/reservas" className="font-bold underline">
              Ver mis reservas
            </Link>
          )}
        </p>
      )}
      <button type="submit" disabled={busy} className="min-h-14 cursor-pointer rounded-xl bg-accent px-6 text-lg font-bold text-ink disabled:cursor-wait disabled:opacity-60">
        {busy ? 'Enviando…' : 'Enviar solicitud'}
      </button>
      <p className="text-sm">No se te cobra nada. La tienda la revisará y te avisaremos por correo.</p>
    </form>
  );
}

/** Sin sesión, lleva a entrar y vuelve a esta página. */
export function RequestForm(props: RequestFormProps) {
  const { result } = useResource<object>('/api/me');
  return <ResourceGate result={result}>{() => <Form {...props} />}</ResourceGate>;
}
