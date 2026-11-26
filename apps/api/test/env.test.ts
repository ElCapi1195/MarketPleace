import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env.js';

const valid = {
  NODE_ENV: 'production',
  VERTICAL: 'demo',
  DATABASE_URL: 'postgresql://app:secreto-db@postgres:5432/marketplace',
  REDIS_URL: 'redis://:secreto-redis@redis:6379',
  PUBLIC_URL: 'https://market.test',
  AUTH_SECRET: 'k'.repeat(48),
  MEDIA_DIR: '/data/media',
  SMTP_URL: 'smtp://correo.test:587',
};

describe('parseEnv', () => {
  it('acepta un entorno válido y aplica valores por defecto', () => {
    expect(parseEnv(valid)).toMatchObject({ HOST: '0.0.0.0', PORT: 3001, TRUST_PROXY_HOPS: 1, VERTICAL: 'demo' });
  });

  it.each(['VERTICAL', 'DATABASE_URL', 'REDIS_URL', 'NODE_ENV', 'PUBLIC_URL', 'AUTH_SECRET', 'MEDIA_DIR', 'SMTP_URL'])('exige %s', (key) => {
    expect(() => parseEnv({ ...valid, [key]: undefined })).toThrow(key);
  });

  it('rechaza un nicho desconocido', () => {
    expect(() => parseEnv({ ...valid, VERTICAL: 'no-existe' })).toThrow(/VERTICAL/);
  });

  it('rechaza un puerto inválido', () => {
    expect(() => parseEnv({ ...valid, PORT: '70000' })).toThrow(/PORT/);
  });

  it.each([
    ['PUBLIC_URL', 'http://market.test'],
    ['AUTH_SECRET', 'corto'],
    ['AUTH_SECRET', 'valor-de-ejemplo-que-debes-cambiar-ya-mismo'],
  ])('en producción rechaza %s=%s', (key, value) => {
    expect(() => parseEnv({ ...valid, [key]: value })).toThrow(key);
  });

  it('en desarrollo permite http y prescindir de SMTP', () => {
    const env = parseEnv({ ...valid, NODE_ENV: 'development', PUBLIC_URL: 'http://localhost:4310/', SMTP_URL: undefined });
    expect(env.PUBLIC_URL).toBe('http://localhost:4310');
  });

  it('no filtra secretos en el mensaje de error', () => {
    const run = () => parseEnv({ ...valid, DATABASE_URL: 'mysql://root:secreto-db@host/db' });
    expect(run).toThrow(/DATABASE_URL/);
    expect(run).not.toThrow(/secreto-db/);
  });
});
