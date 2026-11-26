import { describe, expect, it } from 'vitest';
import {
  deadlineHours,
  holdsUnits,
  isActive,
  reservationActions,
  reservationActors,
  reservationNeedsReason,
  reservationStatuses,
  reservationTransition,
} from '../src/index.js';

const plain = { offer: false, depositDue: false };

const valid: Record<string, string> = {
  'PENDING_REVIEW approve STORE': 'CONFIRMED',
  'PENDING_REVIEW reject STORE': 'REJECTED',
  'AWAITING_CUSTOMER accept CUSTOMER': 'CONFIRMED',
  'AWAITING_CUSTOMER decline CUSTOMER': 'CANCELLED',
  'AWAITING_DEPOSIT confirm STORE': 'CONFIRMED',
  'CONFIRMED start STORE': 'IN_PROGRESS',
  'CONFIRMED ready STORE': 'READY',
  'IN_PROGRESS ready STORE': 'READY',
  'READY complete STORE': 'COMPLETED',
  'READY no_show STORE': 'NO_SHOW',
  'PENDING_REVIEW expire SYSTEM': 'EXPIRED',
  'AWAITING_CUSTOMER expire SYSTEM': 'EXPIRED',
  'AWAITING_DEPOSIT expire SYSTEM': 'EXPIRED',
};
for (const status of ['PENDING_REVIEW', 'AWAITING_CUSTOMER', 'AWAITING_DEPOSIT', 'CONFIRMED']) valid[`${status} cancel CUSTOMER`] = 'CANCELLED';
for (const status of ['AWAITING_CUSTOMER', 'AWAITING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS', 'READY']) valid[`${status} cancel STORE`] = 'CANCELLED';
for (const status of ['PENDING_REVIEW', 'AWAITING_CUSTOMER', 'AWAITING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS', 'READY']) {
  valid[`${status} cancel PLATFORM`] = 'CANCELLED';
}

describe('reservationTransition', () => {
  const all = reservationStatuses.flatMap((status) =>
    reservationActions.flatMap((action) => reservationActors.map((actor) => [status, action, actor] as const)),
  );

  it.each(all)('%s, %s, %s', (status, action, actor) => {
    expect(reservationTransition(status, action, actor, plain)).toBe(valid[`${status} ${action} ${actor}`] ?? null);
  });

  it('aprobar con cambios espera al cliente; con depósito, al depósito', () => {
    const approve = (context: typeof plain) => reservationTransition('PENDING_REVIEW', 'approve', 'STORE', context);
    expect(approve({ offer: true, depositDue: true })).toBe('AWAITING_CUSTOMER');
    expect(approve({ offer: false, depositDue: true })).toBe('AWAITING_DEPOSIT');
    expect(reservationTransition('AWAITING_CUSTOMER', 'accept', 'CUSTOMER', { offer: false, depositDue: true })).toBe('AWAITING_DEPOSIT');
  });

  it('no resuelve propiedades heredadas', () => {
    expect(reservationTransition('constructor', 'approve', 'STORE', plain)).toBeNull();
    expect(reservationTransition('PENDING_REVIEW', 'toString' as never, 'STORE', plain)).toBeNull();
  });
});

describe('estados', () => {
  it('los finales no admiten ninguna acción', () => {
    for (const status of ['REJECTED', 'CANCELLED', 'EXPIRED', 'COMPLETED', 'NO_SHOW']) {
      expect(isActive(status)).toBe(false);
      expect(holdsUnits(status)).toBe(false);
    }
  });

  it('solo lo aprobado compromete unidades', () => {
    expect(reservationStatuses.filter(holdsUnits)).toEqual(['AWAITING_CUSTOMER', 'AWAITING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS', 'READY']);
    expect(isActive('PENDING_REVIEW')).toBe(true);
  });

  it('piden motivo rechazar y cancelar', () => {
    expect(reservationActions.filter(reservationNeedsReason)).toEqual(['reject', 'cancel']);
  });

  it('cada espera tiene su plazo', () => {
    const limits = { reviewHours: 1, customerResponseHours: 2, depositHours: 3, pickupHours: 4 };
    expect(reservationStatuses.map((status) => deadlineHours(status, limits))).toEqual([1, 2, 3, null, null, 4, null, null, null, null, null]);
  });
});
