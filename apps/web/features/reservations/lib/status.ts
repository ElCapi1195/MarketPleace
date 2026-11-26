import type { ListingKind, PaymentView, ReservationEventView, ReservationStatus } from '@marketplace/contracts';

const CUSTOMER: Record<ReservationStatus, { title: string; text: string }> = {
  PENDING_REVIEW: { title: 'La tienda la está revisando', text: 'Te avisaremos por correo cuando responda.' },
  AWAITING_CUSTOMER: { title: 'La tienda propone un cambio', text: 'Compara y decide si te sirve.' },
  AWAITING_DEPOSIT: { title: 'Falta tu depósito', text: 'Págalo directo a la tienda. Ella lo anotará aquí.' },
  CONFIRMED: { title: 'Confirmada', text: 'La tienda prepara tu pedido.' },
  IN_PROGRESS: { title: 'En camino', text: 'La tienda ya está con tu pedido.' },
  READY: { title: 'Lista para recoger', text: 'Pasa por ella antes de que venza el plazo.' },
  COMPLETED: { title: 'Entregada', text: 'Gracias por reservar.' },
  NO_SHOW: { title: 'No recogida', text: 'Pasó el plazo y la tienda la cerró.' },
  REJECTED: { title: 'No aceptada', text: 'La tienda no pudo aceptarla.' },
  CANCELLED: { title: 'Cancelada', text: '' },
  EXPIRED: { title: 'Vencida', text: 'Se cumplió el plazo sin respuesta.' },
};

export const customerStatus = (status: ReservationStatus) => CUSTOMER[status];

const STORE: Record<ReservationStatus, string> = {
  PENDING_REVIEW: 'Por revisar',
  AWAITING_CUSTOMER: 'Espera al cliente',
  AWAITING_DEPOSIT: 'Espera depósito',
  CONFIRMED: 'Confirmada',
  IN_PROGRESS: 'En curso',
  READY: 'Lista',
  COMPLETED: 'Entregada',
  NO_SHOW: 'No se presentó',
  REJECTED: 'Rechazada',
  CANCELLED: 'Cancelada',
  EXPIRED: 'Vencida',
};

export const storeStatus = (status: ReservationStatus) => STORE[status];

interface ProgressInput {
  status: ReservationStatus;
  kind: ListingKind;
  depositMinor: number;
}

/** Pasos de la reserva y cuál está en curso; null si se cerró sin entrega. */
export function progressOf({ status, kind, depositMinor }: ProgressInput): { steps: string[]; current: number } | null {
  const way = kind === 'SERVICE' ? 'En trabajo' : kind === 'PREORDER' ? 'En camino' : 'Preparación';
  const deposit = depositMinor > 0 ? ['Depósito'] : [];
  const steps = ['Solicitada', 'Aprobada', ...deposit, way, 'Lista', 'Entregada'];
  const named: Partial<Record<ReservationStatus, string>> = {
    PENDING_REVIEW: 'Aprobada',
    AWAITING_CUSTOMER: 'Aprobada',
    AWAITING_DEPOSIT: 'Depósito',
    CONFIRMED: way,
    IN_PROGRESS: way,
    READY: 'Lista',
    COMPLETED: 'Entregada',
  };
  const name = named[status];
  return name === undefined ? null : { steps, current: steps.indexOf(name) };
}

const EVENTS = new Map<string, string>([
  ['request', 'Solicitud enviada'],
  ['approve', 'La tienda la aprobó'],
  ['reject', 'La tienda la rechazó'],
  ['accept', 'El cliente aceptó la propuesta'],
  ['decline', 'El cliente no aceptó la propuesta'],
  ['confirm', 'Depósito recibido'],
  ['start', 'La tienda empezó el pedido'],
  ['ready', 'Lista para recoger'],
  ['complete', 'Entregada'],
  ['no_show', 'No se presentó'],
  ['expire', 'Venció el plazo'],
]);

const CANCELLED_BY = { CUSTOMER: 'La canceló el cliente', STORE: 'La canceló la tienda', PLATFORM: 'La canceló la plataforma', SYSTEM: 'Cancelada' };

export function eventText({ action, actor, toStatus }: ReservationEventView): string {
  if (action === 'cancel') return CANCELLED_BY[actor];
  if (action === 'approve' && toStatus === 'AWAITING_CUSTOMER') return 'La tienda propuso un cambio';
  return EVENTS.get(action) ?? action;
}

const KINDS: Record<PaymentView['kind'], string> = { DEPOSIT: 'Depósito', BALANCE: 'Pago', REFUND: 'Devolución' };
const METHODS: Record<PaymentView['method'], string> = { CASH: 'Efectivo', TRANSFER: 'Transferencia', TERMINAL: 'Terminal', OTHER: 'Otro' };

export const paymentKindLabel = (kind: PaymentView['kind']) => KINDS[kind];
export const paymentMethodLabel = (method: PaymentView['method']) => METHODS[method];
export const paymentMethods = Object.entries(METHODS).map(([value, label]) => ({ value, label }));
