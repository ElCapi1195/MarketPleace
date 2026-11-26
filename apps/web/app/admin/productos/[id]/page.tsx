import type { Metadata } from 'next';
import { ProductEditor } from '@/features/products/components/product-editor';
import { editorContext } from '@/features/products/lib/context';
import { Page } from '@/features/shared/components/page';

export const metadata: Metadata = { title: 'Editar producto' };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Page title="Editar producto" back={{ href: '/admin/productos', label: 'Productos' }}>
      <ProductEditor owner={{ kind: 'platform' }} id={(await params).id} {...editorContext()} />
    </Page>
  );
}
