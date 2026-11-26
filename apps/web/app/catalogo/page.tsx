import type { Metadata } from 'next';
import Link from 'next/link';
import { FiltersForm } from '@/features/catalog/components/filters-form';
import { Pagination } from '@/features/catalog/components/pagination';
import { ProductCard } from '@/features/catalog/components/product-card';
import { readFilters, toApiQuery } from '@/features/catalog/lib/params';
import { searchCatalog } from '@/lib/server-api';
import { getVertical } from '@/lib/vertical';

export const metadata: Metadata = { title: 'Catálogo' };

type CatalogPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const filters = readFilters(await searchParams);
  const result = await searchCatalog(toApiQuery(filters));
  const category = getVertical().categories.find(({ slug }) => slug === filters.category);
  const title = filters.q ? `Resultados de «${filters.q}»` : (category?.name ?? 'Catálogo');

  return (
    <main className="mx-auto grid max-w-7xl gap-x-10 gap-y-6 px-4 pt-6 pb-20 sm:px-6 lg:grid-cols-[14rem_1fr]">
      <div className="lg:col-span-2">
        <h1 className="font-display text-3xl font-extrabold tracking-tight break-words sm:text-4xl">{title}</h1>
        <p className="mt-1">{result.total === 1 ? '1 publicación' : `${result.total} publicaciones`}</p>
      </div>
      {/* La clave reinicia los selectores al cambiar de filtros con un enlace. */}
      <FiltersForm key={JSON.stringify(filters)} filters={filters} />
      <div className="flex min-w-0 flex-col gap-10">
        {result.items.length > 0 ? (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-5 xl:grid-cols-3">
            {result.items.map((product, index) => (
              <li key={product.slug} className="flex min-w-0 *:flex-1">
                <ProductCard product={product} priority={index < 4} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-lg">
            Nada coincide con tu búsqueda. Prueba con otra palabra o{' '}
            <Link href="/catalogo" className="font-bold underline">
              mira todo el catálogo
            </Link>
            .
          </p>
        )}
        <Pagination result={result} filters={filters} />
      </div>
    </main>
  );
}
