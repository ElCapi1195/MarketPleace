import type { StoreApplicationInput } from '@marketplace/contracts';
import type { StoreAction, StoreStatus } from '@marketplace/core';
import { Inject, Injectable } from '@nestjs/common';
import type { StoreDocument, Store } from '../../generated/prisma/client.js';
import { PRISMA, type Prisma } from '../../database/prisma.js';
import type { MembershipReader } from '../identity/access.js';

const include = () => ({ documents: { orderBy: { key: 'asc' as const } }, events: { orderBy: { id: 'desc' as const }, take: 50 } });

export interface Decision {
  id: string;
  from: string;
  to: StoreStatus;
  action: StoreAction;
  reason: string;
  actorId: string;
}

@Injectable()
export class StoreRepository implements MembershipReader {
  constructor(@Inject(PRISMA) private readonly prisma: Prisma) {}

  async find(storeId: string, userId: string) {
    const member = await this.prisma.storeMember.findUnique({
      where: { storeId_userId: { storeId, userId } },
      include: { store: { select: { status: true } } },
    });
    return member ? { role: member.role, status: member.store.status } : null;
  }

  findApproved() {
    return this.prisma.store.findMany({ where: { status: 'APPROVED' }, orderBy: { name: 'asc' }, take: 500 });
  }

  findPage(status: StoreStatus | undefined, page: number, size: number) {
    return this.prisma.store.findMany({
      // Un borrador todavía no se ha presentado.
      where: status ? { status } : { status: { not: 'DRAFT' } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * size,
      take: size,
    });
  }

  findById(id: string) {
    return this.prisma.store.findUnique({ where: { id }, include: include() });
  }

  findBySlug(slug: string) {
    return this.prisma.store.findUnique({ where: { slug } });
  }

  findByMember(userId: string) {
    return this.prisma.storeMember.findMany({ where: { userId }, include: { store: true }, orderBy: { createdAt: 'asc' } });
  }

  countOwned(userId: string, statuses: readonly StoreStatus[]) {
    return this.prisma.storeMember.count({ where: { userId, role: 'OWNER', store: { status: { in: [...statuses] } } } });
  }

  owners(storeId: string) {
    return this.prisma.storeMember.findMany({
      where: { storeId, role: 'OWNER' },
      select: { user: { select: { name: true, email: true } } },
    });
  }

  /** Tienda dada de alta por la administración, ya aprobada. */
  createApproved(data: { slug: string; name: string }, actorId: string) {
    return this.prisma.store.create({
      data: { ...data, status: 'APPROVED', events: { create: { action: 'created', fromStatus: 'DRAFT', toStatus: 'APPROVED', actorId } } },
    });
  }

  createApplication(input: StoreApplicationInput, slug: string, userId: string) {
    return this.prisma.store.create({
      data: { ...input, slug, members: { create: { userId, role: 'OWNER' } } },
      include: include(),
    });
  }

  async setPickup(id: string, pickupInfo: string): Promise<void> {
    await this.prisma.store.update({ where: { id }, data: { pickupInfo } });
  }

  /** Devuelve false si la solicitud ya no se puede editar. */
  async updateApplication(id: string, input: StoreApplicationInput, editable: readonly StoreStatus[]): Promise<boolean> {
    const { count } = await this.prisma.store.updateMany({ where: { id, status: { in: [...editable] } }, data: input });
    return count === 1;
  }

  /**
   * Cambia el estado y lo anota, todo o nada. Devuelve false si el estado ya no era el esperado.
   * `check` se evalúa con la tienda bloqueada: nadie puede quitar un documento mientras se envía.
   */
  transition({ id, from, to, ...event }: Decision, check?: (store: Store, documents: StoreDocument[]) => void): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "store" WHERE "id" = ${id}::uuid FOR UPDATE`;
      if (check) {
        const store = await tx.store.findUniqueOrThrow({ where: { id }, include: { documents: true } });
        check(store, store.documents);
      }
      const { count } = await tx.store.updateMany({ where: { id, status: from }, data: { status: to } });
      if (count === 1) await tx.storeEvent.create({ data: { storeId: id, fromStatus: from, toStatus: to, ...event } });
      return count === 1;
    });
  }
}
