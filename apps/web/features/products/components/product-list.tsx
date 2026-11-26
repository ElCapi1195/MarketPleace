'use client';

import type { AdminProduct } from '@marketplace/contracts';
import Link from 'next/link';
import { useState } from 'react';
import { privateMediaUrl } from '@/features/catalog/lib/media';
import { formatMoney } from '@/features/catalog/lib/money';
import { ResourceGate, useResource } from '@/features/shared/components/resource';
import { statusLabel } from '../lib/status';

interface Page {
  items: AdminProduct[];
  total: number;
  page: number;
  pageSize: number;
}

interface ListProps {
  /** Dirección de la lista, si no es `<base>/products`. */
  list?: string;
  empty?: string;
  /** Raíz de la API. */
  base: string;
  /** Dirección de las páginas de producto. */
  path: string;
  currency: string;
  locale: string;
}

function Row({ product, base, path, currency, locale }: ListProps & { product: AdminProduct }) {
  const cover = product.media.find(({ kind }) => kind === 'IMAGE');
  return (
    <li className="group relative flex items-center gap-4 border-b-2 border-surface py-3">
      <span className="size-18 shrink-0 overflow-hidden rounded-xl bg-surface">{cover && <img src={privateMediaUrl(base, cover, 'sm')} alt="" loading="lazy" className="size-full object-cover" />}</span>
      <span className="min-w-0 flex-1">
        <Link href={`${path}/${product.id}`} className="block truncate font-bold after:absolute after:inset-0 group-hover:underline">
          {product.title}
        </Link>
        <span className="text-sm">{product.store.name}</span>
      </span>
      <span className="hidden font-bold sm:block">{formatMoney(product.priceMinor, currency, locale)}</span>
      <span className={`w-24 text-right font-medium ${product.status === 'PUBLISHED' ? '' : 'text-ink/70'}`}>{statusLabel(product.status)}</span>
    </li>
  );
}

export function ProductList(props: ListProps) {
  const [page, setPage] = useState(1);
  const { result } = useResource<Page>(`${props.list ?? `${props.base}/products`}?page=${page}`);
  return (
    <ResourceGate result={result}>
      {({ items, total, pageSize }) =>
        total === 0 ? (
          <p className="text-lg">{props.empty ?? 'Todavía no hay productos. Crea el primero.'}</p>
        ) : (
          <>
            <ul>
              {items.map((product) => (
                <Row key={product.id} product={product} {...props} />
              ))}
            </ul>
            {total > pageSize && (
              <div className="flex items-center gap-4">
                <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)} className="min-h-12 cursor-pointer rounded-xl border-2 border-ink px-5 font-bold disabled:opacity-40">
                  Anterior
                </button>
                <button type="button" disabled={page * pageSize >= total} onClick={() => setPage(page + 1)} className="min-h-12 cursor-pointer rounded-xl border-2 border-ink px-5 font-bold disabled:opacity-40">
                  Siguiente
                </button>
              </div>
            )}
          </>
        )
      }
    </ResourceGate>
  );
}
