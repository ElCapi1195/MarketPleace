import type { StoreRole, StoreStatus } from './store-types.js';

export interface StoreSummary {
  id: string;
  name: string;
  status: StoreStatus;
  role: StoreRole;
}

export interface StoreDocumentView {
  id: string;
  key: string;
  type: string;
  bytes: number;
  createdAt: string;
}

export interface StoreEventView {
  at: string;
  action: string;
  toStatus: StoreStatus;
  reason: string;
}

interface StoreData {
  id: string;
  slug: string;
  name: string;
  about: string;
  legalName: string;
  taxId: string;
  phone: string;
  address: string;
  status: StoreStatus;
  documents: StoreDocumentView[];
  /** Del más reciente al más antiguo. */
  events: StoreEventView[];
}

export interface StoreDetail extends StoreData {
  role: StoreRole;
}

export interface StoreReview extends StoreData {
  owners: { name: string; email: string }[];
}

export interface StoreSummaryPage {
  items: { id: string; name: string; status: StoreStatus; updatedAt: string }[];
  page: number;
  hasMore: boolean;
}

export interface MemberView {
  userId: string;
  name: string;
  email: string;
  role: StoreRole;
  twoFactorEnabled: boolean;
}

export interface InvitationView {
  id: string;
  email: string;
  role: StoreRole;
  expiresAt: string;
}

export interface TeamView {
  members: MemberView[];
  invitations: InvitationView[];
}
