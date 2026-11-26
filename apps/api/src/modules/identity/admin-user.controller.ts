import { suspensionInput, type SuspensionInput } from '@marketplace/contracts';
import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { Actor, type ActorData } from '../../common/actor.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { RequirePermission } from './access.js';
import { AdminUserService } from './admin-user.service.js';

const findQuery = z.object({ email: z.string().trim().toLowerCase().pipe(z.email().max(254)) });

@Controller('admin/users')
@RequirePermission('user.suspend')
export class AdminUserController {
  constructor(@Inject(AdminUserService) private readonly users: AdminUserService) {}

  @Get()
  find(@Query(new ZodPipe(findQuery)) { email }: z.output<typeof findQuery>) {
    return this.users.find(email);
  }

  @Get(':id')
  get(@Actor() actor: ActorData, @Param('id') id: string) {
    return this.users.get(actor, id);
  }

  @Post(':id/suspend')
  @HttpCode(200)
  suspend(@Actor() actor: ActorData, @Param('id') id: string, @Body(new ZodPipe(suspensionInput)) { reason }: SuspensionInput) {
    return this.users.suspend(actor, id, reason);
  }

  @Post(':id/reinstate')
  @HttpCode(200)
  reinstate(@Actor() actor: ActorData, @Param('id') id: string, @Body(new ZodPipe(suspensionInput)) { reason }: SuspensionInput) {
    return this.users.reinstate(actor, id, reason);
  }
}
