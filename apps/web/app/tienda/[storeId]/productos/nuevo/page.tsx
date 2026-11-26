import type { Metadata } from 'next';
import { editorContext } from '@/features/products/lib/context';
import { Page } from '@/features/shared/components/page';
import { StoreNewProduct } from '@/features/store/components/store-products';

export const metadata: Metadata = { title: 'Nuevo producto' };

export default async function StoreNewProductPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  return (
    <Page title="Nuevo producto" back={{ href: `/tienda/${storeId}/productos`, label: 'Productos' }}>
      <StoreNewProduct id={storeId} {...editorContext()} />
    </Page>
  );
}
