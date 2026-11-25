import { describe, expect, it } from 'vitest';
import { loadVertical } from '../src/index.js';
import { loadSamples } from '../src/samples/index.js';

describe.each(['gamer', 'demo'])('muestras de %s', (id) => {
  it('tiene productos con identificador único', () => {
    const samples = loadSamples(id);
    expect(samples.length).toBeGreaterThan(0);
    expect(new Set(samples.map(({ slug }) => slug)).size).toBe(samples.length);
  });

  it('solo usa categorías del nicho', () => {
    const slugs = loadVertical(id).categories.map(({ slug }) => slug);
    for (const { categorySlug } of loadSamples(id)) expect(slugs).toContain(categorySlug);
  });

  it('tiene importes y cupos coherentes', () => {
    for (const { priceMinor, depositMinor, capacity, remaining, monthsAhead } of loadSamples(id)) {
      expect(Number.isInteger(priceMinor) && priceMinor > 0).toBe(true);
      expect(depositMinor).toBeLessThanOrEqual(priceMinor);
      expect(remaining).toBeLessThanOrEqual(capacity);
      expect(monthsAhead).toBeGreaterThan(0);
    }
  });
});

describe('loadSamples', () => {
  it.each(['otro', 'constructor'])('devuelve vacío para %s', (id) => {
    expect(loadSamples(id)).toEqual([]);
  });
});
