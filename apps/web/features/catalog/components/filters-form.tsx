import Link from 'next/link';
import { withBasePath } from '@/lib/base-path';
import { getVertical } from '@/lib/vertical';
import { kinds, sorts, type Filters } from '../lib/params';

const select = 'h-12 w-full rounded-xl border-2 border-ink/30 bg-background px-3 font-medium';

/** Filtros sin JavaScript: un formulario que cambia la dirección. */
export function FiltersForm({ filters }: { filters: Filters }) {
  const { categories } = getVertical();
  const active = filters.category || filters.kind || filters.sort || filters.q;
  return (
    <form action={withBasePath('/catalogo')} className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-1 lg:gap-5 lg:self-start">
      {filters.q && <input type="hidden" name="q" value={filters.q} />}
      <label className="flex flex-col gap-1.5 font-bold">
        Categoría
        <select name="categoria" defaultValue={filters.category} className={select}>
          <option value="">Todas</option>
          {categories.map(({ slug, name, parent }) => (
            <option key={slug} value={slug}>
              {parent ? `  ${name}` : name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 font-bold">
        Entrega
        <select name="tipo" defaultValue={filters.kind} className={select}>
          <option value="">Cualquiera</option>
          {kinds.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 font-bold">
        Ordenar por
        <select name="orden" defaultValue={filters.sort} className={select}>
          {sorts.map(({ value, label }, index) => (
            <option key={value} value={index === 0 ? '' : value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end gap-4 lg:flex-col lg:items-stretch lg:gap-1">
        <button type="submit" className="h-12 flex-1 cursor-pointer rounded-xl bg-ink px-5 font-bold text-background lg:flex-none">
          Aplicar
        </button>
        {active && (
          <Link href="/catalogo" className="py-3 text-center font-bold underline">
            Quitar
          </Link>
        )}
      </div>
    </form>
  );
}
