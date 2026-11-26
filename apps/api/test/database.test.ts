import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrisma, type Prisma } from '../src/database/prisma.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';

let db: TestDatabase;
let app: Client;
let owner: Client;
let prisma: Prisma;

beforeAll(async () => {
  db = await createTestDatabase();
  app = new Client({ connectionString: db.appUrl });
  owner = new Client({ connectionString: db.ownerUrl });
  await Promise.all([app.connect(), owner.connect()]);
  prisma = createPrisma(db.appUrl);
}, 90_000);

afterAll(async () => {
  await Promise.all([app?.end(), owner?.end(), prisma?.$disconnect()]);
  await db?.stop();
}, 30_000);

const DENIED = '42501';
const insert = (client: Client) =>
  client.query(`INSERT INTO audit_event (id, action) VALUES ($1, 'prueba')`, [randomUUID()]);

describe('auditoría de solo inserción', () => {
  it('la aplicación inserta y lee', async () => {
    await insert(app);
    const { rows } = await app.query('SELECT action FROM audit_event');
    expect(rows).toContainEqual({ action: 'prueba' });
  });

  it.each([
    `UPDATE audit_event SET action = 'alterado'`,
    'DELETE FROM audit_event',
    'TRUNCATE audit_event',
    'DROP TABLE audit_event',
    'ALTER TABLE audit_event DISABLE TRIGGER ALL',
  ])('la aplicación no puede: %s', async (sql) => {
    await insert(app);
    await expect(app.query(sql)).rejects.toMatchObject({ code: DENIED });
  });

  it.each([`UPDATE audit_event SET action = 'alterado'`, 'DELETE FROM audit_event', 'TRUNCATE audit_event'])(
    'tampoco el propietario por descuido: %s',
    async (sql) => {
      await insert(owner);
      await expect(owner.query(sql)).rejects.toMatchObject({ code: DENIED });
    },
  );
});

describe('rol de la aplicación', () => {
  it.each(['CREATE TABLE intruso (id int)', 'CREATE ROLE intruso', 'ALTER TABLE "user" ADD COLUMN intruso int'])(
    'no puede: %s',
    async (sql) => {
      await expect(app.query(sql)).rejects.toMatchObject({ code: DENIED });
    },
  );

  it('no puede reescribir los fallos de acceso', async () => {
    await expect(app.query('UPDATE login_failure SET at = now()')).rejects.toMatchObject({ code: DENIED });
  });
});

describe('restricciones de usuario', () => {
  const user = (data: object) =>
    prisma.user.create({ data: { id: randomUUID(), name: 'Prueba', email: `${randomUUID()}@example.test`, ...data } });

  it('el esquema de Prisma coincide con la base', async () => {
    const created = await user({});
    expect(created).toMatchObject({ platformRole: 'customer', emailVerified: false, twoFactorEnabled: false });
  });

  it('rechaza un rol desconocido', async () => {
    await expect(user({ platformRole: 'root' })).rejects.toThrow(/platformRole_check/);
  });

  it('rechaza un email con mayúsculas, que permitiría duplicar cuentas', async () => {
    await expect(user({ email: 'Mayus@Example.test' })).rejects.toThrow(/lowercase_check/);
  });
});

describe('catálogo', () => {
  const base = { storeId: '', slug: '', title: 'Prueba', description: '', categorySlug: 'cosas', kind: 'IN_STOCK', priceMinor: 10, depositMinor: 0, searchText: '' };
  const store = () => prisma.store.create({ data: { slug: randomUUID(), name: 'Tienda' } });
  const product = async (data: object = {}) =>
    prisma.product.create({ data: { ...base, storeId: (await store()).id, slug: randomUUID(), ...data } });

  it('acepta un producto válido, que nace como borrador', async () => {
    expect(await product()).toMatchObject({ status: 'DRAFT', version: 1 });
  });

  it.each([
    [{ kind: 'RENTAL' }, /kind_check/],
    [{ status: 'VISIBLE' }, /status_check/],
    [{ depositMinor: 11 }, /money_check/],
    [{ units: -1 }, /units_check/],
    [{ kind: 'PREORDER' }, /date_check/],
    [{ availableOn: new Date('2027-01-01') }, /date_check/],
  ])('rechaza %j', async (data, error) => {
    await expect(product(data)).rejects.toThrow(error);
  });

  it('admite un solo modelo 3D por producto', async () => {
    const { id: productId } = await product();
    const model = () => prisma.productMedia.create({ data: { id: randomUUID(), productId, kind: 'MODEL', bytes: 1 } });
    await model();
    await expect(model()).rejects.toThrow(/Unique constraint/);
  });

  it.each(['DELETE FROM product', 'DELETE FROM store'])('la aplicación no puede: %s', async (sql) => {
    await expect(app.query(sql)).rejects.toMatchObject({ code: DENIED });
  });
});

describe('tiendas', () => {
  const store = (data: object = {}) => prisma.store.create({ data: { slug: randomUUID(), name: 'Tienda', ...data } });

  it.each([
    [{ status: 'ACTIVE' }, /status_check/],
    [{ status: 'SUBMITTED' }, /complete_check/],
    [{ status: 'IN_REVIEW', legalName: 'a', taxId: 'b', phone: 'c' }, /complete_check/],
  ])('rechaza %j', async (data, error) => {
    await expect(store(data)).rejects.toThrow(error);
  });

  it('el historial de decisiones no se puede reescribir', async () => {
    const { id: storeId } = await store();
    await prisma.storeEvent.create({ data: { storeId, action: 'submit', fromStatus: 'DRAFT', toStatus: 'SUBMITTED', actorId: 'x' } });
    for (const client of [app, owner]) {
      for (const sql of [`UPDATE store_event SET reason = 'x'`, 'DELETE FROM store_event', 'TRUNCATE store_event']) {
        await expect(client.query(sql)).rejects.toMatchObject({ code: DENIED });
      }
    }
  });

  it('no se puede borrar a una persona que pertenece a una tienda', async () => {
    const { id: storeId } = await store();
    const id = randomUUID();
    await prisma.user.create({ data: { id, name: 'P', email: `${id}@example.test` } });
    await prisma.storeMember.create({ data: { storeId, userId: id, role: 'OWNER' } });
    await expect(prisma.user.delete({ where: { id } })).rejects.toThrow();
    await expect(prisma.storeMember.update({ where: { storeId_userId: { storeId, userId: id } }, data: { role: 'ADMIN' } })).rejects.toThrow(/role_check/);
  });
});

describe('reservas', () => {
  async function reservation(data: object = {}) {
    const id = randomUUID();
    await prisma.user.create({ data: { id, name: 'P', email: `${id}@example.test` } });
    const store = await prisma.store.create({ data: { slug: randomUUID(), name: 'Tienda' } });
    const product = await prisma.product.create({
      data: { storeId: store.id, slug: randomUUID(), title: 'P', description: '', categorySlug: 'x', kind: 'IN_STOCK', priceMinor: 10, depositMinor: 0, searchText: '' },
    });
    return prisma.reservation.create({
      data: {
        code: randomUUID(),
        customerId: id,
        storeId: store.id,
        productId: product.id,
        idempotencyKey: randomUUID(),
        kind: 'IN_STOCK',
        productTitle: 'P',
        currency: 'USD',
        requestedPriceMinor: 10,
        requestedDepositMinor: 0,
        priceMinor: 10,
        depositMinor: 0,
        termsVersion: '1',
        expiresAt: new Date(),
        ...data,
      },
    });
  }

  it.each([
    [{ status: 'OTRO', approvedAt: new Date(), expiresAt: null }, /status_check/],
    [{ status: 'CONFIRMED', expiresAt: null }, /approved_check/],
    [{ unitHeld: true }, /held_check/],
    [{ expiresAt: null }, /deadline_check/],
    [{ depositMinor: 11 }, /money_check/],
    [{ offerPriceMinor: 5, offerDepositMinor: 0 }, /offer_check/],
    [{ status: 'AWAITING_CUSTOMER', approvedAt: new Date() }, /offer_check/],
  ])('rechaza %j', async (data, error) => {
    await expect(reservation(data)).rejects.toThrow(error);
  });

  it('solo una activa por producto y cliente', async () => {
    const first = await reservation();
    const again = () => reservation({ customerId: first.customerId, productId: first.productId, storeId: first.storeId });
    await expect(again()).rejects.toThrow(/Unique constraint/);
    await prisma.reservation.update({ where: { id: first.id }, data: { status: 'CANCELLED', expiresAt: null } });
    await expect(again()).resolves.toBeDefined();
  });

  it('un pago solo se reversa una vez y los importes tienen su signo', async () => {
    const { id: reservationId } = await reservation();
    const base = { reservationId, kind: 'DEPOSIT', currency: 'USD', method: 'CASH', recordedBy: 'x' };
    const { id } = await prisma.paymentRecord.create({ data: { ...base, amountMinor: 5 } });
    await expect(prisma.paymentRecord.create({ data: { ...base, amountMinor: -5 } })).rejects.toThrow(/amount_check/);
    await expect(prisma.paymentRecord.create({ data: { ...base, amountMinor: 5, reversesId: id } })).rejects.toThrow(/amount_check/);
    await prisma.paymentRecord.create({ data: { ...base, amountMinor: -5, reversesId: id } });
    await expect(prisma.paymentRecord.create({ data: { ...base, amountMinor: -5, reversesId: id } })).rejects.toThrow(/Unique constraint/);
  });

  it.each(['payment_record', 'reservation_event'])('%s no se puede reescribir', async (table) => {
    const { id: reservationId } = await reservation();
    await prisma.paymentRecord.create({ data: { reservationId, kind: 'DEPOSIT', amountMinor: 5, currency: 'USD', method: 'CASH', recordedBy: 'x' } });
    await prisma.reservationEvent.create({ data: { reservationId, action: 'x', fromStatus: 'x', toStatus: 'x', actor: 'SYSTEM' } });
    for (const client of [app, owner]) {
      for (const sql of [`UPDATE ${table} SET at = now()`, `DELETE FROM ${table}`, `TRUNCATE ${table} CASCADE`]) {
        await expect(client.query(sql)).rejects.toMatchObject({ code: DENIED });
      }
    }
  });

  it('la aplicación no puede borrar reservas', async () => {
    await expect(app.query('DELETE FROM reservation')).rejects.toMatchObject({ code: DENIED });
  });
});
