import { describe, expect, it } from 'vitest';
import {
  corridorEnd,
  depthScale,
  focusOf,
  itemOpacity,
  material,
  monthTicks,
  placeItems,
  progressAt,
} from '../features/arrivals/lib/corridor';

const at = (id: string, monthsAhead: number) => ({ id, monthsAhead });

describe('progressAt', () => {
  it('es completo al llegar y nulo cuando falta mucho', () => {
    expect(progressAt(0)).toBe(1);
    expect(progressAt(200)).toBe(0);
  });

  it.each([-50, -1, 17, 34, 500])('se mantiene entre 0 y 1 a distancia %d', (distance) => {
    expect(progressAt(distance)).toBeGreaterThanOrEqual(0);
    expect(progressAt(distance)).toBeLessThanOrEqual(1);
  });

  it('crece al acercarse', () => {
    expect(progressAt(10)).toBeGreaterThan(progressAt(20));
  });
});

describe('material', () => {
  it('sin progreso es solo una línea de puntos', () => {
    expect(material(0)).toMatchObject({ body: 0, detail: 0, light: 0 });
    expect(material(0).dash).not.toBe('none');
  });

  it('completo es sólido y con trazo continuo', () => {
    expect(material(1)).toEqual({ body: 1, detail: 1, light: 1, dash: 'none' });
  });

  it('aparece primero el cuerpo y después los detalles', () => {
    const half = material(0.55);
    expect(half.body).toBeGreaterThan(half.detail);
    expect(half.detail).toBeGreaterThanOrEqual(half.light);
  });
});

describe('profundidad', () => {
  it('lo lejano es más pequeño', () => {
    expect(depthScale(60)).toBeLessThan(depthScale(10));
    expect(depthScale(0)).toBe(1);
  });

  it('el tamaño de lo que ya pasó tiene un tope', () => {
    expect(depthScale(-500)).toBe(depthScale(-9));
  });

  it('lo que ya pasó se desvanece', () => {
    expect(itemOpacity(5)).toBe(1);
    expect(itemOpacity(-30)).toBe(0);
  });
});

describe('placeItems', () => {
  it('ordena por mes y separa los del mismo mes', () => {
    const placed = placeItems([at('b', 2), at('a', 1), at('c', 1)]);
    expect(placed.map((item) => item.id)).toEqual(['a', 'c', 'b']);
    expect(placed[0]!.moment).toBeLessThan(placed[1]!.moment);
  });

  it('coloca todo un mes antes que el siguiente', () => {
    const many = [...Array.from({ length: 8 }, (_, i) => at(`x${i}`, 1)), at('y', 2)];
    const moments = placeItems(many).map((item) => item.moment);
    expect(Math.max(...moments.slice(0, 8))).toBeLessThan(moments[8]!);
  });

  it('mantiene los carriles dentro del corredor', () => {
    for (const { lane } of placeItems(Array.from({ length: 12 }, (_, i) => at(String(i), 1)))) {
      expect(Math.abs(lane)).toBeLessThanOrEqual(0.26);
    }
  });

  it('acepta una lista vacía', () => {
    expect(placeItems([])).toEqual([]);
    expect(corridorEnd([])).toBeGreaterThan(0);
  });
});

describe('focusOf', () => {
  const placed = placeItems([at('a', 1), at('b', 3)]);

  it('elige el más próximo que aún no ha pasado', () => {
    expect(focusOf(placed, 0)?.id).toBe('a');
    expect(focusOf(placed, placed[0]!.moment + 20)?.id).toBe('b');
  });

  it('al final conserva el último', () => {
    expect(focusOf(placed, 9999)?.id).toBe('b');
  });

  it('sin productos no hay foco', () => {
    expect(focusOf([], 0)).toBeUndefined();
  });

  it('todo producto llega a materializarse dentro del recorrido', () => {
    const end = corridorEnd(placed);
    for (const item of placed) expect(progressAt(item.moment - end)).toBe(1);
  });
});

describe('monthTicks', () => {
  const placed = placeItems([at('a', 1), at('b', 2), at('c', 2), at('d', 2), at('e', 5)]);

  it('crea una marca por mes con productos', () => {
    expect(monthTicks(placed).map((tick) => tick.monthsAhead)).toEqual([1, 2, 5]);
  });

  it('ir a un mes enfoca su primer producto, ya materializado', () => {
    for (const tick of monthTicks(placed)) {
      const focus = focusOf(placed, tick.moment);
      expect(focus).toBe(placed.find((item) => item.monthsAhead === tick.monthsAhead));
      expect(progressAt(focus!.moment - tick.moment)).toBe(1);
    }
  });
});
