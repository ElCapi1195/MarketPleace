import { Module, type DynamicModule, type Type } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PRISMA, type Prisma } from './database/prisma.js';
import { AuditController } from './modules/audit/audit.controller.js';
import { AuditRepository } from './modules/audit/audit.repository.js';
import { AuditService } from './modules/audit/audit.service.js';
import { HealthController } from './modules/health/health.controller.js';
import { HEALTH_PROBES, type HealthProbe } from './modules/health/health.probes.js';
import { HealthService } from './modules/health/health.service.js';
import { AccessGuard } from './modules/identity/access.js';
import { AuthEmails } from './modules/identity/auth.emails.js';
import { AUTH, createAuth, type AuthConfig } from './modules/identity/auth.js';
import { IdentityController } from './modules/identity/identity.controller.js';
import { LoginThrottleRepository } from './modules/identity/login-throttle.repository.js';
import { LoginThrottle } from './modules/identity/login-throttle.service.js';
import type { Mailer } from './modules/mail/mailer.js';

export interface ModuleOptions {
  probes: HealthProbe[];
  prisma: Prisma;
  mailer: Mailer;
  auth: AuthConfig;
  /** Controladores adicionales; las pruebas los usan para provocar situaciones. */
  controllers?: Type[];
}

@Module({})
export class AppModule {
  static register({ probes, prisma, mailer, auth, controllers = [] }: ModuleOptions): DynamicModule {
    const emails = new AuthEmails(mailer, auth.brandName, auth.publicUrl);
    return {
      module: AppModule,
      controllers: [HealthController, IdentityController, AuditController, ...controllers],
      providers: [
        HealthService,
        AuditRepository,
        AuditService,
        LoginThrottleRepository,
        { provide: HEALTH_PROBES, useValue: probes },
        { provide: PRISMA, useValue: prisma },
        {
          provide: LoginThrottle,
          inject: [LoginThrottleRepository],
          useFactory: (repository: LoginThrottleRepository) => new LoginThrottle(repository, auth.secret),
        },
        {
          provide: AUTH,
          inject: [LoginThrottle, AuditService],
          useFactory: (throttle: LoginThrottle, audit: AuditService) => createAuth(auth, { prisma, emails, throttle, audit }),
        },
        { provide: APP_GUARD, useClass: AccessGuard },
      ],
    };
  }
}
