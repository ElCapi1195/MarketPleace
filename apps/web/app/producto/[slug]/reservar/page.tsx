import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { availability } from '@/features/catalog/lib/availability';
import { formatMoney } from '@/features/catalog/lib/money';
import { ProductImage } from '@/features/catalog/components/product-image';
import { RequestForm } from '@/features/reservations/components/request-form';
import { getProduct } from '@/lib/server-api';
import { getVertical } from '@/lib/vertical';

export const metadata: Metadata = { title: 'Solicitar reserva' };

export default async function RequestPage({ params }: { params: Promise<{ slug: string }> }) {
  const product = await getProduct((await params).slug);
  if (!product) notFound();
  const { currency, locale, reservations } = getVertical();
  const { priceMinor, depositMinor, availableOn } = product;

  return (
    <main className="mx-auto grid max-w-5xl gap-x-12 gap-y-8 px-4 pt-6 pb-20 sm:px-6 lg:grid-cols-[2fr_3fr]">
      <div className="flex flex-col gap-4 self-start rounded-3xl bg-surface p-5">
        <div className="aspect-4/3 overflow-hidden rounded-2xl">
          <ProductImage image={product.cover} alt="" sizes="(min-width: 1024px) 360px, 100vw" priority className="size-full" />
        </div>
        <div>
          <Link href={`/producto/${product.slug}`} className="text-xl font-bold underline">
            {product.title}
          </Link>
          <p>{product.storeName}</p>
        </div>
        <p className="font-display text-3xl font-extrabold">{formatMoney(priceMinor, currency, locale)}</p>
        <p>
          <span className="font-bold">{availability(product, new Date(), locale)}.</span>{' '}
          {depositMinor > 0 ? `Depósito de ${formatMoney(depositMinor, currency, locale)}, directo a la tienda.` : 'Sin depósito.'}
        </p>
      </div>
      <div className="flex min-w-0 flex-col gap-5">
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Solicitar reserva</h1>
        <p className="text-lg">La tienda responde en un máximo de {reservations.reviewHours} horas. Puedes cancelarla mientras no haya empezado tu pedido.</p>
        {product.units === 0 ? (
          <p className="text-lg font-bold">El producto está agotado.</p>
        ) : (
          <RequestForm slug={product.slug} expected={{ priceMinor, depositMinor, availableOn }} conditions={reservations.terms} />
        )}
      </div>
    </main>
  );
}
