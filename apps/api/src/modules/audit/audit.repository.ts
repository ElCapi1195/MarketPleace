import { Inject, Injectable } from '@nestjs/common';
import { PRISMA, type Prisma } from '../../database/prisma.js';

export interface AuditRecord {
  actorId?: string | undefined;
  action: string;
  targetType?: string | undefined;
  targetId?: string | undefined;
  ipAddress?: string | undefined;
  requestId?: string | undefined;
  metadata?: Record<string, string | number | boolean | null> | undefined;
}

export interface AuditFilter {
  action?: string | undefined;
  actorId?: string | undefined;
  targetType?: string | undefined;
  targetId?: string | undefined;
}

/** Solo inserta y lee: la base de datos rechaza cualquier otra operación. */
@Injectable()
export class AuditRepository {
  constructor(@Inject(PRISMA) private readonly prisma: Prisma) {}

  async insert({ actorId, targetType, targetId, ipAddress, requestId, ...record }: AuditRecord): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        action: record.action,
        actorId: actorId ?? null,
        targetType: targetType ?? null,
        targetId: targetId ?? null,
        ipAddress: ipAddress ?? null,
        requestId: requestId ?? null,
        metadata: record.metadata ?? {},
      },
    });
  }

  /** El id es UUIDv7, así que ordenar por él equivale a ordenar por fecha y sirve de cursor. */
  findPage(limit: number, cursor: string | undefined, filter: AuditFilter = {}) {
    const { action, actorId, targetType, targetId } = filter;
    return this.prisma.auditEvent.findMany({
      where: {
        ...(cursor !== undefined && { id: { lt: cursor } }),
        ...(action && { action: { startsWith: action } }),
        ...(actorId && { actorId }),
        ...(targetType && { targetType }),
        ...(targetId && { targetId }),
      },
      orderBy: { id: 'desc' },
      take: limit,
    });
  }

  actors(ids: string[]) {
    return this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } });
  }
}
