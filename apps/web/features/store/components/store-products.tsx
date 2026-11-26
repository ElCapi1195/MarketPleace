'use client';

import Link from 'next/link';
import { NewProduct, ProductEditor, type EditorContext } from '@/features/products/components/product-editor';
import { ProductList } from '@/features/products/components/product-list';
import { StoreShell } from './store-area';

function Closed({ status }: { status: string }) {
  return (
    <p className="text-lg">
      {status === 'SUSPENDED' ? 'La tienda está suspendida: puedes consultar tus productos, pero no cambiarlos.' : 'Podrás crear productos cuando la tienda esté verificada.'}
    </p>
  );
}

export function StoreProducts({ id, currency, locale }: { id: string; currency: string; locale: string }) {
  return (
    <StoreShell id={id}>
      {({ status }) => (
        <>
          {status === 'APPROVED' ? (
            <Link href={`/tienda/${id}/productos/nuevo`} className="inline-flex min-h-13 items-center self-start rounded-xl bg-accent px-6 font-bold text-ink">
              Nuevo producto
            </Link>
          ) : (
            <Closed status={status} />
          )}
          <ProductList base={`/api/stores/${id}`} path={`/tienda/${id}/productos`} currency={currency} locale={locale} />
        </>
      )}
    </StoreShell>
  );
}

export function StoreNewProduct({ id, ...context }: EditorContext & { id: string }) {
  return (
    <StoreShell id={id}>
      {({ status }) => (status === 'APPROVED' ? <NewProduct owner={{ kind: 'store', id }} {...context} /> : <Closed status={status} />)}
    </StoreShell>
  );
}

export function StoreEditProduct({ id, productId, ...context }: EditorContext & { id: string; productId: string }) {
  return (
    <StoreShell id={id}>
      {({ status }) => (
        <>
          {status !== 'APPROVED' && <Closed status={status} />}
          <ProductEditor owner={{ kind: 'store', id }} id={productId} {...context} />
        </>
      )}
    </StoreShell>
  );
}
