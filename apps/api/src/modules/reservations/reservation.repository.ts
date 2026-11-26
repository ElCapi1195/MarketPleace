import { activeStatuses, expirableStatuses, holdsUnits, isActive, type ReservationStatus } from '@marketplace/core';
import { Inject, Injectable } from '@nestjs/common';
import { PRISMA, type Prisma } from '../../database/prisma.js';
import type { PaymentRecord, Product, Reservation, ReservationEvent, Store } from '../../generated/prisma/client.js';
import { alreadyReserved, idempotencyMismatch, noUnits, notFound, tooMany, versionConflict } from './reservation.errors.js';
import { scopeWhere, type ReservationScope } from './reservation.scope.js';

export type Transaction = Parameters<Parameters<Prisma['$transaction']>[0]>[0];

const include = () => ({
  store: true,
  customer: { select: { name: true, email: true } },
  product: { include: { media: { where: { kind: 'IMAGE' }, orderBy: { position: 'asc' as const }, take: 1 } } },
  payments: { orderBy: { id: 'asc' as const } },
  events: { orderBy: { id: 'desc' as const } },
});

export type ReservationRow = Reservation & {
  store: Store;
  customer: { name: string; email: string };
  product: Product & { media: { id: string }[] };
  payments: PaymentRecord[];
  events: ReservationEvent[];
};

export interface NewReservation {
  code: string;
  customerId: string;
  idempotencyKey: string;
  termsVersion: string;
  phone: string;
  note: string;
  expiresAt: Date;
}

export interface Change {
  action: string;
  to: ReservationStatus;
  actor: 'CUSTOMER' | 'STORE' | 'PLATFORM' | 'SYSTEM';
  actorId: string | null;
  reason: string;
  expiresAt: Date | null;
  /** Otros cambios de la fila: acuerdos, propuesta, fecha de aprobación. */
  data?: Partial<
    Pick<
      Reservation,
      'priceMinor' | 'depositMinor' | 'availableOn' | 'offerPriceMinor' | 'offerDepositMinor' | 'offerAvailableOn' | 'approvedAt'
    >
  >;
}

/** Ajusta las unidades del producto al nuevo estado. Devuelve si la reserva conserva una comprometida. */
async function settleUnits(tx: Transaction, row: Reservation, to: ReservationStatus): Promise<boolean> {
  const holds = holdsUnits(to);
  // Lo entregado queda vendido: ni se compromete de nuevo ni se libera.
  if (to === 'COMPLETED' || holds === row.unitHeld) return row.unitHeld;
  if (holds && holdsUnits(row.status)) return row.unitHeld;
  const [product] = await tx.$queryRaw<{ units: number | null }[]>`SELECT "units" FROM "product" WHERE "id" = ${row.productId}::uuid FOR UPDATE`;
  const units = product?.units ?? null;
  if (holds) {
    if (units === null) return false;
    if (units < 1) throw noUnits();
  }
  if (units !== null) {
    // Cambia la versión: quien editaba el producto debe volver a cargarlo.
    await tx.product.update({
      where: { id: row.productId },
      data: { units: holds ? { decrement: 1 } : { increment: 1 }, version: { increment: 1 } },
    });
  }
  return holds;
}

@Injectable()
export class ReservationRepository {
  constructor(@Inject(PRISMA) private readonly prisma: Prisma) {}

  find(scope: ReservationScope, id: string): Promise<ReservationRow | null> {
    return this.prisma.reservation.findFirst({ where: { ...scopeWhere(scope), id }, include: include() });
  }

  findPage(
    scope: ReservationScope,
    filter: { status?: ReservationStatus | undefined; withPayments?: boolean; code?: string | undefined },
    page: number,
    size: number,
  ) {
    return this.prisma.reservation.findMany({
      where: {
        ...scopeWhere(scope),
        ...(filter.code && { code: filter.code }),
        ...(filter.status && { status: filter.status }),
        ...(filter.withPayments && { status: { in: ['CANCELLED', 'EXPIRED', 'REJECTED'] }, payments: { some: {} } }),
      },
      include: include(),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * size,
      take: size,
    });
  }

  /** Cuántas terminaron en cada estado, en toda la plataforma. */
  countBy(customerId: string, status: ReservationStatus): Promise<number> {
    return this.prisma.reservation.count({ where: { customerId, status } });
  }

  /** Correos de quienes pueden decidir en la tienda. */
  async deciders(storeId: string): Promise<string[]> {
    const members = await this.prisma.storeMember.findMany({
      where: { storeId, role: { in: ['OWNER', 'MANAGER'] } },
      select: { user: { select: { email: true } } },
    });
    return members.map(({ user }) => user.email);
  }

  /**
   * Crea la reserva o devuelve la que ya creó esa clave. Bloquea a la persona: dos peticiones a la vez
   * no superan el máximo ni duplican. `freeze` valida el producto, que no puede cambiar mientras tanto.
   */
  create(
    input: NewReservation,
    productSlug: string,
    max: number,
    freeze: (product: (Product & { store: Store }) | null) => Omit<Reservation, keyof NewReservation | Generated>,
  ): Promise<{ row: ReservationRow; created: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      const { customerId, idempotencyKey } = input;
      await tx.$queryRaw`SELECT 1 FROM "user" WHERE "id" = ${customerId} FOR UPDATE`;
      const previous = await tx.reservation.findUnique({
        where: { customerId_idempotencyKey: { customerId, idempotencyKey } },
        include: include(),
      });
      if (previous) {
        if (previous.product.slug !== productSlug) throw idempotencyMismatch();
        return { row: previous, created: false };
      }
      await tx.$queryRaw`SELECT 1 FROM "product" WHERE "slug" = ${productSlug} FOR SHARE`;
      const product = await tx.product.findUnique({ where: { slug: productSlug }, include: { store: true } });
      const frozen = freeze(product);
      const active = await tx.reservation.findMany({
        where: { customerId, status: { in: [...activeStatuses] } },
        select: { productId: true },
      });
      if (active.some(({ productId }) => productId === frozen.productId)) throw alreadyReserved();
      if (active.length >= max) throw tooMany(max);
      const { id } = await tx.reservation.create({
        data: {
          ...frozen,
          ...input,
          events: { create: { action: 'request', fromStatus: 'NEW', toStatus: 'PENDING_REVIEW', actor: 'CUSTOMER', actorId: customerId } },
        },
      });
      return { row: await tx.reservation.findUniqueOrThrow({ where: { id }, include: include() }), created: true };
    });
  }

  /**
   * Único lugar que cambia el estado. Con la reserva bloqueada, `plan` decide a partir de la fila vigente;
   * después se ajustan las unidades y se anota el evento, todo o nada. Null si `plan` renuncia.
   */
  change(
    scope: ReservationScope | 'system',
    id: string,
    version: number | null,
    plan: (row: ReservationRow, tx: Transaction) => Promise<Change | null> | Change | null,
  ): Promise<ReservationRow | null> {
    return this.prisma.$transaction(async (tx) => {
      const row = await this.lock(tx, scope, id);
      if (!row) throw notFound();
      if (version !== null && row.version !== version) throw versionConflict();
      const change = await plan(row, tx);
      if (change) await this.apply(tx, row, change);
      return change ? tx.reservation.findUniqueOrThrow({ where: { id }, include: include() }) : null;
    });
  }

  /** Vence una reserva si sigue vencida. No espera a quien la tenga bloqueada. */
  expire(id: string, now: Date, change: Omit<Change, 'expiresAt'>): Promise<ReservationRow | null> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "reservation" WHERE "id" = ${id}::uuid AND "expiresAt" <= ${now} FOR UPDATE SKIP LOCKED`;
      if (locked.length === 0) return null;
      const row = await tx.reservation.findUniqueOrThrow({ where: { id }, include: include() });
      if (!(expirableStatuses as readonly string[]).includes(row.status)) return null;
      if (row.status === 'AWAITING_DEPOSIT' && row.payments.length > 0) return null;
      await this.apply(tx, row, { ...change, expiresAt: null });
      return tx.reservation.findUniqueOrThrow({ where: { id }, include: include() });
    });
  }

  /** Con dinero anotado no vence sola: la tienda debe decidir. */
  async overdue(now: Date, take: number): Promise<string[]> {
    const rows = await this.prisma.reservation.findMany({
      where: {
        status: { in: [...expirableStatuses] },
        expiresAt: { lte: now },
        NOT: { status: 'AWAITING_DEPOSIT', payments: { some: {} } },
      },
      select: { id: true },
      orderBy: { expiresAt: 'asc' },
      take,
    });
    return rows.map(({ id }) => id);
  }

  async addPayment(tx: Transaction, data: Omit<PaymentRecord, 'id' | 'at' | 'reversesId'> & { reversesId?: string }): Promise<void> {
    await tx.paymentRecord.create({ data });
  }

  /** Ejecuta con la reserva bloqueada y devuelve su estado final. */
  withLock(scope: ReservationScope, id: string, run: (row: ReservationRow, tx: Transaction) => Promise<Change | null>): Promise<ReservationRow> {
    return this.prisma.$transaction(async (tx) => {
      const row = await this.lock(tx, scope, id);
      if (!row) throw notFound();
      const change = await run(row, tx);
      if (change) await this.apply(tx, row, change);
      return tx.reservation.findUniqueOrThrow({ where: { id }, include: include() });
    });
  }

  private async lock(tx: Transaction, scope: ReservationScope | 'system', id: string): Promise<ReservationRow | null> {
    await tx.$queryRaw`SELECT 1 FROM "reservation" WHERE "id" = ${id}::uuid FOR UPDATE`;
    return tx.reservation.findFirst({ where: { ...(scope === 'system' ? {} : scopeWhere(scope)), id }, include: include() });
  }

  private async apply(tx: Transaction, row: ReservationRow, { action, to, actor, actorId, reason, expiresAt, data }: Change): Promise<void> {
    const unitHeld = await settleUnits(tx, row, to);
    // Una propuesta solo existe mientras el cliente decide.
    const offer = to === 'AWAITING_CUSTOMER' ? {} : { offerPriceMinor: null, offerDepositMinor: null, offerAvailableOn: null };
    await tx.reservation.update({
      where: { id: row.id },
      data: { ...data, ...offer, status: to, expiresAt, unitHeld: isActive(to) || to === 'COMPLETED' ? unitHeld : false, version: { increment: 1 } },
    });
    await tx.reservationEvent.create({ data: { reservationId: row.id, action, fromStatus: row.status, toStatus: to, actor, actorId, reason } });
  }
}

type Generated =
  | 'id'
  | 'status'
  | 'version'
  | 'offerPriceMinor'
  | 'offerDepositMinor'
  | 'offerAvailableOn'
  | 'unitHeld'
  | 'approvedAt'
  | 'createdAt'
  | 'updatedAt';
