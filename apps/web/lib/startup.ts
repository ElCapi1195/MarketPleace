import { getVertical } from './vertical';

const DEV_API = 'http://127.0.0.1:4311';

/** Dirección interna de la API, solo para el servidor. */
export function apiBaseUrl(): string {
  const value = process.env.API_INTERNAL_URL ?? (process.env.NODE_ENV === 'production' ? '' : DEV_API);
  if (!URL.canParse(value)) throw new Error('API_INTERNAL_URL debe ser la dirección interna de la API');
  return new URL(value).origin;
}

/** Detiene el proceso si la configuración no es válida, en lugar de servir errores 500 en cada visita. */
export function assertConfigOrExit(): void {
  try {
    getVertical();
    apiBaseUrl();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Configuración inválida');
    process.exit(1);
  }
}
