// Base de desarrollo desechable, sin Docker: se vacía al cerrarla.
// Uso: corepack pnpm --filter @marketplace/api dev:db
import { createTestDatabase } from './database.ts';

const url = new URL(process.env.DATABASE_URL ?? '');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.username !== 'marketplace_app') {
  throw new Error('DATABASE_URL debe apuntar a localhost con el usuario marketplace_app');
}

const database = await createTestDatabase({ port: Number(url.port), password: decodeURIComponent(url.password) });
console.log(`Postgres de desarrollo listo en el puerto ${url.port}. Ctrl+C para cerrar y borrar.`);

const keepAlive = setInterval(() => {}, 60_000);
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    clearInterval(keepAlive);
    void database.stop();
  });
}
