import { describe, expect, it } from 'vitest';
import {
  needsReason,
  storeActionPermission,
  storeActions,
  storeCan,
  storePermissions,
  storeRoles,
  storeStatuses,
  storeTransition,
} from '../src/index.js';

const valid: Record<string, string> = {
  'DRAFT submit': 'SUBMITTED',
  'NEEDS_INFO submit': 'SUBMITTED',
  'SUBMITTED start_review': 'IN_REVIEW',
  'IN_REVIEW request_info': 'NEEDS_INFO',
  'IN_REVIEW approve': 'APPROVED',
  'IN_REVIEW reject': 'REJECTED',
  'APPROVED suspend': 'SUSPENDED',
  'SUSPENDED reinstate': 'APPROVED',
};

describe('storeTransition', () => {
  it.each(storeStatuses.flatMap((status) => storeActions.map((action) => [status, action] as const)))('%s con %s', (status, action) => {
    expect(storeTransition(status, action)).toBe(valid[`${status} ${action}`] ?? null);
  });

  it('no resuelve propiedades heredadas', () => {
    expect(storeTransition('constructor', 'approve')).toBeNull();
    expect(storeTransition('DRAFT', 'toString' as never)).toBeNull();
  });
});

describe('acciones', () => {
  it('exigen motivo las que detienen o devuelven', () => {
    expect(storeActions.filter(needsReason)).toEqual(['request_info', 'reject', 'suspend', 'reinstate']);
  });

  it('verificar es de moderación; suspender, solo de administración', () => {
    expect(storeActionPermission('approve')).toBe('store.verify');
    expect(storeActionPermission('suspend')).toBe('store.suspend');
    expect(storeActionPermission('reinstate')).toBe('store.suspend');
    expect(storeActionPermission('submit')).toBeNull();
  });
});

describe('storeCan', () => {
  const expected: Record<string, string[]> = {
    OWNER: [...storePermissions],
    MANAGER: ['product.manage', 'reservation.approve', 'reservation.read', 'store.read'],
    STAFF: ['product.manage', 'reservation.read', 'store.read'],
  };

  it.each(storeRoles.flatMap((role) => storePermissions.map((permission) => [role, permission] as const)))('%s y %s', (role, permission) => {
    expect(storeCan(role, permission)).toBe(expected[role]?.includes(permission));
  });

  it.each(['', 'owner', 'constructor', '__proto__'])('niega todo al rol desconocido %j', (role) => {
    for (const permission of storePermissions) expect(storeCan(role, permission)).toBe(false);
  });
});
