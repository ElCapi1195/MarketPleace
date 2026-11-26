import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadVertical } from '../src/index.js';
import { loadSamples, SAMPLE_IMAGES, sampleAssets } from '../src/samples/index.js';

describe('muestras', () => {
  const id = 'gamer';
  const samples = loadSamples(id);

  it('son productos distintos', () => {
    expect(samples.length).toBeGreaterThan(0);
    expect(new Set(samples.map(({ title }) => title)).size).toBe(samples.length);
  });

  it('solo usan categorías del nicho', () => {
    const slugs = loadVertical(id).categories.map(({ slug }) => slug);
    for (const { categorySlug } of samples) expect(slugs).toContain(categorySlug);
  });

  it('tienen todos sus archivos', () => {
    for (const { asset } of samples) {
      const files = [`${asset}.glb`, ...Array.from({ length: SAMPLE_IMAGES }, (_, index) => `${asset}-${index + 1}.webp`)];
      for (const file of files) expect(existsSync(fileURLToPath(new URL(file, sampleAssets(id)))), file).toBe(true);
    }
  });

  it('cubren los tres tipos de reserva', () => {
    expect(new Set(samples.map(({ kind }) => kind)).size).toBe(3);
  });
});

describe('loadSamples', () => {
  it.each(['otro', 'constructor', 'demo'])('devuelve vacío para %s', (id) => {
    expect(loadSamples(id)).toEqual([]);
  });
});
