import { Inject, Injectable } from '@nestjs/common';
import { PRISMA, type Prisma } from '../../database/prisma.js';

const include = () => ({
  reporter: { select: { id: true, name: true, email: true } },
});

export interface NewReport {
  reporterId: string;
  targetType: 'PRODUCT' | 'RESERVATION';
  productId: string | null;
  reservationId: string | null;
  storeId: string;
  reason: string;
  details: string;
}

@Injectable()
export class ReportRepository {
  constructor(@Inject(PRISMA) private readonly prisma: Prisma) {}

  publishedProduct(slug: string) {
    return this.prisma.product.findFirst({ where: { slug, status: 'PUBLISHED', store: { status: 'APPROVED' } }, select: { id: true, storeId: true } });
  }

  ownReservation(id: string, customerId: string) {
    return this.prisma.reservation.findFirst({ where: { id, customerId }, select: { id: true, storeId: true } });
  }

  /** Crea la denuncia con la persona bloqueada: el máximo de abiertas no se supera a la vez. */
  create(report: NewReport, max: number): Promise<{ id: string } | 'duplicate' | 'too-many'> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "user" WHERE "id" = ${report.reporterId} FOR UPDATE`;
      const open = await tx.report.findMany({ where: { reporterId: report.reporterId, status: 'OPEN' }, select: { productId: true, reservationId: true } });
      const same = open.some(({ productId, reservationId }) =>
        report.productId !== null ? productId === report.productId : reservationId === report.reservationId,
      );
      if (same) return 'duplicate';
      if (open.length >= max) return 'too-many';
      return tx.report.create({ data: report, select: { id: true } });
    });
  }

  find(id: string, types: readonly string[]) {
    return this.prisma.report.findFirst({ where: { id, targetType: { in: [...types] } }, include: include() });
  }

  findPage(types: readonly string[], status: string | undefined, page: number, size: number) {
    return this.prisma.report.findMany({
      where: { targetType: { in: [...types] }, ...(status && { status }) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * size,
      take: size,
    });
  }

  byReporter(reporterId: string) {
    return this.prisma.report.findMany({ where: { reporterId }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  titles(productIds: string[], reservationIds: string[]) {
    return Promise.all([
      this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, title: true, slug: true, status: true, store: { select: { name: true } } } }),
      this.prisma.reservation.findMany({
        where: { id: { in: reservationIds } },
        select: { id: true, productTitle: true, code: true, status: true, store: { select: { name: true } } },
      }),
    ]);
  }

  async isMember(storeId: string, userId: string): Promise<boolean> {
    return (await this.prisma.storeMember.count({ where: { storeId, userId } })) > 0;
  }

  /** Devuelve false si otra persona ya la resolvió. */
  async resolve(id: string, data: { status: string; resolution: string; resolvedBy: string }): Promise<boolean> {
    const { count } = await this.prisma.report.updateMany({ where: { id, status: 'OPEN' }, data: { ...data, resolvedAt: new Date() } });
    return count === 1;
  }
}
