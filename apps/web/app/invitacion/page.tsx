import type { Metadata } from 'next';
import { Page } from '@/features/shared/components/page';
import { AcceptInvitation } from '@/features/store/components/accept-invitation';

export const metadata: Metadata = { title: 'Invitación', referrer: 'no-referrer' };

export default function InvitationPage() {
  return (
    <Page title="Te invitaron a una tienda">
      <AcceptInvitation />
    </Page>
  );
}
