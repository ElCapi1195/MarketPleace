import { Corridor } from '@/features/arrivals/components/corridor';
import { getArrivals } from '@/features/arrivals/source';
import { getVertical } from '@/lib/vertical';

export default function HomePage() {
  const arrivals = getArrivals();

  if (arrivals.length === 0) {
    return (
      <main className="flex max-w-2xl flex-col gap-4 px-4 py-16 sm:px-8 lg:px-12">
        <h1 className="font-display text-4xl font-extrabold text-balance">Todavía no hay preventas abiertas</h1>
        <p className="text-lg">{getVertical().brand.tagline} Aparecerán aquí en cuanto una tienda publique la primera.</p>
      </main>
    );
  }

  return (
    <main>
      <h1 className="max-w-3xl px-4 pt-2 pb-1 font-display text-[clamp(2rem,4.6vw,3.75rem)] leading-none font-extrabold tracking-tight text-balance [font-stretch:90%] sm:px-8 lg:px-12">
        Adelanta el tiempo y aparta lo que viene
      </h1>
      <Corridor arrivals={arrivals} />
    </main>
  );
}
