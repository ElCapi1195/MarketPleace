import type { CategoryCover } from '@marketplace/contracts';
import Link from 'next/link';
import { getVertical } from '@/lib/vertical';
import { catalogHref } from '../lib/params';
import { ProductImage } from './product-image';

export function CategoryTiles({ categories }: { categories: readonly CategoryCover[] }) {
  const names = new Map(getVertical().categories.map(({ slug, name }) => [slug, name]));
  return (
    <nav aria-label="Categorías">
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {categories.map(({ slug, total, cover }) => (
          <li key={slug}>
            <Link href={catalogHref({ category: slug })} className="group flex items-center gap-3 overflow-hidden rounded-2xl bg-surface pr-3">
              <ProductImage image={cover} alt="" sizes="112px" className="size-20 shrink-0 sm:size-28" />
              <span className="min-w-0">
                <span className="block leading-tight font-bold group-hover:underline sm:text-lg">{names.get(slug) ?? slug}</span>
                <span className="text-sm">{total === 1 ? '1 publicación' : `${total} publicaciones`}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
