import type { Metadata } from 'next';
import { AdminReservationList } from '@/features/admin/components/admin-reservations';
import { Page } from '@/features/shared/components/page';
import { getVertical } from '@/lib/vertical';

export const metadata: Metadata = { title: 'Reservas' };

export default async function AdminReservationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { devolucion } = await searchParams;
  return (
    <Page title="Reservas">
      <AdminReservationList locale={getVertical().locale} refundOnly={devolucion === 'pendiente'} />
    </Page>
  );
}
