import type { StoreRole, StoreStatus } from '@marketplace/contracts';

const LABELS: Record<StoreStatus, string> = {
  DRAFT: 'Sin enviar',
  SUBMITTED: 'Enviada',
  IN_REVIEW: 'En revisión',
  NEEDS_INFO: 'Falta algo',
  APPROVED: 'Verificada',
  REJECTED: 'No aprobada',
  SUSPENDED: 'Suspendida',
};

export const storeStatusLabel = (status: StoreStatus) => LABELS[status];

const ROLES: Record<StoreRole, string> = { OWNER: 'Propietario', MANAGER: 'Encargado', STAFF: 'Personal' };

export const roleLabel = (role: StoreRole) => ROLES[role];

export const steps = ['Completas los datos', 'Envías la solicitud', 'Comprobamos los documentos', 'Publicas'] as const;

/** Paso en curso de la verificación; null si la solicitud se cerró sin aprobarse. */
export function currentStep(status: StoreStatus): number | null {
  switch (status) {
    case 'DRAFT':
    case 'NEEDS_INFO':
      return 0;
    case 'SUBMITTED':
      return 1;
    case 'IN_REVIEW':
      return 2;
    case 'APPROVED':
    case 'SUSPENDED':
      return 3;
    case 'REJECTED':
      return null;
  }
}

const EVENTS = new Map([
  ['submit', 'Solicitud enviada'],
  ['start_review', 'Empezó la revisión'],
  ['request_info', 'Se pidió corregir algo'],
  ['approve', 'Tienda verificada'],
  ['reject', 'Solicitud no aprobada'],
  ['suspend', 'Tienda suspendida'],
  ['reinstate', 'Tienda restituida'],
  ['created', 'Alta por la administración'],
]);

export const eventLabel = (action: string) => EVENTS.get(action) ?? action;
