import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrivalList } from '@/features/arrivals/components/arrival-list';
import { categoryBranch, filterArrivals, normalizeSearch } from '@/features/arrivals/lib/filter';
import { getArrivals } from '@/features/arrivals/source';
import { getVertical } from '@/lib/vertical';

export const metadata: Metadata = { title: 'Lista de preventas' };

type ListPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ListPage({ searchParams }: ListPageProps) {
  const params = await searchParams;
  const { categories } = getVertical();
  const query = normalizeSearch(params.q);
  const branch = categoryBranch(categories, normalizeSearch(params.categoria));
  const arrivals = filterArrivals(getArrivals(), { query, categories: branch });

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pt-4 pb-16 sm:px-8">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Preventas abiertas</h1>
      <form className="grid gap-3 sm:grid-cols-[1fr_14rem_auto] sm:items-end">
        <label className="flex flex-col gap-1.5 font-bold">
          Buscar
          <input type="search" name="q" defaultValue={query} maxLength={80} className="h-12 w-full rounded-lg border-2 border-ink/50 bg-background px-3 font-medium" />
        </label>
        <label className="flex flex-col gap-1.5 font-bold">
          Categoría
          <select name="categoria" defaultValue={branch[0] ?? ''} className="h-12 w-full rounded-lg border-2 border-ink/50 bg-background px-3 font-medium">
            <option value="">Todas</option>
            {categories.map(({ slug, name }) => (
              <option key={slug} value={slug}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="h-12 cursor-pointer rounded-lg bg-ink px-6 font-bold text-background">
          Buscar
        </button>
      </form>
      {arrivals.length > 0 ? (
        <ArrivalList arrivals={arrivals} />
      ) : (
        <p className="text-lg">
          Ninguna preventa coincide.{' '}
          <Link href="/lista" className="underline">
            Ver todas
          </Link>
        </p>
      )}
    </main>
  );
}
