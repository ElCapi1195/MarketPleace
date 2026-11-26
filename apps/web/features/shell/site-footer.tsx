import Link from 'next/link';
import { getVertical } from '@/lib/vertical';

export function SiteFooter() {
  const { brand } = getVertical();
  return (
    <footer className="bg-ink text-background">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-8 gap-y-4 px-4 py-10 sm:px-6">
        <div>
          <p className="font-display text-lg font-extrabold">{brand.name}</p>
          <p>{brand.tagline}</p>
        </div>
        <nav aria-label="Pie" className="flex flex-wrap gap-x-6 font-medium">
          <Link href="/catalogo" className="py-2.5 hover:underline">
            Catálogo
          </Link>
          <Link href="/vender" className="py-2.5 hover:underline">
            Vende aquí
          </Link>
          <Link href="/tienda" className="py-2.5 hover:underline">
            Mis tiendas
          </Link>
        </nav>
      </div>
    </footer>
  );
}
