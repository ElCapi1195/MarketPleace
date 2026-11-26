'use client';

import type { AdminProduct } from '@marketplace/contracts';
import Link from 'next/link';
import { useState } from 'react';
import { describeAttributes } from '@/features/catalog/lib/attributes';
import { ModelViewer } from '@/features/catalog/components/model-viewer';
import { privateMediaUrl } from '@/features/catalog/lib/media';
import { formatMoney } from '@/features/catalog/lib/money';
import type { FormContext } from '@/features/products/lib/product-form';
import { ProductList } from '@/features/products/components/product-list';
import { ResourceGate, useResource } from '@/features/shared/components/resource';
import { apiMessage } from '@/features/shared/lib/messages';
import { post } from '@/lib/client-api';
import { DecisionPanel } from './decision-panel';

const BASE = '/api/admin/moderation';

interface Locale {
  currency: string;
  locale: string;
}

export function ModerationQueue(props: Locale) {
  return <ProductList list={BASE} base={BASE} path="/admin/moderacion" empty="No hay productos por revisar." {...props} />;
}

const DECISIONS = [
  { action: 'approve', label: 'Publicar', needsReason: false },
  { action: 'reject', label: 'Rechazar', needsReason: true },
];

function Facts({ product, context, currency, locale }: Locale & { product: AdminProduct; context: FormContext }) {
  const category = context.categories.find(({ slug }) => slug === product.categorySlug);
  const definitions = (category?.attributes ?? []).map(({ key, label, type, options }) => ({ key, label, type, ...(options && { options }) }));
  const rows = [
    { label: 'Tienda', value: product.store.name },
    { label: 'Categoría', value: category?.name ?? product.categorySlug },
    { label: 'Precio', value: formatMoney(product.priceMinor, currency, locale) },
    ...(product.depositMinor > 0 ? [{ label: 'Depósito', value: formatMoney(product.depositMinor, currency, locale) }] : []),
    ...(product.availableOn ? [{ label: 'Llegada estimada', value: product.availableOn }] : []),
    ...describeAttributes(definitions, product.attributes, locale),
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 border-t-2 border-surface">
      {rows.map(({ label, value }) => (
        <div key={label} className="col-span-2 grid grid-cols-subgrid border-b-2 border-surface py-2.5">
          <dt>{label}</dt>
          <dd className="text-right font-bold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ModerationDetail({ id, context, ...format }: Locale & { id: string; context: FormContext }) {
  const { result } = useResource<AdminProduct>(`${BASE}/${id}`);
  const [done, setDone] = useState<string | null>(null);

  if (done) {
    return (
      <p role="status" className="text-lg">
        {done}{' '}
        <Link href="/admin/moderacion" className="font-bold underline">
          Seguir revisando
        </Link>
      </p>
    );
  }
  return (
    <ResourceGate result={result}>
      {(product) => {
        const images = product.media.filter(({ kind }) => kind === 'IMAGE');
        const model = product.media.find(({ kind }) => kind === 'MODEL');
        return (
          <div className="flex flex-col gap-8">
            <p className="text-xl font-bold">{product.title}</p>
            <ul className="grid gap-4 sm:grid-cols-2">
              {images.map((image) => (
                <li key={image.id} className="overflow-hidden rounded-2xl bg-surface">
                  <img src={privateMediaUrl(BASE, image, 'lg')} alt={image.alt || product.title} className="aspect-4/3 w-full object-contain" />
                  {image.alt && <p className="p-3 text-sm">Descripción: {image.alt}</p>}
                </li>
              ))}
            </ul>
            {model && (
              <div className="aspect-4/3 overflow-hidden rounded-3xl bg-surface">
                <ModelViewer url={privateMediaUrl(BASE, model, 'model')} label={product.title} />
              </div>
            )}
            {product.description && <p className="max-w-prose text-lg whitespace-pre-line">{product.description}</p>}
            <Facts product={product} context={context} {...format} />
            <DecisionPanel
              decisions={DECISIONS}
              onDecide={async (action, reason) => {
                const body = action === 'reject' ? { action, version: product.version, reason } : { action, version: product.version };
                const response = await post(`${BASE}/${id}/decision`, body);
                if (!response.ok) return apiMessage(response);
                setDone(action === 'approve' ? 'Publicado.' : 'Rechazado. La tienda verá el motivo.');
                return null;
              }}
            />
          </div>
        );
      }}
    </ResourceGate>
  );
}
