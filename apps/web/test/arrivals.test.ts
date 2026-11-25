import { describe, expect, it } from 'vitest';
import { categoryBranch, filterArrivals, normalizeSearch } from '../features/arrivals/lib/filter';
import { formatMoney } from '../features/arrivals/lib/money';
import { monthLabel } from '../features/arrivals/lib/months';

const arrivals = [
  { name: 'Cámara de acción', storeName: 'Norte', categorySlug: 'camaras' },
  { name: 'Trípode', storeName: 'Cámaras Sur', categorySlug: 'soportes' },
];

describe('filterArrivals', () => {
  it('ignora tildes y mayúsculas', () => {
    expect(filterArrivals(arrivals, { query: 'CAMARA' })).toHaveLength(2);
    expect(filterArrivals(arrivals, { query: 'tripode' })).toEqual([arrivals[1]]);
  });

  it('exige todas las palabras', () => {
    expect(filterArrivals(arrivals, { query: 'camara norte' })).toEqual([arrivals[0]]);
  });

  it('filtra por categoría', () => {
    expect(filterArrivals(arrivals, { categories: ['soportes'] })).toEqual([arrivals[1]]);
  });

  it('sin filtros devuelve todo', () => {
    expect(filterArrivals(arrivals, {})).toEqual(arrivals);
  });

  it('no interpreta expresiones regulares', () => {
    expect(filterArrivals(arrivals, { query: '.*' })).toEqual([]);
  });
});

describe('normalizeSearch', () => {
  it('toma el primer valor y lo recorta', () => {
    expect(normalizeSearch(['  hola ', 'x'])).toBe('hola');
  });

  it('convierte la ausencia en vacío', () => {
    expect(normalizeSearch(undefined)).toBe('');
  });

  it('limita la longitud', () => {
    expect(normalizeSearch('a'.repeat(500))).toHaveLength(80);
  });
});

describe('formatMoney', () => {
  it('convierte desde unidades menores según la moneda', () => {
    expect(formatMoney(54900, 'USD', 'en')).toBe('$549');
    expect(formatMoney(54950, 'USD', 'en')).toBe('$549.50');
    expect(formatMoney(549, 'JPY', 'en')).toBe('¥549');
  });
});

describe('monthLabel', () => {
  it('cruza el cambio de año y empieza en mayúscula', () => {
    expect(monthLabel(new Date('2026-11-24T12:00:00Z'), 1, 'es')).toBe('Diciembre');
    expect(monthLabel(new Date('2026-11-24T12:00:00Z'), 2, 'es')).toBe('Enero');
  });

  it('no se desborda en meses cortos', () => {
    expect(monthLabel(new Date('2027-01-31T12:00:00Z'), 1, 'es')).toBe('Febrero');
  });
});

describe('categoryBranch', () => {
  const categories = [{ slug: 'a' }, { slug: 'b', parent: 'a' }, { slug: 'c', parent: 'b' }, { slug: 'd' }];

  it('incluye la categoría y todas sus descendientes', () => {
    expect(categoryBranch(categories, 'a')).toEqual(['a', 'b', 'c']);
    expect(categoryBranch(categories, 'd')).toEqual(['d']);
  });

  it('una categoría desconocida no filtra', () => {
    expect(categoryBranch(categories, 'x')).toEqual([]);
  });
});
