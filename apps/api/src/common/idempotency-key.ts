import { idempotencyKey } from '@marketplace/contracts';
import { BadRequestException, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** Clave con la que el cliente puede repetir una petición sin duplicar su efecto. */
export const IdempotencyKey = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  const result = idempotencyKey.safeParse(context.switchToHttp().getRequest<Request>().headers['idempotency-key']);
  if (!result.success) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Falta la cabecera Idempotency-Key.' });
  return result.data.toLowerCase();
});
