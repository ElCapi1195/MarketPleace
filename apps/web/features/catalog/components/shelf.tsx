import type { ProductCard } from '@marketplace/contracts';
import Link from 'next/link';
import { ProductGrid } from './product-card';

// Una fila completa: el resto está en «Ver todo».
const ROW = 4;

interface ShelfProps {
  id: string;
  title: string;
  href: string;
  products: readonly ProductCard[];
}

export function Shelf({ id, title, href, products }: ShelfProps) {
  if (products.length === 0) return null;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6">
        <h2 id={id} className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
          {title}
        </h2>
        <Link href={href} className="py-2 font-bold underline">
          Ver todo
        </Link>
      </div>
      <ProductGrid products={products.slice(0, ROW)} />
    </section>
  );
}
