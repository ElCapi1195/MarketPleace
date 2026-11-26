import type { Metadata } from 'next';
import { ModerationDetail } from '@/features/admin/components/moderation';
import { editorContext } from '@/features/products/lib/context';
import { Page } from '@/features/shared/components/page';
import { getVertical } from '@/lib/vertical';

export const metadata: Metadata = { title: 'Revisar producto' };

export default async function ModerationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { currency, locale } = getVertical();
  return (
    <Page title="Revisar producto" back={{ href: '/admin/moderacion', label: 'Moderación' }}>
      <ModerationDetail id={(await params).id} context={editorContext().context} currency={currency} locale={locale} />
    </Page>
  );
}
