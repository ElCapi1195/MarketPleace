import { Logger } from '@nestjs/common';
import { createTransport } from 'nodemailer';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

export function smtpMailer(url: string, from: string): Mailer {
  const transport = createTransport(url);
  return {
    send: async (mail) => {
      await transport.sendMail({ from, ...mail });
    },
  };
}

/** Solo desarrollo: muestra el correo en la terminal. Contiene enlaces de acceso, nunca usar en producción. */
export function consoleMailer(): Mailer {
  const logger = new Logger('CorreoDesarrollo');
  return {
    send: async ({ to, subject, text }) => {
      logger.log(`Para ${to}: ${subject}\n${text}`);
    },
  };
}
