import { Controller, Get, Inject, Query } from '@nestjs/common';
import { z } from 'zod';
import { ZodPipe } from '../../common/zod.pipe.js';
import { RequirePermission } from '../identity/access.js';
import { AuditService } from './audit.service.js';

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.uuid().optional(),
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
