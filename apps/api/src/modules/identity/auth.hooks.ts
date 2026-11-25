import { Logger } from '@nestjs/common';
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import type { AuditService } from '../audit/audit.service.js';
import { TooManyAttemptsError, type LoginThrottle } from './login-throttle.service.js';
import { passwordProblem } from './password.js';

export const CLIENT_IP_HEADER = 'x-mp-client-ip';
export const REQUEST_ID_HEADER = 'x-mp-request-id';

const AUDITED = new Map([
  ['/sign-up/email', 'auth.sign_up'],
  ['/sign-in/email', 'auth.sign_in'],
  ['/sign-out', 'auth.sign_out'],
  ['/verify-email', 'auth.email_verified'],
  ['/change-password', 'auth.password_changed'],
  ['/revoke-session', 'auth.session_revoked'],
  ['/revoke-sessions', 'auth.session_revoked'],
  ['/revoke-other-sessions', 'auth.session_revoked'],
  ['/two-factor/disable', 'auth.two_factor_disabled'],
  ['/two-factor/generate-backup-codes', 'auth.backup_codes_renewed'],
  ['/two-factor/verify-totp', 'auth.two_factor_passed'],
  ['/two-factor/verify-backup-code', 'auth.backup_code_used'],
]);

// Rutas en las que la sesión hace falta antes o después de que la librería la cargue o la destruya.
const NEEDS_SESSION = new Set(['/sign-out', '/change-password']);

/** Titular de la sesión al empezar la petición; al cerrarla ya no se puede consultar. */
const owners = new WeakMap<Request, { id: string; email: string }>();

const text = (value: unknown) => (typeof value === 'string' ? value : undefined);

const badRequest = (code: string, message: string) => new APIError('BAD_REQUEST', { code, message });

/** Reglas previas: política de contraseñas, límite por cuenta y campos que nunca se aceptan. */
export function beforeHook(throttle: LoginThrottle) {
  return createAuthMiddleware(async (ctx) => {
    const body = (ctx.body ?? {}) as Record<string, unknown>;
    const session = NEEDS_SESSION.has(ctx.path) ? await getSessionFromCtx(ctx) : null;
    if (session && ctx.request) owners.set(ctx.request, { id: session.user.id, email: session.user.email });

    if (body.image !== undefined) throw badRequest('IMAGE_NOT_ALLOWED', 'No se admite imagen.');
    if (body.trustDevice) throw badRequest('TRUST_DEVICE_NOT_ALLOWED', 'El segundo paso se pide siempre.');

    const candidate = text(ctx.path === '/sign-up/email' ? body.password : body.newPassword);
    if (candidate !== undefined) {
      const email = text(body.email) ?? session?.user.email;
      const problem = passwordProblem(candidate, email);
      if (problem) throw badRequest('WEAK_PASSWORD', problem);
    }

    const email = text(body.email);
    if (ctx.path === '/sign-in/email' && email !== undefined) {
      try {
        await throttle.begin(email);
      } catch (error) {
        if (!(error instanceof TooManyAttemptsError)) throw error;
        throw new APIError('TOO_MANY_REQUESTS', {
          code: 'TOO_MANY_ATTEMPTS',
          message: 'Demasiados intentos. Espera 15 minutos o restablece tu contraseña.',
        });
      }
    }
  });
}

/** Deja rastro de lo ocurrido. Un fallo de auditoría se registra, pero no rompe una sesión ya creada. */
export function afterHook(throttle: LoginThrottle, audit: AuditService) {
  const logger = new Logger('AuditoriaIdentidad');
  return createAuthMiddleware(async (ctx) => {
    const result: unknown = ctx.context.returned;
    const failed = result instanceof APIError;
    const email = text((ctx.body as Record<string, unknown> | undefined)?.email);

    if (ctx.path === '/sign-in/email' && !failed && email !== undefined) await throttle.clear(email);

    const action = AUDITED.get(ctx.path);
    if (action === undefined) return;
    const signInFailed = ctx.path === '/sign-in/email' && failed;
    if (failed && !signInFailed) return;

    const returnedUser = (result as { user?: { id?: unknown } } | undefined)?.user?.id;
    const owner = ctx.request && owners.get(ctx.request);
    const actorId = ctx.context.newSession?.user.id ?? ctx.context.session?.user.id ?? owner?.id ?? text(returnedUser);
    try {
      await audit.record({
        action: signInFailed ? 'auth.sign_in_failed' : action,
        ...(!signInFailed && actorId !== undefined && { actorId, targetType: 'user', targetId: actorId }),
        ipAddress: ctx.headers?.get(CLIENT_IP_HEADER) ?? undefined,
        requestId: ctx.headers?.get(REQUEST_ID_HEADER) ?? undefined,
        metadata: signInFailed && email !== undefined ? { account: throttle.fingerprint(email) } : {},
      });
    } catch (error) {
      logger.error(`No se pudo auditar ${action}: ${error instanceof Error ? error.name : 'error'}`);
    }
  });
}
