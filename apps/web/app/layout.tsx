import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { getVertical } from '@/lib/vertical';
import { SiteHeader } from '@/features/shell/site-header';
import { samplesEnabled } from '@/features/arrivals/source';
import './globals.css';

export function generateMetadata(): Metadata {
  const { brand } = getVertical();
  return {
    title: { default: brand.name, template: `%s · ${brand.name}` },
    description: brand.tagline,
    robots: { index: false },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { brand, locale } = getVertical();
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const tokens = Object.entries(brand.colors)
    .map(([name, value]) => `--brand-${name}:${value}`)
    .join(';');

  return (
    <html lang={locale}>
      <head>
        {/* El navegador oculta el nonce tras leerlo, de ahí la diferencia al hidratar. */}
        <style nonce={nonce} suppressHydrationWarning>{`:root{${tokens}}`}</style>
      </head>
      <body>
        <SiteHeader showSampleNotice={samplesEnabled()} />
        {children}
      </body>
    </html>
  );
}
