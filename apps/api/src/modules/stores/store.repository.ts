import { Inject, Injectable } from '@nestjs/common';
import { PRISMA, type Prisma } from '../../database/prisma.js';

@Injectable()
export class StoreRepository {
  constructor(@Inject(PRISMA) private readonly prisma: Prisma) {}

  findAll() {
    return this.prisma.store.findMany({ orderBy: { name: 'asc' }, take: 500 });
  }

  findById(id: string) {
    return this.prisma.store.findUnique({ where: { id } });
  }

  findBySlug(slug: string) {
    return this.prisma.store.findUnique({ where: { slug } });
  }

  create(data: { slug: string; name: string }) {
    return this.prisma.store.create({ data });
  }
}
