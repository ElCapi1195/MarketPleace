import type { ReactNode } from 'react';
import { AdminNav } from '@/features/admin/components/admin-nav';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="mx-auto max-w-4xl px-4 pt-4 sm:px-6">
        <AdminNav />
      </div>
      {children}
    </>
  );
}
