/** Geometría del corredor de llegadas. El tiempo se mide en unidades; un mes son MONTH. */
export const MONTH = 24;
const MATERIALIZE_FROM = 34;
const PASSED = -4;
const LANES = [-0.25, 0.2, -0.12, 0.26, -0.2, 0.08];

export interface Schedulable {
  id: string;
  monthsAhead: number;
}

export type Placed<T extends Schedulable> = T & { moment: number; lane: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Avance de 0 (línea de puntos) a 1 (sólido) según lo que falta para llegar. */
export function progressAt(distance: number): number {
  return clamp(1 - distance / MATERIALIZE_FROM, 0, 1);
}

export interface Material {
  body: number;
  detail: number;
  light: number;
  dash: string;
}

export function material(progress: number): Material {
  const dash = progress > 0.85 ? 'none' : `${(1 + progress * 9).toFixed(1)} ${(7 - progress * 4).toFixed(1)}`;
  return {
    body: clamp((progress - 0.25) / 0.6, 0, 1),
    detail: clamp((progress - 0.5) / 0.5, 0, 1),
    light: clamp((progress - 0.7) / 0.3, 0, 1),
    dash,
  };
}

/** Tamaño relativo por perspectiva: 1 en primer plano. */
export function depthScale(distance: number): number {
  return 1 / (1 + Math.max(distance, -9) / 28);
}

export function itemOpacity(distance: number): number {
  return distance < PASSED ? clamp(1 + (distance - PASSED) / 10, 0, 1) : 1;
}

/** Reparte los productos en el tiempo; los de un mismo mes nunca alcanzan al siguiente. */
export function placeItems<T extends Schedulable>(items: readonly T[]): Placed<T>[] {
  const sorted = items.toSorted((a, b) => a.monthsAhead - b.monthsAhead);
  const total = new Map<number, number>();
  for (const { monthsAhead } of sorted) total.set(monthsAhead, (total.get(monthsAhead) ?? 0) + 1);

  const used = new Map<number, number>();
  return sorted.map((item, index) => {
    const position = used.get(item.monthsAhead) ?? 0;
    used.set(item.monthsAhead, position + 1);
    const span = (position + 1) / ((total.get(item.monthsAhead) ?? 1) + 1);
    return { ...item, moment: item.monthsAhead * MONTH - MONTH * 0.5 + span * MONTH * 0.9, lane: LANES[index % LANES.length]! };
  });
}

/** Una marca por mes, situada en su primer producto: ir a un mes siempre lo enfoca. */
export function monthTicks<T extends { moment: number; monthsAhead: number }>(placed: readonly T[]): T[] {
  return placed.filter((item, index) => item.monthsAhead !== placed[index - 1]?.monthsAhead);
}

/** Final del recorrido: deja pasar el último mes y materializar el último producto. */
export function corridorEnd(placed: readonly { moment: number; monthsAhead: number }[]): number {
  return Math.ceil(Math.max(MONTH, ...placed.map(({ moment, monthsAhead }) => Math.max(moment, monthsAhead * MONTH))));
}

export function focusOf<T extends { moment: number }>(placed: readonly T[], time: number): T | undefined {
  return placed.find(({ moment }) => moment - time >= PASSED) ?? placed.at(-1);
}
