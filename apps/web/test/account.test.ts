import { afterEach, describe, expect, it, vi } from 'vitest';
import { post } from '../lib/client-api';
import { messageFor } from '../features/account/lib/messages';
import { safeNext } from '../features/account/lib/safe-next';
import { describeAgent } from '../features/account/lib/user-agent';
import { parseTotpUri } from '../features/account/lib/totp';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('safeNext', () => {
  it.each(['/cuenta', '/preventas/uno?x=1'])('acepta la ruta interna %s', (path) => {
    expect(safeNext(path)).toBe(path);
  });

  it.each([null, '', 'https://malo.example', '//malo.example', '/\\malo.example', '/\t/malo.example', 'javascript:alert(1)', 'cuenta'])(
    'descarta %j',
    (path) => {
      expect(safeNext(path)).toBe('/cuenta');
    },
  );

  it.each(['/entrar', '/segundo-paso?a=1', '/registro'])('no vuelve a una pantalla de acceso: %s', (path) => {
    expect(safeNext(path)).toBe('/cuenta');
  });
});

describe('messageFor', () => {
  it('explica los errores conocidos en lenguaje claro', () => {
    expect(messageFor('INVALID_EMAIL_OR_PASSWORD')).toMatch(/correo o la contraseña/i);
    expect(messageFor('TOO_MANY_ATTEMPTS')).toMatch(/15 minutos/);
  });

  it('usa el motivo del servidor para una contraseña débil', () => {
    expect(messageFor('WEAK_PASSWORD', 'No incluyas tu correo.')).toBe('No incluyas tu correo.');
  });

  it.each([undefined, 'ALGO_NUEVO', '__proto__', 'constructor'])('ante %j da un mensaje genérico y no el del servidor', (code) => {
    expect(messageFor(code, 'detalle técnico')).toMatch(/Inténtalo de nuevo/);
  });
});

describe('post', () => {
  const respond = (status: number, body: unknown) =>
    vi.stubGlobal('fetch', vi.fn(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })));

  it('devuelve los datos si todo va bien', async () => {
    respond(200, { token: 'x' });
    expect(await post('/api/auth/x', {})).toEqual({ ok: true, data: { token: 'x' } });
  });

  it('entiende los dos formatos de error', async () => {
    respond(400, { code: 'WEAK_PASSWORD', message: 'm' });
    expect(await post('/api/auth/x', {})).toMatchObject({ ok: false, code: 'WEAK_PASSWORD', message: 'm' });
    respond(403, { error: { code: 'FORBIDDEN', message: 'n' } });
    expect(await post('/api/x', {})).toMatchObject({ ok: false, code: 'FORBIDDEN', message: 'n' });
  });

  it('reconoce el límite por IP, que no trae código', async () => {
    respond(429, { message: 'Too many requests.' });
    expect(await post('/api/auth/x', {})).toMatchObject({ ok: false, code: 'RATE_LIMITED' });
  });

  it('no se rompe si la respuesta no es JSON o no hay red', async () => {
    respond(502, '<html>');
    expect(await post('/api/auth/x', {})).toMatchObject({ ok: false, status: 502 });
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('red'))));
    expect(await post('/api/auth/x', {})).toMatchObject({ ok: false, code: 'NETWORK' });
  });
});

describe('parseTotpUri', () => {
  it('extrae la clave en grupos legibles', () => {
    expect(parseTotpUri('otpauth://totp/M:a?secret=ABCDEFGHIJKL&issuer=M')?.groups).toEqual(['ABCD', 'EFGH', 'IJKL']);
  });

  it.each(['', 'https://malo.example?secret=A', 'otpauth://totp/x'])('descarta %j', (uri) => {
    expect(parseTotpUri(uri)).toBeNull();
  });
});

describe('describeAgent', () => {
  it('resume el navegador y el sistema', () => {
    const chrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
    expect(describeAgent(chrome)).toBe('Chrome en Windows');
    expect(describeAgent(`${chrome} Edg/140.0`)).toBe('Edge en Windows');
  });

  it.each([null, undefined, '', 'curl/8'])('ante %j no inventa', (agent) => {
    expect(describeAgent(agent)).toBe('Dispositivo desconocido');
  });
});
