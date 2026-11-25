'use client';

import { useId, useState, type ComponentProps, type FormEvent, type ReactNode } from 'react';

interface FieldProps extends Omit<ComponentProps<'input'>, 'id' | 'className'> {
  label: string;
  hint?: string;
}

export function Field({ label, hint, ...input }: FieldProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-bold">
        {label}
      </label>
      <input
        id={id}
        required
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="h-12 w-full rounded-lg border-2 border-ink/60 bg-background px-3 font-medium"
        {...input}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-sm">
          {hint}
        </p>
      )}
    </div>
  );
}

interface FormProps {
  submitLabel: string;
  error?: string | null;
  /** Recibe los campos; el formulario queda ocupado hasta que termina. */
  onSubmit: (fields: Record<string, string>) => Promise<void>;
  children: ReactNode;
}

export function Form({ submitLabel, error, onSubmit, children }: FormProps) {
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const fields = Object.fromEntries([...new FormData(event.currentTarget)].map(([key, value]) => [key, String(value)]));
    setBusy(true);
    try {
      await onSubmit(fields);
    } finally {
      setBusy(false);
    }
  };

  return (
    // method="post": si se envía antes de cargar el script, la contraseña no acaba en la URL.
    <form method="post" onSubmit={submit} className="flex flex-col gap-5">
      {children}
      {error && (
        <p role="alert" className="rounded-lg border-2 border-ink bg-background p-3 font-medium">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="min-h-13 cursor-pointer rounded-lg bg-ink px-6 font-bold text-background disabled:cursor-wait disabled:opacity-60">
        {busy ? 'Un momento…' : submitLabel}
      </button>
    </form>
  );
}

export function Screen({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-6 pb-16">
      <h1 className="font-display text-4xl leading-tight font-extrabold tracking-tight">{title}</h1>
      {intro && <p className="text-lg">{intro}</p>}
      {children}
    </main>
  );
}
