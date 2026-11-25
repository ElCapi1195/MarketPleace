import { toNodeHandler } from 'better-auth/node';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Auth } from './auth.js';
import { CLIENT_IP_HEADER, REQUEST_ID_HEADER } from './auth.hooks.js';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

function reject(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ code, message, error: { code, message, requestId: res.locals.requestId } });
}

/**
 * Protección CSRF para toda la API: una petición que modifica debe venir de nuestro origen.
 * Sin Origin solo se admite si no trae cookies, es decir, si no puede suplantar a nadie.
 */
export function sameOrigin(publicUrl: string): RequestHandler {
  const allowed = new URL(publicUrl).origin;
  return (req: Request, res: Response, next: NextFunction) => {
    if (SAFE.has(req.method)) return next();
    const { origin } = req.headers;
    if (origin === undefined ? req.headers.cookie === undefined : origin === allowed) return next();
    reject(res, 403, 'INVALID_ORIGIN', 'Origen no permitido.');
  };
}

/** Monta la autenticación. Debe ir después del parser JSON, que es quien limita el tamaño del cuerpo. */
export function authRoutes(auth: Auth): RequestHandler {
  const handler = toNodeHandler(auth);
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/api/auth/')) return next();
    const hasBody = req.headers['transfer-encoding'] !== undefined || Number(req.headers['content-length'] ?? 0) > 0;
    if (hasBody && !req.is('application/json')) {
      return reject(res, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Envía JSON.');
    }
    // Se sobrescriben siempre: el cliente no puede falsear su IP ni el id de la petición.
    req.headers[CLIENT_IP_HEADER] = req.ip ?? '';
    req.headers[REQUEST_ID_HEADER] = String(res.locals.requestId);
    handler(req, res).catch(next);
  };
}
