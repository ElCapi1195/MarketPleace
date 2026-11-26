import { reservationNeedsReason, reservationTransition, type ReservationAction } from '@marketplace/core';
import type { ReservationStatus } from '@marketplace/contracts';

const NO_CONTEXT = { offer: false, depositDue: false };

const STORE_LABELS: [ReservationAction, string][] = [
  ['approve', 'Aprobar'],
  ['start', 'Ya lo pedí'],
  ['ready', 'Está listo'],
  ['complete', 'Entregado'],
  ['no_show', 'No se presentó'],
  ['reject', 'Rechazar'],
  ['cancel', 'Cancelar'],
];

/** Acciones de la tienda en el estado actual, en orden de uso. */
export function storeActions({ status, expiresAt }: { status: ReservationStatus; expiresAt: string | null }, now: Date) {
  return STORE_LABELS.filter(([action]) => {
    if (action === 'no_show' && expiresAt !== null && new Date(expiresAt) > now) return false;
    return reservationTransition(status, action, 'STORE', NO_CONTEXT) !== null;
  }).map(([action, label]) => ({ action, label, needsReason: reservationNeedsReason(action) }));
}

/** Ante una propuesta, «no aceptar» sustituye a cancelar. */
export function customerCan(status: ReservationStatus) {
  const can = (action: ReservationAction) => reservationTransition(status, action, 'CUSTOMER', NO_CONTEXT) !== null;
  return { accept: can('accept'), decline: can('decline'), cancel: can('cancel') && !can('decline') };
}
