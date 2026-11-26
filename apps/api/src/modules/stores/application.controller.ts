import { storeApplicationInput, type StoreApplicationInput } from '@marketplace/contracts';
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Req, Res, StreamableFile } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Actor, type ActorData } from '../../common/actor.js';
import { UuidPipe } from '../../common/uuid.pipe.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import {
  CurrentStore,
  CurrentUser,
  RequireStore,
  RequireTwoFactor,
  type CurrentStoreData,
  type CurrentUserData,
} from '../identity/access.js';
import { ApplicationService } from './application.service.js';
import { sendDocument } from './document.response.js';
import { DocumentService } from './document.service.js';

@Controller('stores')
export class ApplicationController {
  constructor(
    @Inject(ApplicationService) private readonly applications: ApplicationService,
    @Inject(DocumentService) private readonly documents: DocumentService,
  ) {}

  @Get('mine')
  mine(@CurrentUser() user: CurrentUserData) {
    return this.applications.mine(user.id);
  }

  @Post()
  @RequireTwoFactor()
  create(@Actor() actor: ActorData, @Body(new ZodPipe(storeApplicationInput)) input: StoreApplicationInput) {
    return this.applications.create(actor, input);
  }

  @Get(':storeId')
  @RequireStore('store.read')
  get(@CurrentStore() store: CurrentStoreData) {
    return this.applications.get(store);
  }

  @Patch(':storeId')
  @RequireStore('store.edit')
  update(
    @Actor() actor: ActorData,
    @CurrentStore() store: CurrentStoreData,
    @Body(new ZodPipe(storeApplicationInput)) input: StoreApplicationInput,
  ) {
    return this.applications.update(actor, store, input);
  }

  @Post(':storeId/submit')
  @HttpCode(200)
  @RequireStore('store.edit')
  submit(@Actor() actor: ActorData, @CurrentStore() store: CurrentStoreData) {
    return this.applications.submit(actor, store);
  }

  @Post(':storeId/documents/:key')
  @RequireStore('store.edit')
  upload(@Actor() actor: ActorData, @CurrentStore() store: CurrentStoreData, @Param('key') key: string, @Req() request: Request) {
    return this.documents.upload(actor, store, key, request);
  }

  @Get(':storeId/documents/:id')
  @RequireStore('store.edit')
  async read(
    @CurrentStore() store: CurrentStoreData,
    @Param('id', UuidPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return sendDocument(res, await this.documents.open(store.id, id));
  }

  @Delete(':storeId/documents/:id')
  @HttpCode(204)
  @RequireStore('store.edit')
  remove(@Actor() actor: ActorData, @CurrentStore() store: CurrentStoreData, @Param('id', UuidPipe) id: string) {
    return this.documents.remove(actor, store, id);
  }
}
