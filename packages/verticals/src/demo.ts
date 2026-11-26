import type { VerticalInput } from './schema.js';

/** Nicho mínimo y ajeno al sector principal: demuestra que el núcleo es reutilizable. */
export const demo: VerticalInput = {
  id: 'demo',
  locale: 'es',
  currency: 'EUR',
  brand: {
    name: 'Mercado Demo',
    tagline: 'Bicicletas y taller de tiendas verificadas.',
    colors: { background: '#ffffff', surface: '#f1f5f2', text: '#17211b', accent: '#1f7a4d' },
  },
  categories: [
    {
      slug: 'bicicletas',
      name: 'Bicicletas',
      attributes: [{ key: 'frameSize', label: 'Talla', type: 'text', required: true }],
    },
    { slug: 'taller', name: 'Taller', attributes: [] },
  ],
  reservations: {
    kinds: ['IN_STOCK', 'SERVICE'],
    reviewHours: 24,
    customerResponseHours: 24,
    depositHours: 24,
    pickupHours: 48,
    maxActivePerCustomer: 2,
    terms: { version: 'demo-1', text: 'Solicitar no te cobra nada. La tienda revisa cada reserva antes de aceptarla.' },
  },
  listings: { remoderateOn: ['category'], maxImages: 4 },
  storeVerification: { documents: [{ key: 'registro', label: 'Registro', required: true }] },
};
