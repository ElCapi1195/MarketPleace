/** De quién debe ser la reserva. Es obligatorio en el repositorio. */
export type ReservationScope = { customerId: string } | { storeId: string };
