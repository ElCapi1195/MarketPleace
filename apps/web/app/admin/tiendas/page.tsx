import type { Metadata } from 'next';
import { StoreReviewList } from '@/features/admin/components/store-reviews';
import { Page } from '@/features/shared/components/page';
import { getVertical } from '@/lib/vertical';

export const metadata: Metadata = { title: 'Tiendas' };

export default function StoresAdminPage() {
  return (
    <Page title="Tiendas">
      <StoreReviewList locale={getVertical().locale} />
    </Page>
  );
}
