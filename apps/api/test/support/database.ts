import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
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

/** Aplica las migraciones pendientes; el registro permite reutilizar una base persistente. */
async function migrate(url: string): Promise<void> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('CREATE TABLE IF NOT EXISTS "dev_migration" ("name" TEXT PRIMARY KEY)');
    const { rows } = await client.query<{ name: string }>('SELECT "name" FROM "dev_migration"');
    const applied = new Set(rows.map((row) => row.name));
    const folders = (await readdir(MIGRATIONS, { withFileTypes: true })).filter((entry) => entry.isDirectory() && !applied.has(entry.name));
    for (const { name } of folders.toSorted((a, b) => a.name.localeCompare(b.name))) {
      await client.query('BEGIN');
      await client.query(await readFile(path.join(MIGRATIONS, name, 'migration.sql'), 'utf8'));
      await client.query('INSERT INTO "dev_migration" VALUES ($1)', [name]);
      await client.query('COMMIT');
    }
  } finally {
    await client.end();
  }
}

interface DatabaseOptions {
  port?: number;
  password?: string;
  /** Conserva los datos en este directorio; sin él, la base se borra al cerrarla. */
  directory?: string;
}

/** Postgres real, con los mismos roles y migraciones que producción. */
export async function createTestDatabase(options: DatabaseOptions = {}): Promise<TestDatabase> {
  const databaseDir = options.directory ?? (await mkdtemp(path.join(tmpdir(), 'marketplace-pg-')));
  const exists = existsSync(path.join(databaseDir, 'PG_VERSION'));
  const port = options.port ?? (await freePort());
  const password = options.password ?? randomUUID();
  const server = new EmbeddedPostgres({
    databaseDir,
    port,
    user: 'owner',
    password,
    persistent: options.directory !== undefined,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {},
    onError: () => {},
  });
  if (!exists) await server.initialise();
  await server.start();
  if (!exists) await server.createDatabase('marketplace');

  const ownerUrl = `postgresql://owner:${encodeURIComponent(password)}@127.0.0.1:${port}/marketplace`;
  if (!exists) {
    const admin = new Client({ connectionString: ownerUrl });
    await admin.connect();
    await admin.query(`CREATE ROLE marketplace_app LOGIN PASSWORD ${admin.escapeLiteral(password)}`);
    await admin.end();
  }
  await migrate(ownerUrl);

  return {
    ownerUrl,
    appUrl: `postgresql://marketplace_app:${encodeURIComponent(password)}@127.0.0.1:${port}/marketplace`,
    stop: async () => {
      await server.stop();
      if (options.directory === undefined) await rm(databaseDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    },
  };
}
