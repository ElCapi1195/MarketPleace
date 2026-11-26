import type { ReservationAction } from '@marketplace/core';
import type { Outbox } from '../mail/outbox.js';
import type { ReservationRow } from './reservation.repository.js';

export const RESERVATION_EMAILS = Symbol('RESERVATION_EMAILS');

type Event = ReservationAction | 'request';

const CUSTOMER: Partial<Record<Event, [subject: string, text: string]>> = {
  approve: ['Tu reserva avanza', 'La tienda respondió a tu solicitud. Entra para ver el siguiente paso.'],
  reject: ['La tienda no pudo aceptar tu reserva', 'El motivo es:'],
  confirm: ['Tu reserva está confirmada', 'La tienda anotó tu depósito.'],
  start: ['La tienda ya está con tu pedido', 'Te avisaremos cuando esté listo.'],
  ready: ['Tu pedido está listo', 'Ya puedes pasar a recogerlo.'],
  no_show: ['No recogiste tu pedido', 'Pasó el plazo y la tienda cerró la reserva.'],
  expire: ['Tu reserva venció', 'Se cumplió el plazo sin respuesta.'],
};

const STORE: Partial<Record<Event, [subject: string, text: string]>> = {
  request: ['Nueva solicitud de reserva', 'Revísala antes de que venza el plazo.'],
  accept: ['El cliente aceptó tu propuesta', 'Sigue con la reserva.'],
  decline: ['El cliente no aceptó tu propuesta', 'La unidad vuelve a estar disponible.'],
  expire: ['Una reserva venció', 'Se cumplió el plazo y se cerró sola.'],
};

/** Los correos no llevan datos de contacto ni importes: solo el aviso y el enlace. */
export class ReservationEmails {
  constructor(
    private readonly outbox: Outbox,
    private readonly brandName: string,
    private readonly publicUrl: string,
  ) {}

  customer(row: ReservationRow, event: Event, reason: string, actor: string): void {
    const content: [string, string] | undefined =
      event === 'cancel' && actor !== 'CUSTOMER' ? ['Tu reserva se canceló', 'El motivo es:'] : CUSTOMER[event];
    if (content) this.send(row.customer.email, content, row, reason, `/reservas/${row.id}`);
  }

  store(recipients: readonly string[], row: ReservationRow, event: Event, reason: string, actor: string): void {
    const content: [string, string] | undefined =
      event === 'cancel' && actor !== 'STORE' ? ['Se canceló una reserva', 'El motivo es:'] : STORE[event];
    if (!content) return;
    for (const to of recipients) this.send(to, content, row, reason, `/tienda/${row.storeId}/reservas/${row.id}`);
  }

  private send(to: string, [subject, text]: [string, string], row: ReservationRow, reason: string, path: string): void {
    const parts = [`Reserva ${row.code}: ${row.productTitle}`, text, reason, `${this.publicUrl}${path}`];
    this.outbox.send({ to, subject: `${subject} · ${this.brandName}`, text: parts.filter(Boolean).join('\n\n') });
  }
}
