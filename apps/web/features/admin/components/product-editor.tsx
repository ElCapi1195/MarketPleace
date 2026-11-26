'use client';

import type { AdminProduct, ProductInput, StoreView } from '@marketplace/contracts';
import Link from 'next/link';
import { useState } from 'react';
import { patch, post } from '@/lib/client-api';
import { adminMessage } from '../lib/messages';
import { emptyValues, toValues, type FormContext } from '../lib/product-form';
import { AdminGate, useAdmin } from './admin-gate';
import { MediaManager } from './media-manager';
import { ProductForm } from './product-form';
import { statusLabel } from './status';

interface EditorContext {
  context: FormContext;
  kinds: readonly { value: string; label: string }[];
  maxImages: number;
}

export function NewProduct({ context, kinds }: EditorContext) {
  const { result, reload } = useAdmin<StoreView[]>('/api/admin/stores');
  const save = async (input: ProductInput) => {
    const response = await post<AdminProduct>('/api/admin/products', input);
    if (!response.ok) return adminMessage(response);
    window.location.assign(`/admin/productos/${response.data.id}`);
    return null;
  };
  return (
    <AdminGate result={result}>
      {(stores) => (
        <ProductForm context={context} kinds={kinds} stores={stores} initial={emptyValues(context)} submitLabel="Guardar y añadir fotos" onSave={save} onStoreCreated={reload} />
      )}
    </AdminGate>
  );
}

function Publication({ product, onChange }: { product: AdminProduct; onChange: (product: AdminProduct) => void }) {
  const [error, setError] = useState<string | null>(null);
  const act = async (action: 'publish' | 'archive') => {
    const response = await post<AdminProduct>(`/api/admin/products/${product.id}/${action}`, {});
    setError(response.ok ? null : adminMessage(response));
    if (response.ok) onChange(response.data);
  };
  const published = product.status === 'PUBLISHED';
  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-surface p-5 sm:flex-row sm:flex-wrap sm:items-center">
      <p className="flex-1 text-lg">
        <span className="font-bold">{statusLabel(product.status)}.</span> {published ? 'Cualquiera puede verlo.' : 'Solo lo ve la administración.'}
      </p>
      {published && (
        <Link href={`/producto/${product.slug}`} className="inline-flex min-h-12 items-center font-bold underline">
          Ver en la tienda
        </Link>
      )}
      {product.status !== 'ARCHIVED' && (
        <button type="button" onClick={() => act('archive')} className="min-h-12 cursor-pointer rounded-xl border-2 border-ink px-5 font-bold">
          Archivar
        </button>
      )}
      {!published && (
        <button type="button" onClick={() => act('publish')} className="min-h-12 cursor-pointer rounded-xl bg-accent px-6 font-bold text-ink">
          Publicar
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

export function ProductEditor({ id, context, kinds, maxImages }: EditorContext & { id: string }) {
  const product = useAdmin<AdminProduct>(`/api/admin/products/${id}`);
  const stores = useAdmin<StoreView[]>('/api/admin/stores');
  const [saved, setSaved] = useState(false);

  return (
    <AdminGate result={product.result}>
      {(data) => {
        const save = async (input: ProductInput) => {
          setSaved(false);
          const response = await patch<AdminProduct>(`/api/admin/products/${id}`, { version: data.version, product: input });
          if (!response.ok) return adminMessage(response);
          product.replace(response.data);
          setSaved(true);
          return null;
        };
        return (
          <div className="flex flex-col gap-10">
            <Publication product={data} onChange={product.replace} />
            <MediaManager product={data} maxImages={maxImages} onChange={product.reload} />
            <section aria-labelledby="data-title" className="flex flex-col gap-5">
              <h2 id="data-title" className="font-display text-2xl font-extrabold">
                Datos
              </h2>
              {saved && <p role="status">Cambios guardados.</p>}
              <AdminGate result={stores.result}>
                {(list) => (
                  <ProductForm context={context} kinds={kinds} stores={list} initial={toValues(data, context)} submitLabel="Guardar cambios" onSave={save} onStoreCreated={stores.reload} />
                )}
              </AdminGate>
            </section>
          </div>
        );
      }}
    </AdminGate>
  );
}
