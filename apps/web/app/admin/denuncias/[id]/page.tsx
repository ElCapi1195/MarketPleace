import type { Metadata } from 'next';
import { ReportDetailPanel } from '@/features/admin/components/reports';
import { Page } from '@/features/shared/components/page';
import { getVertical } from '@/lib/vertical';

export const metadata: Metadata = { title: 'Denuncia' };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Page title="Denuncia" back={{ href: '/admin/denuncias', label: 'Denuncias' }}>
      <ReportDetailPanel id={(await params).id} locale={getVertical().locale} />
    </Page>
  );
}
