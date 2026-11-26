import type { Metadata } from 'next';
import { NewProduct } from '@/features/products/components/product-editor';
import { editorContext } from '@/features/products/lib/context';
import { Page } from '@/features/shared/components/page';

export const metadata: Metadata = { title: 'Nuevo producto' };

export default function NewProductPage() {
  return (
    <Page title="Nuevo producto" back={{ href: '/admin/productos', label: 'Productos' }}>
      <NewProduct owner={{ kind: 'platform' }} {...editorContext()} />
    </Page>
  );
}
