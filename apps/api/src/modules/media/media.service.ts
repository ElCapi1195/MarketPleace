import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { imageTypes, MAX_IMAGE_BYTES, MAX_MODEL_BYTES, modelType, type MediaPatch, type MediaView } from '@marketplace/contracts';
import type { VerticalConfig } from '@marketplace/verticals';
import { ConflictException, Inject, Injectable, NotFoundException, UnsupportedMediaTypeException } from '@nestjs/common';
import type { ActorData } from '../../common/actor.js';
import { VERTICAL } from '../../config/vertical.js';
import { AuditService } from '../audit/audit.service.js';
import { assertWritable, PLATFORM, type Scope } from '../catalog/scope.js';
import { inspectGlb } from './glb.js';
import { processImage } from './image.js';
import { MediaRepository, type NewMedia } from './media.repository.js';
import { mediaView } from './media.views.js';
import { readBody } from './read-body.js';
import { STORAGE, variants, type StoragePort, type StoredFile, type Variant } from './storage.js';

const notFound = () => new NotFoundException({ code: 'NOT_FOUND', message: 'No existe.' });
const isImageType = (type: string | undefined) => (imageTypes as readonly (string | undefined)[]).includes(type);

@Injectable()
export class MediaService {
  constructor(
    @Inject(MediaRepository) private readonly media: MediaRepository,
    @Inject(STORAGE) private readonly storage: StoragePort,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(VERTICAL) private readonly vertical: VerticalConfig,
  ) {}

  /** Recibe el archivo en el cuerpo de la petición, que se lee después de autorizarla. */
  async upload(actor: ActorData, scope: Scope, productId: string, request: IncomingMessage): Promise<MediaView> {
    assertWritable(scope);
    const type = request.headers['content-type']?.split(';')[0]?.trim().toLowerCase();
    if (!isImageType(type) && type !== modelType) {
      throw new UnsupportedMediaTypeException({
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Sube fotos JPEG, PNG o WebP, o un modelo .glb.',
      });
    }
    if (!(await this.media.productExists(scope, productId))) throw notFound();
    const kind = type === modelType ? 'MODEL' : 'IMAGE';
    const body = await readBody(request, kind === 'MODEL' ? MAX_MODEL_BYTES : MAX_IMAGE_BYTES);
    return this.add(actor, scope, productId, kind, body);
  }

  /** Valida y guarda un archivo ya recibido. */
  async add(actor: ActorData, scope: Scope, productId: string, kind: MediaView['kind'], body: Buffer): Promise<MediaView> {
    const moderate = this.moderates(scope);
    const view = kind === 'MODEL' ? await this.replaceModel(productId, body, moderate) : await this.addImage(productId, body, moderate);
    await this.record(actor, 'media.added', productId, view);
    return view;
  }

  async patch(scope: Scope, id: string, changes: MediaPatch): Promise<MediaView> {
    assertWritable(scope);
    const { productId } = await this.load(scope, id);
    const media = await this.media.patch(id, productId, changes, this.moderates(scope));
    if (!media) throw notFound();
    return mediaView(media);
  }

  async remove(actor: ActorData, scope: Scope, id: string): Promise<void> {
    assertWritable(scope);
    const media = await this.load(scope, id);
    const result = await this.media.remove(id, media.productId, this.moderates(scope));
    if (result === 'missing') throw notFound();
    if (result === 'last-image') {
      throw new ConflictException({
        code: 'LAST_IMAGE',
        message: 'Un producto publicado necesita una foto. Sube otra antes o archívalo.',
      });
    }
    await this.storage.remove(id);
    await this.record(actor, 'media.removed', media.productId, mediaView(media));
  }

  /** Archivo de un producto visible para cualquiera. */
  async openPublic(id: string, variant: string): Promise<StoredFile> {
    const { product } = await this.load(PLATFORM, id);
    if (product.status !== 'PUBLISHED' || product.store.status !== 'APPROVED') throw notFound();
    return this.openFile(id, variant);
  }

  /** Archivo de un producto en revisión, para quien modera. */
  async openPending(id: string, variant: string): Promise<StoredFile> {
    const { product } = await this.load(PLATFORM, id);
    if (product.status !== 'PENDING_MODERATION') throw notFound();
    return this.openFile(id, variant);
  }

  async openPrivate(scope: Scope, id: string, variant: string): Promise<StoredFile> {
    await this.load(scope, id);
    return this.openFile(id, variant);
  }

  /** Los cambios de la plataforma no necesitan otra revisión. */
  private moderates(scope: Scope): boolean {
    return scope.kind === 'store' && this.vertical.listings.remoderateOn.includes('images');
  }

  private async openFile(id: string, variant: string): Promise<StoredFile> {
    const known = variants.find((name) => name === variant);
    const file = known ? await this.storage.open(id, known) : null;
    if (!file) throw notFound();
    return file;
  }

  private async addImage(productId: string, body: Buffer, moderate: boolean): Promise<MediaView> {
    const { lg, sm, width, height } = await processImage(body);
    const media: NewMedia = { id: randomUUID(), productId, kind: 'IMAGE', width, height, bytes: lg.length };
    const { maxImages } = this.vertical.listings;
    return this.stored(media, { lg, sm }, async () => {
      const row = await this.media.addImage(media, maxImages, moderate);
      if (!row) throw new ConflictException({ code: 'TOO_MANY_IMAGES', message: `Máximo ${maxImages} fotos por producto.` });
      return mediaView(row);
    });
  }

  private async replaceModel(productId: string, body: Buffer, moderate: boolean): Promise<MediaView> {
    await inspectGlb(body);
    const media: NewMedia = { id: randomUUID(), productId, kind: 'MODEL', width: null, height: null, bytes: body.length };
    return this.stored(media, { model: body }, async () => {
      const result = await this.media.replaceModel(media, moderate);
      if (!result) throw notFound();
      if (result.previousId) await this.storage.remove(result.previousId);
      return mediaView(result.created);
    });
  }

  /** Guarda los archivos y después la fila; si la fila no entra, no quedan archivos huérfanos. */
  private async stored(
    { id }: NewMedia,
    files: Partial<Record<Variant, Buffer>>,
    save: () => Promise<MediaView>,
  ): Promise<MediaView> {
    try {
      for (const variant of variants) {
        const data = files[variant];
        if (data) await this.storage.put(id, variant, data);
      }
      return await save();
    } catch (error) {
      await this.storage.remove(id).catch(() => {});
      throw error;
    }
  }

  private async load(scope: Scope, id: string) {
    const media = await this.media.find(scope, id);
    if (!media) throw notFound();
    return media;
  }

  private record(actor: ActorData, action: string, productId: string, { id, kind, bytes }: MediaView): Promise<void> {
    return this.audit.record({ ...actor, action, targetType: 'product', targetId: productId, metadata: { mediaId: id, kind, bytes } });
  }
}
