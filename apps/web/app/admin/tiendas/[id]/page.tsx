import type { Metadata } from 'next';
import { StoreReviewDetail } from '@/features/admin/components/store-reviews';
import { Page } from '@/features/shared/components/page';
import { getVertical } from '@/lib/vertical';

export const metadata: Metadata = { title: 'Revisar tienda' };

export default async function StoreReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { locale, storeVerification } = getVertical();
  return (
    <Page title="Revisar tienda" back={{ href: '/admin/tiendas', label: 'Tiendas' }}>
      <StoreReviewDetail id={(await params).id} requirements={storeVerification.documents} locale={locale} />
    </Page>
  );
}
