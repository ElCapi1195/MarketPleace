import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPath } from '../features/arrivals/lib/path';

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function source(showSamples: string | undefined) {
  vi.stubEnv('VERTICAL', 'demo');
  vi.stubEnv('SHOW_SAMPLES', showSamples);
  return import('../features/arrivals/source');
}

describe('fuente de llegadas', () => {
  it.each([undefined, '', 'false', '1', 'TRUE'])('no muestra datos ficticios con SHOW_SAMPLES=%j', async (value) => {
    const { getArrivals, samplesEnabled } = await source(value);
    expect(samplesEnabled()).toBe(false);
    expect(getArrivals()).toEqual([]);
  });

  it('los muestra solo si se activan, con precio y mes ya formateados', async () => {
    const { getArrivals } = await source('true');
    const [first] = getArrivals(new Date('2026-11-24T12:00:00Z'));
    expect(first).toMatchObject({ id: 'bicicleta-urbana', monthName: 'Diciembre' });
    expect(first?.price).toMatch(/450.*€/);
  });

  it('busca por identificador y no inventa productos', async () => {
    const { getArrival } = await source('true');
    expect(getArrival('bicicleta-de-carga')?.name).toBe('Bicicleta de carga');
    expect(getArrival('no-existe')).toBeUndefined();
  });
});

describe('buildPath', () => {
  const base = { reviewHours: 72, monthName: 'Enero', deposit: '100 €' };

  it('incluye el depósito cuando la tienda lo pide', () => {
    const path = buildPath(base);
    expect(path).toHaveLength(5);
    expect(path.some(({ text }) => text.includes('100 €'))).toBe(true);
  });

  it('omite el paso del depósito si no lo hay', () => {
    expect(buildPath({ ...base, deposit: null })).toHaveLength(4);
  });

  it('usa el plazo de revisión del nicho', () => {
    expect(buildPath({ ...base, reviewHours: 24 }).some(({ text }) => text.includes('24 horas'))).toBe(true);
  });

  it.each(['100 €', null])('avanza siempre y termina completo (depósito %j)', (deposit) => {
    const progress = buildPath({ ...base, deposit }).map((step) => step.progress);
    expect(progress).toEqual(progress.toSorted((a, b) => a - b));
    expect(progress.at(-1)).toBe(1);
  });
});
