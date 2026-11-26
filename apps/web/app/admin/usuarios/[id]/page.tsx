import type { Metadata } from 'next';
import { UserDetail } from '@/features/admin/components/users';
import { Page } from '@/features/shared/components/page';
import { getVertical } from '@/lib/vertical';

export const metadata: Metadata = { title: 'Cuenta' };

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Page title="Cuenta" back={{ href: '/admin/usuarios', label: 'Cuentas' }}>
      <UserDetail id={(await params).id} locale={getVertical().locale} />
    </Page>
  );
}
