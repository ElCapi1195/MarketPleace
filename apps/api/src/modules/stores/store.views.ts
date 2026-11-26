import type { StoreDetail, StoreDocumentView, StoreEventView, StoreReview, StoreSummary } from '@marketplace/contracts';
import { storeCan, type StoreRole, type StoreStatus } from '@marketplace/core';
import type { Store, StoreDocument, StoreEvent } from '../../generated/prisma/client.js';

export type StoreRow = Store & { documents: StoreDocument[]; events: StoreEvent[] };

const statusOf = (store: Store) => store.status as StoreStatus;

const documentView = ({ id, key, type, bytes, createdAt }: StoreDocument): StoreDocumentView => ({
  id,
  key,
  type,
  bytes,
  createdAt: createdAt.toISOString(),
});

/** Sin autor: quien solicita no necesita saber quién la revisó. */
const eventView = ({ at, action, toStatus, reason }: StoreEvent): StoreEventView => ({
  at: at.toISOString(),
  action,
  toStatus: toStatus as StoreStatus,
  reason,
});

const details = (store: StoreRow) => ({
  id: store.id,
  slug: store.slug,
  name: store.name,
  about: store.about,
  pickupInfo: store.pickupInfo,
  legalName: store.legalName,
  taxId: store.taxId,
  phone: store.phone,
  address: store.address,
  status: statusOf(store),
  documents: store.documents.map(documentView),
  events: store.events.map(eventView),
});

export const summaryView = (store: Store, role: string): StoreSummary => ({
  id: store.id,
  name: store.name,
  status: statusOf(store),
  role: role as StoreRole,
});

const PRIVATE = { legalName: '', taxId: '', phone: '', address: '', documents: [], events: [] };

/** Los datos de verificación solo salen hacia quien puede editarlos. */
export const detailView = (store: StoreRow, role: string): StoreDetail => ({
  ...details(store),
  ...(!storeCan(role, 'store.edit') && PRIVATE),
  role: role as StoreRole,
});

export const reviewView = (store: StoreRow, owners: StoreReview['owners']): StoreReview => ({ ...details(store), owners });
