import { mediaPatch, modelType, type MediaPatch } from '@marketplace/contracts';
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Req, Res, StreamableFile } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Actor, type ActorData } from '../../common/actor.js';
import { UuidPipe } from '../../common/uuid.pipe.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { Public, RequirePermission } from '../identity/access.js';
import { MediaService } from './media.service.js';
import type { StoredFile } from './storage.js';

/** El tipo lo decide el servidor, nunca quien subió el archivo. */
function send(res: Response, variant: string, { stream, size }: StoredFile, cache: string): StreamableFile {
  res.setHeader('cache-control', cache);
  return new StreamableFile(stream, { type: variant === 'model' ? modelType : 'image/webp', length: size });
}

@Public()
@Controller('media')
export class MediaController {
  constructor(@Inject(MediaService) private readonly media: MediaService) {}

  @Get(':id/:variant')
  async read(@Param('id', UuidPipe) id: string, @Param('variant') variant: string, @Res({ passthrough: true }) res: Response) {
    return send(res, variant, await this.media.openPublic(id, variant), 'public, max-age=86400');
  }
}

@Controller('admin')
@RequirePermission('catalog.manage')
export class AdminMediaController {
  constructor(@Inject(MediaService) private readonly media: MediaService) {}

  @Post('products/:id/media')
  upload(@Actor() actor: ActorData, @Param('id', UuidPipe) id: string, @Req() request: Request) {
    return this.media.upload(actor, id, request);
  }

  @Get('media/:id/:variant')
  async read(@Param('id', UuidPipe) id: string, @Param('variant') variant: string, @Res({ passthrough: true }) res: Response) {
    return send(res, variant, await this.media.openPrivate(id, variant), 'private, no-store');
  }

  @Patch('media/:id')
  patch(@Param('id', UuidPipe) id: string, @Body(new ZodPipe(mediaPatch)) changes: MediaPatch) {
    return this.media.patch(id, changes);
  }

  @Delete('media/:id')
  @HttpCode(204)
  remove(@Actor() actor: ActorData, @Param('id', UuidPipe) id: string) {
    return this.media.remove(actor, id);
  }
}
