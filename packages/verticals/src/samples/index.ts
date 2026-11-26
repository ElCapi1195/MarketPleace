import { gamerSamples } from './gamer.js';
import type { SampleProduct } from './types.js';

export const SAMPLE_IMAGES = 3;

const samples = new Map<string, readonly SampleProduct[]>([['gamer', gamerSamples]]);

export function loadSamples(verticalId: string): readonly SampleProduct[] {
  return samples.get(verticalId) ?? [];
}

/** Carpeta con los archivos de ejemplo de un nicho. */
export function sampleAssets(verticalId: string): URL {
  return new URL(`../../assets/${verticalId}/`, import.meta.url);
}

export type { SampleProduct } from './types.js';
