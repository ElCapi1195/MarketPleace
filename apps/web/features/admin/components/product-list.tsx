'use client';

import type { AdminProduct } from '@marketplace/contracts';
import Link from 'next/link';
import { useState } from 'react';
import { adminMediaUrl } from '@/features/catalog/lib/media';
import { formatMoney } from '@/features/catalog/lib/money';
import { AdminGate, useAdmin } from './admin-gate';
import { statusLabel } from './status';

interface Page {
  items: AdminProduct[];
  total: number;
  page: number;
  pageSize: number;
}

function Row({ product, currency, locale }: { product: AdminProduct; currency: string; locale: string }) {
  const cover = product.media.find(({ kind }) => kind === 'IMAGE');
  return (
    <li className="group relative flex items-center gap-4 border-b-2 border-surface py-3">
      <span className="size-18 shrink-0 overflow-hidden rounded-xl bg-surface">{cover && <img src={adminMediaUrl(cover, 'sm')} alt="" loading="lazy" className="size-full object-cover" />}</span>
      <span className="min-w-0 flex-1">
        <Link href={`/admin/productos/${product.id}`} className="block truncate font-bold after:absolute after:inset-0 group-hover:underline">
          {product.title}
        </Link>
        <span className="text-sm">{product.store.name}</span>
      </span>
      <span className="hidden font-bold sm:block">{formatMoney(product.priceMinor, currency, locale)}</span>
      <span className={`w-24 text-right font-medium ${product.status === 'PUBLISHED' ? '' : 'text-ink/70'}`}>{statusLabel(product.status)}</span>
    </li>
  );
}

export function ProductList({ currency, locale }: { currency: string; locale: string }) {
  const [page, setPage] = useState(1);
  const { result } = useAdmin<Page>(`/api/admin/products?page=${page}`);
  return (
    <AdminGate result={result}>
      {({ items, total, pageSize }) =>
        total === 0 ? (
          <p className="text-lg">Todavía no hay productos. Crea el primero.</p>
        ) : (
          <>
            <ul>
              {items.map((product) => (
                <Row key={product.id} product={product} currency={currency} locale={locale} />
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
    </AdminGate>
  );
}
