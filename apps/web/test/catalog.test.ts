import { describe, expect, it } from 'vitest';
import { availability } from '../features/catalog/lib/availability';
import { describeAttributes } from '../features/catalog/lib/attributes';
import { formatMoney, parseMoney } from '../features/catalog/lib/money';
import { catalogHref, readFilters, toApiQuery } from '../features/catalog/lib/params';
import { buildPath } from '../features/catalog/lib/path';

const now = new Date('2026-11-25T12:00:00Z');

describe('formatMoney', () => {
  it('muestra decimales solo cuando los hay, según la moneda', () => {
    expect(formatMoney(54900, 'USD', 'es')).toMatch(/^549\s\$$/);
    expect(formatMoney(54990, 'USD', 'es')).toMatch(/^549,90\s\$$/);
    expect(formatMoney(5000, 'JPY', 'es')).toContain('5000');
  });
});

describe('parseMoney', () => {
  it.each([
    ['549', 54900],
    ['549,9', 54990],
    ['549.90', 54990],
    ['1.299,90', 129990],
    ['1,299.90', 129990],
    ['1.299', 129900],
    ['1,299', 129900],
    ['12.345.678', 1234567800],
    ['0,1', 10],
    [' 20 ', 2000],
    ['0', 0],
  ])('%j son %i unidades menores', (text, minor) => {
    expect(parseMoney(text, 'USD')).toBe(minor);
  });

  it.each(['', 'abc', '-5', '1.2.3', '1,2,3', '0,125', '1e3', '99999999999', '12.34.567', '1,23.4'])('rechaza %j', (text) => {
    expect(parseMoney(text, 'USD')).toBeNull();
  });

  it('respeta las monedas sin decimales', () => {
    expect(parseMoney('5000', 'JPY')).toBe(5000);
    expect(parseMoney('50,5', 'JPY')).toBeNull();
  });
});

describe('availability', () => {
  const base = { kind: 'IN_STOCK' as const, units: 8, availableOn: null };
  const text = (patch: object) => availability({ ...base, ...patch }, now, 'es');

  it.each([
    [{}, 'Disponible'],
    [{ units: null }, 'Disponible'],
    [{ units: 3 }, 'Quedan 3'],
    [{ units: 1 }, 'Queda 1'],
    [{ units: 0 }, 'Agotado'],
    [{ kind: 'SERVICE', units: null }, 'Servicio'],
    [{ kind: 'PREORDER', availableOn: '2026-12-15' }, 'Llega en diciembre'],
    [{ kind: 'PREORDER', availableOn: '2027-02-01' }, 'Llega en febrero de 2027'],
    [{ kind: 'PREORDER', availableOn: '2026-10-01' }, 'Fecha por confirmar'],
  ])('%j se lee %s', (patch, expected) => {
    expect(text(patch)).toBe(expected);
  });

  it('el día de llegada no se considera vencido', () => {
    expect(text({ kind: 'PREORDER', availableOn: '2026-11-25' })).toBe('Llega en noviembre');
  });
});

describe('parámetros del catálogo', () => {
  it('lee valores ausentes, repetidos o absurdos sin fallar', () => {
    expect(readFilters({})).toEqual({ q: '', category: '', kind: '', sort: '', page: 1 });
    expect(readFilters({ q: [' mando ', 'x'], tipo: 'raro', orden: 'raro', pagina: '-4' })).toEqual({
      q: 'mando',
      category: '',
      kind: '',
      sort: '',
      page: 1,
    });
  });

  it('construye enlaces solo con lo que se aparta de lo habitual', () => {
    expect(catalogHref({})).toBe('/catalogo');
    expect(catalogHref({ q: 'a&b', kind: 'preventa', page: 1 })).toBe('/catalogo?q=a%26b&tipo=preventa');
    expect(catalogHref({ page: 3 })).toBe('/catalogo?pagina=3');
  });

  it('traduce los filtros a la API', () => {
    const filters = readFilters({ q: 'mando', categoria: 'mandos', tipo: 'disponible', orden: 'precio-asc', pagina: '2' });
    expect(toApiQuery(filters)).toBe('q=mando&category=mandos&kind=IN_STOCK&sort=price_asc&page=2');
  });
});

describe('buildPath', () => {
  const base = { kind: 'PREORDER' as const, reviewHours: 72, arrival: 'Llega en enero', deposit: '100 $' };
  const titles = (patch: object) => buildPath({ ...base, ...patch }).map(({ title }) => title);

  it('una preventa con depósito tiene todos los pasos', () => {
    expect(titles({})).toEqual(['Envías tu solicitud', 'La tienda la revisa', 'Dejas el depósito', 'La tienda lo pide', 'Lo recoges']);
  });

  it('sin depósito no aparece ese paso', () => {
    expect(titles({ deposit: null })).not.toContain('Dejas el depósito');
  });

  it('en existencia no espera a ningún pedido', () => {
    expect(titles({ kind: 'IN_STOCK', deposit: null })).toEqual(['Envías tu solicitud', 'La tienda la revisa', 'Lo recoges']);
  });

  it('un servicio se coordina', () => {
    expect(titles({ kind: 'SERVICE', deposit: null }).at(-1)).toBe('Coordinan la cita');
  });

  it('indica el plazo de revisión', () => {
    expect(buildPath(base)[1]?.text).toContain('72 horas');
  });
});

describe('describeAttributes', () => {
  const definitions = [
    { key: 'color', label: 'Color', type: 'select' as const, options: [{ value: 'rojo', label: 'Rojo vivo' }] },
    { key: 'size', label: 'Tamaño', type: 'number' as const },
    { key: 'boxed', label: 'Con caja', type: 'boolean' as const },
  ];

  it('muestra etiquetas en el orden del nicho y omite lo desconocido', () => {
    expect(describeAttributes(definitions, { boxed: false, size: 2000, color: 'rojo', otro: 'x' }, 'es')).toEqual([
      { label: 'Color', value: 'Rojo vivo' },
      { label: 'Tamaño', value: '2000' },
      { label: 'Con caja', value: 'No' },
    ]);
  });
});
