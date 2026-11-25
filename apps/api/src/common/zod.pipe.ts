import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

/** Valida y transforma una entrada; el error nombra los campos, no sus valores. */
export class ZodPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    const fields = [...new Set(result.error.issues.map(({ path }) => path.join('.') || '(cuerpo)'))];
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: `Revisa: ${fields.join(', ')}.` });
  }
}
