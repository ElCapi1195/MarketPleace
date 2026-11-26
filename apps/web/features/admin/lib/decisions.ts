import { can, needsReason, storeActionPermission, storeTransition, type StoreAction } from '@marketplace/core';
import type { StoreStatus } from '@marketplace/contracts';

const LABELS: Partial<Record<StoreAction, string>> = {
  start_review: 'Empezar la revisión',
  approve: 'Aprobar',
  request_info: 'Pedir correcciones',
  reject: 'No aprobar',
  suspend: 'Suspender',
  reinstate: 'Restituir',
};

/** Decisiones posibles para esa persona en el estado actual, en orden de uso. */
export function availableDecisions(status: StoreStatus, role: string) {
  return (Object.entries(LABELS) as [StoreAction, string][])
    .filter(([action]) => {
      const permission = storeActionPermission(action);
      return permission !== null && can(role, permission) && storeTransition(status, action) !== null;
    })
    .map(([action, label]) => ({ action, label, needsReason: needsReason(action) }));
}
