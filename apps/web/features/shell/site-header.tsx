import Link from 'next/link';
import { AccountLink } from '@/features/account/components/account-link';
import { catalogHref } from '@/features/catalog/lib/params';
import { getVertical } from '@/lib/vertical';

function Search() {
  return (
    <form action="/catalogo" role="search" className="order-3 flex w-full basis-full md:order-none md:w-auto md:max-w-2xl md:flex-1 md:basis-0">
      <label htmlFor="site-search" className="sr-only">
        Buscar productos
      </label>
      <input
        id="site-search"
        type="search"
        name="q"
        maxLength={80}
        placeholder="¿Qué buscas?"
        className="h-12 min-w-0 flex-1 rounded-l-xl border-2 border-r-0 border-ink bg-background px-4 font-medium placeholder:text-ink/70"
      />
      <button type="submit" className="h-12 cursor-pointer rounded-r-xl bg-ink px-5 font-bold text-background">
        Buscar
      </button>
    </form>
  );
}

export function SiteHeader({ showSampleNotice }: { showSampleNotice: boolean }) {
  const { brand, categories } = getVertical();
  const roots = categories.filter(({ parent }) => parent === undefined);
  return (
    <>
      {showSampleNotice && (
        <p className="bg-accent px-4 py-1.5 text-center text-sm font-medium text-ink">Vista de desarrollo: incluye productos y tiendas ficticios.</p>
      )}
      <header className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <Link href="/" className="py-2 font-display text-lg font-extrabold sm:text-xl">
            {brand.name}
          </Link>
          <Search />
          <AccountLink />
        </div>
        <nav aria-label="Principal" className="-mx-4 mt-2 flex gap-x-6 overflow-x-auto px-4 font-medium [scrollbar-width:none] whitespace-nowrap sm:mx-0 sm:px-0">
          {roots.map(({ slug, name }) => (
            <Link key={slug} href={catalogHref({ category: slug })} className="py-3 hover:underline">
              {name}
            </Link>
          ))}
          <Link href={catalogHref({ kind: 'preventa' })} className="py-3 hover:underline">
            Preventas
          </Link>
          <Link href={catalogHref({ kind: 'disponible' })} className="py-3 hover:underline">
            Disponible hoy
          </Link>
        </nav>
      </header>
    </>
  );
}
