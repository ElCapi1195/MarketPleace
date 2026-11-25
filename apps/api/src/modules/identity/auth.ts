import { Logger } from '@nestjs/common';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { twoFactor } from 'better-auth/plugins';
import type { Prisma } from '../../database/prisma.js';
import type { AuditService } from '../audit/audit.service.js';
import type { AuthEmails } from './auth.emails.js';
import { afterHook, beforeHook, CLIENT_IP_HEADER } from './auth.hooks.js';
import type { LoginThrottle } from './login-throttle.service.js';
import { hashPassword, MAX_LENGTH, MIN_LENGTH, verifyPassword } from './password.js';

export interface AuthConfig {
  publicUrl: string;
  secret: string;
  brandName: string;
  rateLimit: boolean;
}

interface AuthDeps {
  prisma: Prisma;
  emails: AuthEmails;
  throttle: LoginThrottle;
  audit: AuditService;
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Token de inyección de la instancia de autenticación. */
export const AUTH = Symbol('AUTH');
export type Auth = ReturnType<typeof createAuth>;

export function createAuth(config: AuthConfig, { prisma, emails, throttle, audit }: AuthDeps) {
  const logger = new Logger('Autenticacion');
  // El prefijo __Host- exige HTTPS; en desarrollo por HTTP el navegador la descartaría.
  const secure = config.publicUrl.startsWith('https://');

  return betterAuth({
    appName: config.brandName,
    baseURL: config.publicUrl,
    basePath: '/api/auth',
    secret: config.secret,
    trustedOrigins: [config.publicUrl],
    database: prismaAdapter(prisma, { provider: 'postgresql', transaction: true }),
    telemetry: { enabled: false },
    // El logger por defecto escribe correos en claro: solo se conserva el nivel y el mensaje de errores propios.
    logger: { disabled: true },
    onAPIError: {
      onError: (error) => {
        if (!(error instanceof Error) || error.name !== 'APIError') {
          logger.error(`Error inesperado: ${error instanceof Error ? error.name : 'desconocido'}`, error instanceof Error ? error.stack : undefined);
        }
      },
    },
    disabledPaths: [
      '/sign-in/social',
      '/link-social',
      '/unlink-account',
      '/list-accounts',
      '/account-info',
      '/get-access-token',
      '/refresh-token',
      '/change-email',
      '/delete-user',
      '/delete-user/callback',
      '/two-factor/send-otp',
      '/two-factor/verify-otp',
      '/error',
    ],
    user: { additionalFields: { platformRole: { type: 'string', required: false, defaultValue: 'customer', input: false } } },
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
      requireEmailVerification: true,
      minPasswordLength: MIN_LENGTH,
      maxPasswordLength: MAX_LENGTH,
      password: { hash: hashPassword, verify: verifyPassword },
      resetPasswordTokenExpiresIn: HOUR,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, token }) => emails.passwordReset(user.email, token),
      onExistingUserSignUp: async ({ user }) => emails.alreadyRegistered(user.email),
      onPasswordReset: async ({ user }) => {
        await throttle.clear(user.email);
        await audit.record({ action: 'auth.password_reset', actorId: user.id, targetType: 'user', targetId: user.id });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
      expiresIn: DAY,
      sendVerificationEmail: async ({ user, url }) => emails.verification(user.email, url),
    },
    session: { expiresIn: 7 * DAY, updateAge: DAY, freshAge: 10 * MINUTE, cookieCache: { enabled: false } },
    verification: { storeIdentifier: 'hashed' },
    rateLimit: {
      enabled: config.rateLimit,
      storage: 'database',
      window: MINUTE,
      max: 60,
      customRules: {
        '/sign-in/email': { window: MINUTE, max: 10 },
        '/sign-up/email': { window: 10 * MINUTE, max: 5 },
        '/request-password-reset': { window: 10 * MINUTE, max: 5 },
        '/send-verification-email': { window: 10 * MINUTE, max: 5 },
        '/reset-password': { window: 10 * MINUTE, max: 10 },
        '/two-factor/*': { window: MINUTE, max: 10 },
        // Se consulta en cada página y solo lee; limitarla afectaría a quienes comparten IP.
        '/get-session': false,
      },
    },
    advanced: {
      cookiePrefix: secure ? '__Host-mp' : 'mp',
      useSecureCookies: false,
      defaultCookieAttributes: { secure, httpOnly: true, sameSite: 'lax', path: '/' },
      // Explícito: la librería los desactiva por defecto en pruebas.
      disableOriginCheck: false,
      disableCSRFCheck: false,
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
    },
    hooks: { before: beforeHook(throttle), after: afterHook(throttle, audit) },
    databaseHooks: {
      user: {
        update: {
          after: async (user, ctx) => {
            // Solo interesa el momento de activar 2FA, que ocurre al verificar el primer código.
            if (ctx?.path === '/two-factor/verify-totp' && user.twoFactorEnabled) {
              await audit.record({ action: 'auth.two_factor_enabled', actorId: user.id, targetType: 'user', targetId: user.id });
            }
          },
        },
      },
    },
    plugins: [twoFactor({ issuer: config.brandName, backupCodeOptions: { storeBackupCodes: 'encrypted' } })],
  });
}
