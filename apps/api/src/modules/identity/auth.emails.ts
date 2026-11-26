import type { Outbox } from '../mail/outbox.js';

/** Correos de identidad. */
export class AuthEmails {
  constructor(
    private readonly outbox: Outbox,
    private readonly brandName: string,
    private readonly publicUrl: string,
  ) {}

  verification(to: string, url: string): void {
    this.outbox.send({
      to,
      subject: `Verifica tu correo en ${this.brandName}`,
      text: `Abre este enlace para verificar tu correo. Vence en 24 horas.\n\n${url}\n\nSi no creaste la cuenta, ignora este mensaje.`,
    });
  }

  /** El token viaja en el fragmento: no llega a los registros del servidor ni a la cabecera Referer. */
  passwordReset(to: string, token: string): void {
    this.outbox.send({
      to,
      subject: `Restablece tu contraseña de ${this.brandName}`,
      text: `Abre este enlace para elegir otra contraseña. Vence en 1 hora y sirve una sola vez.\n\n${this.publicUrl}/restablecer#token=${token}\n\nSi no lo pediste, ignora este mensaje: tu contraseña no cambia.`,
    });
  }

  alreadyRegistered(to: string): void {
    this.outbox.send({
      to,
      subject: `Ya tienes cuenta en ${this.brandName}`,
      text: `Alguien intentó registrarse con tu correo. Si fuiste tú, entra aquí:\n\n${this.publicUrl}/entrar\n\nSi no fuiste tú, no tienes que hacer nada.`,
    });
  }
}
