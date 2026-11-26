import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { newEmail, startIdentity, type Browser, type TestIdentity } from './support/identity.js';
import { approvedStore, decide, readyStore } from './support/stores.js';

let db: TestDatabase;
let t: TestIdentity;
let admin: Browser;

beforeAll(async () => {
  db = await createTestDatabase();
  t = await startIdentity(db.appUrl);
  admin = await t.signedIn('admin');
}, 90_000);

afterAll(async () => {
  await t?.stop();
  await db?.stop();
}, 30_000);

const me = async (browser: Browser) => (await browser.get('/api/me')).body as { id: string; email: string };
const tokenFor = (email: string) => new URLSearchParams(t.mailer.link(email).hash.slice(1)).get('token') ?? '';

async function invite(owner: Browser, storeId: string, email: string, role = 'STAFF') {
  return owner.post(`/api/stores/${storeId}/invitations`, { email, role });
}

/** Persona con 2FA que ya forma parte de la tienda. */
async function member(owner: Browser, storeId: string, role: string): Promise<Browser> {
  const person = await t.signedIn('customer', true);
  const { email } = await me(person);
  expect((await invite(owner, storeId, email, role)).status).toBe(201);
  expect((await person.post('/api/store-invitations/accept', { token: tokenFor(email) })).status).toBe(200);
  return person;
}

const roleOf = async (owner: Browser, storeId: string, userId: string) =>
  (await owner.get(`/api/stores/${storeId}/members`)).body.members.find((item: { userId: string }) => item.userId === userId)?.role;

describe('invitaciones', () => {
  it('quien recibe el correo se une con el papel indicado', async () => {
    const { owner, id } = await approvedStore(t, admin);
    const person = await member(owner, id, 'MANAGER');
    expect((await person.get(`/api/stores/${id}`)).body.role).toBe('MANAGER');
  });

  it('la respuesta no revela si el correo tiene cuenta', async () => {
    const { owner, id } = await approvedStore(t, admin);
    const known = await invite(owner, id, await t.account());
    const unknown = await invite(owner, id, newEmail());
    expect([known.status, Object.keys(known.body)]).toEqual([unknown.status, Object.keys(unknown.body)]);
  });

  it('no se guarda el token', async () => {
    const { owner, id } = await approvedStore(t, admin);
    const email = newEmail();
    await invite(owner, id, email);
    const row = await t.prisma.storeInvitation.findFirstOrThrow({ where: { email } });
    expect(JSON.stringify(row)).not.toContain(tokenFor(email));
  });

  it('otra persona no puede usar el enlace', async () => {
    const { owner, id } = await approvedStore(t, admin);
    const email = await t.account();
    await invite(owner, id, email);
    const thief = await t.signedIn('customer', true);
    const res = await thief.post('/api/store-invitations/accept', { token: tokenFor(email) });
    expect([res.status, res.body.error.code]).toEqual([404, 'INVITATION_INVALID']);
    expect((await thief.get(`/api/stores/${id}`)).status).toBe(404);
  });

  it('sirve una sola vez, aunque se use dos veces a la vez', async () => {
    const { owner, id } = await approvedStore(t, admin);
    const person = await t.signedIn('customer', true);
    const { email, id: userId } = await me(person);
    await invite(owner, id, email);
    const token = tokenFor(email);
    const results = await Promise.all([1, 2].map(() => person.post('/api/store-invitations/accept', { token })));
    expect(results.map((res) => res.status).toSorted()).toEqual([200, 404]);
    await owner.delete(`/api/stores/${id}/members/${userId}`);
    expect((await person.post('/api/store-invitations/accept', { token })).status).toBe(404);
  });

  it('vence', async () => {
    const { owner, id } = await approvedStore(t, admin);
    const person = await t.signedIn('customer', true);
    const { email } = await me(person);
    await invite(owner, id, email);
    await t.prisma.storeInvitation.updateMany({ where: { email }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await person.post('/api/store-invitations/accept', { token: tokenFor(email) })).status).toBe(404);
  });

  it('reenviarla anula el enlace anterior, y revocarla, el último', async () => {
    const { owner, id } = await approvedStore(t, admin);
    const person = await t.signedIn('customer', true);
    const { email } = await me(person);
    await invite(owner, id, email);
    const first = tokenFor(email);
    const again = await invite(owner, id, email, 'MANAGER');
    expect((await person.post('/api/store-invitations/accept', { token: first })).status).toBe(404);
    expect((await owner.delete(`/api/stores/${id}/invitations/${again.body.id}`)).status).toBe(204);
    expect((await person.post('/api/store-invitations/accept', { token: tokenFor(email) })).status).toBe(404);
  });

  it('una tienda sin verificar no puede enviar correos a nadie', async () => {
    const owner = await t.signedIn('customer', true);
    const id = await readyStore(owner);
    const res = await invite(owner, id, newEmail());
    expect([res.status, res.body.error.code]).toEqual([409, 'STORE_NOT_APPROVED']);
  });

  it('limita las pendientes', async () => {
    const { owner, id } = await approvedStore(t, admin);
    await t.prisma.storeInvitation.createMany({
      data: Array.from({ length: 20 }, () => ({
        storeId: id,
        email: newEmail(),
        role: 'STAFF',
        tokenHash: randomUUID().replaceAll('-', '').padEnd(64, '0'),
        invitedBy: 'x',
        expiresAt: new Date(Date.now() + 60_000),
      })),
    });
    const res = await invite(owner, id, newEmail());
    expect([res.status, res.body.error.code]).toEqual([409, 'TOO_MANY_INVITATIONS']);
  });

  it('aceptar exige el segundo paso', async () => {
    const { owner, id } = await approvedStore(t, admin);
    const person = await t.signedIn('customer');
    const { email } = await me(person);
    await invite(owner, id, email);
    const res = await person.post('/api/store-invitations/accept', { token: tokenFor(email) });
    expect([res.status, res.body.error.code]).toEqual([403, 'TWO_FACTOR_REQUIRED']);
  });
});

describe('equipo', () => {
  it('solo el propietario lo gestiona', async () => {
    const { owner, id } = await approvedStore(t, admin);
    const { id: ownerId } = await me(owner);
    for (const role of ['MANAGER', 'STAFF']) {
      const person = await member(owner, id, role);
      const attempts = [
        await person.get(`/api/stores/${id}/members`),
        await invite(person, id, newEmail()),
        await person.patch(`/api/stores/${id}/members/${ownerId}`, { role: 'STAFF' }),
        await person.delete(`/api/stores/${id}/members/${ownerId}`),
        await person.patch(`/api/stores/${id}`, {}),
        await person.post(`/api/stores/${id}/submit`),
      ];
      expect(attempts.map((res) => [res.status, res.body.error.code])).toEqual(attempts.map(() => [403, 'FORBIDDEN']));
    }
  });

  it('el resto del equipo no recibe los datos de verificación, aunque los pida a la API', async () => {
    const { owner, id } = await approvedStore(t, admin, { taxId: 'PRIVADO-7', legalName: 'Legal Privado' });
    for (const role of ['MANAGER', 'STAFF']) {
      const { body } = await (await member(owner, id, role)).get(`/api/stores/${id}`);
      expect(body).toMatchObject({ name: 'Tienda de Ana', status: 'APPROVED', taxId: '', legalName: '', phone: '', address: '', documents: [], events: [] });
      expect(JSON.stringify(body)).not.toMatch(/PRIVADO-7|Legal Privado/);
    }
    expect((await owner.get(`/api/stores/${id}`)).body.taxId).toBe('PRIVADO-7');
  });

  it('cambiar el papel surte efecto en la siguiente petición', async () => {
    const { owner, id } = await approvedStore(t, admin);
    const person = await member(owner, id, 'STAFF');
    const { id: userId } = await me(person);
    expect((await owner.patch(`/api/stores/${id}/members/${userId}`, { role: 'OWNER' })).status).toBe(200);
    expect((await person.get(`/api/stores/${id}/members`)).status).toBe(200);
    expect((await owner.delete(`/api/stores/${id}/members/${userId}`)).status).toBe(204);
    expect((await person.get(`/api/stores/${id}`)).status).toBe(404);
  });

  it('el último propietario no se puede quitar, degradar ni marchar', async () => {
    const { owner, id } = await approvedStore(t, admin);
    const { id: userId } = await me(owner);
    for (const res of [
      await owner.delete(`/api/stores/${id}/members/${userId}`),
      await owner.patch(`/api/stores/${id}/members/${userId}`, { role: 'STAFF' }),
      await owner.post(`/api/stores/${id}/leave`),
    ]) {
      expect([res.status, res.body.error.code]).toEqual([409, 'LAST_OWNER']);
    }
  });

  it('dos propietarios que se quitan a la vez no dejan la tienda sin dueño', async () => {
    const { owner, id } = await approvedStore(t, admin);
    const second = await member(owner, id, 'STAFF');
    const [a, b] = [await me(owner), await me(second)];
    await owner.patch(`/api/stores/${id}/members/${b.id}`, { role: 'OWNER' });
    const results = await Promise.all([owner.post(`/api/stores/${id}/leave`), second.post(`/api/stores/${id}/leave`)]);
    expect(results.map((res) => res.status).toSorted()).toEqual([204, 409]);
    expect(await t.prisma.storeMember.count({ where: { storeId: id, role: 'OWNER', userId: { in: [a.id, b.id] } } })).toBe(1);
  });

  it('cualquiera puede marcharse', async () => {
    const { owner, id } = await approvedStore(t, admin);
    const person = await member(owner, id, 'STAFF');
    expect((await person.post(`/api/stores/${id}/leave`)).status).toBe(204);
    expect((await person.get(`/api/stores/${id}`)).status).toBe(404);
  });

  it('con su tienda en la ruta, no toca a los miembros ni invitaciones de otra', async () => {
    const a = await approvedStore(t, admin);
    const b = await approvedStore(t, admin);
    const victim = await member(b.owner, b.id, 'STAFF');
    const { id: userId } = await me(victim);
    const invitation = (await invite(b.owner, b.id, newEmail())).body.id;
    for (const res of [
      await a.owner.patch(`/api/stores/${a.id}/members/${userId}`, { role: 'OWNER' }),
      await a.owner.delete(`/api/stores/${a.id}/members/${userId}`),
      await a.owner.delete(`/api/stores/${a.id}/invitations/${invitation}`),
      await a.owner.get(`/api/stores/${b.id}/members`),
      await a.owner.post(`/api/stores/${b.id}/leave`),
      await invite(a.owner, b.id, newEmail()),
    ]) {
      expect(res.status).toBe(404);
    }
    expect(await roleOf(b.owner, b.id, userId)).toBe('STAFF');
  });

  it('los cambios quedan en la auditoría', async () => {
    const { owner, id } = await approvedStore(t, admin);
    const person = await member(owner, id, 'STAFF');
    await owner.delete(`/api/stores/${id}/members/${(await me(person)).id}`);
    const actions = (await t.prisma.auditEvent.findMany({ where: { targetId: id } })).map(({ action }) => action);
    expect(actions).toEqual(expect.arrayContaining(['store.member_invited', 'store.member_joined', 'store.member_removed']));
  });

  it('una tienda suspendida no invita', async () => {
    const { owner, id } = await approvedStore(t, admin);
    await decide(admin, id, 'suspend', 'motivo');
    expect((await invite(owner, id, newEmail())).body.error.code).toBe('STORE_NOT_APPROVED');
  });
});
