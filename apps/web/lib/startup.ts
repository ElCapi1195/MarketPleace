import { getVertical } from './vertical';

/** Detiene el proceso si el nicho no es válido, en lugar de servir errores 500 en cada visita. */
export function assertVerticalOrExit(): void {
  try {
    getVertical();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Nicho inválido');
    process.exit(1);
  }
}
