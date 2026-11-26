import type { StoreStatus } from '@marketplace/core';
import { Inject, Injectable } from '@nestjs/common';
import { PRISMA, type Prisma } from '../../database/prisma.js';

export interface NewDocument {
  id: string;
  storeId: string;
  key: string;
  type: string;
  bytes: number;
  uploadedBy: string;
}

/** Documentos de verificación. Toda operación exige la tienda. */
@Injectable()
export class DocumentRepository {
  constructor(@Inject(PRISMA) private readonly prisma: Prisma) {}

  find(storeId: string, id: string) {
    return this.prisma.storeDocument.findFirst({ where: { id, storeId } });
  }

  /** Sustituye el documento; null si la solicitud ya no admite cambios. */
  put(document: NewDocument, editable: readonly StoreStatus[]) {
    return this.prisma.$transaction(async (tx) => {
      if (!(await this.lock(tx, document.storeId, editable))) return null;
      const where = { storeId_key: { storeId: document.storeId, key: document.key } };
      const previous = await tx.storeDocument.findUnique({ where });
      if (previous) await tx.storeDocument.delete({ where });
      return { created: await tx.storeDocument.create({ data: document }), previousId: previous?.id ?? null };
    });
  }

  remove(storeId: string, id: string, editable: readonly StoreStatus[]): Promise<'removed' | 'missing' | 'locked'> {
    return this.prisma.$transaction(async (tx) => {
      if (!(await this.lock(tx, storeId, editable))) return 'locked';
      const { count } = await tx.storeDocument.deleteMany({ where: { id, storeId } });
      return count === 1 ? 'removed' : 'missing';
    });
  }

  /** Bloquea la tienda: enviar la solicitud y cambiar un documento no pueden cruzarse. */
  private async lock(
    tx: Pick<Prisma, '$queryRaw'>,
    storeId: string,
    editable: readonly StoreStatus[],
  ): Promise<boolean> {
    const rows = await tx.$queryRaw<{ status: StoreStatus }[]>`SELECT "status" FROM "store" WHERE "id" = ${storeId}::uuid FOR UPDATE`;
    const status = rows[0]?.status;
    return status !== undefined && editable.includes(status);
  }
}
