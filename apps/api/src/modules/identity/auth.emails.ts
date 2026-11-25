import { Logger } from '@nestjs/common';
import type { Mail, Mailer } from '../mail/mailer.js';

/** Correos de identidad. No se espera al envío: el tiempo de respuesta delataría si la cuenta existe. */
export class AuthEmails {
  private readonly logger = new Logger(AuthEmails.name);

  constructor(
    private readonly mailer: Mailer,
    private readonly brandName: string,
    private readonly publicUrl: string,
  ) {}

  verification(to: string, url: string): void {
    this.send({
      to,
      subject: `Verifica tu correo en ${this.brandName}`,
      text: `Abre este enlace para verificar tu correo. Vence en 24 horas.\n\n${url}\n\nSi no creaste la cuenta, ignora este mensaje.`,
    });
  }

  /** El token viaja en el fragmento: no llega a los registros del servidor ni a la cabecera Referer. */
  passwordReset(to: string, token: string): void {
    this.send({
      to,
      subject: `Restablece tu contraseña de ${this.brandName}`,
      text: `Abre este enlace para elegir otra contraseña. Vence en 1 hora y sirve una sola vez.\n\n${this.publicUrl}/restablecer#token=${token}\n\nSi no lo pediste, ignora este mensaje: tu contraseña no cambia.`,
    });
  }

  alreadyRegistered(to: string): void {
    this.send({
      to,
      subject: `Ya tienes cuenta en ${this.brandName}`,
      text: `Alguien intentó registrarse con tu correo. Si fuiste tú, entra aquí:\n\n${this.publicUrl}/entrar\n\nSi no fuiste tú, no tienes que hacer nada.`,
    });
  }

  private send(mail: Mail): void {
    this.mailer.send(mail).catch((error: unknown) => {
      // Sin destinatario: el registro no debe revelar quién tiene cuenta.
      this.logger.error(`No se pudo enviar "${mail.subject}": ${error instanceof Error ? error.name : 'error'}`);
    });
  }
}
