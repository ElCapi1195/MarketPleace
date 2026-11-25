import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Secret, TOTP } from 'otpauth';
import request from 'supertest';
import { createApp, type AppOptions } from '../../src/app.js';
import { createPrisma, type Prisma } from '../../src/database/prisma.js';
import type { Mail, Mailer } from '../../src/modules/mail/mailer.js';

export const ORIGIN = 'https://market.test';
export const PASSWORD = 'Una frase larga y rara 41';

export class FakeMailer implements Mailer {
  readonly sent: Mail[] = [];

  async send(mail: Mail): Promise<void> {
    this.sent.push(mail);
  }

  /** Último enlace recibido por esa dirección. */
  link(to: string): URL {
    const mail = this.sent.findLast((item) => item.to === to);
    const url = mail?.text.match(/https:\/\/\S+/)?.[0];
    if (!url) throw new Error(`Sin correo con enlace para ${to}`);
    return new URL(url);
  }
}

/** Cliente HTTP que se comporta como un navegador: guarda cookies y envía Origin. */
export class Browser {
  private readonly cookies = new Map<string, string>();

  constructor(private readonly app: NestExpressApplication) {}

  async send(method: 'get' | 'post', url: string, body?: object, headers: Record<string, string> = {}) {
    const req = request(this.app.getHttpServer())[method](url).redirects(0).set('origin', ORIGIN).set(headers);
    if (this.cookies.size > 0) req.set('cookie', [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; '));
    const res = await (body === undefined ? req : req.send(body));
    for (const line of this.setCookies(res)) {
      const [name = '', value = ''] = (line.split(';')[0] ?? '').split(/=(.*)/s);
      if (value === '' || /max-age=0/i.test(line)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return res;
  }

  get = (url: string, headers?: Record<string, string>) => this.send('get', url, undefined, headers);
  post = (url: string, body: object = {}, headers?: Record<string, string>) => this.send('post', url, body, headers);

  setCookies(res: request.Response): string[] {
    return (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
  }

  signIn = (email: string, password = PASSWORD) => this.post('/api/auth/sign-in/email', { email, password });
}

export interface TestIdentity {
  app: NestExpressApplication;
  prisma: Prisma;
  mailer: FakeMailer;
  browser(): Browser;
  /** Crea una cuenta verificada y devuelve su email. */
  account(role?: string): Promise<string>;
  stop(): Promise<void>;
}

export const newEmail = () => `${randomUUID()}@example.test`;

export async function startIdentity(appUrl: string, overrides: Partial<AppOptions> = {}): Promise<TestIdentity> {
  const prisma = createPrisma(appUrl);
  const mailer = new FakeMailer();
  const app = await createApp({
    probes: [],
    trustProxyHops: 1,
    logger: false,
    prisma,
    mailer,
    auth: { publicUrl: ORIGIN, secret: 'x'.repeat(48), brandName: 'Mercado de Prueba', rateLimit: false },
    ...overrides,
  });
  await app.init();
  const browser = () => new Browser(app);

  return {
    app,
    prisma,
    mailer,
    browser,
    account: async (role = 'customer') => {
      const email = newEmail();
      await browser().post('/api/auth/sign-up/email', { name: 'Persona', email, password: PASSWORD });
      await prisma.user.update({ where: { email }, data: { emailVerified: true, platformRole: role } });
      return email;
    },
    stop: async () => {
      await app.close();
      await prisma.$disconnect();
    },
  };
}

/** Activa 2FA en la sesión del navegador y devuelve el generador de códigos. */
export async function enableTwoFactor(browser: Browser): Promise<{ code: () => string; backupCodes: string[] }> {
  const { body } = await browser.post('/api/auth/two-factor/enable', { password: PASSWORD });
  const secret = new URL(body.totpURI).searchParams.get('secret') ?? '';
  const totp = new TOTP({ secret: Secret.fromBase32(secret) });
  await browser.post('/api/auth/two-factor/verify-totp', { code: totp.generate() });
  return { code: () => totp.generate(), backupCodes: body.backupCodes };
}
