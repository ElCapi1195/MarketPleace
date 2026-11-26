import type { CurrentStoreData } from '../identity/access.js';
import { notApproved } from '../stores/store.errors.js';

/** Alcance de una operación: toda la plataforma o una sola tienda. Es obligatorio en servicios y repositorios. */
export type Scope = { kind: 'platform' } | { kind: 'store'; id: string; status: string };

export const PLATFORM: Scope = { kind: 'platform' };

export const storeScope = ({ id, status }: CurrentStoreData): Scope => ({ kind: 'store', id, status });

/** Filtro que impide salir de la tienda. */
export const scoped = (scope: Scope): { storeId?: string } => (scope.kind === 'platform' ? {} : { storeId: scope.id });

/** Una tienda sin verificar o suspendida puede mirar, no cambiar. */
export function assertWritable(scope: Scope): void {
  if (scope.kind === 'store' && scope.status !== 'APPROVED') throw notApproved();
}
