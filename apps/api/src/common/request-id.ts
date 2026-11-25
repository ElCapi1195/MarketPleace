import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/** Siempre genera el id: aceptar el del cliente permitiría falsear la trazabilidad de los logs. */
export function requestId(_req: Request, res: Response, next: NextFunction): void {
  const id = randomUUID();
  res.locals.requestId = id;
  res.setHeader('x-request-id', id);
  next();
}
