import { randomInt } from 'node:crypto';
import type { CustomerDecision, CustomerReservation, ReservationInput, ReservationPage } from '@marketplace/contracts';
import type { VerticalConfig } from '@marketplace/verticals';
import { Inject, Injectable } from '@nestjs/common';
import type { ActorData } from '../../common/actor.js';
import { VERTICAL } from '../../config/vertical.js';
import type { Product, Store } from '../../generated/prisma/client.js';
import { ReservationEngine } from './reservation.engine.js';
import { notFound, productChanged, productNotFound, reasonRequired, soldOut, termsChanged } from './reservation.errors.js';
import { ReservationRepository } from './reservation.repository.js';
import { customerView, summaryView } from './reservation.views.js';

const PAGE_SIZE = 20;
// Sin letras ni cifras que se confundan al dictarlo.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

function newCode(): string {
  const chars = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

const dateOnly = (date: Date | null) => date?.toISOString().slice(0, 10) ?? null;

/** La reserva vista por quien la pide. */
@Injectable()
export class CustomerReservationService {
  constructor(
    @Inject(ReservationRepository) private readonly reservations: ReservationRepository,
    @Inject(ReservationEngine) private readonly engine: ReservationEngine,
    @Inject(VERTICAL) private readonly vertical: VerticalConfig,
  ) {}

  async create(actor: ActorData, key: string, input: ReservationInput): Promise<CustomerReservation> {
    const { terms, maxActivePerCustomer } = this.vertical.reservations;
    if (input.termsVersion !== terms.version) throw termsChanged();
    const expiresAt = this.engine.deadline('PENDING_REVIEW') ?? new Date();
    const { row, created } = await this.reservations.create(
      {
        code: newCode(),
        customerId: actor.actorId,
        idempotencyKey: key,
        termsVersion: terms.version,
        phone: input.phone,
        note: input.note,
        expiresAt,
      },
      input.productSlug,
      maxActivePerCustomer,
      (product) => this.freeze(product, input),
    );
    if (created) await this.engine.announce(actor, row, 'request', 'CUSTOMER');
    return customerView(row);
  }

  async list(customerId: string, page: number): Promise<ReservationPage> {
    const rows = await this.reservations.findPage({ customerId }, {}, page, PAGE_SIZE + 1);
    return { items: rows.slice(0, PAGE_SIZE).map(summaryView), page, hasMore: rows.length > PAGE_SIZE };
  }

  async get(customerId: string, id: string): Promise<CustomerReservation> {
    const row = await this.reservations.find({ customerId }, id);
    if (!row) throw notFound();
    return customerView(row);
  }

  async accept(actor: ActorData, id: string, { version }: CustomerDecision): Promise<CustomerReservation> {
    const row = await this.reservations.change({ customerId: actor.actorId }, id, version, (current) => {
      const { offerPriceMinor, offerDepositMinor, offerAvailableOn } = current;
      return this.engine.plan(current, {
        action: 'accept',
        actor: 'CUSTOMER',
        actorId: actor.actorId,
        ...(offerPriceMinor !== null &&
          offerDepositMinor !== null && {
            depositMinor: offerDepositMinor,
            data: { priceMinor: offerPriceMinor, depositMinor: offerDepositMinor, availableOn: offerAvailableOn },
          }),
      });
    });
    if (!row) throw notFound();
    await this.engine.announce(actor, row, 'accept', 'CUSTOMER');
    return customerView(row);
  }

  async close(actor: ActorData, id: string, action: 'decline' | 'cancel', { version, reason }: CustomerDecision): Promise<CustomerReservation> {
    if (action === 'cancel' && reason === '') throw reasonRequired();
    const row = await this.reservations.change({ customerId: actor.actorId }, id, version, (current) =>
      this.engine.plan(current, { action, actor: 'CUSTOMER', actorId: actor.actorId, reason }),
    );
    if (!row) throw notFound();
    await this.engine.announce(actor, row, action, 'CUSTOMER', reason);
    return customerView(row);
  }

  /** Comprueba que el producto sigue siendo el que vio el cliente y copia sus condiciones. */
  private freeze(product: (Product & { store: Store }) | null, { expected }: ReservationInput) {
    if (!product || product.status !== 'PUBLISHED' || product.store.status !== 'APPROVED') throw productNotFound();
    if (product.units === 0) throw soldOut();
    if (
      product.priceMinor !== expected.priceMinor ||
      product.depositMinor !== expected.depositMinor ||
      dateOnly(product.availableOn) !== expected.availableOn
    ) {
      throw productChanged();
    }
    return {
      storeId: product.storeId,
      productId: product.id,
      kind: product.kind,
      productTitle: product.title,
      currency: this.vertical.currency,
      requestedPriceMinor: product.priceMinor,
      requestedDepositMinor: product.depositMinor,
      requestedAvailableOn: product.availableOn,
      priceMinor: product.priceMinor,
      depositMinor: product.depositMinor,
      availableOn: product.availableOn,
    };
  }
}
