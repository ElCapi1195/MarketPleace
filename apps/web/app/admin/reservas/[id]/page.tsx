import type { Metadata } from 'next';
import { AdminReservationDetail } from '@/features/admin/components/admin-reservations';
import { Page } from '@/features/shared/components/page';
import { getVertical } from '@/lib/vertical';

export const metadata: Metadata = { title: 'Reserva' };

export default async function AdminReservationPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Page title="Reserva" back={{ href: '/admin/reservas', label: 'Reservas' }}>
      <AdminReservationDetail id={(await params).id} locale={getVertical().locale} />
    </Page>
  );
}
