'use client';

import type { StoreApplicationInput } from '@marketplace/contracts';
import { useState, type FormEvent } from 'react';
import { TextArea, TextField } from '@/features/shared/components/fields';

interface ApplicationFormProps {
  initial: StoreApplicationInput;
  submitLabel: string;
  /** Devuelve el error para la persona, o null si se guardó. */
  onSave: (input: StoreApplicationInput) => Promise<string | null>;
}

export const emptyApplication: StoreApplicationInput = { name: '', about: '', legalName: '', taxId: '', phone: '', address: '' };

export function ApplicationForm({ initial, submitLabel, onSave }: ApplicationFormProps) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const bind = (key: keyof StoreApplicationInput) => ({
    value: values[key],
    onChange: (value: string) => {
      setSaved(false);
      setValues((current) => ({ ...current, [key]: value }));
    },
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (values.name.trim().length < 2) return setError('Escribe el nombre de la tienda.');
    setBusy(true);
    const problem = await onSave(values);
    setError(problem);
    setSaved(problem === null);
    setBusy(false);
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
      <fieldset className="contents">
        <legend className="mb-1 font-display text-2xl font-extrabold sm:col-span-2">Lo que verán tus clientes</legend>
        <TextField label="Nombre de la tienda" wide {...bind('name')} maxLength={80} />
        <TextArea label="Presentación" wide {...bind('about')} maxLength={1000} hint="Qué vendes y qué te distingue." />
      </fieldset>
      <fieldset className="contents">
        <legend className="mt-4 mb-1 font-display text-2xl font-extrabold sm:col-span-2">Solo para verificarte</legend>
        <TextField label="Nombre legal" {...bind('legalName')} maxLength={120} />
        <TextField label="Identificación fiscal" {...bind('taxId')} maxLength={40} />
        <TextField label="Teléfono" {...bind('phone')} maxLength={30} />
        <TextField label="Dirección" {...bind('address')} maxLength={200} />
      </fieldset>
      {error && (
        <p role="alert" className="rounded-xl border-2 border-ink p-3 font-medium sm:col-span-2">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <button type="submit" disabled={busy} className="min-h-13 cursor-pointer rounded-xl bg-ink px-6 font-bold text-background disabled:cursor-wait disabled:opacity-60">
          {busy ? 'Guardando…' : submitLabel}
        </button>
        {saved && <p role="status">Datos guardados.</p>}
      </div>
    </form>
  );
}
