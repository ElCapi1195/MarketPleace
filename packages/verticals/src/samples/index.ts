import { demoSamples } from './demo.js';
import { gamerSamples } from './gamer.js';
import type { SampleArrival } from './types.js';

const samples = new Map<string, readonly SampleArrival[]>([
  ['gamer', gamerSamples],
  ['demo', demoSamples],
]);

export function loadSamples(verticalId: string): readonly SampleArrival[] {
  return samples.get(verticalId) ?? [];
}

export type { SampleArrival, SampleShape } from './types.js';
