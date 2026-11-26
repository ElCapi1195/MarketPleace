import type { Metadata } from 'next';
import { Page } from '@/features/shared/components/page';
import { StoreHome } from '@/features/store/components/store-area';
import { getVertical } from '@/lib/vertical';

export const metadata: Metadata = { title: 'Tu tienda' };

export default async function StorePage({ params }: { params: Promise<{ storeId: string }> }) {
  const { locale, storeVerification } = getVertical();
  return (
    <Page title="Tu tienda" back={{ href: '/tienda', label: 'Mis tiendas' }}>
      <StoreHome id={(await params).storeId} requirements={storeVerification.documents} locale={locale} />
    </Page>
  );
}
