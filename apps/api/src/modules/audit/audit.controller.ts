import { Controller, Get, Inject, Query } from '@nestjs/common';
import { z } from 'zod';
import { ZodPipe } from '../../common/zod.pipe.js';
import { RequirePermission } from '../identity/access.js';
import { AuditService } from './audit.service.js';

const text = (max: number) => z.string().trim().min(1).max(max).regex(/^[\w.:@-]+$/).optional();

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.uuid().optional(),
  /** Prefijo, como `reservation.`. */
  action: text(60),
  actorId: text(60),
  targetType: text(30),
  targetId: text(60),
});

@Controller('admin/audit')
export class AuditController {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  @Get()
  @RequirePermission('audit.read')
  list(@Query(new ZodPipe(listQuery)) query: z.output<typeof listQuery>) {
    return this.audit.list(query);
  }
}
