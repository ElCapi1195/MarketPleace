'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface SectionLink {
  href: string;
  label: string;
}

/** Pestañas de una zona de gestión. La activa es la coincidencia más larga. */
export function SectionNav({ label, links }: { label: string; links: readonly SectionLink[] }) {
  const pathname = usePathname();
  const active = links
    .filter(({ href }) => pathname === href || pathname.startsWith(`${href}/`))
    .toSorted((a, b) => b.href.length - a.href.length)[0];
  return (
    <nav aria-label={label} className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
      {links.map(({ href, label: text }) => (
        <Link
          key={href}
          href={href}
          aria-current={active?.href === href ? 'page' : undefined}
          className="rounded-xl px-4 py-2.5 font-bold whitespace-nowrap hover:underline aria-[current=page]:bg-ink aria-[current=page]:text-background aria-[current=page]:no-underline"
        >
          {text}
        </Link>
      ))}
    </nav>
  );
}
