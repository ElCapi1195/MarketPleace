import { z } from 'zod';

// El salto de línea solo tiene sentido en los textos largos.
export const line = (max: number) => z.string().trim().max(max).regex(/^\P{Cc}*$/u, 'caracteres no admitidos');

export const block = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .regex(/^(?:\P{Cc}|[\n\r\t])*$/u, 'caracteres no admitidos');
