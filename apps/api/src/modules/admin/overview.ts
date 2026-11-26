import { can } from '@marketplace/core';
import type { Overview } from '@marketplace/contracts';
import { Controller, Get, Inject, Injectable } from '@nestjs/common';
import { PRISMA, type Prisma } from '../../database/prisma.js';
import { CurrentUser, RequirePermission, type CurrentUserData } from '../identity/access.js';

@Injectable()
export class OverviewRepository {
  constructor(@Inject(PRISMA) private readonly prisma: Prisma) {}

  pendingStores = () => this.prisma.store.count({ where: { status: { in: ['SUBMITTED', 'IN_REVIEW'] } } });
  pendingProducts = () => this.prisma.product.count({ where: { status: 'PENDING_MODERATION' } });
  openReports = (targetType: string) => this.prisma.report.count({ where: { status: 'OPEN', targetType } });

  /** Reservas cerradas sin entrega en las que la tienda aún conserva dinero. */
  async refundsPending(): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) FROM (
        SELECT r."id" FROM "reservation" r JOIN "payment_record" p ON p."reservationId" = r."id"
        WHERE r."status" IN ('CANCELLED', 'EXPIRED', 'REJECTED')
        GROUP BY r."id"
        HAVING sum(CASE WHEN p."kind" = 'REFUND' THEN -p."amountMinor" ELSE p."amountMinor" END) > 0
      ) pending`;
    return Number(rows[0]?.count ?? 0);
  }
}

/** Lo pendiente para cada rol: solo cuenta lo que ese rol puede atender. */
@Controller('admin/overview')
@RequirePermission('listing.moderate')
export class OverviewController {
  constructor(@Inject(OverviewRepository) private readonly overview: OverviewRepository) {}

  @Get()
  async get(@CurrentUser() { platformRole: role }: CurrentUserData): Promise<Overview> {
    const result: Overview = {};
    if (can(role, 'store.verify')) result.pendingStores = await this.overview.pendingStores();
    if (can(role, 'listing.moderate')) {
      result.pendingProducts = await this.overview.pendingProducts();
      result.openReports = await this.overview.openReports('PRODUCT');
    }
    if (can(role, 'reservation.intervene')) {
      result.reservationReports = await this.overview.openReports('RESERVATION');
      result.refundsPending = await this.overview.refundsPending();
    }
    return result;
  }
}
