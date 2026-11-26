import type { Metadata } from 'next';
import { Page } from '@/features/shared/components/page';
import { MyStores } from '@/features/store/components/my-stores';

export const metadata: Metadata = { title: 'Mis tiendas' };

export default function StoresPage() {
  return (
    <Page title="Mis tiendas" action={{ href: '/tienda/nueva', label: 'Solicitar una tienda' }}>
      <MyStores />
    </Page>
  );
}
