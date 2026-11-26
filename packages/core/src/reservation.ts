export const reservationStatuses = [
  'PENDING_REVIEW',
  'AWAITING_CUSTOMER',
  'AWAITING_DEPOSIT',
  'CONFIRMED',
  'IN_PROGRESS',
  'READY',
  'COMPLETED',
  'NO_SHOW',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
] as const;
export type ReservationStatus = (typeof reservationStatuses)[number];

export const reservationActions = [
  'approve',
  'reject',
  'accept',
  'decline',
  'confirm',
  'start',
  'ready',
  'complete',
  'no_show',
  'cancel',
  'expire',
] as const;
export type ReservationAction = (typeof reservationActions)[number];

export const reservationActors = ['CUSTOMER', 'STORE', 'PLATFORM', 'SYSTEM'] as const;
export type ReservationActor = (typeof reservationActors)[number];

export interface TransitionContext {
  /** La tienda cambió precio, depósito o fecha y el cliente debe aceptarlo. */
  offer: boolean;
  /** Queda depósito por recibir según lo acordado. */
  depositDue: boolean;
}

type Target = ReservationStatus | ((context: TransitionContext) => ReservationStatus);

interface Rule {
  from: readonly ReservationStatus[];
  to: Target;
}

const agreed = ({ depositDue }: TransitionContext): ReservationStatus => (depositDue ? 'AWAITING_DEPOSIT' : 'CONFIRMED');

// Clave: acción y actor. Lo que no figura aquí no puede ocurrir.
const rules = new Map<string, Rule>([
  ['approve STORE', { from: ['PENDING_REVIEW'], to: (context) => (context.offer ? 'AWAITING_CUSTOMER' : agreed(context)) }],
  ['reject STORE', { from: ['PENDING_REVIEW'], to: 'REJECTED' }],
  ['accept CUSTOMER', { from: ['AWAITING_CUSTOMER'], to: agreed }],
  ['decline CUSTOMER', { from: ['AWAITING_CUSTOMER'], to: 'CANCELLED' }],
  ['confirm STORE', { from: ['AWAITING_DEPOSIT'], to: 'CONFIRMED' }],
  ['start STORE', { from: ['CONFIRMED'], to: 'IN_PROGRESS' }],
  ['ready STORE', { from: ['CONFIRMED', 'IN_PROGRESS'], to: 'READY' }],
  ['complete STORE', { from: ['READY'], to: 'COMPLETED' }],
  ['no_show STORE', { from: ['READY'], to: 'NO_SHOW' }],
  // Desde que la tienda compra al proveedor, cancelar ya no depende solo del cliente.
  ['cancel CUSTOMER', { from: ['PENDING_REVIEW', 'AWAITING_CUSTOMER', 'AWAITING_DEPOSIT', 'CONFIRMED'], to: 'CANCELLED' }],
  ['cancel STORE', { from: ['AWAITING_CUSTOMER', 'AWAITING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS', 'READY'], to: 'CANCELLED' }],
  [
    'cancel PLATFORM',
    { from: ['PENDING_REVIEW', 'AWAITING_CUSTOMER', 'AWAITING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS', 'READY'], to: 'CANCELLED' },
  ],
  ['expire SYSTEM', { from: ['PENDING_REVIEW', 'AWAITING_CUSTOMER', 'AWAITING_DEPOSIT'], to: 'EXPIRED' }],
]);

/** Estado al que lleva una acción de un actor; null si no se admite. */
export function reservationTransition(
  status: string,
  action: ReservationAction,
  actor: ReservationActor,
  context: TransitionContext,
): ReservationStatus | null {
  const rule = rules.get(`${action} ${actor}`);
  if (!rule || !(rule.from as readonly string[]).includes(status)) return null;
  return typeof rule.to === 'function' ? rule.to(context) : rule.to;
}

export function reservationNeedsReason(action: ReservationAction): boolean {
  return action === 'reject' || action === 'cancel';
}

const HOLDING: readonly string[] = ['AWAITING_CUSTOMER', 'AWAITING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS', 'READY'];

/** Estados que comprometen una unidad de la tienda. */
export function holdsUnits(status: string): boolean {
  return HOLDING.includes(status);
}

/** Estados que aún pueden avanzar. */
export function isActive(status: string): boolean {
  return status === 'PENDING_REVIEW' || holdsUnits(status);
}

export const activeStatuses = reservationStatuses.filter(isActive);

export interface DeadlineLimits {
  reviewHours: number;
  customerResponseHours: number;
  depositHours: number;
  pickupHours: number;
}

/** Plazo de cada espera. El de recogida no vence solo: permite a la tienda marcar que no se presentó. */
export function deadlineHours(status: ReservationStatus, limits: DeadlineLimits): number | null {
  switch (status) {
    case 'PENDING_REVIEW':
      return limits.reviewHours;
    case 'AWAITING_CUSTOMER':
      return limits.customerResponseHours;
    case 'AWAITING_DEPOSIT':
      return limits.depositHours;
    case 'READY':
      return limits.pickupHours;
    default:
      return null;
  }
}

/** Estados que el barrido cierra al vencer. */
export const expirableStatuses: readonly ReservationStatus[] = ['PENDING_REVIEW', 'AWAITING_CUSTOMER', 'AWAITING_DEPOSIT'];
