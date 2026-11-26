import type { Metadata } from 'next';
import { StoreReservationDetail } from '@/features/reservations/components/store-detail';
import { Page } from '@/features/shared/components/page';
import { getVertical } from '@/lib/vertical';

export const metadata: Metadata = { title: 'Reserva' };

export default async function StoreReservationPage({ params }: { params: Promise<{ storeId: string; id: string }> }) {
  const { storeId, id } = await params;
  return (
    <Page title="Reserva" back={{ href: `/tienda/${storeId}/reservas`, label: 'Reservas' }}>
      <StoreReservationDetail storeId={storeId} id={id} locale={getVertical().locale} />
    </Page>
  );
}
