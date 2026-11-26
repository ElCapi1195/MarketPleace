'use client';

import type { ProductInput, StoreView } from '@marketplace/contracts';
import { useState, type FormEvent } from 'react';
import { post } from '@/lib/client-api';
import { apiMessage } from '@/features/shared/lib/messages';
import { toInput, type FormAttribute, type FormContext, type Values } from '../lib/product-form';
import { CheckField, SelectField, TextArea, TextField } from '@/features/shared/components/fields';

interface ProductFormProps {
  context: FormContext;
  kinds: readonly { value: string; label: string }[];
  stores: readonly StoreView[];
  initial: Values;
  submitLabel: string;
  /** Devuelve el error para la persona, o null si se guardó. */
  onSave: (input: ProductInput) => Promise<string | null>;
  /** Solo la plataforma elige tienda, crea tiendas y destaca. */
  onStoreCreated?: () => Promise<void>;
}

function NewStore({ onCreated }: { onCreated: (store: StoreView) => Promise<void> }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const create = async () => {
    const result = await post<StoreView>('/api/admin/stores', { name });
    if (result.ok) {
      setName('');
      setError(null);
      await onCreated(result.data);
    } else setError(apiMessage(result));
  };
  return (
    <details className="sm:col-span-2">
      <summary className="cursor-pointer py-1 font-bold underline">Crear otra tienda</summary>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <TextField label="Nombre de la tienda" value={name} onChange={setName} maxLength={80} />
        </div>
        <button type="button" onClick={create} disabled={name.trim().length < 2} className="h-12 cursor-pointer rounded-xl border-2 border-ink px-5 font-bold disabled:cursor-not-allowed disabled:opacity-50">
          Crear tienda
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </details>
  );
}

function Attribute({ attribute, value, onChange }: { attribute: FormAttribute; value: string; onChange: (value: string) => void }) {
  const { label, type, required, options = [] } = attribute;
  const common = { label: required ? label : `${label} (opcional)`, value, onChange };
  if (type === 'boolean') return <CheckField {...common} label={label} />;
  if (type === 'select') return <SelectField {...common} options={options} placeholder="Elige" />;
  return <TextField {...common} {...(type === 'number' && { inputMode: 'decimal' as const })} maxLength={120} />;
}

export function ProductForm({ context, kinds, stores, initial, submitLabel, onSave, onStoreCreated }: ProductFormProps) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bind = (key: string) => ({ value: values[key] ?? '', onChange: (value: string) => setValues((current) => ({ ...current, [key]: value })) });
  const category = context.categories.find(({ slug }) => slug === values.categorySlug);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const result = toInput(values, context);
    if (!result.ok) return setError(result.error);
    setBusy(true);
    setError(await onSave(result.input));
    setBusy(false);
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
      <TextField label="Título" wide {...bind('title')} maxLength={120} placeholder="Qué es y qué lo distingue" />
      <SelectField label="Categoría" {...bind('categorySlug')} options={context.categories.map(({ slug, name }) => ({ value: slug, label: name }))} />
      <SelectField label="Entrega" {...bind('kind')} options={kinds} />
      <TextField label={`Precio (${context.currency})`} {...bind('price')} inputMode="decimal" placeholder="549,90" />
      <TextField label={`Depósito (${context.currency}, opcional)`} {...bind('deposit')} inputMode="decimal" hint="Se paga a la tienda, fuera de la web." />
      {values.kind === 'PREORDER' && <TextField label="Llegada estimada" type="date" {...bind('availableOn')} />}
      {values.kind !== 'SERVICE' && (
        <TextField label={values.kind === 'PREORDER' ? 'Cupos (opcional)' : 'Unidades (opcional)'} {...bind('units')} inputMode="numeric" />
      )}
      {category?.attributes.map((attribute) => <Attribute key={attribute.key} attribute={attribute} {...bind(`attributes.${attribute.key}`)} />)}
      <TextArea label="Descripción" wide {...bind('description')} maxLength={4000} />
      {onStoreCreated && (
        <>
          <SelectField label="Tienda" {...bind('storeId')} options={stores.map(({ id, name }) => ({ value: id, label: name }))} placeholder="Elige" />
          <CheckField label="Destacar en la portada" {...bind('featured')} />
          <NewStore
            onCreated={async ({ id }) => {
              await onStoreCreated();
              bind('storeId').onChange(id);
            }}
          />
        </>
      )}
      {error && (
        <p role="alert" className="rounded-xl border-2 border-ink p-3 font-medium sm:col-span-2">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="min-h-13 cursor-pointer rounded-xl bg-ink px-6 font-bold text-background disabled:cursor-wait disabled:opacity-60 sm:col-span-2 sm:justify-self-start">
        {busy ? 'Guardando…' : submitLabel}
      </button>
    </form>
  );
}
