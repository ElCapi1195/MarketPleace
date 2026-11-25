import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { newEmail, ORIGIN, PASSWORD, startIdentity, type TestIdentity } from './support/identity.js';

let db: TestDatabase;
let t: TestIdentity;

beforeAll(async () => {
  db = await createTestDatabase();
  t = await startIdentity(db.appUrl);
}, 90_000);

afterAll(async () => {
  await t?.stop();
  await db?.stop();
}, 30_000);

const signUp = (body: object) => t.browser().post('/api/auth/sign-up/email', { name: 'Persona', password: PASSWORD, ...body });

describe('registro', () => {
  it('no abre sesión hasta verificar el email', async () => {
    const email = newEmail();
    const browser = t.browser();
    const res = await browser.post('/api/auth/sign-up/email', { name: 'Persona', email, password: PASSWORD });
    expect(res.status).toBe(200);
    expect((await browser.get('/api/me')).status).toBe(401);
    expect((await browser.signIn(email)).status).toBe(403);
  });

  it('el enlace del correo verifica la cuenta', async () => {
    const email = newEmail();
    await signUp({ email });
    const link = t.mailer.link(email);
    expect(link.origin).toBe(ORIGIN);
    const browser = t.browser();
    await browser.get(link.pathname + link.search);
    expect((await browser.signIn(email)).status).toBe(200);
    expect((await browser.get('/api/me')).body).toMatchObject({ email, platformRole: 'customer', twoFactorEnabled: false });
  });

  it('un email existente recibe la misma respuesta que uno nuevo', async () => {
    const email = await t.account();
    const existing = await signUp({ email });
    const fresh = await signUp({ email: newEmail() });
    expect(existing.status).toBe(fresh.status);
    expect(Object.keys(existing.body).sort()).toEqual(Object.keys(fresh.body).sort());
    expect(Object.keys(existing.body.user).sort()).toEqual(Object.keys(fresh.body.user).sort());
    expect(existing.headers['set-cookie']).toBeUndefined();
  });

  it('registrar un email existente no cambia su contraseña', async () => {
    const email = await t.account();
    await signUp({ email, password: 'Otra frase distinta 99' });
    expect((await t.browser().signIn(email)).status).toBe(200);
  });

  it.each([{ platformRole: 'admin' }, { emailVerified: true }, { twoFactorEnabled: true }])(
    'el cliente no puede fijar %j',
    async (extra) => {
      const email = newEmail();
      await signUp({ email, ...extra });
      const user = await t.prisma.user.findUnique({ where: { email } });
      for (const [key, value] of Object.entries(extra)) expect(user?.[key as 'platformRole']).not.toBe(value);
    },
  );

  it.each([
    ['corta', 'Corta1234'],
    ['de un solo carácter', 'aaaaaaaaaaaaaaaa'],
    ['muy común', 'password12345'],
    ['demasiado larga', 'x1'.repeat(80)],
  ])('rechaza una contraseña %s', async (_name, password) => {
    expect((await signUp({ email: newEmail(), password })).status).toBe(400);
  });

  it('rechaza una contraseña que contiene el propio email', async () => {
    expect((await signUp({ email: 'margarita@example.test', password: 'Margarita-2026-x' })).status).toBe(400);
  });

  it('rechaza imágenes externas en el perfil', async () => {
    expect((await signUp({ email: newEmail(), image: 'https://rastreador.example/x.png' })).status).toBe(400);
  });

  it('guarda la contraseña con Argon2id', async () => {
    const email = await t.account();
    const account = await t.prisma.account.findFirst({ where: { user: { email } } });
    expect(account?.password).toMatch(/^\$argon2id\$v=19\$m=\d+,t=\d+,p=\d+\$/);
  });
});

describe('inicio de sesión', () => {
  it('la cookie es __Host-, HttpOnly, Secure y SameSite=Lax, sin dominio', async () => {
    const browser = t.browser();
    const cookies = browser.setCookies(await browser.signIn(await t.account()));
    expect(cookies.length).toBeGreaterThan(0);
    for (const cookie of cookies) {
      expect(cookie).toMatch(/^__Host-/);
      expect(cookie).toMatch(/httponly/i);
      expect(cookie).toMatch(/secure/i);
      expect(cookie).toMatch(/samesite=lax/i);
      expect(cookie).toMatch(/path=\/(;|$)/i);
      expect(cookie).not.toMatch(/domain=/i);
    }
  });

  it('cuenta inexistente y contraseña errónea responden igual', async () => {
    const wrong = await t.browser().signIn(await t.account(), 'Contraseña equivocada 1');
    const missing = await t.browser().signIn(newEmail(), 'Contraseña equivocada 1');
    expect(missing.status).toBe(wrong.status);
    expect(missing.body).toEqual(wrong.body);
  });

  it('bloquea la cuenta tras varios fallos, aunque cambien las mayúsculas', async () => {
    const email = await t.account();
    for (let i = 0; i < 8; i += 1) await t.browser().signIn(i % 2 ? email.toUpperCase() : email, 'Contraseña equivocada 1');
    const blocked = await t.browser().signIn(email);
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('TOO_MANY_ATTEMPTS');
  });

  it('el bloqueo responde igual si la cuenta no existe', async () => {
    const email = newEmail();
    for (let i = 0; i < 8; i += 1) await t.browser().signIn(email);
    expect((await t.browser().signIn(email)).status).toBe(429);
  });

  it('consultar la sesión sin haber entrado responde null, sin error', async () => {
    const res = await t.browser().get('/api/auth/get-session');
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it('consultar la sesión no revela el token de la cookie ni otros secretos', async () => {
    const browser = t.browser();
    await browser.signIn(await t.account());
    expect(JSON.stringify((await browser.get('/api/auth/get-session')).body)).not.toMatch(/password|secret|backupCodes/i);
  });

  it('cerrar sesión la invalida en el servidor', async () => {
    const browser = t.browser();
    const email = await t.account();
    await browser.signIn(email);
    await browser.post('/api/auth/sign-out');
    expect(await t.prisma.session.count({ where: { user: { email } } })).toBe(0);
    expect((await browser.get('/api/me')).status).toBe(401);
  });

  it('se puede cerrar la sesión de otro equipo', async () => {
    const email = await t.account();
    const [mine, other] = [t.browser(), t.browser()];
    await mine.signIn(email);
    await other.signIn(email);
    expect((await mine.post('/api/auth/revoke-other-sessions')).status).toBe(200);
    expect((await other.get('/api/me')).status).toBe(401);
    expect((await mine.get('/api/me')).status).toBe(200);
  });
});

describe('contraseña', () => {
  it('restablecerla cierra todas las sesiones y el enlace sirve una sola vez', async () => {
    const email = await t.account();
    const browser = t.browser();
    await browser.signIn(email);
    await t.browser().post('/api/auth/request-password-reset', { email });
    const token = t.mailer.link(email).hash.replace('#token=', '');
    const reset = (newPassword: string) => t.browser().post('/api/auth/reset-password', { newPassword, token });

    expect((await reset('Nueva frase segura 2026')).status).toBe(200);
    expect((await browser.get('/api/me')).status).toBe(401);
    expect((await t.browser().signIn(email)).status).toBe(401);
    expect((await t.browser().signIn(email, 'Nueva frase segura 2026')).status).toBe(200);
    expect((await reset('Tercera frase segura 2026')).status).toBe(400);
  });

  it('restablecerla también respeta la política', async () => {
    const email = await t.account();
    await t.browser().post('/api/auth/request-password-reset', { email });
    const token = t.mailer.link(email).hash.replace('#token=', '');
    expect((await t.browser().post('/api/auth/reset-password', { newPassword: 'password12345', token })).status).toBe(400);
  });

  it('pedirlo para una cuenta inexistente responde igual y no envía nada', async () => {
    const missing = newEmail();
    const a = await t.browser().post('/api/auth/request-password-reset', { email: missing });
    const b = await t.browser().post('/api/auth/request-password-reset', { email: await t.account() });
    expect(a.status).toBe(b.status);
    expect(a.body).toEqual(b.body);
    expect(() => t.mailer.link(missing)).toThrow();
  });

  it('cambiarla exige la actual y puede cerrar las demás sesiones', async () => {
    const email = await t.account();
    const [mine, other] = [t.browser(), t.browser()];
    await mine.signIn(email);
    await other.signIn(email);
    const change = (currentPassword: string) =>
      mine.post('/api/auth/change-password', { currentPassword, newPassword: 'Nueva frase segura 2026', revokeOtherSessions: true });
    expect((await change('no es esta 12345')).status).toBe(400);
    expect((await change(PASSWORD)).status).toBe(200);
    expect((await other.get('/api/me')).status).toBe(401);
  });
});

describe('política al cambiar la contraseña', () => {
  it('también rechaza la que contiene el propio email', async () => {
    const email = await t.account();
    const browser = t.browser();
    await browser.signIn(email);
    const newPassword = `${email.split('@')[0]}-X`;
    const res = await browser.post('/api/auth/change-password', { currentPassword: PASSWORD, newPassword });
    expect(res.body.code).toBe('WEAK_PASSWORD');
  });
});

describe('cuerpos de petición', () => {
  it('rechaza formatos que no son JSON', async () => {
    const res = await t.browser().post('/api/auth/sign-in/email', 'email=a' as never, { 'content-type': 'application/x-www-form-urlencoded' });
    expect(res.status).toBe(415);
  });

  it('limita el tamaño', async () => {
    expect((await signUp({ email: newEmail(), name: 'x'.repeat(200_000) })).status).toBe(413);
  });
});

describe('origen y redirecciones', () => {
  it.each([{ origin: 'https://malo.example' }, { origin: 'null' }])('rechaza peticiones de %j', async (headers) => {
    const email = await t.account();
    const res = await t.browser().post('/api/auth/sign-in/email', { email, password: PASSWORD }, headers);
    expect(res.status).toBe(403);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('no redirige a otro dominio tras verificar', async () => {
    const email = newEmail();
    const res = await signUp({ email, callbackURL: 'https://malo.example/' });
    expect(res.status).toBe(403);
  });

  it.each(['/api/auth/sign-in/social', '/api/auth/change-email', '/api/auth/delete-user'])('%s está desactivada', async (path) => {
    const browser = t.browser();
    await browser.signIn(await t.account());
    expect((await browser.post(path, { provider: 'google', newEmail: newEmail() })).status).toBe(404);
  });
});
