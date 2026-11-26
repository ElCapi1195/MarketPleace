import type { CatalogSort, ListingKind } from '@marketplace/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { PRISMA, type Prisma } from '../../database/prisma.js';

const visible = { status: 'PUBLISHED', store: { status: 'ACTIVE' } } as const;
const mediaOrder = [{ position: 'asc' }, { id: 'asc' }] as const;
const include = () => ({ store: true, media: { orderBy: [...mediaOrder] } });

const orders = {
  recent: [{ publishedAt: 'desc' }, { id: 'desc' }],
  price_asc: [{ priceMinor: 'asc' }, { id: 'desc' }],
  price_desc: [{ priceMinor: 'desc' }, { id: 'desc' }],
  soonest: [{ availableOn: { sort: 'asc', nulls: 'last' } }, { id: 'desc' }],
} as const;

export interface CatalogFilter {
  words?: readonly string[];
  categories?: readonly string[] | undefined;
  kind?: ListingKind | undefined;
  featured?: boolean;
}

const where = ({ words = [], categories, kind, featured }: CatalogFilter) => ({
  ...visible,
  AND: words.map((word) => ({ searchText: { contains: word } })),
  ...(categories && { categorySlug: { in: [...categories] } }),
  ...(kind && { kind }),
  ...(featured !== undefined && { featured }),
});

/** Lectura pública: solo productos publicados de tiendas activas. */
@Injectable()
export class CatalogRepository {
  constructor(@Inject(PRISMA) private readonly prisma: Prisma) {}

  find(filter: CatalogFilter, sort: CatalogSort, take: number, skip = 0) {
    return this.prisma.product.findMany({ where: where(filter), include: include(), orderBy: [...orders[sort]], take, skip });
  }

  count(filter: CatalogFilter) {
    return this.prisma.product.count({ where: where(filter) });
  }

  findBySlug(slug: string) {
    return this.prisma.product.findFirst({ where: { ...visible, slug }, include: include() });
  }
}
