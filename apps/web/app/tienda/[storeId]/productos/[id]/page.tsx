import type { Metadata } from 'next';
import { editorContext } from '@/features/products/lib/context';
import { Page } from '@/features/shared/components/page';
import { StoreEditProduct } from '@/features/store/components/store-products';

export const metadata: Metadata = { title: 'Editar producto' };

export default async function StoreEditProductPage({ params }: { params: Promise<{ storeId: string; id: string }> }) {
  const { storeId, id } = await params;
  return (
    <Page title="Editar producto" back={{ href: `/tienda/${storeId}/productos`, label: 'Productos' }}>
      <StoreEditProduct id={storeId} productId={id} {...editorContext()} />
    </Page>
  );
}
