import { ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

export const notFound = () => new NotFoundException({ code: 'NOT_FOUND', message: 'No existe.' });

export const notEditable = () =>
  new ConflictException({ code: 'NOT_EDITABLE', message: 'La solicitud ya se envió y no se puede cambiar.' });

export const invalidTransition = () =>
  new ConflictException({ code: 'INVALID_TRANSITION', message: 'La tienda cambió de estado. Vuelve a cargarla.' });

export const reasonRequired = () =>
  new UnprocessableEntityException({ code: 'REASON_REQUIRED', message: 'Explica el motivo.' });

export const ownStore = () =>
  new ForbiddenException({ code: 'OWN_STORE', message: 'No puedes decidir sobre una tienda de la que formas parte.' });

export const incomplete = (missing: string[]) =>
  new UnprocessableEntityException({ code: 'INCOMPLETE', message: `Falta: ${missing.join(', ')}.` });

export const notApproved = () =>
  new ConflictException({ code: 'STORE_NOT_APPROVED', message: 'La tienda no está activa.' });
