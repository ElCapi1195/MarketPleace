import { z } from 'zod';
import { demo } from './demo.js';
import { gamer } from './gamer.js';
import { verticalSchema, type VerticalConfig, type VerticalInput } from './schema.js';

// Para añadir un nicho: crear su archivo y registrarlo aquí.
const registry = new Map<string, VerticalInput>([gamer, demo].map((vertical) => [vertical.id, vertical]));

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

/** Valida una configuración de nicho. Lanza un error que nombra cada campo inválido. */
export function parseVertical(input: unknown): VerticalConfig {
  const result = verticalSchema.safeParse(input);
  if (!result.success) {
    throw new Error(`Configuración de nicho inválida:\n${z.prettifyError(result.error)}`);
  }
  return deepFreeze(result.data);
}

export function loadVertical(id: string): VerticalConfig {
  const input = registry.get(id);
  if (!input) {
    throw new Error(`Nicho desconocido "${id}". Disponibles: ${[...registry.keys()].join(', ')}`);
  }
  return parseVertical(structuredClone(input));
}
