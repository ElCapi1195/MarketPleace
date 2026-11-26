import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { documentTypes, MAX_DOCUMENT_BYTES, type StoreDocumentView } from '@marketplace/contracts';
import type { VerticalConfig } from '@marketplace/verticals';
import { Inject, Injectable, UnsupportedMediaTypeException } from '@nestjs/common';
import type { ActorData } from '../../common/actor.js';
import { VERTICAL } from '../../config/vertical.js';
import { AuditService } from '../audit/audit.service.js';
import type { CurrentStoreData, CurrentUserData } from '../identity/access.js';
import { processDocument } from '../media/document.js';
import { readBody } from '../media/read-body.js';
import type { StoragePort, StoredFile } from '../media/storage.js';
import { EDITABLE } from './application.service.js';
import { DocumentRepository } from './document.repository.js';
import { notEditable, notFound, ownStore } from './store.errors.js';
import { StoreRepository } from './store.repository.js';
import { DOCUMENTS } from './store.tokens.js';

export interface DocumentFile extends StoredFile {
  type: string;
  filename: string;
}

@Injectable()
export class DocumentService {
  constructor(
    @Inject(DocumentRepository) private readonly documents: DocumentRepository,
    @Inject(StoreRepository) private readonly stores: StoreRepository,
    @Inject(DOCUMENTS) private readonly storage: StoragePort,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(VERTICAL) private readonly vertical: VerticalConfig,
  ) {}

  async upload(actor: ActorData, store: CurrentStoreData, key: string, request: IncomingMessage): Promise<StoreDocumentView> {
    if (!this.vertical.storeVerification.documents.some((document) => document.key === key)) throw notFound();
    if (!(EDITABLE as readonly string[]).includes(store.status)) throw notEditable();
    const type = request.headers['content-type']?.split(';')[0]?.trim().toLowerCase() ?? '';
    if (!(documentTypes as readonly string[]).includes(type)) {
      throw new UnsupportedMediaTypeException({ code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Sube un PDF o una imagen JPEG, PNG o WebP.' });
    }
    const processed = await processDocument(await readBody(request, MAX_DOCUMENT_BYTES), type);
    const id = randomUUID();
    try {
      await this.storage.put(id, 'doc', processed.data);
      const saved = await this.documents.put(
        { id, storeId: store.id, key, type: processed.type, bytes: processed.data.length, uploadedBy: actor.actorId },
        EDITABLE,
      );
      if (!saved) throw notEditable();
      if (saved.previousId) await this.storage.remove(saved.previousId);
      await this.record(actor, 'store.document_added', store.id, key);
      const { type: savedType, bytes, createdAt } = saved.created;
      return { id, key, type: savedType, bytes, createdAt: createdAt.toISOString() };
    } catch (error) {
      await this.storage.remove(id).catch(() => {});
      throw error;
    }
  }

  async remove(actor: ActorData, store: CurrentStoreData, id: string): Promise<void> {
    const document = await this.documents.find(store.id, id);
    if (!document) throw notFound();
    const result = await this.documents.remove(store.id, id, EDITABLE);
    if (result === 'locked') throw notEditable();
    if (result === 'missing') throw notFound();
    await this.storage.remove(id);
    await this.record(actor, 'store.document_removed', store.id, document.key);
  }

  /** Descarga por un miembro de la tienda. */
  async open(storeId: string, id: string): Promise<DocumentFile> {
    const document = await this.documents.find(storeId, id);
    const file = document ? await this.storage.open(id, 'doc') : null;
    if (!document || !file) throw notFound();
    const extension = document.type === 'application/pdf' ? 'pdf' : 'webp';
    return { ...file, type: document.type, filename: `${document.key}.${extension}` };
  }

  /** Descarga por quien revisa: se anota antes de entregar el archivo. */
  async openForReview(user: CurrentUserData, actor: ActorData, storeId: string, id: string): Promise<DocumentFile> {
    if (await this.stores.find(storeId, user.id)) throw ownStore();
    const [document, store] = await Promise.all([this.documents.find(storeId, id), this.stores.findById(storeId)]);
    if (!document || !store || store.status === 'DRAFT') throw notFound();
    await this.record(actor, 'store.document_viewed', storeId, document.key);
    return this.open(storeId, id);
  }

  private record(actor: ActorData, action: string, targetId: string, document: string): Promise<void> {
    return this.audit.record({ ...actor, action, targetType: 'store', targetId, metadata: { document } });
  }
}
