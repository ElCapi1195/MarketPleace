import type { StoreAction } from '@marketplace/core';
import type { Outbox } from '../mail/outbox.js';

const DECISIONS: Partial<Record<StoreAction, { subject: string; text: string }>> = {
  request_info: { subject: 'Necesitamos algo más', text: 'Para seguir con la verificación hace falta corregir esto:' },
  approve: { subject: 'Tu tienda está verificada', text: 'Ya puedes crear tus productos.' },
  reject: { subject: 'No pudimos verificar tu tienda', text: 'El motivo es:' },
  suspend: { subject: 'Tu tienda está suspendida', text: 'Tus productos dejaron de verse. El motivo es:' },
  reinstate: { subject: 'Tu tienda vuelve a estar activa', text: 'Tus productos se ven de nuevo.' },
};

/** Los correos no llevan datos de verificación: solo la decisión y su motivo. */
export class StoreEmails {
  constructor(
    private readonly outbox: Outbox,
    private readonly brandName: string,
    private readonly publicUrl: string,
  ) {}

  decision(to: string, store: { id: string; name: string }, action: StoreAction, reason: string): void {
    const content = DECISIONS[action];
    if (!content) return;
    const parts = [`Tienda: ${store.name}`, content.text, reason, `${this.publicUrl}/tienda/${store.id}`];
    this.outbox.send({ to, subject: `${content.subject} · ${this.brandName}`, text: parts.filter(Boolean).join('\n\n') });
  }

  /** El token viaja en el fragmento: no llega a los registros del servidor. */
  invitation(to: string, storeName: string, token: string): void {
    this.outbox.send({
      to,
      subject: `Te invitaron a ${storeName} en ${this.brandName}`,
      text: `Para unirte, entra con este correo y abre el enlace. Vence en 7 días y sirve una sola vez.\n\n${this.publicUrl}/invitacion#token=${token}\n\nSi no esperabas esta invitación, ignora este mensaje.`,
    });
  }
}
