import type { MediaPatch } from '@marketplace/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { PRISMA, type Prisma } from '../../database/prisma.js';

type Transaction = Parameters<Parameters<Prisma['$transaction']>[0]>[0];

export interface NewMedia {
  id: string;
  productId: string;
  kind: 'IMAGE' | 'MODEL';
  width: number | null;
  height: number | null;
  bytes: number;
}

/** Serializa los cambios de archivos de un producto: los límites y el orden se comprueban sin carreras. */
async function lockProduct(tx: Transaction, productId: string): Promise<string | null> {
  const rows = await tx.$queryRaw<{ status: string }[]>`SELECT "status" FROM "product" WHERE "id" = ${productId}::uuid FOR UPDATE`;
  return rows[0]?.status ?? null;
}

const images = (tx: Transaction, productId: string) =>
  tx.productMedia.findMany({ where: { productId, kind: 'IMAGE' }, orderBy: [{ position: 'asc' }, { id: 'asc' }] });

async function reorder(tx: Transaction, list: readonly { id: string; position: number }[]): Promise<void> {
  for (const [position, item] of list.entries()) {
    if (item.position !== position) await tx.productMedia.update({ where: { id: item.id }, data: { position } });
  }
}

@Injectable()
export class MediaRepository {
  constructor(@Inject(PRISMA) private readonly prisma: Prisma) {}

  async productExists(id: string): Promise<boolean> {
    return (await this.prisma.product.count({ where: { id } })) > 0;
  }

  find(id: string) {
    return this.prisma.productMedia.findUnique({ where: { id }, include: { product: { include: { store: true } } } });
  }

  /** Añade una foto al final; null si el producto ya tiene el máximo o dejó de existir. */
  addImage(media: NewMedia, max: number) {
    return this.prisma.$transaction(async (tx) => {
      if ((await lockProduct(tx, media.productId)) === null) return null;
      const position = await tx.productMedia.count({ where: { productId: media.productId, kind: 'IMAGE' } });
      return position >= max ? null : tx.productMedia.create({ data: { ...media, position } });
    });
  }

  /** Pone el modelo 3D del producto y devuelve además el id del que sustituye. */
  replaceModel(media: NewMedia) {
    return this.prisma.$transaction(async (tx) => {
      if ((await lockProduct(tx, media.productId)) === null) return null;
      const previous = await tx.productMedia.findFirst({ where: { productId: media.productId, kind: 'MODEL' } });
      if (previous) await tx.productMedia.delete({ where: { id: previous.id } });
      return { created: await tx.productMedia.create({ data: media }), previousId: previous?.id ?? null };
    });
  }

  patch(id: string, productId: string, { alt, position }: MediaPatch) {
    return this.prisma.$transaction(async (tx) => {
      await lockProduct(tx, productId);
      if (alt !== undefined) await tx.productMedia.updateMany({ where: { id }, data: { alt } });
      if (position !== undefined) {
        const list = await images(tx, productId);
        const moved = list.find((item) => item.id === id);
        if (moved) await reorder(tx, list.filter((item) => item !== moved).toSpliced(position, 0, moved));
      }
      return tx.productMedia.findUnique({ where: { id } });
    });
  }

  /** `last-image` si es la única foto de un producto publicado. */
  remove(id: string, productId: string): Promise<'removed' | 'missing' | 'last-image'> {
    return this.prisma.$transaction(async (tx) => {
      const status = await lockProduct(tx, productId);
      const media = await tx.productMedia.findUnique({ where: { id } });
      if (!media) return 'missing';
      const list = await images(tx, productId);
      if (media.kind === 'IMAGE' && status === 'PUBLISHED' && list.length === 1) return 'last-image';
      await tx.productMedia.delete({ where: { id } });
      await reorder(tx, list.filter((item) => item.id !== id));
      return 'removed';
    });
  }
}
