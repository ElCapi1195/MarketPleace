import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';

/** Quién hace la petición y desde dónde; se incluye en la auditoría. */
export interface ActorData {
  actorId: string;
  ipAddress?: string | undefined;
  requestId?: string | undefined;
}

export const Actor = createParamDecorator((_data: unknown, context: ExecutionContext): ActorData => {
  const http = context.switchToHttp();
  const { user, requestId } = http.getResponse<Response>().locals;
  return { actorId: user.id, ipAddress: http.getRequest<Request>().ip, requestId };
});
