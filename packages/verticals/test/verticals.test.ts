import { describe, expect, it } from 'vitest';
import { loadVertical, parseVertical } from '../src/index.js';

type Draft = Record<string, unknown> & {
  categories: Array<Record<string, unknown>>;
  reservations: Record<string, unknown>;
};

/** Copia editable de un nicho válido, para romper un solo campo por prueba. */
function draft(): Draft {
  return structuredClone(loadVertical('demo')) as unknown as Draft;
}

describe('loadVertical', () => {
  it.each(['gamer', 'demo'])('carga el nicho %s', (id) => {
    const vertical = loadVertical(id);
    expect(vertical.id).toBe(id);
    expect(vertical.categories.length).toBeGreaterThan(0);
  });

  it('rechaza un id desconocido e indica los disponibles', () => {
    expect(() => loadVertical('no-existe')).toThrow(/no-existe.*gamer.*demo/s);
  });

  it.each(['__proto__', 'constructor', 'toString'])('no resuelve la clave heredada %s', (id) => {
    expect(() => loadVertical(id)).toThrow(/desconocido/);
  });

  it('devuelve una configuración inmutable', () => {
    const vertical = loadVertical('gamer');
    expect(Object.isFrozen(vertical)).toBe(true);
    expect(Object.isFrozen(vertical.categories[0])).toBe(true);
  });
});

describe('parseVertical', () => {
  it('acepta una configuración válida', () => {
    expect(parseVertical(draft()).id).toBe('demo');
  });

  it('rechaza categorías duplicadas', () => {
    const input = draft();
    input.categories.push({ ...input.categories[0] });
    expect(() => parseVertical(input)).toThrow(/duplicada.*categories/s);
  });

  it('rechaza un padre inexistente', () => {
    const input = draft();
    input.categories[0]!.parent = 'fantasma';
    expect(() => parseVertical(input)).toThrow(/fantasma.*parent/s);
  });

  it('rechaza ciclos entre categorías', () => {
    const input = draft();
    input.categories = [
      { slug: 'a', name: 'A', parent: 'b', attributes: [] },
      { slug: 'b', name: 'B', parent: 'a', attributes: [] },
    ];
    expect(() => parseVertical(input)).toThrow(/ciclo/);
  });

  it.each(['XXX', 'usd', 'PESOS', ''])('rechaza la moneda %j', (currency) => {
    expect(() => parseVertical({ ...draft(), currency })).toThrow(/currency/);
  });

  it.each([0, -1, 1.5])('rechaza el plazo de revisión %d', (reviewHours) => {
    const input = draft();
    input.reservations.reviewHours = reviewHours;
    expect(() => parseVertical(input)).toThrow(/reviewHours/);
  });

  it('rechaza un atributo select sin opciones', () => {
    const input = draft();
    input.categories[0]!.attributes = [{ key: 'estado', label: 'Estado', type: 'select', options: [] }];
    expect(() => parseVertical(input)).toThrow(/options/);
  });

  it('rechaza atributos con clave repetida en una categoría', () => {
    const input = draft();
    const attribute = { key: 'estado', label: 'Estado', type: 'text' };
    input.categories[0]!.attributes = [attribute, attribute];
    expect(() => parseVertical(input)).toThrow(/estado.*repetido/s);
  });

  it('rechaza un nicho sin tipos de reserva', () => {
    const input = draft();
    input.reservations.kinds = [];
    expect(() => parseVertical(input)).toThrow(/kinds/);
  });

  it('rechaza campos desconocidos para detectar erratas', () => {
    expect(() => parseVertical({ ...draft(), curency: 'USD' })).toThrow(/curency/);
  });
});
