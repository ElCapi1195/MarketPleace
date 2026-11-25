import Link from 'next/link';
import { AccountLink } from '@/features/account/components/account-link';
import { getVertical } from '@/lib/vertical';

export function SiteHeader({ showSampleNotice }: { showSampleNotice: boolean }) {
  return (
    <>
      {showSampleNotice && (
        <p className="bg-accent px-4 py-2 text-center text-sm font-medium text-ink">
          Datos de ejemplo: los productos, las tiendas y los precios son ficticios.
        </p>
      )}
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 sm:px-8 lg:px-12">
        <Link href="/" className="py-2.5 font-display text-base font-extrabold sm:text-lg">
          {getVertical().brand.name}
        </Link>
        <nav aria-label="Principal" className="flex gap-4 font-medium sm:gap-7">
          <Link href="/" className="py-2.5 hover:underline">
            Corredor
          </Link>
          <Link href="/lista" className="py-2.5 hover:underline">
            Lista
          </Link>
          <AccountLink />
        </nav>
      </header>
    </>
  );
}
