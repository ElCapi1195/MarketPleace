import { Inject, Injectable } from '@nestjs/common';
import { PRISMA, type Prisma } from '../../database/prisma.js';

const select = {
  id: true,
  name: true,
  email: true,
  platformRole: true,
  twoFactorEnabled: true,
  createdAt: true,
  suspendedAt: true,
  suspensionReason: true,
} as const;

@Injectable()
export class AdminUserRepository {
  constructor(@Inject(PRISMA) private readonly prisma: Prisma) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email }, select });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select });
  }

  async details(id: string) {
    const [stores, byStatus, reports] = await Promise.all([
      this.prisma.storeMember.findMany({ where: { userId: id }, select: { role: true, store: { select: { id: true, name: true } } } }),
      this.prisma.reservation.groupBy({ by: ['status'], where: { customerId: id }, _count: { _all: true } }),
      this.prisma.report.count({ where: { reporterId: id } }),
    ]);
    return { stores, byStatus, reports };
  }

  /** Marca la cuenta y cierra sus sesiones, todo o nada. */
  async suspend(id: string, reason: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { suspendedAt: new Date(), suspensionReason: reason } }),
      this.prisma.session.deleteMany({ where: { userId: id } }),
    ]);
  }

  async reinstate(id: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { suspendedAt: null, suspensionReason: '' } });
  }
}
