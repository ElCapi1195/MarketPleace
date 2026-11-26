import { loadVertical } from '@marketplace/verticals';
import { z } from 'zod';

const url = (protocols: string[]) =>
  z.string().refine((value) => {
    const parsed = URL.canParse(value) ? new URL(value) : null;
    return parsed !== null && protocols.includes(parsed.protocol);
  }, `debe ser una URL ${protocols.join(' o ')}`);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    // En un contenedor debe escuchar en todas las interfaces; en desarrollo, solo en este equipo.
    HOST: z.string().min(1).default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    // Saltos de proxy de confianza delante de la API; si sobra uno, la IP del cliente es falsificable.
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
    VERTICAL: z.string().min(1).superRefine((id, ctx) => {
      try {
        loadVertical(id);
      } catch (error) {
        ctx.addIssue({ code: 'custom', message: error instanceof Error ? error.message : 'nicho inválido' });
      }
    }),
    DATABASE_URL: url(['postgresql:', 'postgres:']),
    REDIS_URL: url(['redis:', 'rediss:']),
    PUBLIC_URL: url(['https:', 'http:']).transform((value) => {
      const parsed = new URL(value);
      const pathname = parsed.pathname.replace(/\/$/, '');
      return `${parsed.origin}${pathname}`;
    }),
    AUTH_SECRET: z.string().min(32, 'al menos 32 caracteres aleatorios'),
    // Volumen persistente y privado con los archivos subidos. Nunca dentro de lo que sirve la web.
    MEDIA_DIR: z.string().min(1),
    // Documentos de las tiendas: datos personales, con su propio volumen y su propia retención.
    DOCUMENTS_DIR: z.string().min(1),
    SMTP_URL: z.preprocess((value) => value === '' ? undefined : value, url(['smtp:', 'smtps:']).optional()),
    MAIL_FROM: z.string().min(3).default('no-responder@localhost'),
  })
  .superRefine(({ NODE_ENV, PUBLIC_URL, SMTP_URL, AUTH_SECRET, MEDIA_DIR, DOCUMENTS_DIR }, ctx) => {
    if (MEDIA_DIR === DOCUMENTS_DIR) ctx.addIssue({ code: 'custom', path: ['DOCUMENTS_DIR'], message: 'debe ser distinto de MEDIA_DIR' });
    if (NODE_ENV !== 'production') return;
    // Sin HTTPS no hay cookies seguras, y el correo por terminal expondría enlaces de acceso.
    if (!PUBLIC_URL.startsWith('https://')) ctx.addIssue({ code: 'custom', path: ['PUBLIC_URL'], message: 'debe usar https en producción' });
    if (SMTP_URL === undefined) ctx.addIssue({ code: 'custom', path: ['SMTP_URL'], message: 'obligatorio en producción' });
    if (/cambiar|ejemplo|example/i.test(AUTH_SECRET)) ctx.addIssue({ code: 'custom', path: ['AUTH_SECRET'], message: 'es un valor de ejemplo' });
  });

export type Env = z.output<typeof envSchema>;

/** Valida el entorno. El error nombra las variables, nunca sus valores. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Entorno inválido:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
