import type { Permission } from './permissions.js';

export const storeStatuses = ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'NEEDS_INFO', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const;
export type StoreStatus = (typeof storeStatuses)[number];

export const storeActions = ['submit', 'start_review', 'request_info', 'approve', 'reject', 'suspend', 'reinstate'] as const;
export type StoreAction = (typeof storeActions)[number];

interface Rule {
  from: readonly StoreStatus[];
  to: StoreStatus;
  /** Permiso de plataforma; null si la acción es del propietario. */
  permission: Permission | null;
  reason: boolean;
}

const rules = new Map<string, Rule>([
  ['submit', { from: ['DRAFT', 'NEEDS_INFO'], to: 'SUBMITTED', permission: null, reason: false }],
  ['start_review', { from: ['SUBMITTED'], to: 'IN_REVIEW', permission: 'store.verify', reason: false }],
  ['request_info', { from: ['IN_REVIEW'], to: 'NEEDS_INFO', permission: 'store.verify', reason: true }],
  ['approve', { from: ['IN_REVIEW'], to: 'APPROVED', permission: 'store.verify', reason: false }],
  ['reject', { from: ['IN_REVIEW'], to: 'REJECTED', permission: 'store.verify', reason: true }],
  ['suspend', { from: ['APPROVED'], to: 'SUSPENDED', permission: 'store.suspend', reason: true }],
  ['reinstate', { from: ['SUSPENDED'], to: 'APPROVED', permission: 'store.suspend', reason: true }],
]);

/** Estado al que lleva una acción; null si no se admite desde el actual. */
export function storeTransition(status: string, action: StoreAction): StoreStatus | null {
  const rule = rules.get(action);
  return rule && (rule.from as readonly string[]).includes(status) ? rule.to : null;
}

export function needsReason(action: StoreAction): boolean {
  return rules.get(action)?.reason ?? true;
}

export function storeActionPermission(action: StoreAction): Permission | null {
  return rules.get(action)?.permission ?? null;
}

/** Estados en los que el solicitante puede corregir sus datos y documentos. */
export function storeEditable(status: string): boolean {
  return status === 'DRAFT' || status === 'NEEDS_INFO';
}

export const storeRoles = ['OWNER', 'MANAGER', 'STAFF'] as const;
export type StoreRole = (typeof storeRoles)[number];

export const storePermissions = [
  'member.manage',
  'product.manage',
  'reservation.approve',
  'reservation.read',
  'store.edit',
  'store.read',
] as const;
export type StorePermission = (typeof storePermissions)[number];

const granted = new Map<string, ReadonlySet<string>>([
  ['OWNER', new Set<StorePermission>(storePermissions)],
  ['MANAGER', new Set<StorePermission>(['product.manage', 'reservation.approve', 'reservation.read', 'store.read'])],
  ['STAFF', new Set<StorePermission>(['product.manage', 'reservation.read', 'store.read'])],
]);

/** Permiso de un miembro dentro de su tienda. */
export function storeCan(role: string, permission: StorePermission): boolean {
  return granted.get(role)?.has(permission) ?? false;
}
