import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { startIdentity, type Browser, type TestIdentity } from './support/identity.js';
import { listing, openShop, reserved, type Listing, type Shop } from './support/reservations.js';
import { readyStore, decide } from './support/stores.js';

let db: TestDatabase;
let t: TestIdentity;
let admin: Browser;
let moderator: Browser;
let shop: Shop;
let product: Listing;

beforeAll(async () => {
  db = await createTestDatabase();
  t = await startIdentity(db.appUrl);
  [admin, moderator] = [await t.signedIn('admin'), await t.signedIn('moderator')];
  shop = await openShop(t, admin);
  product = await listing(admin, shop);
}, 90_000);

afterAll(async () => {
  await t?.stop();
  await db?.stop();
}, 30_000);

const report = (who: Browser, body: object) => who.post('/api/reports', { reason: 'MISLEADING', details: 'La foto no coincide', ...body });

describe('denunciar', () => {
  it('un producto publicado, una vez mientras siga abierta', async () => {
    const person = await t.signedIn('customer');
    const first = await report(person, { productSlug: product.slug });
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ targetType: 'PRODUCT', status: 'OPEN', title: 'Artículo reservable' });
    const again = await report(person, { productSlug: product.slug });
    expect([again.status, again.body.error.code]).toEqual([409, 'ALREADY_REPORTED']);
    expect((await person.get('/api/reports/mine')).body.map((item: { id: string }) => item.id)).toEqual([first.body.id]);
  });

  it('una reserva propia, no una ajena', async () => {
    const person = await t.signedIn('customer');
    const reservation = await reserved(person, await listing(admin, shop));
    const stranger = await report(await t.signedIn('customer'), { reservationId: reservation.id, reason: 'PAYMENT_ISSUE' });
    expect(stranger.status).toBe(404);
    expect((await report(person, { reservationId: reservation.id, reason: 'PAYMENT_ISSUE' })).status).toBe(201);
  });

  it('un borrador o un producto inexistente no se puede denunciar', async () => {
    const { body } = await admin.post('/api/admin/products', {
      storeId: shop.id, title: 'Borrador', description: '', categorySlug: 'juegos', kind: 'IN_STOCK', priceMinor: 1, depositMinor: 0,
      units: null, availableOn: null, attributes: { platform: 'pc', condition: 'nuevo' }, featured: false,
    });
    expect((await report(await t.signedIn('customer'), { productSlug: body.slug })).status).toBe(404);
    expect((await report(await t.signedIn('customer'), { productSlug: 'no-existe' })).status).toBe(404);
  });

  it.each([
    [{ productSlug: 'a', reservationId: '019338c2-7a50-4c0e-9d54-2f1a3b4c5d6e' }],
    [{}],
    [{ productSlug: 'a', reason: 'OTRA' }],
    [{ productSlug: 'a', details: 'x'.repeat(2001) }],
  ])('rechaza %j', async (body) => {
    expect((await report(await t.signedIn('customer'), body)).status).toBe(400);
  });

  it('limita las abiertas por persona', async () => {
    const person = await t.signedIn('customer');
    for (let index = 0; index < 5; index += 1) {
      expect((await report(person, { productSlug: (await listing(admin, shop)).slug })).status).toBe(201);
    }
    const res = await report(person, { productSlug: product.slug });
    expect([res.status, res.body.error.code]).toEqual([409, 'TOO_MANY_REPORTS']);
  }, 30_000);

  it('exige sesión', async () => {
    expect((await report(t.browser(), { productSlug: product.slug })).status).toBe(401);
  });
});

describe('resolver', () => {
  it('quien modera ve las de productos y las resuelve con nota, que llega a quien denunció', async () => {
    const person = await t.signedIn('customer');
    const { body: created } = await report(person, { productSlug: (await listing(admin, shop)).slug });
    const list = (await moderator.get('/api/admin/reports?status=OPEN')).body.items;
    expect(list.map((item: { id: string }) => item.id)).toContain(created.id);
    const detail = (await moderator.get(`/api/admin/reports/${created.id}`)).body;
    expect(detail).toMatchObject({ details: 'La foto no coincide', reporter: { name: 'Persona' }, target: { storeName: 'Tienda de Ana' } });
    const bare = await moderator.post(`/api/admin/reports/${created.id}/resolve`, { outcome: 'RESOLVED', note: '' });
    expect(bare.status).toBe(400);
    const res = await moderator.post(`/api/admin/reports/${created.id}/resolve`, { outcome: 'RESOLVED', note: 'Retiramos la foto' });
    expect(res.body).toMatchObject({ status: 'RESOLVED', resolution: 'Retiramos la foto' });
    const { email } = (await person.get('/api/me')).body;
    expect(t.mailer.sent.findLast((mail) => mail.to === email)?.text).toContain('Retiramos la foto');
    expect((await person.get('/api/reports/mine')).body[0]).toMatchObject({ status: 'RESOLVED', resolution: 'Retiramos la foto' });
    const again = await moderator.post(`/api/admin/reports/${created.id}/resolve`, { outcome: 'DISMISSED', note: 'Otra' });
    expect([again.status, again.body.error.code]).toEqual([409, 'ALREADY_RESOLVED']);
  });

  it('las de reservas solo las ve quien puede intervenir', async () => {
    const person = await t.signedIn('customer');
    const reservation = await reserved(person, await listing(admin, shop));
    const { body } = await report(person, { reservationId: reservation.id, reason: 'PAYMENT_ISSUE', details: 'No anotaron mi depósito' });
    expect((await moderator.get('/api/admin/reports')).body.items.map((item: { id: string }) => item.id)).not.toContain(body.id);
    expect((await moderator.get(`/api/admin/reports/${body.id}`)).status).toBe(404);
    expect((await moderator.post(`/api/admin/reports/${body.id}/resolve`, { outcome: 'DISMISSED', note: 'x x x' })).status).toBe(404);
    expect((await admin.get(`/api/admin/reports/${body.id}`)).body.target).toMatchObject({ code: expect.any(String) });
  });

  it('nadie resuelve denuncias contra su propia tienda', async () => {
    const own = await t.signedIn('moderator');
    const id = await readyStore(own);
    await own.post(`/api/stores/${id}/submit`);
    await decide(admin, id, 'start_review');
    await decide(admin, id, 'approve');
    await own.patch(`/api/stores/${id}/pickup`, { pickupInfo: 'Calle 2, de 9 a 18' });
    const target = await listing(admin, { owner: own, id });
    const { body } = await report(await t.signedIn('customer'), { productSlug: target.slug });
    const res = await own.post(`/api/admin/reports/${body.id}/resolve`, { outcome: 'DISMISSED', note: 'Sin fundamento' });
    expect([res.status, res.body.error.code]).toEqual([403, 'OWN_STORE']);
  });

  it('un cliente no entra en la bandeja', async () => {
    const res = await (await t.signedIn('customer')).get('/api/admin/reports');
    expect([res.status, res.body.error.code]).toEqual([403, 'FORBIDDEN']);
  });
});
