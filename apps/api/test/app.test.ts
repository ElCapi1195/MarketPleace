import { Controller, Get, HttpException } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { loadVertical } from '@marketplace/verticals';
import { memoryStorage } from './support/storage.js';
import { createApp } from '../src/app.js';
import { createPrisma } from '../src/database/prisma.js';
import { Public } from '../src/modules/identity/access.js';
import type { HealthProbe } from '../src/modules/health/health.probes.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

@Public()
@Controller('boom')
class BoomController {
  @Get('unexpected')
  unexpected(): never {
    throw new Error('password=secreto-interno');
  }

  @Get('http-500')
  http500(): never {
    throw new HttpException('detalle-interno', 500);
  }
}

const probe = (name: string, check: () => Promise<void>): HealthProbe => ({
  name,
  check,
  close: async () => {},
});
const ok = (name: string) => probe(name, async () => {});

let app: NestExpressApplication | undefined;

async function start(probes: HealthProbe[] = [ok('postgres'), ok('redis')]) {
  app = await createApp({
    probes,
    trustProxyHops: 1,
    controllers: [BoomController],
    logger: false,
    // Nunca llega a conectarse: estas pruebas no tocan la base de datos.
    prisma: createPrisma('postgresql://nadie@127.0.0.1:1/nada'),
    mailer: { send: async () => {} },
    storage: memoryStorage(),
    documents: memoryStorage(),
    vertical: loadVertical('demo'),
    auth: { publicUrl: 'https://market.test', secret: 'x'.repeat(48), brandName: 'Prueba', rateLimit: false },
  });
  await app.init();
  return request(app.getHttpServer());
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('salud', () => {
  it('GET /api/health responde sin consultar dependencias', async () => {
    const http = await start([probe('postgres', () => Promise.reject(new Error('caída')))]);
    const res = await http.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /api/health/ready responde 200 si todo funciona', async () => {
    const res = await (await start()).get('/api/health/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', checks: { postgres: 'up', redis: 'up' } });
  });

  it('responde 503 sin detalles si una dependencia falla', async () => {
    const failing = probe('postgres', () => Promise.reject(new Error('host 10.0.0.1')));
    const res = await (await start([failing, ok('redis')])).get('/api/health/ready');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'error', checks: { postgres: 'down', redis: 'up' } });
  });

  it('responde 503 en menos de 2 s si una dependencia se cuelga', async () => {
    const hung = probe('redis', () => new Promise<void>(() => {}));
    const http = await start([ok('postgres'), hung]);
    const startedAt = Date.now();
    const res = await http.get('/api/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.checks).toEqual({ postgres: 'up', redis: 'down' });
    expect(Date.now() - startedAt).toBeLessThan(2000);
  });
});

describe('errores', () => {
  it('404 usa el formato uniforme', async () => {
    const res = await (await start()).get('/api/no-existe');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: expect.any(String), requestId: res.headers['x-request-id'] },
    });
  });

  it.each(['unexpected', 'http-500'])('500 (%s) no filtra detalles internos', async (path) => {
    const res = await (await start()).get(`/api/boom/${path}`);
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.text).not.toMatch(/secreto-interno|detalle-interno|stack|\.ts/);
  });

  it('un JSON malformado responde 400 con formato uniforme', async () => {
    const res = await (await start())
      .post('/api/health')
      .set('content-type', 'application/json')
      .send('{"a":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('un cuerpo excesivo responde 413 con formato uniforme', async () => {
    const res = await (await start()).post('/api/health').send({ a: 'x'.repeat(200_000) });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('cabeceras', () => {
  it('genera el request-id e ignora el del cliente', async () => {
    const res = await (await start()).get('/api/health').set('x-request-id', 'falso inyectado');
    expect(res.headers['x-request-id']).toMatch(UUID);
  });

  it('aplica cabeceras de seguridad y oculta la tecnología', async () => {
    const { headers } = await (await start()).get('/api/health');
    expect(headers['x-powered-by']).toBeUndefined();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['content-security-policy']).toContain("default-src 'none'");
    expect(headers['cache-control']).toBe('no-store');
  });

  it('no habilita CORS', async () => {
    const res = await (await start()).get('/api/health').set('origin', 'https://otro.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
