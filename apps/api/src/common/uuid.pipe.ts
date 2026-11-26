import { NotFoundException, type PipeTransform } from '@nestjs/common';
import { z } from 'zod';

const uuid = z.uuid();

/** Un id imposible no existe: responde 404 sin consultar la base. */
export class UuidPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    const result = uuid.safeParse(value);
    if (!result.success) throw new NotFoundException({ code: 'NOT_FOUND', message: 'No existe.' });
    return result.data.toLowerCase();
  }
}
