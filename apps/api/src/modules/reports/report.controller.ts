import { reportInput, reportResolution, type ReportInput, type ReportResolution } from '@marketplace/contracts';
import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { Actor, type ActorData } from '../../common/actor.js';
import { UuidPipe } from '../../common/uuid.pipe.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { CurrentUser, RequirePermission, type CurrentUserData } from '../identity/access.js';
import { ReportService } from './report.service.js';

const listQuery = z.object({
  status: z.enum(['OPEN', 'RESOLVED', 'DISMISSED']).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

@Controller('reports')
export class ReportController {
  constructor(@Inject(ReportService) private readonly reports: ReportService) {}

  @Post()
  create(@Actor() actor: ActorData, @Body(new ZodPipe(reportInput)) input: ReportInput) {
    return this.reports.create(actor, input);
  }

  @Get('mine')
  mine(@CurrentUser() user: CurrentUserData) {
    return this.reports.mine(user.id);
  }
}

/** Basta con moderar; cada denuncia se filtra además por lo que el rol puede ver. */
@Controller('admin/reports')
@RequirePermission('listing.moderate')
export class AdminReportController {
  constructor(@Inject(ReportService) private readonly reports: ReportService) {}

  @Get()
  list(@CurrentUser() user: CurrentUserData, @Query(new ZodPipe(listQuery)) { status, page }: z.output<typeof listQuery>) {
    return this.reports.list(user, status, page);
  }

  @Get(':id')
  get(@CurrentUser() user: CurrentUserData, @Param('id', UuidPipe) id: string) {
    return this.reports.get(user, id);
  }

  @Post(':id/resolve')
  @HttpCode(200)
  resolve(
    @CurrentUser() user: CurrentUserData,
    @Actor() actor: ActorData,
    @Param('id', UuidPipe) id: string,
    @Body(new ZodPipe(reportResolution)) input: ReportResolution,
  ) {
    return this.reports.resolve(user, actor, id, input);
  }
}
