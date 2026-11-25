const GENERIC = 'No pudimos completar la operación. Inténtalo de nuevo en un momento.';

const MESSAGES = new Map([
  ['INVALID_EMAIL_OR_PASSWORD', 'El correo o la contraseña no coinciden.'],
  ['EMAIL_NOT_VERIFIED', 'Verifica tu correo antes de entrar. Busca el enlace en tu bandeja.'],
  ['TOO_MANY_ATTEMPTS', 'Demasiados intentos. Espera 15 minutos o restablece tu contraseña.'],
  ['RATE_LIMITED', 'Vas muy rápido. Espera unos minutos y vuelve a intentarlo.'],
  ['INVALID_PASSWORD', 'La contraseña actual no es correcta.'],
  ['INVALID_TOKEN', 'El enlace venció o ya se usó. Pide uno nuevo.'],
  ['INVALID_CODE', 'El código no es correcto. Usa el que muestra tu aplicación ahora.'],
  ['INVALID_BACKUP_CODE', 'Ese código de respaldo no es válido o ya se usó.'],
  ['INVALID_TWO_FACTOR_COOKIE', 'El tiempo para el segundo paso venció. Vuelve a entrar.'],
  ['TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE', 'Demasiados códigos erróneos. Vuelve a entrar para intentarlo otra vez.'],
  ['ACCOUNT_TEMPORARILY_LOCKED', 'Bloqueamos el segundo paso por seguridad. Espera unos minutos.'],
  ['INVALID_EMAIL', 'Revisa el correo.'],
  ['NETWORK', 'No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.'],
]);

/** Texto para la persona. El del servidor solo se muestra cuando está escrito para ella. */
export function messageFor(code: string | undefined, serverMessage?: string): string {
  if (code === 'WEAK_PASSWORD' && serverMessage) return serverMessage;
  return (code !== undefined && MESSAGES.get(code)) || GENERIC;
}
