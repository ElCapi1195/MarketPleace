import { productSources, productTransition, type ProductAction, type ProductStatus } from '@marketplace/core';
import type { ProductInput } from '@marketplace/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { PRISMA, type Prisma } from '../../database/prisma.js';
import { scoped, type Scope } from './scope.js';

const include = () => ({ store: true, media: { orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }] } });

const columns = ({ availableOn, ...product }: ProductInput) => ({
  ...product,
  availableOn: availableOn === null ? null : new Date(availableOn),
});

export interface StatusChange {
  version?: number;
  rejection?: string;
  publishedAt?: Date;
}

@Injectable()
export class ProductRepository {
  constructor(@Inject(PRISMA) private readonly prisma: Prisma) {}

  findPage(scope: Scope, page: number, size: number, status?: ProductStatus) {
    return this.prisma.product.findMany({
      where: { ...scoped(scope), ...(status && { status }) },
      include: include(),
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * size,
      take: size,
    });
  }

  count(scope: Scope, status?: ProductStatus) {
    return this.prisma.product.count({ where: { ...scoped(scope), ...(status && { status }) } });
  }

  findById(scope: Scope, id: string) {
    return this.prisma.product.findFirst({ where: { ...scoped(scope), id }, include: include() });
  }

  async slugTaken(slug: string): Promise<boolean> {
    return (await this.prisma.product.count({ where: { slug } })) > 0;
  }

  create(product: ProductInput, extra: { slug: string; searchText: string; createdBy: string }) {
    return this.prisma.product.create({ data: { ...columns(product), ...extra }, include: include() });
  }

  /** Devuelve false si otra persona cambió el producto desde esa versión. */
  async update(
    scope: Scope,
    id: string,
    version: number,
    product: ProductInput,
    extra: { searchText: string; status?: ProductStatus },
  ): Promise<boolean> {
    const { count } = await this.prisma.product.updateMany({
      where: { ...scoped(scope), id, version },
      data: { ...columns(product), ...extra, version: { increment: 1 } },
    });
    return count === 1;
  }

  /** Aplica una acción si el estado actual la admite y, si se indica, la versión coincide. */
  async apply(scope: Scope, id: string, action: ProductAction, { version, ...data }: StatusChange = {}): Promise<boolean> {
    const sources = productSources(action);
    const status = sources[0] === undefined ? null : productTransition(sources[0], action);
    if (status === null) return false;
    const { count } = await this.prisma.product.updateMany({
      where: { ...scoped(scope), id, status: { in: [...sources] }, ...(version !== undefined && { version }) },
      data: { ...data, status, version: { increment: 1 } },
    });
    return count === 1;
  }
}
