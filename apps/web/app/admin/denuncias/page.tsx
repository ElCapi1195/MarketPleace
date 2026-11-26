import type { Metadata } from 'next';
import { ReportList } from '@/features/admin/components/reports';
import { Page } from '@/features/shared/components/page';
import { getVertical } from '@/lib/vertical';

export const metadata: Metadata = { title: 'Denuncias' };

export default function ReportsPage() {
  return (
    <Page title="Denuncias">
      <ReportList locale={getVertical().locale} />
    </Page>
  );
}
