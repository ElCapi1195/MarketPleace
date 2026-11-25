import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { Client } from 'pg';

const MIGRATIONS = path.join(import.meta.dirname, '../../prisma/migrations');

export interface TestDatabase {
  /** Conexión de la aplicación: sin propiedad ni DDL. */
  appUrl: string;
  /** Conexión del propietario, la que usan las migraciones. */
  ownerUrl: string;
  stop(): Promise<void>;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => (address && typeof address === 'object' ? resolve(address.port) : reject(new Error('sin puerto'))));
    });
  });
}

async function migrate(url: string): Promise<void> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const folders = (await readdir(MIGRATIONS, { withFileTypes: true })).filter((entry) => entry.isDirectory());
    for (const { name } of folders.toSorted((a, b) => a.name.localeCompare(b.name))) {
      await client.query(await readFile(path.join(MIGRATIONS, name, 'migration.sql'), 'utf8'));
    }
  } finally {
    await client.end();
  }
}

/** Postgres real y desechable, con los mismos roles y migraciones que producción. */
export async function createTestDatabase(options: { port?: number; password?: string } = {}): Promise<TestDatabase> {
  const databaseDir = await mkdtemp(path.join(tmpdir(), 'marketplace-pg-'));
  const port = options.port ?? (await freePort());
  const password = options.password ?? randomUUID();
  const server = new EmbeddedPostgres({
    databaseDir,
    port,
    user: 'owner',
    password,
    persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {},
    onError: () => {},
  });
  await server.initialise();
  await server.start();
  await server.createDatabase('marketplace');

  const ownerUrl = `postgresql://owner:${encodeURIComponent(password)}@127.0.0.1:${port}/marketplace`;
  const admin = new Client({ connectionString: ownerUrl });
  await admin.connect();
  await admin.query(`CREATE ROLE marketplace_app LOGIN PASSWORD ${admin.escapeLiteral(password)}`);
  await admin.end();
  await migrate(ownerUrl);

  return {
    ownerUrl,
    appUrl: `postgresql://marketplace_app:${encodeURIComponent(password)}@127.0.0.1:${port}/marketplace`,
    stop: async () => {
      await server.stop();
      await rm(databaseDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    },
  };
}
