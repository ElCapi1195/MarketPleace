import { can, requiresTwoFactor, storeCan, type Permission, type StorePermission } from '@marketplace/core';
import {
  createParamDecorator,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  SetMetadata,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { AUTH, type Auth } from './auth.js';

const PUBLIC = 'access:public';
const PERMISSION = 'access:permission';
const STORE = 'access:store';
const TWO_FACTOR = 'access:two-factor';

/** Ruta accesible sin sesión. Todo lo demás la exige. */
export const Public = () => SetMetadata(PUBLIC, true);

/** Exige un permiso de plataforma y, por tanto, 2FA activo. */
export const RequirePermission = (permission: Permission) => SetMetadata(PERMISSION, permission);

/** Exige ser miembro de la tienda `:storeId` con ese permiso, y 2FA activo. */
export const RequireStore = (permission: StorePermission) => SetMetadata(STORE, permission);

/** Exige 2FA activo, sea cual sea el rol. */
export const RequireTwoFactor = () => SetMetadata(TWO_FACTOR, true);

export interface CurrentUserData {
  id: string;
  name: string;
  email: string;
  platformRole: string;
  twoFactorEnabled: boolean;
}

/** Tienda de la ruta, ya comprobada, y el papel de quien la usa. */
export interface CurrentStoreData {
  id: string;
  role: string;
  status: string;
}

/** Consulta de membresías; la implementa el módulo de tiendas. */
export interface MembershipReader {
  find(storeId: string, userId: string): Promise<{ role: string; status: string } | null>;
}

export const MEMBERSHIPS = Symbol('MEMBERSHIPS');

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentUserData => context.switchToHttp().getResponse<Response>().locals.user,
);

export const CurrentStore = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentStoreData => context.switchToHttp().getResponse<Response>().locals.store,
);

const forbidden = () => new ForbiddenException({ code: 'FORBIDDEN', message: 'No tienes permiso.' });
const twoFactorRequired = () =>
  new ForbiddenException({ code: 'TWO_FACTOR_REQUIRED', message: 'Activa el segundo paso para continuar.' });
const uuid = z.uuid();

/** Guard global: deniega por defecto y consulta la sesión, el rol y la membresía en cada petición. */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AUTH) private readonly auth: Auth,
    @Inject(MEMBERSHIPS) private readonly memberships: MembershipReader,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const read = <T>(key: string) => this.reflector.getAllAndOverride<T | undefined>(key, targets);
    if (read<boolean>(PUBLIC)) return true;

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const { locals } = http.getResponse<Response>();
    const user = await this.user(request);

    const permission = read<Permission>(PERMISSION);
    if (permission !== undefined) {
      if (!can(user.platformRole, permission)) throw forbidden();
      if (requiresTwoFactor(user.platformRole) && !user.twoFactorEnabled) throw twoFactorRequired();
    }
    if (read<boolean>(TWO_FACTOR) && !user.twoFactorEnabled) throw twoFactorRequired();
    const storePermission = read<StorePermission>(STORE);
    if (storePermission !== undefined) locals.store = await this.store(user, request.params.storeId, storePermission);

    locals.user = user;
    return true;
  }

  private async user(request: Request): Promise<CurrentUserData> {
    const session = await this.auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
      query: { disableCookieCache: true },
    });
    if (!session) throw new UnauthorizedException('Inicia sesión para continuar.');
    const { id, name, email, platformRole, twoFactorEnabled } = session.user;
    return { id, name, email, platformRole: platformRole ?? '', twoFactorEnabled: twoFactorEnabled ?? false };
  }

  /** Una tienda ajena responde como si no existiera. */
  private async store(user: CurrentUserData, storeId: unknown, permission: StorePermission): Promise<CurrentStoreData> {
    const id = uuid.safeParse(storeId);
    const membership = id.success ? await this.memberships.find(id.data.toLowerCase(), user.id) : null;
    if (!id.success || !membership) throw new NotFoundException({ code: 'NOT_FOUND', message: 'No existe.' });
    if (!user.twoFactorEnabled) throw twoFactorRequired();
    if (!storeCan(membership.role, permission)) throw forbidden();
    return { id: id.data.toLowerCase(), ...membership };
  }
}
