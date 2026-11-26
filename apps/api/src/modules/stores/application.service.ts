import { randomBytes } from 'node:crypto';
import { slugify, storeTransition, type StoreStatus } from '@marketplace/core';
import { requiredStoreFields, type StoreApplicationInput, type StoreDetail, type StoreSummary } from '@marketplace/contracts';
import type { VerticalConfig } from '@marketplace/verticals';
import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type { ActorData } from '../../common/actor.js';
import { VERTICAL } from '../../config/vertical.js';
import type { Store, StoreDocument } from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import type { CurrentStoreData } from '../identity/access.js';
import { incomplete, invalidTransition, notApproved, notEditable, notFound } from './store.errors.js';
import { StoreRepository } from './store.repository.js';
import { detailView, summaryView } from './store.views.js';

const MAX_OPEN = 3;
const OPEN: readonly StoreStatus[] = ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'NEEDS_INFO'];
export const EDITABLE: readonly StoreStatus[] = ['DRAFT', 'NEEDS_INFO'];

const FIELD_LABELS: Record<(typeof requiredStoreFields)[number], string> = {
  legalName: 'nombre legal',
  taxId: 'identificación fiscal',
  phone: 'teléfono',
  address: 'dirección',
};

/** La solicitud vista por quien la presenta. */
@Injectable()
export class ApplicationService {
  constructor(
    @Inject(StoreRepository) private readonly stores: StoreRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(VERTICAL) private readonly vertical: VerticalConfig,
  ) {}

  async mine(userId: string): Promise<StoreSummary[]> {
    return (await this.stores.findByMember(userId)).map(({ store, role }) => summaryView(store, role));
  }

  async create(actor: ActorData, input: StoreApplicationInput): Promise<StoreDetail> {
    if ((await this.stores.countOwned(actor.actorId, OPEN)) >= MAX_OPEN) {
      throw new ConflictException({ code: 'TOO_MANY_APPLICATIONS', message: 'Ya tienes varias solicitudes abiertas.' });
    }
    const base = slugify(input.name);
    const slug = (await this.stores.findBySlug(base)) ? `${base}-${randomBytes(4).toString('hex')}` : base;
    const store = await this.stores.createApplication(input, slug, actor.actorId);
    await this.record(actor, 'store.application_created', store.id);
    return detailView(store, 'OWNER');
  }

  async get({ id, role }: CurrentStoreData): Promise<StoreDetail> {
    const store = await this.stores.findById(id);
    if (!store) throw notFound();
    return detailView(store, role);
  }

  async update(actor: ActorData, store: CurrentStoreData, input: StoreApplicationInput): Promise<StoreDetail> {
    if (!(await this.stores.updateApplication(store.id, input, EDITABLE))) throw notEditable();
    await this.record(actor, 'store.application_updated', store.id);
    return this.get(store);
  }

  /** Lo que leerán los clientes con una reserva aprobada. Se puede cambiar cuando se quiera. */
  async setPickup(actor: ActorData, store: CurrentStoreData, pickupInfo: string): Promise<StoreDetail> {
    if (store.status !== 'APPROVED') throw notApproved();
    await this.stores.setPickup(store.id, pickupInfo);
    await this.record(actor, 'store.pickup_changed', store.id);
    return this.get(store);
  }

  async submit(actor: ActorData, store: CurrentStoreData): Promise<StoreDetail> {
    const to = storeTransition(store.status, 'submit');
    if (to === null) throw invalidTransition();
    const decision = { id: store.id, from: store.status, to, action: 'submit' as const, reason: '', actorId: actor.actorId };
    if (!(await this.stores.transition(decision, (row, documents) => this.assertComplete(row, documents)))) throw invalidTransition();
    await this.record(actor, 'store.submitted', store.id);
    return this.get(store);
  }

  private assertComplete(store: Store, documents: readonly StoreDocument[]): void {
    const missing = [
      ...requiredStoreFields.filter((field) => store[field] === '').map((field) => FIELD_LABELS[field]),
      ...this.vertical.storeVerification.documents
        .filter(({ key, required }) => required && !documents.some((document) => document.key === key))
        .map(({ label }) => label),
    ];
    if (missing.length > 0) throw incomplete(missing);
  }

  private record(actor: ActorData, action: string, targetId: string): Promise<void> {
    return this.audit.record({ ...actor, action, targetType: 'store', targetId });
  }
}
