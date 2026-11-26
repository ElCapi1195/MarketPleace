import { Logger } from '@nestjs/common';
import type { Mail, Mailer } from './mailer.js';

/** Envía sin hacer esperar a quien llama: el tiempo de respuesta no debe delatar si hay destinatario. */
export class Outbox {
  private readonly logger = new Logger(Outbox.name);

  constructor(private readonly mailer: Mailer) {}

  send(mail: Mail): void {
    this.mailer.send(mail).catch((error: unknown) => {
      // Sin destinatario: el registro no debe revelar quién tiene cuenta.
      this.logger.error(`No se pudo enviar "${mail.subject}": ${error instanceof Error ? error.name : 'error'}`);
    });
  }
}
