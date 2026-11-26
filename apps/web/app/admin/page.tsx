import type { Metadata } from 'next';
import { OverviewPanel } from '@/features/admin/components/overview';
import { Page } from '@/features/shared/components/page';

export const metadata: Metadata = { title: 'Administración' };

export default function AdminPage() {
  return (
    <Page title="Lo pendiente">
      <OverviewPanel />
    </Page>
  );
}
