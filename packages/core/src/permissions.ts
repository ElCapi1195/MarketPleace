export const platformRoles = ['customer', 'moderator', 'admin'] as const;
export type PlatformRole = (typeof platformRoles)[number];

export const permissions = [
  'audit.read',
  'catalog.manage',
  'listing.moderate',
  'reservation.intervene',
  'store.verify',
  'user.suspend',
] as const;
export type Permission = (typeof permissions)[number];

// Map y no objeto: un rol como "constructor" no debe resolver propiedades heredadas.
const granted = new Map<string, ReadonlySet<string>>([
  ['customer', new Set()],
  ['moderator', new Set<Permission>(['listing.moderate', 'store.verify'])],
  ['admin', new Set<Permission>(permissions)],
]);

export function isPlatformRole(role: string): role is PlatformRole {
  return granted.has(role);
}

export function can(role: string, permission: Permission): boolean {
  return granted.get(role)?.has(permission) ?? false;
}

/** Todo rol con permisos exige 2FA. Un rol desconocido se trata como el más sensible. */
export function requiresTwoFactor(role: string): boolean {
  const own = granted.get(role);
  return own === undefined || own.size > 0;
}
