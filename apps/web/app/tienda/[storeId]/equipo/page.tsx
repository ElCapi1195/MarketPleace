import type { Metadata } from 'next';
import { Page } from '@/features/shared/components/page';
import { Team } from '@/features/store/components/team';
import { getVertical } from '@/lib/vertical';

export const metadata: Metadata = { title: 'Equipo' };

export default async function TeamPage({ params }: { params: Promise<{ storeId: string }> }) {
  return (
    <Page title="Equipo" back={{ href: '/tienda', label: 'Mis tiendas' }}>
      <Team id={(await params).storeId} locale={getVertical().locale} />
    </Page>
  );
}
