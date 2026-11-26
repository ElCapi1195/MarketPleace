import { CategoryTiles } from '@/features/catalog/components/category-tiles';
import { HowItWorks } from '@/features/catalog/components/how-it-works';
import { Shelf } from '@/features/catalog/components/shelf';
import { Showcase } from '@/features/catalog/components/showcase';
import { catalogHref } from '@/features/catalog/lib/params';
import { getHome } from '@/lib/server-api';
import { getVertical } from '@/lib/vertical';

export default async function HomePage() {
  const { featured, preorders, available, categories } = await getHome();
  const { tagline } = getVertical().brand;

  if (featured.length === 0) {
    return (
      <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-16 sm:px-6">
        <h1 className="font-display text-4xl font-extrabold text-balance">Todavía no hay productos publicados</h1>
        <p className="text-lg">{tagline} Aparecerán aquí en cuanto una tienda publique el primero.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-12 px-4 pt-4 pb-20 sm:gap-16 sm:px-6">
      <div className="flex flex-col gap-4">
        <h1 className="sr-only">{tagline}</h1>
        <Showcase products={featured} />
        <CategoryTiles categories={categories} />
      </div>
      <Shelf id="disponibles" title="Disponible hoy" href={catalogHref({ kind: 'disponible' })} products={available} />
      <Shelf id="preventas" title="Preventas abiertas" href={catalogHref({ kind: 'preventa', sort: 'llegada' })} products={preorders} />
      <HowItWorks />
    </main>
  );
}
