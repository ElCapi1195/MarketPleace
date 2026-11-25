import { can, requiresTwoFactor, type Permission } from '@marketplace/core';
import {
  createParamDecorator,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request, Response } from 'express';
import { AUTH, type Auth } from './auth.js';

const PUBLIC = 'access:public';
const PERMISSION = 'access:permission';

/** Ruta accesible sin sesión. Todo lo demás la exige. */
export const Public = () => SetMetadata(PUBLIC, true);

/** Exige un permiso de plataforma y, por tanto, 2FA activo. */
export const RequirePermission = (permission: Permission) => SetMetadata(PERMISSION, permission);

export interface CurrentUserData {
  id: string;
  name: string;
  email: string;
  platformRole: string;
  twoFactorEnabled: boolean;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentUserData => context.switchToHttp().getResponse<Response>().locals.user,
);

/** Guard global: deniega por defecto y consulta la sesión y el rol en cada petición. */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AUTH) private readonly auth: Auth,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean | undefined>(PUBLIC, targets)) return true;

    const http = context.switchToHttp();
    const session = await this.auth.api.getSession({
      headers: fromNodeHeaders(http.getRequest<Request>().headers),
      query: { disableCookieCache: true },
    });
    if (!session) throw new UnauthorizedException('Inicia sesión para continuar.');

    const { id, name, email, platformRole, twoFactorEnabled } = session.user;
    const user: CurrentUserData = { id, name, email, platformRole: platformRole ?? '', twoFactorEnabled: twoFactorEnabled ?? false };

    const permission = this.reflector.getAllAndOverride<Permission | undefined>(PERMISSION, targets);
    if (permission !== undefined) {
      if (!can(user.platformRole, permission)) {
        throw new ForbiddenException({ code: 'FORBIDDEN', message: 'No tienes permiso.' });
      }
      if (requiresTwoFactor(user.platformRole) && !user.twoFactorEnabled) {
        throw new ForbiddenException({ code: 'TWO_FACTOR_REQUIRED', message: 'Activa el segundo paso para continuar.' });
      }
    }
    http.getResponse<Response>().locals.user = user;
    return true;
  }
}
