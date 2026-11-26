import { Inject, Injectable } from '@nestjs/common';
import { PRISMA, type Prisma } from '../../database/prisma.js';

type Transaction = Parameters<Parameters<Prisma['$transaction']>[0]>[0];

export type MemberChange = 'done' | 'missing' | 'last-owner';

export interface NewInvitation {
  storeId: string;
  email: string;
  role: string;
  tokenHash: string;
  invitedBy: string;
  expiresAt: Date;
}

/** Equipo de una tienda. Toda operación exige la tienda. */
@Injectable()
export class MemberRepository {
  constructor(@Inject(PRISMA) private readonly prisma: Prisma) {}

  members(storeId: string) {
    return this.prisma.storeMember.findMany({
      where: { storeId },
      include: { user: { select: { name: true, email: true, twoFactorEnabled: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  invitations(storeId: string, now: Date) {
    return this.prisma.storeInvitation.findMany({ where: { storeId, expiresAt: { gt: now } }, orderBy: { createdAt: 'asc' } });
  }

  storeName(storeId: string) {
    return this.prisma.store.findUniqueOrThrow({ where: { id: storeId }, select: { name: true } });
  }

  async isMember(storeId: string, email: string): Promise<boolean> {
    return (await this.prisma.storeMember.count({ where: { storeId, user: { email } } })) > 0;
  }

  /** Una por correo: volver a invitar sustituye el enlace anterior. */
  putInvitation({ storeId, email, ...data }: NewInvitation) {
    return this.prisma.storeInvitation.upsert({
      where: { storeId_email: { storeId, email } },
      create: { storeId, email, ...data },
      update: data,
    });
  }

  async removeInvitation(storeId: string, id: string): Promise<boolean> {
    return (await this.prisma.storeInvitation.deleteMany({ where: { id, storeId } })).count === 1;
  }

  /** Consume la invitación y une a la persona, todo o nada. Borrarla primero impide usarla dos veces. */
  accept(tokenHash: string, user: { id: string; email: string }, now: Date) {
    return this.prisma.$transaction(async (tx) => {
      const invitation = await tx.storeInvitation.findUnique({ where: { tokenHash } });
      if (!invitation || invitation.email !== user.email || invitation.expiresAt <= now) return null;
      const { count } = await tx.storeInvitation.deleteMany({ where: { id: invitation.id, tokenHash } });
      if (count !== 1) return null;
      const { storeId, role } = invitation;
      const where = { storeId_userId: { storeId, userId: user.id } };
      if (!(await tx.storeMember.findUnique({ where }))) await tx.storeMember.create({ data: { storeId, userId: user.id, role } });
      return { storeId };
    });
  }

  setRole(storeId: string, userId: string, role: string): Promise<MemberChange> {
    return this.change(storeId, userId, role !== 'OWNER', async (tx) => {
      await tx.storeMember.update({ where: { storeId_userId: { storeId, userId } }, data: { role } });
    });
  }

  remove(storeId: string, userId: string): Promise<MemberChange> {
    return this.change(storeId, userId, true, async (tx) => {
      await tx.storeMember.delete({ where: { storeId_userId: { storeId, userId } } });
    });
  }

  /** Con la tienda bloqueada, para que dos cambios a la vez no la dejen sin propietario. */
  private change(storeId: string, userId: string, losesOwner: boolean, apply: (tx: Transaction) => Promise<void>): Promise<MemberChange> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "store" WHERE "id" = ${storeId}::uuid FOR UPDATE`;
      const member = await tx.storeMember.findUnique({ where: { storeId_userId: { storeId, userId } } });
      if (!member) return 'missing';
      if (losesOwner && member.role === 'OWNER' && (await tx.storeMember.count({ where: { storeId, role: 'OWNER' } })) === 1) {
        return 'last-owner';
      }
      await apply(tx);
      return 'done';
    });
  }
}
