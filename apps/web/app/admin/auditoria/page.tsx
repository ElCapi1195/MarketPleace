import type { Metadata } from 'next';
import { AuditLog } from '@/features/admin/components/audit-log';
import { Page } from '@/features/shared/components/page';
import { getVertical } from '@/lib/vertical';

export const metadata: Metadata = { title: 'Auditoría' };

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { objeto } = await searchParams;
  return (
    <Page title="Auditoría" wide>
      <AuditLog locale={getVertical().locale} initialTarget={typeof objeto === 'string' ? objeto.slice(0, 60) : ''} />
    </Page>
  );
}
