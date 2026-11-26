import type { Metadata } from 'next';
import { ProductList } from '@/features/products/components/product-list';
import { Page } from '@/features/shared/components/page';
import { getVertical } from '@/lib/vertical';

export const metadata: Metadata = { title: 'Productos' };

export default function ProductsPage() {
  const { currency, locale } = getVertical();
  return (
    <Page title="Productos" action={{ href: '/admin/productos/nuevo', label: 'Nuevo producto' }}>
      <ProductList base="/api/admin" path="/admin/productos" currency={currency} locale={locale} />
    </Page>
  );
}
