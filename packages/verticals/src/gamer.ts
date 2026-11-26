import type { AttributeInput, VerticalInput } from './schema.js';

const condition: AttributeInput = {
  key: 'condition',
  label: 'Estado',
  type: 'select',
  required: true,
  filterable: true,
  options: [
    { value: 'nuevo', label: 'Nuevo' },
    { value: 'reacondicionado', label: 'Reacondicionado' },
    { value: 'usado', label: 'Usado' },
  ],
};

const platform: AttributeInput = {
  key: 'platform',
  label: 'Plataforma',
  type: 'select',
  required: true,
  filterable: true,
  options: [
    { value: 'playstation', label: 'PlayStation' },
    { value: 'xbox', label: 'Xbox' },
    { value: 'nintendo', label: 'Nintendo' },
    { value: 'pc', label: 'PC' },
    { value: 'multiplataforma', label: 'Multiplataforma' },
  ],
};

const region: AttributeInput = {
  key: 'region',
  label: 'Región',
  type: 'select',
  filterable: true,
  options: [
    { value: 'libre', label: 'Libre' },
    { value: 'america', label: 'América' },
    { value: 'europa', label: 'Europa' },
    { value: 'japon', label: 'Japón' },
  ],
};

// PROVISIONAL hasta que el propietario decida: nombre, moneda, colores y documentos.
export const gamer: VerticalInput = {
  id: 'gamer',
  locale: 'es',
  currency: 'USD',
  brand: {
    name: 'Marketplace Gamer',
    tagline: 'Consolas, accesorios y servicios de tiendas verificadas.',
    colors: { background: '#f8f8ff', surface: '#e6e7fb', text: '#1d1557', accent: '#ffc22e' },
  },
  categories: [
    {
      slug: 'consolas',
      name: 'Consolas',
      attributes: [
        platform,
        condition,
        region,
        { key: 'storageGb', label: 'Almacenamiento (GB)', type: 'number', min: 0, filterable: true },
      ],
    },
    { slug: 'juegos', name: 'Juegos', attributes: [platform, condition, region] },
    { slug: 'accesorios', name: 'Accesorios', attributes: [platform, condition] },
    { slug: 'mandos', name: 'Mandos', parent: 'accesorios', attributes: [platform, condition] },
    {
      slug: 'servicios',
      name: 'Servicios',
      attributes: [{ key: 'turnaround', label: 'Tiempo estimado', type: 'text', required: true }],
    },
  ],
  reservations: {
    kinds: ['PREORDER', 'IN_STOCK', 'SERVICE'],
    reviewHours: 72,
    customerResponseHours: 48,
    depositHours: 72,
    pickupHours: 168,
    maxActivePerCustomer: 5,
    // PROVISIONAL: debe revisarlo el propietario con asesoría legal.
    terms: {
      version: '2026-11-provisional',
      text: 'Solicitar no es comprar ni te cobra nada. La tienda puede aceptar, proponer otro precio o fecha, o rechazar. El depósito y el pago se hacen directamente con la tienda, fuera de esta web, que solo los anota. Si la tienda cancela, debe devolverte lo que hayas pagado. Cuando la tienda ya ha comprado el producto a su proveedor, cancelar requiere hablar con ella.',
    },
  },
  listings: { remoderateOn: ['title', 'category', 'price', 'images'], maxImages: 8 },
  storeVerification: {
    documents: [
      { key: 'registro-comercial', label: 'Registro comercial', required: true },
      { key: 'identidad-responsable', label: 'Identidad del responsable', required: true },
      { key: 'comprobante-domicilio', label: 'Comprobante de domicilio', required: false },
    ],
  },
};
