import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPrisma, type Prisma } from '../src/database/prisma.js';
import { AuditRepository } from '../src/modules/audit/audit.repository.js';
import { AuditService } from '../src/modules/audit/audit.service.js';
import { LoginThrottleRepository } from '../src/modules/identity/login-throttle.repository.js';
import { LoginThrottle, MAX_ATTEMPTS, TooManyAttemptsError, WINDOW_MS } from '../src/modules/identity/login-throttle.service.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';

let db: TestDatabase;
let prisma: Prisma;
let now: Date;
let throttle: LoginThrottle;
let audit: AuditService;

beforeAll(async () => {
  db = await createTestDatabase();
  prisma = createPrisma(db.appUrl);
}, 90_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await db?.stop();
}, 30_000);

beforeEach(async () => {
  await prisma.loginFailure.deleteMany();
  now = new Date('2026-11-24T12:00:00Z');
  throttle = new LoginThrottle(new LoginThrottleRepository(prisma), 'clave-de-prueba', () => now);
  audit = new AuditService(new AuditRepository(prisma));
});

const attempts = async (email: string, count: number) => {
  for (let i = 0; i < count; i += 1) await throttle.begin(email);
};

describe('LoginThrottle', () => {
  it('permite el máximo de intentos y bloquea el siguiente', async () => {
    await attempts('a@example.test', MAX_ATTEMPTS);
    await expect(throttle.begin('a@example.test')).rejects.toBeInstanceOf(TooManyAttemptsError);
  });

  it('no se esquiva con mayúsculas ni espacios', async () => {
    await attempts('a@example.test', MAX_ATTEMPTS);
    await expect(throttle.begin('  A@Example.TEST ')).rejects.toBeInstanceOf(TooManyAttemptsError);
  });

  it('no bloquea a otras cuentas', async () => {
    await attempts('a@example.test', MAX_ATTEMPTS);
    await expect(throttle.begin('b@example.test')).resolves.toBeUndefined();
  });

  it('el bloqueo vence solo', async () => {
    await attempts('a@example.test', MAX_ATTEMPTS);
    now = new Date(now.getTime() + WINDOW_MS + 1);
    await expect(throttle.begin('a@example.test')).resolves.toBeUndefined();
  });

  it('insistir durante el bloqueo no lo prolonga', async () => {
    await attempts('a@example.test', MAX_ATTEMPTS);
    now = new Date(now.getTime() + WINDOW_MS - 1000);
    await expect(throttle.begin('a@example.test')).rejects.toBeInstanceOf(TooManyAttemptsError);
    now = new Date(now.getTime() + 2000);
    await expect(throttle.begin('a@example.test')).resolves.toBeUndefined();
  });

  it('acertar limpia los intentos', async () => {
    await attempts('a@example.test', MAX_ATTEMPTS - 1);
    await throttle.clear('A@example.test');
    await attempts('a@example.test', MAX_ATTEMPTS);
  });

  it('intentos simultáneos nunca superan el máximo', async () => {
    const results = await Promise.allSettled(Array.from({ length: 30 }, () => throttle.begin('a@example.test')));
    expect(results.filter(({ status }) => status === 'fulfilled').length).toBeLessThanOrEqual(MAX_ATTEMPTS);
  });

  it('guarda un HMAC, nunca el email', async () => {
    await throttle.begin('secreto@example.test');
    const [row] = await prisma.loginFailure.findMany();
    expect(row?.emailHash).toMatch(/^[0-9a-f]{64}$/);
    const other = new LoginThrottle(new LoginThrottleRepository(prisma), 'otra-clave', () => now);
    expect(other.fingerprint('secreto@example.test')).not.toBe(row?.emailHash);
  });
});

describe('AuditService', () => {
  it('registra quién, qué y sobre qué', async () => {
    await audit.record({ actorId: 'u1', action: 'auth.sign_in', targetType: 'user', targetId: 'u1', requestId: 'r1' });
    const { items } = await audit.list({ limit: 1 });
    expect(items[0]).toMatchObject({ actorId: 'u1', action: 'auth.sign_in', targetType: 'user', targetId: 'u1', requestId: 'r1' });
  });

  it.each(['password', 'newPassword', 'token', 'sessionToken', 'secret', 'email', 'backupCodes', 'TOTP_CODE'])(
    'nunca guarda la clave sensible %s',
    async (key) => {
      await audit.record({ action: 'prueba', metadata: { [key]: 'valor-sensible', visible: 'sí' } });
      const { items } = await audit.list({ limit: 1 });
      expect(items[0]?.metadata).toEqual({ visible: 'sí' });
    },
  );

  it('pagina del más reciente al más antiguo sin repetir', async () => {
    for (let i = 0; i < 5; i += 1) await audit.record({ action: `pagina.${i}` });
    const first = await audit.list({ limit: 2 });
    const second = await audit.list({ limit: 2, cursor: first.nextCursor! });
    expect([...first.items, ...second.items].map(({ action }) => action)).toEqual(['pagina.4', 'pagina.3', 'pagina.2', 'pagina.1']);
  });

  it('limita el tamaño de página', async () => {
    const { items } = await audit.list({ limit: 100_000 });
    expect(items.length).toBeLessThanOrEqual(100);
  });
});
