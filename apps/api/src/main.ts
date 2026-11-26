import { ConsoleLogger } from '@nestjs/common';
import { loadVertical } from '@marketplace/verticals';
import { createApp } from './app.js';
import { parseEnv } from './config/env.js';
import { createPrisma } from './database/prisma.js';
import { consoleMailer, smtpMailer } from './modules/mail/mailer.js';
import { diskStorage } from './modules/media/storage.js';
import { postgresProbe, redisProbe } from './modules/health/health.probes.js';

async function main(): Promise<void> {
  const env = parseEnv(process.env);
  const vertical = loadVertical(env.VERTICAL);
  const app = await createApp({
    probes: [postgresProbe(env.DATABASE_URL), redisProbe(env.REDIS_URL)],
    trustProxyHops: env.TRUST_PROXY_HOPS,
    prisma: createPrisma(env.DATABASE_URL),
    mailer: env.SMTP_URL ? smtpMailer(env.SMTP_URL, env.MAIL_FROM) : consoleMailer(),
    storage: diskStorage(env.MEDIA_DIR),
    documents: diskStorage(env.DOCUMENTS_DIR),
    vertical,
    sweepIntervalMs: 60_000,
    auth: {
      publicUrl: env.PUBLIC_URL,
      secret: env.AUTH_SECRET,
      brandName: vertical.brand.name,
      rateLimit: true,
    },
    logger: new ConsoleLogger({ json: env.NODE_ENV === 'production' }),
  });
  await app.listen(env.PORT, env.HOST);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'No se pudo iniciar la API');
  process.exit(1);
});
