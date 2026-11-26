import { mediaPatch, type MediaPatch } from '@marketplace/contracts';
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Req, Res, type StreamableFile } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Actor, type ActorData } from '../../common/actor.js';
import { UuidPipe } from '../../common/uuid.pipe.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { PLATFORM, storeScope } from '../catalog/scope.js';
import { CurrentStore, Public, RequirePermission, RequireStore, type CurrentStoreData } from '../identity/access.js';
import { PRIVATE, PUBLIC, sendMedia } from './media.response.js';
import { MediaService } from './media.service.js';

@Public()
@Controller('media')
export class MediaController {
  constructor(@Inject(MediaService) private readonly media: MediaService) {}

  @Get(':id/:variant')
  async read(
    @Param('id', UuidPipe) id: string,
    @Param('variant') variant: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return sendMedia(res, variant, await this.media.openPublic(id, variant), PUBLIC);
  }
}

@Controller('admin')
@RequirePermission('catalog.manage')
export class AdminMediaController {
  constructor(@Inject(MediaService) private readonly media: MediaService) {}

  @Post('products/:id/media')
  upload(@Actor() actor: ActorData, @Param('id', UuidPipe) id: string, @Req() request: Request) {
    return this.media.upload(actor, PLATFORM, id, request);
  }

  @Get('media/:id/:variant')
  async read(
    @Param('id', UuidPipe) id: string,
    @Param('variant') variant: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return sendMedia(res, variant, await this.media.openPrivate(PLATFORM, id, variant), PRIVATE);
  }

  @Patch('media/:id')
  patch(@Param('id', UuidPipe) id: string, @Body(new ZodPipe(mediaPatch)) changes: MediaPatch) {
    return this.media.patch(PLATFORM, id, changes);
  }

  @Delete('media/:id')
  @HttpCode(204)
  remove(@Actor() actor: ActorData, @Param('id', UuidPipe) id: string) {
    return this.media.remove(actor, PLATFORM, id);
  }
}

@Controller('stores/:storeId')
@RequireStore('product.manage')
export class StoreMediaController {
  constructor(@Inject(MediaService) private readonly media: MediaService) {}

  @Post('products/:id/media')
  upload(@Actor() actor: ActorData, @CurrentStore() store: CurrentStoreData, @Param('id', UuidPipe) id: string, @Req() request: Request) {
    return this.media.upload(actor, storeScope(store), id, request);
  }

  @Get('media/:id/:variant')
  async read(
    @CurrentStore() store: CurrentStoreData,
    @Param('id', UuidPipe) id: string,
    @Param('variant') variant: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return sendMedia(res, variant, await this.media.openPrivate(storeScope(store), id, variant), PRIVATE);
  }

  @Patch('media/:id')
  patch(@CurrentStore() store: CurrentStoreData, @Param('id', UuidPipe) id: string, @Body(new ZodPipe(mediaPatch)) changes: MediaPatch) {
    return this.media.patch(storeScope(store), id, changes);
  }

  @Delete('media/:id')
  @HttpCode(204)
  remove(@Actor() actor: ActorData, @CurrentStore() store: CurrentStoreData, @Param('id', UuidPipe) id: string) {
    return this.media.remove(actor, storeScope(store), id);
  }
}
