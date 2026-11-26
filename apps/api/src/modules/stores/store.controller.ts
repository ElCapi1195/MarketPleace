import { storeInput, type StoreInput } from '@marketplace/contracts';
import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { Actor, type ActorData } from '../../common/actor.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { RequirePermission } from '../identity/access.js';
import { StoreService } from './store.service.js';

@Controller('admin/stores')
@RequirePermission('catalog.manage')
export class StoreController {
  constructor(@Inject(StoreService) private readonly stores: StoreService) {}

  @Get()
  list() {
    return this.stores.list();
  }

  @Post()
  create(@Actor() actor: ActorData, @Body(new ZodPipe(storeInput)) input: StoreInput) {
    return this.stores.create(actor, input);
  }
}
