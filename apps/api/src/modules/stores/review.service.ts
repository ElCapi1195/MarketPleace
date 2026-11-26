import { can, needsReason, storeActionPermission, storeTransition, type StoreStatus } from '@marketplace/core';
import type { StoreDecisionInput, StoreReview, StoreSummaryPage } from '@marketplace/contracts';
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { ActorData } from '../../common/actor.js';
import { AuditService } from '../audit/audit.service.js';
import type { CurrentUserData } from '../identity/access.js';
import { invalidTransition, notFound, ownStore, reasonRequired } from './store.errors.js';
import { STORE_EMAILS } from './store.tokens.js';
import type { StoreEmails } from './store.emails.js';
import { StoreRepository } from './store.repository.js';
import { reviewView, type StoreRow } from './store.views.js';

const PAGE_SIZE = 30;

/** Verificación y supervisión de tiendas. */
@Injectable()
export class ReviewService {
  constructor(
    @Inject(StoreRepository) private readonly stores: StoreRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(STORE_EMAILS) private readonly emails: StoreEmails,
  ) {}

  async list(status: Exclude<StoreStatus, 'DRAFT'> | undefined, page: number): Promise<StoreSummaryPage> {
    const rows = await this.stores.findPage(status, page, PAGE_SIZE + 1);
    return {
      items: rows.slice(0, PAGE_SIZE).map(({ id, name, status: current, updatedAt }) => ({
        id,
        name,
        status: current as StoreStatus,
        updatedAt: updatedAt.toISOString(),
      })),
      page,
      hasMore: rows.length > PAGE_SIZE,
    };
  }

  async get(user: CurrentUserData, id: string): Promise<StoreReview> {
    return this.view(await this.load(user, id));
  }

  async decide(user: CurrentUserData, actor: ActorData, id: string, { action, reason }: StoreDecisionInput): Promise<StoreReview> {
    const permission = storeActionPermission(action);
    if (permission === null || !can(user.platformRole, permission)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'No tienes permiso.' });
    }
    const store = await this.load(user, id);
    if (needsReason(action) && reason === '') throw reasonRequired();
    const to = storeTransition(store.status, action);
    if (to === null) throw invalidTransition();
    if (!(await this.stores.transition({ id, from: store.status, to, action, reason, actorId: actor.actorId }))) throw invalidTransition();

    await this.audit.record({ ...actor, action: `store.${action}`, targetType: 'store', targetId: id });
    for (const { user: recipient } of await this.stores.owners(id)) this.emails.decision(recipient.email, store, action, reason);
    return this.view(await this.load(user, id));
  }

  private async view(store: StoreRow): Promise<StoreReview> {
    return reviewView(store, (await this.stores.owners(store.id)).map(({ user }) => user));
  }

  /** Una solicitud sin enviar no se revisa, y nadie revisa la suya. */
  private async load(user: CurrentUserData, id: string): Promise<StoreRow> {
    if (await this.stores.find(id, user.id)) throw ownStore();
    const store = await this.stores.findById(id);
    if (!store || store.status === 'DRAFT') throw notFound();
    return store;
  }
}
