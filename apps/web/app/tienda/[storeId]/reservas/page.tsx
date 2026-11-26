import type { Metadata } from 'next';
import { StoreReservations } from '@/features/reservations/components/store-list';
import { Page } from '@/features/shared/components/page';
import { getVertical } from '@/lib/vertical';

export const metadata: Metadata = { title: 'Reservas de tu tienda' };

export default async function StoreReservationsPage({ params }: { params: Promise<{ storeId: string }> }) {
  return (
    <Page title="Reservas" back={{ href: '/tienda', label: 'Mis tiendas' }}>
      <StoreReservations id={(await params).storeId} locale={getVertical().locale} />
    </Page>
  );
}
