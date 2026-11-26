import type { ProductInput, ProductStatus } from '@marketplace/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { PRISMA, type Prisma } from '../../database/prisma.js';

const include = { store: true, media: { orderBy: [{ position: 'asc' }, { id: 'asc' }] } } as const;

const columns = ({ availableOn, ...product }: ProductInput) => ({
  ...product,
  availableOn: availableOn === null ? null : new Date(availableOn),
});

@Injectable()
export class ProductRepository {
  constructor(@Inject(PRISMA) private readonly prisma: Prisma) {}

  findPage(page: number, size: number) {
    return this.prisma.product.findMany({
      include: { ...include, media: { orderBy: [...include.media.orderBy] } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * size,
      take: size,
    });
  }

  count() {
    return this.prisma.product.count();
  }

  findById(id: string) {
    return this.prisma.product.findUnique({
      where: { id },
      include: { ...include, media: { orderBy: [...include.media.orderBy] } },
    });
  }

  async slugTaken(slug: string): Promise<boolean> {
    return (await this.prisma.product.count({ where: { slug } })) > 0;
  }

  create(product: ProductInput, extra: { slug: string; searchText: string; createdBy: string }) {
    return this.prisma.product.create({ data: { ...columns(product), ...extra }, include: { store: true, media: true } });
  }

  /** Devuelve false si otra persona cambió el producto desde esa versión. */
  async update(id: string, version: number, product: ProductInput, searchText: string): Promise<boolean> {
    const { count } = await this.prisma.product.updateMany({
      where: { id, version },
      data: { ...columns(product), searchText, version: { increment: 1 } },
    });
    return count === 1;
  }

  async setStatus(id: string, from: readonly ProductStatus[], status: ProductStatus, publishedAt?: Date): Promise<boolean> {
    const { count } = await this.prisma.product.updateMany({
      where: { id, status: { in: [...from] } },
      data: { status, version: { increment: 1 }, ...(publishedAt && { publishedAt }) },
    });
    return count === 1;
  }
}
