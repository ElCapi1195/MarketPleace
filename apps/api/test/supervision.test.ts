import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { PASSWORD, startIdentity, type Browser, type TestIdentity } from './support/identity.js';
import { act, approve, listing, openShop, pay, reserved, type Shop } from './support/reservations.js';

let db: TestDatabase;
let t: TestIdentity;
let admin: Browser;
let moderator: Browser;
let shop: Shop;

beforeAll(async () => {
  db = await createTestDatabase();
  t = await startIdentity(db.appUrl);
  [admin, moderator] = [await t.signedIn('admin'), await t.signedIn('moderator')];
  shop = await openShop(t, admin);
}, 90_000);

afterAll(async () => {
  await t?.stop();
  await db?.stop();
}, 30_000);

const me = async (browser: Browser) => (await browser.get('/api/me')).body as { id: string; email: string };

describe('supervisar reservas', () => {
  it('la plataforma ve cualquier reserva con el contacto, y cada consulta queda registrada', async () => {
    const person = await t.signedIn('customer');
    const reservation = await reserved(person, await listing(admin, shop));
    const { body } = await admin.get(`/api/admin/reservations/${reservation.id}`);
    expect(body).toMatchObject({ id: reservation.id, storeName: 'Tienda de Ana', customer: { email: (await me(person)).email, phone: '555 0199' } });
    const viewed = await t.prisma.auditEvent.count({ where: { action: 'reservation.viewed', targetId: reservation.id } });
    expect(viewed).toBe(1);
  });

  it('filtra por estado, código y devolución pendiente', async () => {
    const reservation = await reserved(await t.signedIn('customer'), await listing(admin, shop, { depositMinor: 100 }));
    const { body: approved } = await approve(shop, reservation);
    const { body: paid } = await pay(shop, reservation.id, 'DEPOSIT', 100);
    await act(shop, paid, { action: 'cancel', reason: 'motivo' });
    const ids = async (query: string) => (await admin.get(`/api/admin/reservations?${query}`)).body.items.map((item: { id: string }) => item.id);
    expect(await ids('refund=pending')).toContain(reservation.id);
    expect(await ids(`code=${approved.code}`)).toEqual([reservation.id]);
    expect(await ids(`code=${approved.code.toLowerCase()}`)).toEqual([reservation.id]);
    expect(await ids('status=PENDING_REVIEW')).not.toContain(reservation.id);
  });

  it('cancela con motivo, avisa a ambas partes y libera la unidad', async () => {
    const person = await t.signedIn('customer');
    const product = await listing(admin, shop);
    const { body } = await approve(shop, await reserved(person, product));
    const bare = await admin.post(`/api/admin/reservations/${body.id}/cancel`, { version: body.version, reason: '' });
    expect(bare.status).toBe(400);
    const res = await admin.post(`/api/admin/reservations/${body.id}/cancel`, { version: body.version, reason: 'Denuncia confirmada' });
    expect(res.body).toMatchObject({ status: 'CANCELLED' });
    expect(res.body.events[0]).toMatchObject({ action: 'cancel', actor: 'PLATFORM', reason: 'Denuncia confirmada' });
    expect((await t.prisma.product.findUniqueOrThrow({ where: { id: product.id } })).units).toBe(5);
    const { email } = await me(person);
    expect(t.mailer.sent.findLast((mail) => mail.to === email)?.text).toContain('Denuncia confirmada');
    expect(await t.prisma.auditEvent.count({ where: { action: 'reservation.cancel', targetId: body.id } })).toBe(1);
  });

  it('con una versión antigua no cancela', async () => {
    const reservation = await reserved(await t.signedIn('customer'), await listing(admin, shop));
    await approve(shop, reservation);
    const res = await admin.post(`/api/admin/reservations/${reservation.id}/cancel`, { version: reservation.version, reason: 'motivo' });
    expect([res.status, res.body.error.code]).toEqual([409, 'VERSION_CONFLICT']);
  });

  it('lo cerrado no se cancela', async () => {
    const reservation = await reserved(await t.signedIn('customer'), await listing(admin, shop));
    const { body } = await act(shop, reservation, { action: 'reject', reason: 'motivo' });
    const res = await admin.post(`/api/admin/reservations/${reservation.id}/cancel`, { version: body.version, reason: 'motivo' });
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('solo el administrador con 2FA supervisa reservas', async () => {
    const id = randomUUID();
    for (const [actor, code] of [
      [moderator, 'FORBIDDEN'],
      [await t.signedIn('customer'), 'FORBIDDEN'],
      [await t.signedIn('admin', false), 'TWO_FACTOR_REQUIRED'],
    ] as const) {
      for (const res of [
        await actor.get('/api/admin/reservations'),
        await actor.get(`/api/admin/reservations/${id}`),
        await actor.post(`/api/admin/reservations/${id}/cancel`, { version: 1, reason: 'motivo' }),
      ]) {
        expect([res.status, res.body.error.code]).toEqual([403, code]);
      }
    }
  });
});

describe('cuentas', () => {
  it('se buscan por correo exacto, sin listados', async () => {
    const email = await t.account();
    const found = await admin.get(`/api/admin/users?email=${encodeURIComponent(email.toUpperCase())}`);
    expect(found.body).toMatchObject({ email, platformRole: 'customer', suspendedAt: null });
    expect((await admin.get('/api/admin/users?email=nadie%40example.test')).status).toBe(404);
    expect((await admin.get('/api/admin/users')).status).toBe(400);
  });

  it('la ficha muestra sus tiendas y reservas y queda registrada', async () => {
    const { id } = await me(shop.owner);
    const { body } = await admin.get(`/api/admin/users/${id}`);
    expect(body.stores).toEqual([{ id: shop.id, name: 'Tienda de Ana', role: 'OWNER' }]);
    expect(body.reservations).toEqual(expect.objectContaining({ total: expect.any(Number) }));
    expect(await t.prisma.auditEvent.count({ where: { action: 'user.viewed', targetId: id } })).toBe(1);
  });

  it('suspender cierra sus sesiones, impide entrar y explica por qué', async () => {
    const email = await t.account();
    const person = t.browser();
    await person.signIn(email);
    const { id } = await me(person);
    const bare = await admin.post(`/api/admin/users/${id}/suspend`, { reason: '' });
    expect(bare.status).toBe(400);
    const res = await admin.post(`/api/admin/users/${id}/suspend`, { reason: 'Fraude reiterado' });
    expect(res.body).toMatchObject({ suspensionReason: 'Fraude reiterado', suspendedAt: expect.any(String) });
    expect((await person.get('/api/me')).status).toBe(401);
    const again = await t.browser().signIn(email);
    expect([again.status, again.body.code]).toEqual([403, 'ACCOUNT_SUSPENDED']);
    expect(await t.prisma.session.count({ where: { userId: id } })).toBe(0);

    await admin.post(`/api/admin/users/${id}/reinstate`, { reason: 'Aclarado' });
    expect((await t.browser().signIn(email)).status).toBe(200);
    const actions = (await t.prisma.auditEvent.findMany({ where: { targetId: id, action: { startsWith: 'user.' } } })).map(({ action }) => action);
    expect(actions).toEqual(expect.arrayContaining(['user.suspended', 'user.reinstated']));
  });

  it('una cuenta suspendida a mitad del segundo paso no termina de entrar', async () => {
    const person = await t.signedIn('customer', true);
    const { id, email } = await me(person);
    const secret = await t.prisma.twoFactor.findFirstOrThrow({ where: { userId: id } });
    expect(secret).toBeDefined();
    const fresh = t.browser();
    expect((await fresh.signIn(email, PASSWORD)).body.twoFactorRedirect).toBe(true);
    await admin.post(`/api/admin/users/${id}/suspend`, { reason: 'motivo' });
    expect((await fresh.get('/api/me')).status).toBe(401);
  });

  it('nadie se suspende a sí mismo ni suspende a un administrador', async () => {
    const { id } = await me(admin);
    const other = await me(await t.signedIn('admin'));
    for (const target of [id, other.id]) {
      const res = await admin.post(`/api/admin/users/${target}/suspend`, { reason: 'motivo' });
      expect([res.status, res.body.error.code]).toEqual([403, 'PROTECTED_ACCOUNT']);
    }
  });

  it('solo el administrador gestiona cuentas', async () => {
    const id = randomUUID();
    for (const res of [
      await moderator.get('/api/admin/users?email=a%40b.test'),
      await moderator.get(`/api/admin/users/${id}`),
      await moderator.post(`/api/admin/users/${id}/suspend`, { reason: 'motivo' }),
    ]) {
      expect([res.status, res.body.error.code]).toEqual([403, 'FORBIDDEN']);
    }
  });
});

describe('auditoría y resumen', () => {
  it('filtra por acción, autor y objetivo, y nombra al autor', async () => {
    const reservation = await reserved(await t.signedIn('customer'), await listing(admin, shop));
    await approve(shop, reservation);
    const owner = await me(shop.owner);
    const { body } = await admin.get(`/api/admin/audit?action=reservation.&targetId=${reservation.id}`);
    expect(body.items.map((item: { action: string }) => item.action)).toEqual(['reservation.approve', 'reservation.request']);
    expect(body.items[0].actor).toEqual({ id: owner.id, name: 'Persona', email: owner.email });
    const byActor = (await admin.get(`/api/admin/audit?actorId=${owner.id}&limit=100`)).body.items;
    expect(byActor.every((item: { actor: { id: string } }) => item.actor.id === owner.id)).toBe(true);
  });

  it('el resumen cuenta lo pendiente según los permisos de quien lo pide', async () => {
    const full = (await admin.get('/api/admin/overview')).body;
    expect(Object.keys(full).toSorted()).toEqual(['openReports', 'pendingProducts', 'pendingStores', 'refundsPending', 'reservationReports']);
    const limited = (await moderator.get('/api/admin/overview')).body;
    expect(Object.keys(limited).toSorted()).toEqual(['openReports', 'pendingProducts', 'pendingStores']);
    expect((await (await t.signedIn('customer')).get('/api/admin/overview')).status).toBe(403);
  });
});
