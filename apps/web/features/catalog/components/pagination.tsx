import type { CatalogPage } from '@marketplace/contracts';
import Link from 'next/link';
import { catalogHref, type Filters } from '../lib/params';

const link = 'inline-flex min-h-12 items-center rounded-xl border-2 border-ink px-5 font-bold';

export function Pagination({ result, filters }: { result: CatalogPage; filters: Filters }) {
  const pages = Math.ceil(result.total / result.pageSize);
  if (pages <= 1) return null;
  return (
    <nav aria-label="Páginas" className="flex flex-wrap items-center justify-between gap-4">
      {result.page > 1 ? (
        <Link href={catalogHref({ ...filters, page: result.page - 1 })} className={link}>
          Anterior
        </Link>
      ) : (
        <span />
      )}
      <p>
        Página {result.page} de {pages}
      </p>
      {result.page < pages ? (
        <Link href={catalogHref({ ...filters, page: result.page + 1 })} className={link}>
          Siguiente
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
