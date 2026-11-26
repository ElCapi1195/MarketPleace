import { randomBytes } from 'node:crypto';
import { fold, slugify } from '@marketplace/core';
import type { AdminProduct, ProductInput, ProductPatch } from '@marketplace/contracts';
import type { VerticalConfig } from '@marketplace/verticals';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ActorData } from '../../common/actor.js';
import { VERTICAL } from '../../config/vertical.js';
import { AuditService } from '../audit/audit.service.js';
import { StoreRepository } from '../stores/store.repository.js';
import { invalidAttributes } from './attributes.js';
import { ProductRepository } from './product.repository.js';
import { adminView, type ProductRow } from './product.views.js';

const PAGE_SIZE = 50;

const invalid = (fields: string[]) =>
  new BadRequestException({ code: 'VALIDATION_ERROR', message: `Revisa: ${fields.join(', ')}.` });

/** Gestión de productos. Quien llama ya está autorizado. */
@Injectable()
export class ProductService {
  constructor(
    @Inject(ProductRepository) private readonly products: ProductRepository,
    @Inject(StoreRepository) private readonly stores: StoreRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(VERTICAL) private readonly vertical: VerticalConfig,
  ) {}

  async list(page: number) {
    const [rows, total] = await Promise.all([this.products.findPage(page, PAGE_SIZE), this.products.count()]);
    return { items: rows.map(adminView), total, page, pageSize: PAGE_SIZE };
  }

  async get(id: string): Promise<AdminProduct> {
    return adminView(await this.load(id));
  }

  async create(actor: ActorData, input: ProductInput): Promise<AdminProduct> {
    const searchText = await this.check(input);
    const base = slugify(input.title);
    const slug = (await this.products.slugTaken(base)) ? `${base}-${randomBytes(4).toString('hex')}` : base;
    const row = await this.products.create(input, { slug, searchText, createdBy: actor.actorId });
    await this.record(actor, 'product.created', row.id);
    return adminView(row);
  }

  async update(actor: ActorData, id: string, { version, product }: ProductPatch): Promise<AdminProduct> {
    await this.load(id);
    const searchText = await this.check(product);
    if (!(await this.products.update(id, version, product, searchText))) {
      throw new ConflictException({ code: 'VERSION_CONFLICT', message: 'Otra persona cambió este producto. Vuelve a cargarlo.' });
    }
    await this.record(actor, 'product.updated', id);
    return this.get(id);
  }

  async publish(actor: ActorData, id: string): Promise<AdminProduct> {
    const row = await this.load(id);
    if (row.store.status !== 'ACTIVE') {
      throw new UnprocessableEntityException({ code: 'STORE_SUSPENDED', message: 'La tienda está suspendida.' });
    }
    if (!row.media.some(({ kind }) => kind === 'IMAGE')) {
      throw new UnprocessableEntityException({ code: 'IMAGE_REQUIRED', message: 'Añade al menos una foto antes de publicar.' });
    }
    if (await this.products.setStatus(id, ['DRAFT', 'ARCHIVED'], 'PUBLISHED', new Date())) {
      await this.record(actor, 'product.published', id);
    }
    return this.get(id);
  }

  async archive(actor: ActorData, id: string): Promise<AdminProduct> {
    await this.load(id);
    if (await this.products.setStatus(id, ['DRAFT', 'PUBLISHED'], 'ARCHIVED')) {
      await this.record(actor, 'product.archived', id);
    }
    return this.get(id);
  }

  private async load(id: string): Promise<ProductRow> {
    const row = await this.products.findById(id);
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'El producto no existe.' });
    return row;
  }

  /** Comprueba el producto contra el nicho y la tienda; devuelve su texto de búsqueda. */
  private async check({ categorySlug, attributes, kind, storeId, title }: ProductInput): Promise<string> {
    const wrong = invalidAttributes(this.vertical, categorySlug, attributes);
    if (wrong === null) throw invalid(['categorySlug']);
    if (wrong.length > 0) throw invalid(wrong.map((key) => `attributes.${key}`));
    if (!this.vertical.reservations.kinds.includes(kind)) throw invalid(['kind']);
    const store = await this.stores.findById(storeId);
    if (!store) throw invalid(['storeId']);
    return fold(`${title} ${store.name}`);
  }

  private record(actor: ActorData, action: string, targetId: string): Promise<void> {
    return this.audit.record({ ...actor, action, targetType: 'product', targetId });
  }
}
