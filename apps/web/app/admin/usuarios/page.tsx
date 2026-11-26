import type { Metadata } from 'next';
import { UserSearch } from '@/features/admin/components/users';
import { Page } from '@/features/shared/components/page';

export const metadata: Metadata = { title: 'Cuentas' };

export default function UsersPage() {
  return (
    <Page title="Cuentas">
      <UserSearch />
    </Page>
  );
}
