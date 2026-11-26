// Base de desarrollo, sin Docker. Los datos se conservan en storage/dev-db; borra esa carpeta para empezar de cero.
// Uso: corepack pnpm --filter @marketplace/api dev:db
import { createConnection } from 'node:net';
import path from 'node:path';
import { createTestDatabase, migrate } from './database.ts';

const url = new URL(process.env.DATABASE_URL ?? '');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.username !== 'marketplace_app') {
  throw new Error('DATABASE_URL debe apuntar a localhost con el usuario marketplace_app');
}

/** Si un cierre brusco dejó el servidor en marcha, se reutiliza en lugar de fallar. */
function listening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

const port = Number(url.port);
if (await listening(port)) {
  const owner = new URL(url);
  owner.username = 'owner';
  await migrate(owner.href);
  console.log(`Postgres ya estaba en marcha en el puerto ${port}. Migraciones al día.`);
} else {
  const database = await createTestDatabase({
    port,
    password: decodeURIComponent(url.password),
    directory: path.join(import.meta.dirname, '../../../../storage/dev-db'),
  });
  console.log(`Postgres de desarrollo listo en el puerto ${port}. Ctrl+C para cerrar.`);

  const keepAlive = setInterval(() => {}, 60_000);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      clearInterval(keepAlive);
      void database.stop();
    });
  }
}
