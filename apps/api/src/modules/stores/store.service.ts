import { slugify } from '@marketplace/core';
import type { StoreInput, StoreView } from '@marketplace/contracts';
import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type { ActorData } from '../../common/actor.js';
import { AuditService } from '../audit/audit.service.js';
import { StoreRepository } from './store.repository.js';

const view = ({ id, name }: StoreView): StoreView => ({ id, name });

/** Tiendas que da de alta la administración, sin solicitud. */
@Injectable()
export class StoreService {
  constructor(
    @Inject(StoreRepository) private readonly stores: StoreRepository,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(): Promise<StoreView[]> {
    return (await this.stores.findApproved()).map(view);
  }

  async create(actor: ActorData, { name }: StoreInput): Promise<StoreView> {
    const slug = slugify(name);
    if (await this.stores.findBySlug(slug)) {
      throw new ConflictException({ code: 'STORE_EXISTS', message: 'Ya existe una tienda con ese nombre.' });
    }
    const store = await this.stores.createApproved({ slug, name }, actor.actorId);
    await this.audit.record({ ...actor, action: 'store.created', targetType: 'store', targetId: store.id });
    return view(store);
  }
}
