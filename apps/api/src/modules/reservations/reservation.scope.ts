/** De quién debe ser la reserva. Es obligatorio en el repositorio. */
export type ReservationScope = { customerId: string } | { storeId: string } | { platform: true };

/** Filtro que impide salir del alcance. */
export const scopeWhere = (scope: ReservationScope): { customerId?: string; storeId?: string } =>
  'platform' in scope ? {} : scope;
