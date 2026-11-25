import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrisma, type Prisma } from '../src/database/prisma.js';
import { AuditRepository } from '../src/modules/audit/audit.repository.js';
import { AuditService } from '../src/modules/audit/audit.service.js';
import { RoleService } from '../src/modules/identity/role.service.js';
import { UserRepository } from '../src/modules/identity/user.repository.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';

let db: TestDatabase;
let prisma: Prisma;
let roles: RoleService;

beforeAll(async () => {
  db = await createTestDatabase();
  prisma = createPrisma(db.appUrl);
  roles = new RoleService(new UserRepository(prisma), new AuditService(new AuditRepository(prisma)));
}, 90_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await db?.stop();
}, 30_000);

async function user(emailVerified = true) {
  const id = randomUUID();
  const { email } = await prisma.user.create({ data: { id, name: 'Persona', email: `${id}@example.test`, emailVerified } });
  await prisma.session.create({ data: { id, token: id, userId: id, expiresAt: new Date(Date.now() + 60_000) } });
  return { id, email };
}

describe('RoleService', () => {
  it('asigna el rol, cierra las sesiones y deja rastro', async () => {
    const { id, email } = await user();
    await roles.assign(` ${email.toUpperCase()} `, 'admin');
    expect((await prisma.user.findUniqueOrThrow({ where: { id } })).platformRole).toBe('admin');
    expect(await prisma.session.count({ where: { userId: id } })).toBe(0);
    const event = await prisma.auditEvent.findFirstOrThrow({ where: { targetId: id } });
    expect(event).toMatchObject({ action: 'user.role_assigned', metadata: { from: 'customer', to: 'admin' } });
  });

  it('rechaza un rol desconocido', async () => {
    const { email } = await user();
    await expect(roles.assign(email, 'root')).rejects.toThrow(/Rol desconocido/);
  });

  it('rechaza una cuenta sin verificar', async () => {
    const { email } = await user(false);
    await expect(roles.assign(email, 'admin')).rejects.toThrow(/verificada/);
  });

  it('rechaza una cuenta inexistente', async () => {
    await expect(roles.assign('nadie@example.test', 'admin')).rejects.toThrow(/No existe/);
  });
});
