import type { AdminProduct, ModerationInput } from '@marketplace/contracts';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ActorData } from '../../common/actor.js';
import { AuditService } from '../audit/audit.service.js';
import type { CurrentUserData } from '../identity/access.js';
import { ownStore } from '../stores/store.errors.js';
import { StoreRepository } from '../stores/store.repository.js';
import { ProductRepository } from './product.repository.js';
import { storeSuspended, versionConflict } from './product.service.js';
import { adminView, type ProductRow } from './product.views.js';
import { PLATFORM } from './scope.js';

const PAGE_SIZE = 30;

/** Revisión de productos antes de publicarse. Solo alcanza a lo pendiente. */
@Injectable()
export class ModerationService {
  constructor(
    @Inject(ProductRepository) private readonly products: ProductRepository,
    @Inject(StoreRepository) private readonly stores: StoreRepository,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(page: number) {
    const [rows, total] = await Promise.all([
      this.products.findPage(PLATFORM, page, PAGE_SIZE, 'PENDING_MODERATION'),
      this.products.count(PLATFORM, 'PENDING_MODERATION'),
    ]);
    return { items: rows.map(adminView), total, page, pageSize: PAGE_SIZE };
  }

  async get(id: string): Promise<AdminProduct> {
    return adminView(await this.load(id));
  }

  async decide(user: CurrentUserData, actor: ActorData, id: string, input: ModerationInput): Promise<AdminProduct> {
    const row = await this.load(id);
    if (await this.stores.find(row.storeId, user.id)) throw ownStore();
    const approve = input.action === 'approve';
    if (approve && row.store.status !== 'APPROVED') throw storeSuspended();
    const changes = approve ? { publishedAt: new Date(), rejection: '' } : { rejection: input.reason };
    if (!(await this.products.apply(PLATFORM, id, input.action, { version: input.version, ...changes }))) throw versionConflict();
    await this.audit.record({
      ...actor,
      action: approve ? 'product.approved' : 'product.rejected',
      targetType: 'product',
      targetId: id,
      ...(!approve && { metadata: { reason: input.reason } }),
    });
    const saved = await this.products.findById(PLATFORM, id);
    return adminView(saved ?? row);
  }

  private async load(id: string): Promise<ProductRow> {
    const row = await this.products.findById(PLATFORM, id);
    if (row?.status !== 'PENDING_MODERATION') throw new NotFoundException({ code: 'NOT_FOUND', message: 'No está pendiente de revisión.' });
    return row;
  }
}
