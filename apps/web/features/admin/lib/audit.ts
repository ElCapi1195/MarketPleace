interface AuditFilters {
  action: string;
  actorId: string;
  targetId: string;
}

export function auditQuery(filters: AuditFilters, cursor: string | null): string {
  const query = new URLSearchParams({ limit: '50' });
  for (const [key, value] of Object.entries(filters)) if (value.trim()) query.set(key, value.trim());
  if (cursor) query.set('cursor', cursor);
  return query.toString();
}

const ACTIONS = new Map([
  ['auth.sign_in', 'Entró'],
  ['auth.sign_in_failed', 'Intento de entrada fallido'],
  ['auth.sign_out', 'Salió'],
  ['auth.sign_up', 'Creó su cuenta'],
  ['auth.two_factor_enabled', 'Activó el segundo paso'],
  ['auth.two_factor_disabled', 'Desactivó el segundo paso'],
  ['auth.password_changed', 'Cambió su contraseña'],
  ['user.role_assigned', 'Cambio de rol'],
  ['user.viewed', 'Consultó una cuenta'],
  ['user.suspended', 'Cuenta suspendida'],
  ['user.reinstated', 'Cuenta restituida'],
  ['store.document_viewed', 'Consultó un documento'],
  ['reservation.request', 'Solicitó una reserva'],
  ['reservation.approve', 'Aprobó una reserva'],
  ['reservation.payment_recorded', 'Anotó un pago'],
  ['reservation.payment_reversed', 'Anuló un pago'],
  ['reservation.viewed', 'Consultó una reserva'],
  ['reservation.cancel', 'Canceló una reserva'],
  ['report.created', 'Envió una denuncia'],
  ['report.resolved', 'Resolvió una denuncia'],
  ['report.dismissed', 'Desestimó una denuncia'],
]);

export const describeAction = (action: string) => ACTIONS.get(action) ?? action;

export const actionFilters = [
  { value: '', label: 'Todas' },
  { value: 'auth.', label: 'Accesos' },
  { value: 'user.', label: 'Cuentas' },
  { value: 'store.', label: 'Tiendas' },
  { value: 'product.', label: 'Productos' },
  { value: 'reservation.', label: 'Reservas' },
  { value: 'report.', label: 'Denuncias' },
];
