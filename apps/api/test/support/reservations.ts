import { randomUUID } from 'node:crypto';
import { loadVertical } from '@marketplace/verticals';
import { expect } from 'vitest';
import { jpeg } from './files.js';
import type { Browser, TestIdentity } from './identity.js';
import { approvedStore } from './stores.js';

const { terms } = loadVertical('gamer').reservations;

export interface Shop {
  owner: Browser;
  id: string;
}

export interface Listing {
  id: string;
  slug: string;
  priceMinor: number;
  depositMinor: number;
  availableOn: string | null;
}

/** Tienda aprobada que ya explicó cómo recoger. */
export async function openShop(t: TestIdentity, admin: Browser): Promise<Shop> {
  const shop = await approvedStore(t, admin);
  const res = await shop.owner.patch(`/api/stores/${shop.id}/pickup`, { pickupInfo: 'Calle 1, de 9 a 18. Tel. 555 0100' });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return shop;
}

export const productBody = (shop: Shop, patch: object = {}) => ({
  storeId: shop.id,
  title: 'Artículo reservable',
  description: '',
  categorySlug: 'juegos',
  kind: 'PREORDER',
  priceMinor: 10_000,
  depositMinor: 0,
  units: 5,
  availableOn: '2027-03-15',
  attributes: { platform: 'pc', condition: 'nuevo' },
  featured: false,
  ...patch,
});

/** Producto publicado por la plataforma a nombre de la tienda. */
export async function listing(admin: Browser, shop: Shop, patch: object = {}): Promise<Listing> {
  const { body } = await admin.post('/api/admin/products', productBody(shop, patch));
  await admin.upload(`/api/admin/products/${body.id}/media`, await jpeg(), 'image/jpeg');
  const published = await admin.post(`/api/admin/products/${body.id}/publish`);
  expect(published.status, JSON.stringify(published.body)).toBe(200);
  return published.body;
}

export const reservationBody = ({ slug, priceMinor, depositMinor, availableOn }: Listing, patch: object = {}) => ({
  productSlug: slug,
  expected: { priceMinor, depositMinor, availableOn },
  termsVersion: terms.version,
  phone: '555 0199',
  note: 'Prefiero por la tarde',
  ...patch,
});

export function request(customer: Browser, product: Listing, patch: object = {}, key: string = randomUUID()) {
  return customer.post('/api/reservations', reservationBody(product, patch), { 'idempotency-key': key });
}

export async function reserved(customer: Browser, product: Listing): Promise<{ id: string; version: number; code: string }> {
  const res = await request(customer, product);
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body;
}

export function act(shop: Shop, reservation: { id: string; version: number }, body: object) {
  return shop.owner.post(`/api/stores/${shop.id}/reservations/${reservation.id}/actions`, { version: reservation.version, ...body });
}

export const approve = (shop: Shop, reservation: { id: string; version: number }, offer: object | null = null) =>
  act(shop, reservation, { action: 'approve', offer });

export function pay(shop: Shop, id: string, kind: string, amountMinor: number, patch: object = {}) {
  return shop.owner.post(`/api/stores/${shop.id}/reservations/${id}/payments`, { kind, amountMinor, method: 'TRANSFER', reference: 'T-1', note: '', ...patch });
}
