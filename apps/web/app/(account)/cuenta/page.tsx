import type { Metadata } from 'next';
import { AccountPanel } from '@/features/account/components/account-panel';

export const metadata: Metadata = { title: 'Tu cuenta' };

export default function AccountPage() {
  return <AccountPanel />;
}
