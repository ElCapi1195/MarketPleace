import type { ProductCard } from '@marketplace/contracts';
import Link from 'next/link';
import { getVertical } from '@/lib/vertical';
import { availability } from '../lib/availability';
import { formatMoney } from '../lib/money';
import { ProductImage } from './product-image';

function Lead({ product }: { product: ProductCard }) {
  const { currency, locale } = getVertical();
  return (
    <article className="relative grid overflow-hidden rounded-3xl bg-ink text-background sm:grid-cols-[5fr_9fr] lg:row-span-2">
      <div className="order-2 flex flex-col justify-center gap-4 p-6 sm:order-1 lg:p-7">
        <p className="font-medium">{availability(product, new Date(), locale)}</p>
        <h2 className="font-display text-[clamp(1.75rem,2.7vw,2.3rem)] leading-[1.08] hyphens-auto font-extrabold tracking-tight text-balance">{product.title}</h2>
        <p className="text-lg">
          <span className="font-display text-2xl font-extrabold text-accent">{formatMoney(product.priceMinor, currency, locale)}</span>
          <span className="block">{product.storeName}</span>
        </p>
        <Link
          href={`/producto/${product.slug}`}
          className="mt-2 inline-flex min-h-13 items-center self-start rounded-xl bg-accent px-6 font-bold text-ink after:absolute after:inset-0 hover:underline"
        >
          Ver producto
        </Link>
      </div>
      <div className="order-1 aspect-4/3 sm:order-2 sm:aspect-auto sm:min-h-96 lg:min-h-125">
        <ProductImage image={product.cover} alt="" sizes="(min-width: 1024px) 560px, 100vw" priority className="size-full" />
      </div>
    </article>
  );
}

function Side({ product }: { product: ProductCard }) {
  const { currency, locale } = getVertical();
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-3xl bg-surface">
      <div className="aspect-16/9 overflow-hidden lg:aspect-auto lg:min-h-36 lg:flex-1">
        <ProductImage image={product.cover} alt="" sizes="(min-width: 1024px) 380px, 100vw" priority className="size-full lg:absolute lg:inset-x-0 lg:top-0 lg:h-[calc(100%-4rem)]" />
      </div>
      <div className="relative flex h-16 items-center justify-between gap-4 bg-surface px-5">
        <h2 className="leading-tight font-bold">
          <Link href={`/producto/${product.slug}`} className="after:absolute after:inset-x-0 after:-top-96 after:bottom-0 group-hover:underline">
            {product.title}
          </Link>
        </h2>
        <span className="font-display text-xl font-extrabold whitespace-nowrap">{formatMoney(product.priceMinor, currency, locale)}</span>
      </div>
    </article>
  );
}

/** Un producto destacado grande y hasta dos secundarios. */
export function Showcase({ products }: { products: readonly ProductCard[] }) {
  const [lead, ...rest] = products;
  if (!lead) return null;
  return (
    <section aria-label="Destacados" className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,2fr)] lg:grid-rows-2">
      <Lead product={lead} />
      {rest.slice(0, 2).map((product) => (
        <Side key={product.slug} product={product} />
      ))}
    </section>
  );
}
