import { readFile } from 'node:fs/promises';
import { loadVertical } from '@marketplace/verticals';
import { loadSamples, sampleAssets } from '@marketplace/verticals/samples';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createPrisma, type Prisma } from '../src/database/prisma.js';
import { AuditRepository } from '../src/modules/audit/audit.repository.js';
import { AuditService } from '../src/modules/audit/audit.service.js';
import { ProductRepository } from '../src/modules/catalog/product.repository.js';
import { ProductService } from '../src/modules/catalog/product.service.js';
import { SampleSeeder } from '../src/modules/catalog/sample-seeder.js';
import { MediaRepository } from '../src/modules/media/media.repository.js';
import { MediaService } from '../src/modules/media/media.service.js';
import { StoreRepository } from '../src/modules/stores/store.repository.js';
import { StoreService } from '../src/modules/stores/store.service.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { memoryStorage } from './support/storage.js';

let db: TestDatabase;
let prisma: Prisma;

beforeAll(async () => {
  db = await createTestDatabase();
  prisma = createPrisma(db.appUrl);
}, 90_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await db?.stop();
}, 30_000);

it('publica todas las muestras, con sus fotos y su modelo, y repetirla no duplica', async () => {
  const vertical = loadVertical('gamer');
  const samples = loadSamples(vertical.id);
  const audit = new AuditService(new AuditRepository(prisma));
  const stores = new StoreRepository(prisma);
  const seeder = new SampleSeeder(
    new StoreService(stores, audit),
    new ProductService(new ProductRepository(prisma), stores, audit, vertical),
    new MediaService(new MediaRepository(prisma), memoryStorage(), audit, vertical),
    (file) => readFile(new URL(file, sampleAssets(vertical.id))),
  );
  expect(await seeder.run(samples, new Date('2026-11-30T12:00:00Z'))).toBe(samples.length);
  expect(await seeder.run(samples, new Date('2026-11-30T12:00:00Z'))).toBe(0);
  expect(await prisma.product.count({ where: { status: 'PUBLISHED' } })).toBe(samples.length);
  expect(await prisma.productMedia.count({ where: { kind: 'MODEL' } })).toBe(samples.length);
  expect(await prisma.productMedia.count({ where: { kind: 'IMAGE' } })).toBe(samples.length * 3);
}, 60_000);
