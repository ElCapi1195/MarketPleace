import 'reflect-metadata';
import type { LoggerService } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule, type ModuleOptions } from './app.module.js';
import { HttpErrorFilter } from './common/http-error.filter.js';
import { requestId } from './common/request-id.js';
import { AUTH, type Auth } from './modules/identity/auth.js';
import { authRoutes, sameOrigin } from './modules/identity/auth.middleware.js';

export interface AppOptions extends ModuleOptions {
  trustProxyHops: number;
  logger?: LoggerService | false;
}

function noStore(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('cache-control', 'no-store');
  next();
}

/** Crea la API sin escuchar en ningún puerto. Sin CORS a propósito: web y API comparten origen. */
export async function createApp({ trustProxyHops, logger, ...options }: AppOptions): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(options), {
    bodyParser: false,
    abortOnError: false,
    ...(logger !== undefined && { logger }),
  });
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxyHops);
  app.use(requestId, noStore);
  app.use(
    helmet({
      contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    }),
  );
  app.use(sameOrigin(options.auth.publicUrl));
  app.useBodyParser('json', { limit: '100kb' });
  app.use(authRoutes(app.get<Auth>(AUTH)));
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new HttpErrorFilter());
  app.enableShutdownHooks();
  return app;
}
