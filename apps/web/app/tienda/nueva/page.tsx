import type { Metadata } from 'next';
import { Page } from '@/features/shared/components/page';
import { NewStoreApplication } from '@/features/store/components/my-stores';

export const metadata: Metadata = { title: 'Solicitar una tienda' };

export default function NewStorePage() {
  return (
    <Page title="Solicitar una tienda" back={{ href: '/tienda', label: 'Mis tiendas' }}>
      <NewStoreApplication />
    </Page>
  );
}
