import type { VerticalConfig } from '@marketplace/verticals';
import { Module, type DynamicModule, type Type } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { VERTICAL } from './config/vertical.js';
import { PRISMA, type Prisma } from './database/prisma.js';
import { AuditController } from './modules/audit/audit.controller.js';
import { AuditRepository } from './modules/audit/audit.repository.js';
import { AuditService } from './modules/audit/audit.service.js';
import { CatalogController } from './modules/catalog/catalog.controller.js';
import { CatalogRepository } from './modules/catalog/catalog.repository.js';
import { CatalogService } from './modules/catalog/catalog.service.js';
import { ModerationController } from './modules/catalog/moderation.controller.js';
import { ModerationService } from './modules/catalog/moderation.service.js';
import { ProductController, StoreProductController } from './modules/catalog/product.controller.js';
import { ProductRepository } from './modules/catalog/product.repository.js';
import { ProductService } from './modules/catalog/product.service.js';
import { HealthController } from './modules/health/health.controller.js';
import { HEALTH_PROBES, type HealthProbe } from './modules/health/health.probes.js';
import { HealthService } from './modules/health/health.service.js';
import { AccessGuard, MEMBERSHIPS } from './modules/identity/access.js';
import { AuthEmails } from './modules/identity/auth.emails.js';
import { AUTH, createAuth, type AuthConfig } from './modules/identity/auth.js';
import { IdentityController } from './modules/identity/identity.controller.js';
import { LoginThrottleRepository } from './modules/identity/login-throttle.repository.js';
import { LoginThrottle } from './modules/identity/login-throttle.service.js';
import type { Mailer } from './modules/mail/mailer.js';
import { Outbox } from './modules/mail/outbox.js';
import { AdminMediaController, MediaController, StoreMediaController } from './modules/media/media.controller.js';
import { MediaRepository } from './modules/media/media.repository.js';
import { MediaService } from './modules/media/media.service.js';
import { STORAGE, type StoragePort } from './modules/media/storage.js';
import { ApplicationController } from './modules/stores/application.controller.js';
import { ApplicationService } from './modules/stores/application.service.js';
import { DocumentRepository } from './modules/stores/document.repository.js';
import { DocumentService } from './modules/stores/document.service.js';
import { InvitationController, MemberController } from './modules/stores/member.controller.js';
import { MemberRepository } from './modules/stores/member.repository.js';
import { MemberService } from './modules/stores/member.service.js';
import { ReviewController } from './modules/stores/review.controller.js';
import { ReviewService } from './modules/stores/review.service.js';
import { StoreController } from './modules/stores/store.controller.js';
import { StoreEmails } from './modules/stores/store.emails.js';
import { StoreRepository } from './modules/stores/store.repository.js';
import { StoreService } from './modules/stores/store.service.js';
import { DOCUMENTS, STORE_EMAILS } from './modules/stores/store.tokens.js';

export interface ModuleOptions {
  probes: HealthProbe[];
  prisma: Prisma;
  mailer: Mailer;
  auth: AuthConfig;
  storage: StoragePort;
  /** Documentos de verificación: almacén aparte del de productos. */
  documents: StoragePort;
  vertical: VerticalConfig;
  /** Controladores adicionales; las pruebas los usan para provocar situaciones. */
  controllers?: Type[];
}

@Module({})
export class AppModule {
  static register({ probes, prisma, mailer, auth, storage, documents, vertical, controllers = [] }: ModuleOptions): DynamicModule {
    const outbox = new Outbox(mailer);
    const emails = new AuthEmails(outbox, auth.brandName, auth.publicUrl);
    return {
      module: AppModule,
      controllers: [
        HealthController,
        IdentityController,
        AuditController,
        StoreController,
        ApplicationController,
        ReviewController,
        MemberController,
        InvitationController,
        CatalogController,
        ProductController,
        StoreProductController,
        ModerationController,
        MediaController,
        AdminMediaController,
        StoreMediaController,
        ...controllers,
      ],
      providers: [
        HealthService,
        AuditRepository,
        AuditService,
        LoginThrottleRepository,
        StoreRepository,
        StoreService,
        ApplicationService,
        ReviewService,
        DocumentRepository,
        DocumentService,
        MemberRepository,
        MemberService,
        CatalogRepository,
        CatalogService,
        ProductRepository,
        ProductService,
        ModerationService,
        MediaRepository,
        MediaService,
        { provide: STORAGE, useValue: storage },
        { provide: DOCUMENTS, useValue: documents },
        { provide: STORE_EMAILS, useValue: new StoreEmails(outbox, auth.brandName, auth.publicUrl) },
        { provide: MEMBERSHIPS, useExisting: StoreRepository },
        { provide: VERTICAL, useValue: vertical },
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
