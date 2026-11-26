'use client';

import type { AdminProduct, ProductInput, StoreView } from '@marketplace/contracts';
import Link from 'next/link';
import { useState } from 'react';
import { ResourceGate, useResource } from '@/features/shared/components/resource';
import { apiMessage } from '@/features/shared/lib/messages';
import { withBasePath } from '@/lib/base-path';
import { patch, post } from '@/lib/client-api';
import { emptyValues, toValues, type FormContext } from '../lib/product-form';
import { statusLabel } from '../lib/status';
import { MediaManager } from './media-manager';
import { ProductForm } from './product-form';

export interface EditorContext {
  context: FormContext;
  kinds: readonly { value: string; label: string }[];
  maxImages: number;
}

/** Quién edita: la plataforma, o una tienda que solo toca lo suyo. */
export type EditorOwner = { kind: 'platform' } | { kind: 'store'; id: string };

const apiBase = (owner: EditorOwner) => (owner.kind === 'platform' ? '/api/admin' : `/api/stores/${owner.id}`);
const pagePath = (owner: EditorOwner) => (owner.kind === 'platform' ? '/admin/productos' : `/tienda/${owner.id}/productos`);

type SaveProps = EditorContext & {
  owner: EditorOwner;
  initial: ReturnType<typeof emptyValues>;
  submitLabel: string;
  onSave: (input: ProductInput) => Promise<string | null>;
};

function PlatformForm({ context, kinds, initial, submitLabel, onSave }: SaveProps) {
  const { result, reload } = useResource<StoreView[]>('/api/admin/stores');
  return (
    <ResourceGate result={result}>
      {(stores) => (
        <ProductForm context={context} kinds={kinds} stores={stores} initial={initial} submitLabel={submitLabel} onSave={onSave} onStoreCreated={reload} />
      )}
    </ResourceGate>
  );
}

function OwnerForm(props: SaveProps) {
  const { owner, context, kinds, initial, submitLabel, onSave } = props;
  if (owner.kind === 'platform') return <PlatformForm {...props} />;
  return (
    <ProductForm context={context} kinds={kinds} stores={[]} initial={{ ...initial, storeId: owner.id }} submitLabel={submitLabel} onSave={onSave} />
  );
}

export function NewProduct({ owner, ...context }: EditorContext & { owner: EditorOwner }) {
  const save = async (input: ProductInput) => {
    const response = await post<AdminProduct>(`${apiBase(owner)}/products`, input);
    if (!response.ok) return apiMessage(response);
    window.location.assign(withBasePath(`${pagePath(owner)}/${response.data.id}`));
    return null;
  };
  return <OwnerForm {...context} owner={owner} initial={emptyValues(context.context)} submitLabel="Guardar y añadir fotos" onSave={save} />;
}

const EXPLANATIONS: Record<AdminProduct['status'], string> = {
  DRAFT: 'Todavía no se ve en la web.',
  PENDING_MODERATION: 'Lo estamos revisando. Se verá en la web cuando se apruebe.',
  PUBLISHED: 'Cualquiera puede verlo.',
  REJECTED: 'Corrige lo indicado y vuelve a enviarlo.',
  ARCHIVED: 'Ya no se ve en la web.',
};

function Publication({ owner, product, onChange }: { owner: EditorOwner; product: AdminProduct; onChange: (product: AdminProduct) => void }) {
  const [error, setError] = useState<string | null>(null);
  const act = async (action: 'publish' | 'submit' | 'archive') => {
    const response = await post<AdminProduct>(`${apiBase(owner)}/products/${product.id}/${action}`, {});
    setError(response.ok ? null : apiMessage(response));
    if (response.ok) onChange(response.data);
  };
  const published = product.status === 'PUBLISHED';
  const waiting = product.status === 'PENDING_MODERATION';
  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-surface p-5 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="flex-1 text-lg">
        <p>
          <span className="font-bold">{statusLabel(product.status)}.</span> {EXPLANATIONS[product.status]}
        </p>
        {product.status === 'REJECTED' && product.rejection && <p className="mt-1 whitespace-pre-line">Motivo: {product.rejection}</p>}
      </div>
      {published && (
        <Link href={`/producto/${product.slug}`} className="inline-flex min-h-12 items-center font-bold underline">
          Ver en la web
        </Link>
      )}
      {product.status !== 'ARCHIVED' && (
        <button type="button" onClick={() => act('archive')} className="min-h-12 cursor-pointer rounded-xl border-2 border-ink px-5 font-bold">
          Archivar
        </button>
      )}
      {owner.kind === 'platform' && !published && (
        <button type="button" onClick={() => act('publish')} className="min-h-12 cursor-pointer rounded-xl bg-accent px-6 font-bold text-ink">
          Publicar
        </button>
      )}
      {owner.kind === 'store' && !published && !waiting && (
        <button type="button" onClick={() => act('submit')} className="min-h-12 cursor-pointer rounded-xl bg-accent px-6 font-bold text-ink">
          Enviar a revisión
        </button>
      )}
      {error && (
        <p role="alert" className="basis-full font-medium">
          {error}
        </p>
      )}
    </div>
  );
}

export function ProductEditor({ id, owner, ...context }: EditorContext & { id: string; owner: EditorOwner }) {
  const base = apiBase(owner);
  const product = useResource<AdminProduct>(`${base}/products/${id}`);
  const [saved, setSaved] = useState(false);

  return (
    <ResourceGate result={product.result}>
      {(data) => {
        const save = async (input: ProductInput) => {
          setSaved(false);
          const response = await patch<AdminProduct>(`${base}/products/${id}`, { version: data.version, product: input });
          if (!response.ok) return apiMessage(response);
          product.replace(response.data);
          setSaved(true);
          return null;
        };
        return (
          <div className="flex flex-col gap-10">
            <Publication owner={owner} product={data} onChange={product.replace} />
            {owner.kind === 'store' && data.status === 'PUBLISHED' && (
              <p>Si cambias el título, la categoría, el precio o las fotos, volverá a revisión y dejará de verse hasta que se apruebe.</p>
            )}
            <MediaManager base={base} product={data} maxImages={context.maxImages} onChange={product.reload} />
            <section aria-labelledby="data-title" className="flex flex-col gap-5">
              <h2 id="data-title" className="font-display text-2xl font-extrabold">
                Datos
              </h2>
              {saved && <p role="status">Cambios guardados.</p>}
              <OwnerForm {...context} owner={owner} initial={toValues(data, context.context)} submitLabel="Guardar cambios" onSave={save} />
            </section>
          </div>
        );
      }}
    </ResourceGate>
  );
}
