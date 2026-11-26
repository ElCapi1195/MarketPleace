import type { ApiResult } from '@/lib/client-api';

type Failure = Extract<ApiResult<unknown>, { ok: false }>;

// Códigos cuyo texto ya viene redactado para la persona.
const READABLE = new Set([
  'ALREADY_MEMBER',
  'FILE_TOO_LARGE',
  'IMAGE_REQUIRED',
  'IMAGE_TOO_LARGE',
  'INCOMPLETE',
  'INVALID_MODEL',
  'INVALID_TRANSITION',
  'INVITATION_INVALID',
  'LAST_IMAGE',
  'LAST_OWNER',
  'NOT_EDITABLE',
  'OWN_STORE',
  'REASON_REQUIRED',
  'STORE_EXISTS',
  'STORE_NOT_APPROVED',
  'STORE_SUSPENDED',
  'TOO_MANY_APPLICATIONS',
  'TOO_MANY_IMAGES',
  'TOO_MANY_INVITATIONS',
  'UNSUPPORTED_DOCUMENT',
  'UNSUPPORTED_IMAGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'VALIDATION_ERROR',
  'VERSION_CONFLICT',
]);

export function apiMessage({ code, message, status }: Failure): string {
  if (code !== undefined && READABLE.has(code) && message) return message;
  if (code === 'NETWORK') return 'No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.';
  if (status === 404) return 'Ya no existe. Vuelve a cargar la página.';
  return 'No pudimos completar la operación. Inténtalo de nuevo en un momento.';
}
