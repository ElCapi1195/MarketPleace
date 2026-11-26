import type { Metadata } from 'next';
import { MyReservations } from '@/features/reservations/components/my-reservations';
import { Page } from '@/features/shared/components/page';
import { getVertical } from '@/lib/vertical';

export const metadata: Metadata = { title: 'Mis reservas' };

export default function ReservationsPage() {
  return (
    <Page title="Mis reservas">
      <MyReservations locale={getVertical().locale} />
    </Page>
  );
}
