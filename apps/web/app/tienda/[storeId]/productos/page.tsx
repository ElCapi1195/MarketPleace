import type { Metadata } from 'next';
import { Page } from '@/features/shared/components/page';
import { StoreProducts } from '@/features/store/components/store-products';
import { getVertical } from '@/lib/vertical';

export const metadata: Metadata = { title: 'Productos de tu tienda' };

export default async function StoreProductsPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { currency, locale } = getVertical();
  return (
    <Page title="Productos" back={{ href: '/tienda', label: 'Mis tiendas' }}>
      <StoreProducts id={(await params).storeId} currency={currency} locale={locale} />
    </Page>
  );
}
