import { describe, expect, it } from 'vitest';
import { can, isPlatformRole, permissions, platformRoles, requiresTwoFactor } from '../src/index.js';

const expected: Record<(typeof platformRoles)[number], string[]> = {
  customer: [],
  moderator: ['listing.moderate', 'store.verify'],
  admin: [...permissions],
};

describe('can', () => {
  it.each(platformRoles.flatMap((role) => permissions.map((permission) => [role, permission] as const)))(
    '%s y %s',
    (role, permission) => {
      expect(can(role, permission)).toBe(expected[role].includes(permission));
    },
  );

  it.each(['', 'root', 'ADMIN', '__proto__', 'constructor', 'toString'])('niega todo al rol desconocido %j', (role) => {
    for (const permission of permissions) expect(can(role, permission)).toBe(false);
  });

  it('niega un permiso inexistente incluso al administrador', () => {
    expect(can('admin', 'todo.poder' as never)).toBe(false);
  });
});

describe('requiresTwoFactor', () => {
  it('lo exige a cualquier rol con permisos', () => {
    expect(requiresTwoFactor('moderator')).toBe(true);
    expect(requiresTwoFactor('admin')).toBe(true);
  });

  it('no lo impone al cliente', () => {
    expect(requiresTwoFactor('customer')).toBe(false);
  });

  it('ante un rol desconocido elige lo más estricto', () => {
    expect(requiresTwoFactor('root')).toBe(true);
  });
});

describe('isPlatformRole', () => {
  it('reconoce solo los roles definidos', () => {
    expect(isPlatformRole('admin')).toBe(true);
    expect(isPlatformRole('constructor')).toBe(false);
  });
});
