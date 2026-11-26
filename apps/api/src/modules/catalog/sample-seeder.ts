import { slugify } from '@marketplace/core';
import { SAMPLE_IMAGES, type SampleProduct } from '@marketplace/verticals/samples';
import type { MediaService } from '../media/media.service.js';
import type { StoreService } from '../stores/store.service.js';
import type { ProductService } from './product.service.js';
import { PLATFORM } from './scope.js';

const ACTOR = { actorId: 'semilla' };

/** Día 15 del mes indicado: una fecha estimada creíble y siempre válida. */
function arrival(now: Date, monthsAhead: number): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthsAhead, 15)).toISOString().slice(0, 10);
}

/** Crea los productos de ejemplo con los mismos servicios y validaciones que el panel. */
export class SampleSeeder {
  constructor(
    private readonly stores: StoreService,
    private readonly products: ProductService,
    private readonly media: MediaService,
    private readonly read: (file: string) => Promise<Buffer>,
  ) {}

  /** Devuelve cuántos añadió; los que ya existen no se tocan. */
  async run(samples: readonly SampleProduct[], now: Date): Promise<number> {
    const existing = new Set((await this.products.list(PLATFORM, 1)).items.map(({ slug }) => slug));
    const pending = samples.filter(({ title }) => !existing.has(slugify(title)));
    for (const sample of pending) await this.add(sample, now);
    return pending.length;
  }

  private async add({ asset, monthsAhead, storeName, ...sample }: SampleProduct, now: Date): Promise<void> {
    const { id } = await this.products.create(ACTOR, PLATFORM, {
      ...sample,
      storeId: await this.storeId(storeName),
      availableOn: monthsAhead === null ? null : arrival(now, monthsAhead),
    });
    for (let index = 1; index <= SAMPLE_IMAGES; index += 1) {
      const { id: mediaId } = await this.media.add(ACTOR, PLATFORM, id, 'IMAGE', await this.read(`${asset}-${index}.webp`));
      await this.media.patch(PLATFORM, mediaId, { alt: `${sample.title}, vista ${index}` });
    }
    await this.media.add(ACTOR, PLATFORM, id, 'MODEL', await this.read(`${asset}.glb`));
    await this.products.publish(ACTOR, PLATFORM, id);
  }

  private async storeId(name: string): Promise<string> {
    const found = (await this.stores.list()).find((store) => store.name === name);
    return (found ?? (await this.stores.create(ACTOR, { name }))).id;
  }
}
