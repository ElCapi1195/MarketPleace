import { storeStatuses } from '@marketplace/core';
import { storeDecisionInput, type StoreDecisionInput } from '@marketplace/contracts';
import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Res, type StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { Actor, type ActorData } from '../../common/actor.js';
import { UuidPipe } from '../../common/uuid.pipe.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { CurrentUser, RequirePermission, type CurrentUserData } from '../identity/access.js';
import { sendDocument } from './document.response.js';
import { DocumentService } from './document.service.js';
import { ReviewService } from './review.service.js';

const listQuery = z.object({
  // Un borrador no se ha presentado: pedirlos equivale a no encontrar nada.
  status: z.enum(storeStatuses).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

@Controller('admin/store-reviews')
@RequirePermission('store.verify')
export class ReviewController {
  constructor(
    @Inject(ReviewService) private readonly reviews: ReviewService,
    @Inject(DocumentService) private readonly documents: DocumentService,
  ) {}

  @Get()
  list(@Query(new ZodPipe(listQuery)) { status, page }: z.output<typeof listQuery>) {
    return status === 'DRAFT' ? { items: [], page, hasMore: false } : this.reviews.list(status, page);
  }

  @Get(':id')
  get(@CurrentUser() user: CurrentUserData, @Param('id', UuidPipe) id: string) {
    return this.reviews.get(user, id);
  }

  @Post(':id/decision')
  @HttpCode(200)
  decide(
    @CurrentUser() user: CurrentUserData,
    @Actor() actor: ActorData,
    @Param('id', UuidPipe) id: string,
    @Body(new ZodPipe(storeDecisionInput)) input: StoreDecisionInput,
  ) {
    return this.reviews.decide(user, actor, id, input);
  }

  @Get(':id/documents/:documentId')
  async document(
    @CurrentUser() user: CurrentUserData,
    @Actor() actor: ActorData,
    @Param('id', UuidPipe) id: string,
    @Param('documentId', UuidPipe) documentId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return sendDocument(res, await this.documents.openForReview(user, actor, id, documentId));
  }
}
