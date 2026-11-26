import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { Gallery } from '@/features/catalog/components/gallery';
import { describeAttributes } from '@/features/catalog/lib/attributes';
import { availability } from '@/features/catalog/lib/availability';
import { formatMoney } from '@/features/catalog/lib/money';
import { catalogHref } from '@/features/catalog/lib/params';
import { buildPath } from '@/features/catalog/lib/path';
import { ReportButton } from '@/features/reports/components/report-button';
import { getProduct } from '@/lib/server-api';
import { getVertical } from '@/lib/vertical';

type ProductPageProps = { params: Promise<{ slug: string }> };

// Los metadatos y la página comparten la misma lectura.
const load = cache(getProduct);

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const product = await load((await params).slug);
  return product ? { title: product.title, description: product.description.slice(0, 160) } : {};
}

export default async function ProductPage({ params }: ProductPageProps) {
  const product = await load((await params).slug);
  if (!product) notFound();

  const { currency, locale, categories, reservations } = getVertical();
  const category = categories.find(({ slug }) => slug === product.categorySlug);
  const arrival = availability(product, new Date(), locale);
  const deposit = product.depositMinor > 0 ? formatMoney(product.depositMinor, currency, locale) : null;
  const steps = buildPath({ kind: product.kind, reviewHours: reservations.reviewHours, arrival, deposit });
  const details = describeAttributes(category?.attributes ?? [], product.attributes, locale);

  return (
    <main className="mx-auto grid max-w-7xl items-start gap-x-12 gap-y-8 px-4 pt-6 pb-20 sm:px-6 lg:grid-cols-[7fr_5fr]">
      <Gallery title={product.title} images={product.images} model={product.model} />
      <div className="flex min-w-0 flex-col gap-5">
        {category && (
          <Link href={catalogHref({ category: category.slug })} className="self-start font-medium underline">
            {category.name}
          </Link>
        )}
        <h1 className="font-display text-[clamp(1.9rem,3.4vw,2.9rem)] leading-[1.06] font-extrabold tracking-tight text-balance">{product.title}</h1>
        <p className="font-display text-4xl font-extrabold">{formatMoney(product.priceMinor, currency, locale)}</p>
        <p className="text-lg">
          <span className="font-bold">{arrival}</span>
          {deposit && <span>. Depósito de {deposit}</span>}
          <span className="block">Vendido por {product.storeName}</span>
        </p>
        <div className="flex flex-col gap-2">
          {product.units === 0 ? (
            <p className="rounded-xl bg-surface p-4 text-center text-lg font-bold">Agotado</p>
          ) : (
            <Link
              href={`/producto/${product.slug}/reservar`}
              className="inline-flex min-h-14 items-center justify-center rounded-xl bg-accent px-6 text-lg font-bold text-ink hover:underline"
            >
              Solicitar reserva
            </Link>
          )}
          <p className="text-sm">Solicitar no te cobra nada.</p>
          <ReportButton target={{ productSlug: product.slug }} label="Denunciar este producto" />
        </div>
        {product.description && <p className="max-w-prose text-lg whitespace-pre-line">{product.description}</p>}
        {details.length > 0 && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 border-t-2 border-surface">
            {details.map(({ label, value }) => (
              <div key={label} className="col-span-2 grid grid-cols-subgrid border-b-2 border-surface py-2.5">
                <dt>{label}</dt>
                <dd className="text-right font-bold">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <section aria-labelledby="pasos" className="rounded-3xl bg-surface p-6 sm:p-10 lg:col-span-2">
        <h2 id="pasos" className="font-display text-2xl font-extrabold tracking-tight">
          Cómo será tu reserva
        </h2>
        <ol className="mt-5 grid gap-5 sm:auto-cols-fr sm:grid-flow-col sm:gap-8">
          {steps.map(({ title, text }, index) => (
            <li key={title}>
              <p className="font-bold">
                {index + 1}. {title}
              </p>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
