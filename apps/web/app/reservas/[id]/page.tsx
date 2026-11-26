import type { Metadata } from 'next';
import { CustomerReservationDetail } from '@/features/reservations/components/customer-detail';
import { Page } from '@/features/shared/components/page';
import { getVertical } from '@/lib/vertical';

export const metadata: Metadata = { title: 'Reserva' };

export default async function ReservationPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Page title="Tu reserva" back={{ href: '/reservas', label: 'Mis reservas' }}>
      <CustomerReservationDetail id={(await params).id} locale={getVertical().locale} />
    </Page>
  );
}
