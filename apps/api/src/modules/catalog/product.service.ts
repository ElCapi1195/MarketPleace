import { randomBytes } from 'node:crypto';
import { fold, remoderates, slugify } from '@marketplace/core';
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
import { assertWritable, type Scope } from './scope.js';

const PAGE_SIZE = 50;

const invalid = (fields: string[]) =>
  new BadRequestException({ code: 'VALIDATION_ERROR', message: `Revisa: ${fields.join(', ')}.` });

export const versionConflict = () =>
  new ConflictException({ code: 'VERSION_CONFLICT', message: 'Otra persona cambió este producto. Vuelve a cargarlo.' });

export const storeSuspended = () =>
  new UnprocessableEntityException({ code: 'STORE_SUSPENDED', message: 'La tienda no está activa.' });

/** Gestión de productos. Quien llama ya está autorizado para ese alcance. */
@Injectable()
export class ProductService {
  constructor(
    @Inject(ProductRepository) private readonly products: ProductRepository,
    @Inject(StoreRepository) private readonly stores: StoreRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(VERTICAL) private readonly vertical: VerticalConfig,
  ) {}

  async list(scope: Scope, page: number) {
    const [rows, total] = await Promise.all([this.products.findPage(scope, page, PAGE_SIZE), this.products.count(scope)]);
    return { items: rows.map(adminView), total, page, pageSize: PAGE_SIZE };
  }

  async get(scope: Scope, id: string): Promise<AdminProduct> {
    return adminView(await this.load(scope, id));
  }

  async create(actor: ActorData, scope: Scope, input: ProductInput): Promise<AdminProduct> {
    assertWritable(scope);
    // Destacar es una decisión de la plataforma.
    const product = scope.kind === 'store' ? { ...input, featured: false } : input;
    const searchText = await this.check(scope, product);
    const base = slugify(product.title);
    const slug = (await this.products.slugTaken(base)) ? `${base}-${randomBytes(4).toString('hex')}` : base;
    const row = await this.products.create(product, { slug, searchText, createdBy: actor.actorId });
    await this.record(actor, 'product.created', row.id);
    return adminView(row);
  }

  async update(actor: ActorData, scope: Scope, id: string, { version, product: input }: ProductPatch): Promise<AdminProduct> {
    assertWritable(scope);
    const row = await this.load(scope, id);
    const product = scope.kind === 'store' ? { ...input, featured: row.featured } : input;
    const searchText = await this.check(scope, product);
    const again =
      scope.kind === 'store' && row.status === 'PUBLISHED' && remoderates(row, product, this.vertical.listings.remoderateOn);
    // La versión garantiza que el estado leído sigue vigente al escribir.
    if (row.version !== version) throw versionConflict();
    const saved = await this.products.update(scope, id, version, product, {
      searchText,
      ...(again && { status: 'PENDING_MODERATION' as const }),
    });
    if (!saved) throw versionConflict();
    await this.record(actor, again ? 'product.remoderated' : 'product.updated', id);
    return this.get(scope, id);
  }

  /** Publicación directa, solo de la plataforma. */
  async publish(actor: ActorData, scope: Scope, id: string): Promise<AdminProduct> {
    const row = await this.load(scope, id);
    if (row.store.status !== 'APPROVED') throw storeSuspended();
    this.assertImage(row);
    if (await this.products.apply(scope, id, 'publish', { publishedAt: new Date(), rejection: '' })) {
      await this.record(actor, 'product.published', id);
    }
    return this.get(scope, id);
  }

  /** Envío a moderación, desde la tienda. */
  async submit(actor: ActorData, scope: Scope, id: string): Promise<AdminProduct> {
    assertWritable(scope);
    this.assertImage(await this.load(scope, id));
    if (await this.products.apply(scope, id, 'submit', { rejection: '' })) await this.record(actor, 'product.submitted', id);
    return this.get(scope, id);
  }

  async archive(actor: ActorData, scope: Scope, id: string): Promise<AdminProduct> {
    assertWritable(scope);
    await this.load(scope, id);
    if (await this.products.apply(scope, id, 'archive')) await this.record(actor, 'product.archived', id);
    return this.get(scope, id);
  }

  private assertImage(row: ProductRow): void {
    if (!row.media.some(({ kind }) => kind === 'IMAGE')) {
      throw new UnprocessableEntityException({ code: 'IMAGE_REQUIRED', message: 'Añade al menos una foto antes de publicar.' });
    }
  }

  private async load(scope: Scope, id: string): Promise<ProductRow> {
    const row = await this.products.findById(scope, id);
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'El producto no existe.' });
    return row;
  }

  /** Comprueba el producto contra el nicho y la tienda; devuelve su texto de búsqueda. */
  private async check(scope: Scope, { categorySlug, attributes, kind, storeId, title }: ProductInput): Promise<string> {
    if (scope.kind === 'store' && storeId !== scope.id) throw invalid(['storeId']);
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
