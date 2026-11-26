import { readFile } from 'node:fs/promises';
import { loadVertical } from '@marketplace/verticals';
import { loadSamples, sampleAssets } from '@marketplace/verticals/samples';
import { createPrisma } from '../database/prisma.js';
import { AuditRepository } from '../modules/audit/audit.repository.js';
import { AuditService } from '../modules/audit/audit.service.js';
import { ProductRepository } from '../modules/catalog/product.repository.js';
import { ProductService } from '../modules/catalog/product.service.js';
import { SampleSeeder } from '../modules/catalog/sample-seeder.js';
import { MediaRepository } from '../modules/media/media.repository.js';
import { MediaService } from '../modules/media/media.service.js';
import { diskStorage } from '../modules/media/storage.js';
import { StoreRepository } from '../modules/stores/store.repository.js';
import { StoreService } from '../modules/stores/store.service.js';

// Carga los productos de ejemplo del nicho. Solo para desarrollo; se puede repetir.
const { DATABASE_URL, MEDIA_DIR, VERTICAL, NODE_ENV, SHOW_SAMPLES } = process.env;
if (NODE_ENV !== 'development' || SHOW_SAMPLES !== 'true' || !DATABASE_URL || !MEDIA_DIR || !VERTICAL) {
  console.error('Los productos de ejemplo solo se cargan en desarrollo y con SHOW_SAMPLES=true.');
  process.exit(1);
}

const prisma = createPrisma(DATABASE_URL);
try {
  const vertical = loadVertical(VERTICAL);
  const audit = new AuditService(new AuditRepository(prisma));
  const stores = new StoreRepository(prisma);
  const assets = sampleAssets(vertical.id);
  const seeder = new SampleSeeder(
    new StoreService(stores, audit),
    new ProductService(new ProductRepository(prisma), stores, audit, vertical),
    new MediaService(new MediaRepository(prisma), diskStorage(MEDIA_DIR), audit, vertical),
    (file) => readFile(new URL(file, assets)),
  );
  console.log(`${await seeder.run(loadSamples(vertical.id), new Date())} productos de ejemplo añadidos.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'No se pudieron cargar');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
