import { describe, expect, it } from 'vitest';
import { catalogQuery, mediaPatch, productInput, storeInput } from '../src/index.js';

const valid = {
  storeId: '019338c2-7a50-7c0e-9d54-2f1a3b4c5d6e',
  title: '  Artículo de prueba  ',
  description: 'Texto',
  categorySlug: 'cosas',
  kind: 'IN_STOCK',
  priceMinor: 1000,
  depositMinor: 0,
  units: 3,
  availableOn: null,
  attributes: {},
  featured: false,
};

const fails = (patch: object) => !productInput.safeParse({ ...valid, ...patch }).success;

describe('productInput', () => {
  it('acepta un producto válido y recorta espacios', () => {
    expect(productInput.parse(valid).title).toBe('Artículo de prueba');
  });

  it.each([
    ['sin título', { title: '   ' }],
    ['precio negativo', { priceMinor: -1 }],
    ['precio con decimales', { priceMinor: 10.5 }],
    ['precio desmesurado', { priceMinor: 2_000_000_001 }],
    ['depósito mayor que el precio', { depositMinor: 1001 }],
    ['unidades negativas', { units: -1 }],
    ['preventa sin fecha', { kind: 'PREORDER' }],
    ['fecha imposible', { kind: 'PREORDER', availableOn: '2027-02-30' }],
    ['fecha en un producto que no es preventa', { availableOn: '2027-02-10' }],
    ['tipo desconocido', { kind: 'RENTAL' }],
    ['tienda que no es un id', { storeId: '1' }],
    ['campo no admitido', { status: 'PUBLISHED' }],
    ['atributo con objeto', { attributes: { a: { b: 1 } } }],
    ['demasiados atributos', { attributes: Object.fromEntries(Array.from({ length: 41 }, (_, i) => [`a${i}`, 1])) }],
    ['caracteres de control', { title: 'a\u0000b' }],
  ])('rechaza %s', (_name, patch) => {
    expect(fails(patch)).toBe(true);
  });

  it('una preventa con fecha es válida', () => {
    expect(fails({ kind: 'PREORDER', availableOn: '2027-02-10' })).toBe(false);
  });
});

describe('catalogQuery', () => {
  it('aplica valores por defecto', () => {
    expect(catalogQuery.parse({})).toEqual({ q: '', sort: 'recent', page: 1 });
  });

  it('ante parámetros absurdos usa los valores por defecto en lugar de fallar', () => {
    expect(catalogQuery.parse({ page: '-3', sort: 'x', kind: 'x', category: '../..', q: ['a', 'b'] })).toEqual({ q: '', sort: 'recent', page: 1 });
    expect(catalogQuery.parse({ q: 'a'.repeat(500) }).q).toHaveLength(80);
    expect(catalogQuery.parse({ page: '99999999999' }).page).toBe(1);
  });
});

describe('otras entradas', () => {
  it('storeInput exige un nombre', () => {
    expect(storeInput.safeParse({ name: ' ' }).success).toBe(false);
  });

  it('mediaPatch exige al menos un cambio', () => {
    expect(mediaPatch.safeParse({}).success).toBe(false);
    expect(mediaPatch.safeParse({ alt: 'Vista frontal' }).success).toBe(true);
  });
});
