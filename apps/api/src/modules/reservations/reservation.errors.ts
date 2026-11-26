import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

const conflict = (code: string, message: string) => new ConflictException({ code, message });
const unprocessable = (code: string, message: string) => new UnprocessableEntityException({ code, message });

export const notFound = () => new NotFoundException({ code: 'NOT_FOUND', message: 'La reserva no existe.' });
export const productNotFound = () => new NotFoundException({ code: 'NOT_FOUND', message: 'El producto ya no está disponible.' });
export const invalid = (fields: string) => new BadRequestException({ code: 'VALIDATION_ERROR', message: `Revisa: ${fields}.` });

export const ownReservation = () =>
  new ForbiddenException({ code: 'OWN_RESERVATION', message: 'No puedes gestionar una reserva tuya. Debe hacerlo otra persona de la tienda.' });

export const versionConflict = () => conflict('VERSION_CONFLICT', 'La reserva cambió mientras la veías. Vuelve a cargarla.');
export const invalidTransition = () => conflict('INVALID_TRANSITION', 'Eso ya no se puede hacer con esta reserva.');
export const noUnits = () => conflict('NO_UNITS', 'No quedan unidades para aprobar esta reserva.');
export const soldOut = () => conflict('SOLD_OUT', 'El producto está agotado.');
export const productChanged = () => conflict('PRODUCT_CHANGED', 'El precio o la fecha cambiaron. Revisa el producto antes de solicitarlo.');
export const termsChanged = () => conflict('TERMS_CHANGED', 'Las condiciones cambiaron. Léelas de nuevo antes de solicitar.');
export const alreadyReserved = () => conflict('ALREADY_RESERVED', 'Ya tienes una reserva activa de este producto.');
export const tooMany = (max: number) => conflict('TOO_MANY_RESERVATIONS', `Puedes tener ${max} reservas activas como máximo.`);
export const idempotencyMismatch = () => conflict('IDEMPOTENCY_MISMATCH', 'Esa solicitud ya se usó para otro producto.');
export const tooEarly = () => conflict('TOO_EARLY', 'Todavía está en plazo para recogerlo.');
export const alreadyReversed = () => conflict('ALREADY_REVERSED', 'Ese movimiento ya se anuló.');

export const reasonRequired = () => unprocessable('REASON_REQUIRED', 'Explica el motivo.');
export const pickupInfoRequired = () => unprocessable('PICKUP_INFO_REQUIRED', 'Antes de aprobar, explica cómo contactarte y dónde se recoge.');
export const cardNumber = () => unprocessable('CARD_NUMBER', 'No escribas números de tarjeta. Usa el folio de la operación.');
export const notReversible = () => unprocessable('NOT_REVERSIBLE', 'Ese movimiento no se puede anular.');

const PAYMENT_MESSAGES = {
  INVALID_AMOUNT: 'El importe no es válido.',
  NOT_PAYABLE: 'En el estado actual no se puede anotar ese cobro.',
  DEPOSIT_EXCEEDED: 'Supera el depósito acordado.',
  PRICE_EXCEEDED: 'Supera el precio acordado.',
  REFUND_EXCEEDED: 'Supera lo que el cliente ha pagado.',
};

export const paymentRejected = (problem: keyof typeof PAYMENT_MESSAGES) => unprocessable(problem, PAYMENT_MESSAGES[problem]);
