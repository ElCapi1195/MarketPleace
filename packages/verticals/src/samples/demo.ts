import type { SampleArrival } from './types.js';

const bicycle = {
  body: 'M45 78a27 27 0 1 0 .1 0zM155 78a27 27 0 1 0 .1 0z',
  detail: 'M42 102l38-52h52l26 52-4 4-28-48-36 48H46zM80 56l22 40 24-38H82z',
  light: 'M66 38h26v7H66zM122 34h22v7h-22z',
};

export const demoSamples: readonly SampleArrival[] = [
  {
    slug: 'bicicleta-urbana',
    name: 'Bicicleta urbana',
    categorySlug: 'bicicletas',
    storeName: 'Tienda Ejemplo Parque',
    monthsAhead: 1,
    priceMinor: 45000,
    depositMinor: 5000,
    capacity: 5,
    remaining: 2,
    color: '#7CCB9B',
    shape: bicycle,
  },
  {
    slug: 'bicicleta-de-carga',
    name: 'Bicicleta de carga',
    categorySlug: 'bicicletas',
    storeName: 'Tienda Ejemplo Puerto',
    monthsAhead: 3,
    priceMinor: 180000,
    depositMinor: 30000,
    capacity: 3,
    remaining: 3,
    color: '#F2B84B',
    shape: bicycle,
  },
];
