import { createHmac } from 'node:crypto';
import type { LoginThrottleRepository } from './login-throttle.repository.js';

export const MAX_ATTEMPTS = 8;
export const WINDOW_MS = 15 * 60 * 1000;

export class TooManyAttemptsError extends Error {}

/** Límite de intentos por cuenta, además del límite por IP. */
export class LoginThrottle {
  constructor(
    private readonly repository: LoginThrottleRepository,
    private readonly key: string,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /** HMAC del email normalizado: permite contar sin guardar a quién pertenece. */
  fingerprint(email: string): string {
    return createHmac('sha256', this.key).update(email.trim().toLowerCase()).digest('hex');
  }

  /**
   * Reserva un intento antes de comprobar la contraseña. Contar después permitiría que
   * muchas peticiones simultáneas pasaran a la vez. Un intento rechazado no se guarda,
   * para que insistir no prolongue el bloqueo.
   */
  async begin(email: string): Promise<void> {
    const emailHash = this.fingerprint(email);
    const now = this.clock();
    const since = new Date(now.getTime() - WINDOW_MS);
    const id = await this.repository.insert(emailHash, now);
    if ((await this.repository.countSince(emailHash, since)) > MAX_ATTEMPTS) {
      await this.repository.remove(id);
      throw new TooManyAttemptsError('Demasiados intentos');
    }
    await this.repository.removeOlderThan(since);
  }

  async clear(email: string): Promise<void> {
    await this.repository.removeAll(this.fingerprint(email));
  }
}
