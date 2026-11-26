import type { Metadata } from 'next';
import { ModerationQueue } from '@/features/admin/components/moderation';
import { Page } from '@/features/shared/components/page';
import { getVertical } from '@/lib/vertical';

export const metadata: Metadata = { title: 'Moderación' };

export default function ModerationPage() {
  const { currency, locale } = getVertical();
  return (
    <Page title="Productos por revisar">
      <ModerationQueue currency={currency} locale={locale} />
    </Page>
  );
}
