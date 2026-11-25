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
