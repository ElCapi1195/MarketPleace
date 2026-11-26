import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductList } from '@/features/admin/components/product-list';
import { getVertical } from '@/lib/vertical';

export const metadata: Metadata = { title: 'Productos' };

export default function ProductsPage() {
  const { currency, locale } = getVertical();
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 pt-6 pb-20 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Productos</h1>
        <Link href="/admin/productos/nuevo" className="inline-flex min-h-13 items-center rounded-xl bg-accent px-6 font-bold text-ink">
          Nuevo producto
        </Link>
      </div>
      <ProductList currency={currency} locale={locale} />
    </main>
  );
}
