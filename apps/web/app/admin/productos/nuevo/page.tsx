import type { Metadata } from 'next';
import Link from 'next/link';
import { NewProduct } from '@/features/admin/components/product-editor';
import { editorContext } from '@/features/admin/lib/context';

export const metadata: Metadata = { title: 'Nuevo producto' };

export default function NewProductPage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 pt-6 pb-20 sm:px-6">
      <Link href="/admin/productos" className="self-start font-medium underline">
        Productos
      </Link>
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Nuevo producto</h1>
      <NewProduct {...editorContext()} />
    </main>
  );
}
