import type { ApiResult } from '@/lib/client-api';

type Failure = Extract<ApiResult<unknown>, { ok: false }>;

// Códigos cuyo texto ya viene redactado para la persona.
const READABLE = new Set([
  'FILE_TOO_LARGE',
  'IMAGE_REQUIRED',
  'IMAGE_TOO_LARGE',
  'INVALID_MODEL',
  'LAST_IMAGE',
  'STORE_EXISTS',
  'STORE_SUSPENDED',
  'TOO_MANY_IMAGES',
  'UNSUPPORTED_IMAGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'VALIDATION_ERROR',
  'VERSION_CONFLICT',
]);

export function adminMessage({ code, message, status }: Failure): string {
  if (code !== undefined && READABLE.has(code) && message) return message;
  if (code === 'NETWORK') return 'No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.';
  if (status === 404) return 'Ya no existe. Vuelve a cargar la página.';
  return 'No pudimos completar la operación. Inténtalo de nuevo en un momento.';
}
