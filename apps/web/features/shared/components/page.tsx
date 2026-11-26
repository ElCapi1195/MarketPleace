import Link from 'next/link';
import type { ReactNode } from 'react';

interface PageProps {
  title: string;
  back?: { href: string; label: string };
  action?: { href: string; label: string };
  wide?: boolean;
  children: ReactNode;
}

/** Estructura común de las pantallas de gestión. */
export function Page({ title, back, action, wide = false, children }: PageProps) {
  return (
    <main className={`mx-auto flex flex-col gap-6 px-4 pt-6 pb-20 sm:px-6 ${wide ? 'max-w-6xl' : 'max-w-4xl'}`}>
      {back && (
        <Link href={back.href} className="self-start font-medium underline">
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">{title}</h1>
        {action && (
          <Link href={action.href} className="inline-flex min-h-13 items-center rounded-xl bg-accent px-6 font-bold text-ink">
            {action.label}
          </Link>
        )}
      </div>
      {children}
    </main>
  );
}
