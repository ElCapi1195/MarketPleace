import { moderationInput, type ModerationInput } from '@marketplace/contracts';
import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Res, type StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { Actor, type ActorData } from '../../common/actor.js';
import { UuidPipe } from '../../common/uuid.pipe.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { CurrentUser, RequirePermission, type CurrentUserData } from '../identity/access.js';
import { PRIVATE, sendMedia } from '../media/media.response.js';
import { MediaService } from '../media/media.service.js';
import { ModerationService } from './moderation.service.js';

const listQuery = z.object({ page: z.coerce.number().int().min(1).max(1000).default(1) });

@Controller('admin/moderation')
@RequirePermission('listing.moderate')
export class ModerationController {
  constructor(
    @Inject(ModerationService) private readonly moderation: ModerationService,
    @Inject(MediaService) private readonly media: MediaService,
  ) {}

  @Get()
  list(@Query(new ZodPipe(listQuery)) { page }: z.output<typeof listQuery>) {
    return this.moderation.list(page);
  }

  @Get(':id')
  get(@Param('id', UuidPipe) id: string) {
    return this.moderation.get(id);
  }

  @Post(':id/decision')
  @HttpCode(200)
  decide(
    @CurrentUser() user: CurrentUserData,
    @Actor() actor: ActorData,
    @Param('id', UuidPipe) id: string,
    @Body(new ZodPipe(moderationInput)) input: ModerationInput,
  ) {
    return this.moderation.decide(user, actor, id, input);
  }

  @Get('media/:id/:variant')
  async read(
    @Param('id', UuidPipe) id: string,
    @Param('variant') variant: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return sendMedia(res, variant, await this.media.openPending(id, variant), PRIVATE);
  }
}
