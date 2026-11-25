import { Catch, HttpException, HttpStatus, Logger, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

const INTERNAL = { code: 'INTERNAL_ERROR', message: 'Ha ocurrido un error inesperado.' };

/** Estado HTTP de un error, incluidos los de los parsers de Express (`http-errors`). */
function statusOf(error: unknown): number {
  if (error instanceof HttpException) return error.getStatus();
  if (error instanceof Error && 'expose' in error && error.expose === true && 'status' in error) {
    const { status } = error;
    if (typeof status === 'number' && status >= 400 && status < 500) return status;
  }
  return HttpStatus.INTERNAL_SERVER_ERROR;
}

/** Código estable para el cliente: el propio de la excepción o, si no tiene, el nombre del estado. */
function codeOf(error: unknown, status: number): string {
  const body = error instanceof HttpException ? error.getResponse() : null;
  if (typeof body === 'object' && body !== null && 'code' in body && typeof body.code === 'string') return body.code;
  return HttpStatus[status] ?? 'REQUEST_ERROR';
}

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const requestId: unknown = res.locals.requestId;
    const status = statusOf(error);

    if (status >= 500) {
      this.logger.error(
        { requestId, name: error instanceof Error ? error.name : typeof error },
        error instanceof Error ? error.stack : undefined,
      );
    }
    if (res.headersSent) {
      res.end();
      return;
    }

    const body =
      status >= 500
        ? INTERNAL
        : {
            code: codeOf(error, status),
            message: error instanceof HttpException ? error.message : 'La solicitud no es válida.',
          };
    res.status(status).json({ error: { ...body, requestId } });
  }
}
