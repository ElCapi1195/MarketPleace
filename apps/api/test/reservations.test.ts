import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ExpirySweep } from '../src/modules/reservations/expiry-sweep.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { startIdentity, type Browser, type TestIdentity } from './support/identity.js';
import { act, approve, listing, openShop, productBody, request, reservationBody, reserved, type Listing, type Shop } from './support/reservations.js';
import { approvedStore, decide } from './support/stores.js';

let db: TestDatabase;
let t: TestIdentity;
let admin: Browser;
let shop: Shop;

beforeAll(async () => {
  db = await createTestDatabase();
  t = await startIdentity(db.appUrl);
  admin = await t.signedIn('admin');
  shop = await openShop(t, admin);
}, 90_000);

afterAll(async () => {
  await t?.stop();
  await db?.stop();
}, 30_000);

const customer = () => t.signedIn('customer');
const units = async ({ id }: Listing) => (await t.prisma.product.findUniqueOrThrow({ where: { id } })).units;
const overdue = (id: string) => t.prisma.reservation.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } });
const sweep = () => t.app.get(ExpirySweep).run(new Date());

describe('solicitar', () => {
  it('congela lo que vio el cliente y no compromete unidades', async () => {
    const product = await listing(admin, shop, { depositMinor: 2000 });
    const res = await request(await customer(), product);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: 'PENDING_REVIEW',
      version: 1,
      requested: { priceMinor: 10_000, depositMinor: 2000, availableOn: '2027-03-15' },
      agreed: { priceMinor: 10_000, depositMinor: 2000 },
      offer: null,
      currency: 'USD',
      pickupInfo: null,
    });
    expect(res.body.code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(await units(product)).toBe(5);
    await t.prisma.product.update({ where: { id: product.id }, data: { priceMinor: 3000 } });
    const row = await t.prisma.reservation.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row.priceMinor).toBe(10_000);
  });

  it('exige sesión y clave de idempotencia', async () => {
    const product = await listing(admin, shop);
    expect((await request(t.browser(), product)).status).toBe(401);
    for (const headers of [{}, { 'idempotency-key': 'no-es-un-uuid' }] as Record<string, string>[]) {
      const res = await (await customer()).post('/api/reservations', reservationBody(product), headers);
      expect([res.status, res.body.error.code]).toEqual([400, 'VALIDATION_ERROR']);
    }
  });

  it('repetir la misma petición, incluso a la vez, crea una sola reserva', async () => {
    const product = await listing(admin, shop);
    const person = await customer();
    const key = randomUUID();
    const results = await Promise.all([1, 2, 3, 4].map(() => request(person, product, {}, key)));
    expect(new Set(results.map((res) => res.body.id)).size).toBe(1);
    expect(results.every((res) => res.status === 201)).toBe(true);
    expect(await t.prisma.reservation.count({ where: { productId: product.id } })).toBe(1);
  });

  it('la misma clave con otro producto es un error, y la de otra persona no interfiere', async () => {
    const [a, b] = [await listing(admin, shop), await listing(admin, shop)];
    const person = await customer();
    const key = randomUUID();
    await request(person, a, {}, key);
    const res = await request(person, b, {}, key);
    expect([res.status, res.body.error.code]).toEqual([409, 'IDEMPOTENCY_MISMATCH']);
    expect((await request(await customer(), b, {}, key)).status).toBe(201);
  });

  it('una sola activa por producto', async () => {
    const product = await listing(admin, shop);
    const person = await customer();
    const results = await Promise.all([request(person, product), request(person, product)]);
    expect(results.map((res) => res.status).toSorted()).toEqual([201, 409]);
    expect(results.find((res) => res.status === 409)?.body.error.code).toBe('ALREADY_RESERVED');
  });

  it('respeta el máximo de activas aunque lleguen a la vez', async () => {
    const products = await Promise.all(Array.from({ length: 7 }, () => listing(admin, shop)));
    const person = await customer();
    const results = await Promise.all(products.map((product) => request(person, product)));
    expect(results.filter((res) => res.status === 201)).toHaveLength(5);
    expect(results.filter((res) => res.body.error?.code === 'TOO_MANY_RESERVATIONS')).toHaveLength(2);
  }, 30_000);

  it.each([
    ['precio', { expected: { priceMinor: 9999, depositMinor: 0, availableOn: '2027-03-15' } }, 'PRODUCT_CHANGED'],
    ['fecha', { expected: { priceMinor: 10_000, depositMinor: 0, availableOn: '2027-01-01' } }, 'PRODUCT_CHANGED'],
    ['términos', { termsVersion: 'antigua' }, 'TERMS_CHANGED'],
  ])('avisa si cambió: %s', async (_name, patch, code) => {
    const res = await request(await customer(), await listing(admin, shop), patch);
    expect([res.status, res.body.error.code]).toEqual([409, code]);
  });

  it('no admite productos agotados, retirados o de una tienda suspendida', async () => {
    const soldOut = await listing(admin, shop, { units: 0 });
    expect((await request(await customer(), soldOut)).body.error.code).toBe('SOLD_OUT');
    const archived = await listing(admin, shop);
    await admin.post(`/api/admin/products/${archived.id}/archive`);
    expect((await request(await customer(), archived)).status).toBe(404);
    const other = await openShop(t, admin);
    const hidden = await listing(admin, other);
    await decide(admin, other.id, 'suspend', 'motivo');
    expect((await request(await customer(), hidden)).status).toBe(404);
  });

  it('avisa a la tienda, sin datos del cliente', async () => {
    const own = await openShop(t, admin);
    const { email } = (await own.owner.get('/api/me')).body;
    await reserved(await customer(), await listing(admin, own));
    const mail = t.mailer.sent.findLast((item) => item.to === email);
    expect(mail?.subject).toContain('Nueva solicitud');
    expect(mail?.text).not.toContain('555 0199');
  });
});

describe('aprobar', () => {
  it('sin depósito confirma y compromete una unidad', async () => {
    const product = await listing(admin, shop);
    const reservation = await reserved(await customer(), product);
    const res = await approve(shop, reservation);
    expect(res.body).toMatchObject({ status: 'CONFIRMED', version: 2 });
    expect(await units(product)).toBe(4);
  });

  it('con depósito espera a recibirlo', async () => {
    const reservation = await reserved(await customer(), await listing(admin, shop, { depositMinor: 2000 }));
    expect((await approve(shop, reservation)).body.status).toBe('AWAITING_DEPOSIT');
  });

  it('con cambios espera al cliente, que ve la propuesta y puede aceptarla', async () => {
    const product = await listing(admin, shop);
    const person = await customer();
    const reservation = await reserved(person, product);
    const offer = { priceMinor: 12_000, depositMinor: 3000, availableOn: '2027-05-01' };
    await approve(shop, reservation, offer);
    const seen = (await person.get(`/api/reservations/${reservation.id}`)).body;
    expect(seen).toMatchObject({ status: 'AWAITING_CUSTOMER', offer, agreed: { priceMinor: 10_000 } });
    const accepted = await person.post(`/api/reservations/${reservation.id}/accept`, { version: seen.version });
    expect(accepted.body).toMatchObject({ status: 'AWAITING_DEPOSIT', agreed: offer, offer: null, requested: { priceMinor: 10_000 } });
    expect(await units(product)).toBe(4);
  });

  it('una propuesta idéntica a lo pedido no hace esperar al cliente', async () => {
    const reservation = await reserved(await customer(), await listing(admin, shop));
    const res = await approve(shop, reservation, { priceMinor: 10_000, depositMinor: 0, availableOn: '2027-03-15' });
    expect(res.body.status).toBe('CONFIRMED');
  });

  it('rechazar la propuesta libera la unidad', async () => {
    const product = await listing(admin, shop);
    const person = await customer();
    const reservation = await reserved(person, product);
    const { body } = await approve(shop, reservation, { priceMinor: 12_000, depositMinor: 0, availableOn: '2027-03-15' });
    expect(await units(product)).toBe(4);
    const res = await person.post(`/api/reservations/${reservation.id}/decline`, { version: body.version, reason: '' });
    expect(res.body.status).toBe('CANCELLED');
    expect(await units(product)).toBe(5);
  });

  it('una preventa necesita fecha; lo disponible no la lleva', async () => {
    const preorder = await reserved(await customer(), await listing(admin, shop));
    const inStock = await reserved(await customer(), await listing(admin, shop, { kind: 'IN_STOCK', availableOn: null }));
    for (const res of [
      await approve(shop, preorder, { priceMinor: 1, depositMinor: 0, availableOn: null }),
      await approve(shop, inStock, { priceMinor: 1, depositMinor: 0, availableOn: '2027-01-01' }),
      await approve(shop, inStock, { priceMinor: 1, depositMinor: 2, availableOn: null }),
    ]) {
      expect([res.status, res.body.error.code]).toEqual([400, 'VALIDATION_ERROR']);
    }
  });

  it('20 aprobaciones a la vez sobre una unidad: exactamente una', async () => {
    const product = await listing(admin, shop, { units: 1 });
    const reservations = [];
    for (let index = 0; index < 20; index += 1) reservations.push(await reserved(await customer(), product));
    const results = await Promise.all(reservations.map((reservation) => approve(shop, reservation)));
    expect(results.filter((res) => res.status === 200)).toHaveLength(1);
    expect(results.filter((res) => res.body.error?.code === 'NO_UNITS')).toHaveLength(19);
    expect(await units(product)).toBe(0);
  }, 60_000);

  it('sin límite de unidades no se descuenta nada', async () => {
    const product = await listing(admin, shop, { units: null });
    const reservation = await reserved(await customer(), product);
    const { body } = await approve(shop, reservation);
    expect(await units(product)).toBeNull();
    await act(shop, body, { action: 'cancel', reason: 'motivo' });
    expect(await units(product)).toBeNull();
  });

  it('si la tienda editaba el producto a la vez, no pisa el descuento', async () => {
    const own = await openShop(t, admin);
    const product = await listing(admin, own);
    const { body: before } = await own.owner.get(`/api/stores/${own.id}/products/${product.id}`);
    await approve(own, await reserved(await customer(), product));
    const res = await own.owner.patch(`/api/stores/${own.id}/products/${product.id}`, {
      version: before.version,
      product: productBody(own, { units: before.units }),
    });
    expect([res.status, res.body.error.code]).toEqual([409, 'VERSION_CONFLICT']);
    expect(await units(product)).toBe(4);
  });

  it('con una versión antigua no decide', async () => {
    const reservation = await reserved(await customer(), await listing(admin, shop));
    const results = await Promise.all([approve(shop, reservation), act(shop, reservation, { action: 'reject', reason: 'motivo' })]);
    expect(results.map((res) => res.status).toSorted()).toEqual([200, 409]);
  });

  it('antes debe explicar cómo contactar y recoger', async () => {
    const bare = await approvedStore(t, admin);
    const reservation = await reserved(await customer(), await listing(admin, bare));
    const res = await approve(bare, reservation);
    expect([res.status, res.body.error.code]).toEqual([422, 'PICKUP_INFO_REQUIRED']);
  });

  it('nadie decide sobre su propia reserva', async () => {
    const own = await openShop(t, admin);
    const reservation = await reserved(own.owner, await listing(admin, own));
    const res = await approve(own, reservation);
    expect([res.status, res.body.error.code]).toEqual([403, 'OWN_RESERVATION']);
  });
});

describe('avanzar y cerrar', () => {
  it('recorre el camino hasta completarse y conserva la unidad vendida', async () => {
    const product = await listing(admin, shop);
    let { body } = await approve(shop, await reserved(await customer(), product));
    for (const [action, status] of [['start', 'IN_PROGRESS'], ['ready', 'READY'], ['complete', 'COMPLETED']]) {
      body = (await act(shop, body, { action })).body;
      expect(body.status).toBe(status);
    }
    expect(await units(product)).toBe(4);
    expect(body.events.map((event: { action: string }) => event.action)).toEqual(['complete', 'ready', 'start', 'approve', 'request']);
    expect((await act(shop, body, { action: 'start' })).body.error.code).toBe('INVALID_TRANSITION');
  });

  it('no se marca como no presentado antes del plazo; después libera la unidad', async () => {
    const product = await listing(admin, shop);
    let { body } = await approve(shop, await reserved(await customer(), product));
    body = (await act(shop, body, { action: 'ready' })).body;
    expect((await act(shop, body, { action: 'no_show' })).body.error.code).toBe('TOO_EARLY');
    await overdue(body.id);
    expect((await act(shop, body, { action: 'no_show' })).body.status).toBe('NO_SHOW');
    expect(await units(product)).toBe(5);
  });

  it('el cliente cancela con motivo hasta que la tienda empieza a traerlo', async () => {
    const person = await customer();
    const product = await listing(admin, shop);
    const { body } = await approve(shop, await reserved(person, product));
    const bare = await person.post(`/api/reservations/${body.id}/cancel`, { version: body.version, reason: '' });
    expect([bare.status, bare.body.error.code]).toEqual([422, 'REASON_REQUIRED']);
    const cancelled = await person.post(`/api/reservations/${body.id}/cancel`, { version: body.version, reason: 'Ya no lo necesito' });
    expect(cancelled.body.status).toBe('CANCELLED');
    expect(await units(product)).toBe(5);

    const second = await listing(admin, shop);
    let next = (await approve(shop, await reserved(person, second))).body;
    next = (await act(shop, next, { action: 'start' })).body;
    const late = await person.post(`/api/reservations/${next.id}/cancel`, { version: next.version, reason: 'Tarde' });
    expect([late.status, late.body.error.code]).toEqual([409, 'INVALID_TRANSITION']);
  });

  it('rechazar explica el motivo al cliente', async () => {
    const person = await customer();
    const reservation = await reserved(person, await listing(admin, shop));
    expect((await act(shop, reservation, { action: 'reject', reason: '' })).status).toBe(400);
    await act(shop, reservation, { action: 'reject', reason: 'El proveedor no lo tiene' });
    const seen = (await person.get(`/api/reservations/${reservation.id}`)).body;
    expect(seen.events[0]).toMatchObject({ action: 'reject', actor: 'STORE', reason: 'El proveedor no lo tiene' });
    const { email } = (await person.get('/api/me')).body;
    expect(t.mailer.sent.findLast((item) => item.to === email)?.text).toContain('El proveedor no lo tiene');
  });

  it('cerrada una, se puede volver a solicitar el producto', async () => {
    const person = await customer();
    const product = await listing(admin, shop);
    await act(shop, await reserved(person, product), { action: 'reject', reason: 'motivo' });
    expect((await request(person, product)).status).toBe(201);
  });
});

describe('vencer', () => {
  it('cierra lo vencido, libera la unidad y repetir no hace nada', async () => {
    const product = await listing(admin, shop, { depositMinor: 1000 });
    const pending = await reserved(await customer(), product);
    const waiting = (await approve(shop, await reserved(await customer(), product))).body;
    expect(await units(product)).toBe(4);
    await overdue(pending.id);
    await overdue(waiting.id);
    expect(await sweep()).toBeGreaterThanOrEqual(2);
    for (const { id } of [pending, waiting]) {
      const row = await t.prisma.reservation.findUniqueOrThrow({ where: { id }, include: { events: true } });
      expect(row).toMatchObject({ status: 'EXPIRED', expiresAt: null, unitHeld: false });
      expect(row.events.filter(({ action }) => action === 'expire')).toHaveLength(1);
    }
    expect(await units(product)).toBe(5);
    expect(await sweep()).toBe(0);
  });

  it('no toca lo que aún tiene plazo ni lo que ya está listo', async () => {
    const product = await listing(admin, shop);
    const pending = await reserved(await customer(), product);
    let { body } = await approve(shop, await reserved(await customer(), product));
    body = (await act(shop, body, { action: 'ready' })).body;
    await overdue(body.id);
    await sweep();
    expect((await t.prisma.reservation.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe('PENDING_REVIEW');
    expect((await t.prisma.reservation.findUniqueOrThrow({ where: { id: body.id } })).status).toBe('READY');
  });

  it('si el cliente acepta a la vez que vence, solo ocurre una cosa', async () => {
    for (let index = 0; index < 5; index += 1) {
      const product = await listing(admin, shop);
      const person = await customer();
      const { body } = await approve(shop, await reserved(person, product), { priceMinor: 9000, depositMinor: 0, availableOn: '2027-03-15' });
      await overdue(body.id);
      const [accepted] = await Promise.all([person.post(`/api/reservations/${body.id}/accept`, { version: body.version }), sweep()]);
      const row = await t.prisma.reservation.findUniqueOrThrow({ where: { id: body.id }, include: { events: true } });
      const last = row.events.filter(({ action }) => action === 'accept' || action === 'expire');
      expect(last).toHaveLength(1);
      expect(row.status).toBe(accepted.status === 200 ? 'CONFIRMED' : 'EXPIRED');
      expect(await units(product)).toBe(accepted.status === 200 ? 4 : 5);
    }
  }, 30_000);

  it('dos barridos a la vez no duplican el vencimiento', async () => {
    const product = await listing(admin, shop);
    const { id } = await reserved(await customer(), product);
    await overdue(id);
    await Promise.all([sweep(), sweep(), sweep()]);
    expect(await t.prisma.reservationEvent.count({ where: { reservationId: id, action: 'expire' } })).toBe(1);
  });
});

describe('quién ve qué', () => {
  it('antes de aprobar la tienda no ve el contacto, ni el cliente la recogida', async () => {
    const person = await customer();
    const reservation = await reserved(person, await listing(admin, shop));
    const url = `/api/stores/${shop.id}/reservations/${reservation.id}`;
    const before = (await shop.owner.get(url)).body;
    expect(before.customer).toMatchObject({ name: 'Persona', email: null, phone: null, completed: 0, rejected: 0, noShow: 0 });
    const { email } = (await person.get('/api/me')).body;
    expect(JSON.stringify(before)).not.toMatch(new RegExp(`555 0199|${email}`));
    await approve(shop, reservation);
    expect((await shop.owner.get(url)).body.customer).toMatchObject({ email, phone: '555 0199' });
    expect((await person.get(`/api/reservations/${reservation.id}`)).body.pickupInfo).toContain('Calle 1');
  });

  it('la tienda conoce los antecedentes solo como conteo', async () => {
    const person = await customer();
    const other = await openShop(t, admin);
    await act(other, await reserved(person, await listing(admin, other)), { action: 'reject', reason: 'secreto de otra tienda' });
    const reservation = await reserved(person, await listing(admin, shop));
    const { body } = await shop.owner.get(`/api/stores/${shop.id}/reservations/${reservation.id}`);
    expect(body.customer.rejected).toBe(1);
    expect(JSON.stringify(body)).not.toContain('secreto de otra tienda');
  });

  it('una reserva ajena no existe para otro cliente ni para otra tienda', async () => {
    const reservation = await reserved(await customer(), await listing(admin, shop));
    const other = await openShop(t, admin);
    const stranger = await customer();
    const body = { version: reservation.version, reason: 'motivo' };
    const attempts = [
      await stranger.get(`/api/reservations/${reservation.id}`),
      await stranger.post(`/api/reservations/${reservation.id}/accept`, { version: 1 }),
      await stranger.post(`/api/reservations/${reservation.id}/decline`, body),
      await stranger.post(`/api/reservations/${reservation.id}/cancel`, body),
      await other.owner.get(`/api/stores/${other.id}/reservations/${reservation.id}`),
      await approve(other, reservation),
      await other.owner.get(`/api/stores/${shop.id}/reservations`),
      await stranger.get(`/api/stores/${shop.id}/reservations/${reservation.id}`),
    ];
    expect(attempts.map((res) => res.status)).toEqual(attempts.map(() => 404));
  });

  it('las listas solo traen lo propio', async () => {
    const own = await openShop(t, admin);
    const person = await customer();
    const { id } = await reserved(person, await listing(admin, own));
    await reserved(await customer(), await listing(admin, shop));
    const ids = (body: { items: { id: string }[] }) => body.items.map((item) => item.id);
    expect(ids((await person.get('/api/reservations')).body)).toEqual([id]);
    expect(ids((await own.owner.get(`/api/stores/${own.id}/reservations`)).body)).toEqual([id]);
    expect(ids((await own.owner.get(`/api/stores/${own.id}/reservations?status=CONFIRMED`)).body)).toEqual([]);
  });

  it('el personal consulta pero no decide', async () => {
    const own = await openShop(t, admin);
    const staff = await t.signedIn('customer', true);
    const { id: userId } = (await staff.get('/api/me')).body;
    await t.prisma.storeMember.create({ data: { storeId: own.id, userId, role: 'STAFF' } });
    const reservation = await reserved(await customer(), await listing(admin, own));
    expect((await staff.get(`/api/stores/${own.id}/reservations/${reservation.id}`)).status).toBe(200);
    for (const res of [
      await approve({ owner: staff, id: own.id }, reservation),
      await staff.post(`/api/stores/${own.id}/reservations/${reservation.id}/payments`, {}),
      await staff.patch(`/api/stores/${own.id}/pickup`, { pickupInfo: 'Otra dirección' }),
    ]) {
      expect([res.status, res.body.error.code]).toEqual([403, 'FORBIDDEN']);
    }
  });

  it('una tienda suspendida no decide, pero el cliente sí puede cancelar', async () => {
    const own = await openShop(t, admin);
    const person = await customer();
    const reservation = await reserved(person, await listing(admin, own));
    await decide(admin, own.id, 'suspend', 'motivo');
    expect((await approve(own, reservation)).body.error.code).toBe('STORE_NOT_APPROVED');
    expect((await person.post(`/api/reservations/${reservation.id}/cancel`, { version: 1, reason: 'Cambio de idea' })).status).toBe(200);
  });

  it('cada decisión queda en la auditoría', async () => {
    const reservation = await reserved(await customer(), await listing(admin, shop));
    await approve(shop, reservation);
    const actions = (await t.prisma.auditEvent.findMany({ where: { targetId: reservation.id }, orderBy: { id: 'asc' } })).map(({ action }) => action);
    expect(actions).toEqual(['reservation.request', 'reservation.approve']);
  });
});
