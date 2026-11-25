import { Controller, Get } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { enableTwoFactor, newEmail, PASSWORD, startIdentity, type TestIdentity } from './support/identity.js';

/** Controlador sin ninguna anotación de acceso: debe quedar cerrado por defecto. */
@Controller('olvidado')
class ForgottenController {
  @Get()
  read() {
    return { datos: 'privados' };
  }
}

let db: TestDatabase;
let t: TestIdentity;

beforeAll(async () => {
  db = await createTestDatabase();
  t = await startIdentity(db.appUrl, { controllers: [ForgottenController] });
}, 90_000);

afterAll(async () => {
  await t?.stop();
  await db?.stop();
}, 30_000);

async function signedIn(role?: string) {
  const email = await t.account(role);
  const browser = t.browser();
  await browser.signIn(email);
  return { email, browser };
}

describe('segundo factor', () => {
  it('con 2FA activo, la contraseña sola no abre sesión', async () => {
    const { email, browser } = await signedIn();
    const { code } = await enableTwoFactor(browser);
    const other = t.browser();
    expect((await other.signIn(email)).body.twoFactorRedirect).toBe(true);
    expect((await other.get('/api/me')).status).toBe(401);
    expect((await other.post('/api/auth/two-factor/verify-totp', { code: code() })).status).toBe(200);
    expect((await other.get('/api/me')).body.twoFactorEnabled).toBe(true);
  });

  it('no se puede recordar el dispositivo para saltárselo', async () => {
    const { email, browser } = await signedIn();
    const { code } = await enableTwoFactor(browser);
    const other = t.browser();
    await other.signIn(email);
    const res = await other.post('/api/auth/two-factor/verify-totp', { code: code(), trustDevice: true });
    expect(res.body.code).toBe('TRUST_DEVICE_NOT_ALLOWED');
    expect((await other.get('/api/me')).status).toBe(401);
  });

  it('un código erróneo no abre sesión', async () => {
    const { email, browser } = await signedIn();
    const { code } = await enableTwoFactor(browser);
    const other = t.browser();
    await other.signIn(email);
    const wrong = String((Number(code()) + 1) % 1_000_000).padStart(6, '0');
    expect((await other.post('/api/auth/two-factor/verify-totp', { code: wrong })).status).not.toBe(200);
    expect((await other.get('/api/me')).status).toBe(401);
  });

  it('limita los intentos de adivinar el código', async () => {
    const { email, browser } = await signedIn();
    const { code } = await enableTwoFactor(browser);
    const other = t.browser();
    await other.signIn(email);
    const wrong = String((Number(code()) + 1) % 1_000_000).padStart(6, '0');
    for (let i = 0; i < 12; i += 1) await other.post('/api/auth/two-factor/verify-totp', { code: wrong });
    expect((await other.post('/api/auth/two-factor/verify-totp', { code: code() })).status).not.toBe(200);
    expect((await other.get('/api/me')).status).toBe(401);
  });

  it('un código de respaldo sirve una sola vez', async () => {
    const { email, browser } = await signedIn();
    const { backupCodes } = await enableTwoFactor(browser);
    const use = async () => {
      const other = t.browser();
      await other.signIn(email);
      return other.post('/api/auth/two-factor/verify-backup-code', { code: backupCodes[0] });
    };
    expect((await use()).status).toBe(200);
    expect((await use()).status).not.toBe(200);
  });

  it('activarlo y desactivarlo exige la contraseña', async () => {
    const { browser } = await signedIn();
    expect((await browser.post('/api/auth/two-factor/enable', { password: 'no es esta 12345' })).status).toBe(400);
    await enableTwoFactor(browser);
    expect((await browser.post('/api/auth/two-factor/disable', { password: 'no es esta 12345' })).status).toBe(400);
    expect((await browser.get('/api/me')).body.twoFactorEnabled).toBe(true);
  });

  it('el secreto y los códigos se guardan cifrados', async () => {
    const { email, browser } = await signedIn();
    const { backupCodes } = await enableTwoFactor(browser);
    const row = await t.prisma.twoFactor.findFirst({ where: { user: { email } } });
    expect(row?.backupCodes).not.toContain(backupCodes[0]);
    expect(row?.secret).not.toMatch(/^[A-Z2-7]{32}$/);
  });
});

describe('control de acceso', () => {
  it('deniega por defecto lo que nadie anotó', async () => {
    expect((await t.browser().get('/api/olvidado')).status).toBe(401);
  });

  it('una cookie inventada no da acceso', async () => {
    const res = await t.browser().get('/api/me', { cookie: '__Host-mp.session_token=inventado.firma' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatchObject({ code: 'UNAUTHORIZED', requestId: expect.any(String) });
  });

  it('la sesión vencida no da acceso', async () => {
    const { email, browser } = await signedIn();
    await t.prisma.session.updateMany({ where: { user: { email } }, data: { expiresAt: new Date(0) } });
    expect((await browser.get('/api/me')).status).toBe(401);
  });

  it.each(['customer', 'moderator'])('%s no lee la auditoría', async (role) => {
    const { browser } = await signedIn(role);
    if (role !== 'customer') await enableTwoFactor(browser);
    const res = await browser.get('/api/admin/audit');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('un administrador sin 2FA no entra', async () => {
    const { browser } = await signedIn('admin');
    const res = await browser.get('/api/admin/audit');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('TWO_FACTOR_REQUIRED');
  });

  it('un administrador con 2FA lee la auditoría', async () => {
    const { browser } = await signedIn('admin');
    await enableTwoFactor(browser);
    const res = await browser.get('/api/admin/audit?limit=5');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it('perder el rol retira el acceso de inmediato', async () => {
    const { email, browser } = await signedIn('admin');
    await enableTwoFactor(browser);
    expect((await browser.get('/api/admin/audit')).status).toBe(200);
    await t.prisma.user.update({ where: { email }, data: { platformRole: 'customer' } });
    expect((await browser.get('/api/admin/audit')).status).toBe(403);
  });

  it.each(['limit=abc', 'limit=0', 'cursor=no-es-uuid'])('valida los parámetros: %s', async (query) => {
    const { browser } = await signedIn('admin');
    await enableTwoFactor(browser);
    expect((await browser.get(`/api/admin/audit?${query}`)).status).toBe(400);
  });
});

describe('auditoría de identidad', () => {
  const actions = async (actorId: string) =>
    (await t.prisma.auditEvent.findMany({ where: { actorId }, orderBy: { id: 'asc' } })).map(({ action }) => action);

  it('deja rastro de entrar, activar 2FA y salir', async () => {
    const { email, browser } = await signedIn();
    const user = await t.prisma.user.findUniqueOrThrow({ where: { email } });
    await enableTwoFactor(browser);
    await browser.post('/api/auth/sign-out');
    expect(await actions(user.id)).toEqual(
      expect.arrayContaining(['auth.sign_up', 'auth.sign_in', 'auth.two_factor_enabled', 'auth.sign_out']),
    );
  });

  it('registra los fallos con IP y request-id, sin email ni contraseña', async () => {
    const email = newEmail();
    const res = await t.browser().post('/api/auth/sign-in/email', { email, password: PASSWORD }, { 'x-forwarded-for': '203.0.113.7' });
    const event = await t.prisma.auditEvent.findFirstOrThrow({ where: { requestId: res.headers['x-request-id'] as string } });
    expect(event).toMatchObject({ action: 'auth.sign_in_failed', ipAddress: '203.0.113.7', actorId: null });
    expect(JSON.stringify(event)).not.toMatch(new RegExp(`${email}|${PASSWORD}`));
  });

  it('el cliente no puede falsear la IP con cabeceras internas', async () => {
    const res = await t
      .browser()
      .post('/api/auth/sign-in/email', { email: newEmail(), password: PASSWORD }, { 'x-mp-client-ip': '1.2.3.4', 'x-mp-request-id': 'falso' });
    const event = await t.prisma.auditEvent.findFirstOrThrow({ where: { requestId: res.headers['x-request-id'] as string } });
    expect(event.ipAddress).not.toBe('1.2.3.4');
  });
});

describe('límite por IP', () => {
  it('corta los registros masivos desde una misma IP, pero no a las demás', async () => {
    const limited = await startIdentity(db.appUrl, {
      auth: { publicUrl: 'https://market.test', secret: 'y'.repeat(48), brandName: 'Prueba', rateLimit: true },
    });
    try {
      const from = (ip: string) =>
        limited.browser().post('/api/auth/sign-up/email', { name: 'P', email: newEmail(), password: PASSWORD }, { 'x-forwarded-for': ip });
      const statuses: number[] = [];
      for (let i = 0; i < 8; i += 1) statuses.push((await from('198.51.100.1')).status);
      expect(statuses).toContain(429);
      expect((await from('198.51.100.2')).status).toBe(200);
    } finally {
      await limited.stop();
    }
  });
});
