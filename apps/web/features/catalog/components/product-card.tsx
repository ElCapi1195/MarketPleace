import type { ProductCard as Card } from '@marketplace/contracts';
import Link from 'next/link';
import { getVertical } from '@/lib/vertical';
import { availability } from '../lib/availability';
import { formatMoney } from '../lib/money';
import { ProductImage } from './product-image';

export function ProductCard({ product, priority = false }: { product: Card; priority?: boolean }) {
  const { currency, locale } = getVertical();
  return (
    <article className="group relative flex min-w-0 flex-col gap-3">
      <div className="relative aspect-4/3 overflow-hidden rounded-2xl bg-surface">
        <ProductImage
          image={product.cover}
          alt=""
          sizes="(min-width: 1024px) 300px, 50vw"
          priority={priority}
          className="size-full transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        {product.hasModel && (
          <span className="absolute top-2.5 right-2.5 rounded-lg bg-ink px-2 py-0.5 text-sm font-bold text-background">3D</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-0.5">
        <h3 className="leading-snug font-bold text-balance sm:text-lg">
          <Link href={`/producto/${product.slug}`} className="after:absolute after:inset-0 after:rounded-2xl group-hover:underline">
            {product.title}
          </Link>
        </h3>
        <p className="text-sm text-ink/75">{product.storeName}</p>
        <p className="mt-auto flex flex-wrap items-baseline justify-between gap-x-3 pt-1.5">
          <span className="font-display text-xl font-extrabold">{formatMoney(product.priceMinor, currency, locale)}</span>
          <span className="text-sm font-medium">{availability(product, new Date(), locale)}</span>
        </p>
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: readonly Card[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-5 lg:grid-cols-4">
      {products.map((product, index) => (
        <li key={product.slug} className="flex min-w-0 *:flex-1">
          <ProductCard product={product} priority={index < 2} />
        </li>
      ))}
    </ul>
  );
}
