import { productInput, productPatch, type ProductInput, type ProductPatch } from '@marketplace/contracts';
import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { Actor, type ActorData } from '../../common/actor.js';
import { UuidPipe } from '../../common/uuid.pipe.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { CurrentStore, RequirePermission, RequireStore, type CurrentStoreData } from '../identity/access.js';
import { ProductService } from './product.service.js';
import { PLATFORM, storeScope } from './scope.js';

const listQuery = z.object({ page: z.coerce.number().int().min(1).max(1000).default(1) });
type ListQuery = z.output<typeof listQuery>;

@Controller('admin/products')
@RequirePermission('catalog.manage')
export class ProductController {
  constructor(@Inject(ProductService) private readonly products: ProductService) {}

  @Get()
  list(@Query(new ZodPipe(listQuery)) { page }: ListQuery) {
    return this.products.list(PLATFORM, page);
  }

  @Post()
  create(@Actor() actor: ActorData, @Body(new ZodPipe(productInput)) input: ProductInput) {
    return this.products.create(actor, PLATFORM, input);
  }

  @Get(':id')
  get(@Param('id', UuidPipe) id: string) {
    return this.products.get(PLATFORM, id);
  }

  @Patch(':id')
  update(@Actor() actor: ActorData, @Param('id', UuidPipe) id: string, @Body(new ZodPipe(productPatch)) input: ProductPatch) {
    return this.products.update(actor, PLATFORM, id, input);
  }

  @Post(':id/publish')
  @HttpCode(200)
  publish(@Actor() actor: ActorData, @Param('id', UuidPipe) id: string) {
    return this.products.publish(actor, PLATFORM, id);
  }

  @Post(':id/archive')
  @HttpCode(200)
  archive(@Actor() actor: ActorData, @Param('id', UuidPipe) id: string) {
    return this.products.archive(actor, PLATFORM, id);
  }
}

@Controller('stores/:storeId/products')
@RequireStore('product.manage')
export class StoreProductController {
  constructor(@Inject(ProductService) private readonly products: ProductService) {}

  @Get()
  list(@CurrentStore() store: CurrentStoreData, @Query(new ZodPipe(listQuery)) { page }: ListQuery) {
    return this.products.list(storeScope(store), page);
  }

  @Post()
  create(@Actor() actor: ActorData, @CurrentStore() store: CurrentStoreData, @Body(new ZodPipe(productInput)) input: ProductInput) {
    return this.products.create(actor, storeScope(store), input);
  }

  @Get(':id')
  get(@CurrentStore() store: CurrentStoreData, @Param('id', UuidPipe) id: string) {
    return this.products.get(storeScope(store), id);
  }

  @Patch(':id')
  update(
    @Actor() actor: ActorData,
    @CurrentStore() store: CurrentStoreData,
    @Param('id', UuidPipe) id: string,
    @Body(new ZodPipe(productPatch)) input: ProductPatch,
  ) {
    return this.products.update(actor, storeScope(store), id, input);
  }

  @Post(':id/submit')
  @HttpCode(200)
  submit(@Actor() actor: ActorData, @CurrentStore() store: CurrentStoreData, @Param('id', UuidPipe) id: string) {
    return this.products.submit(actor, storeScope(store), id);
  }

  @Post(':id/archive')
  @HttpCode(200)
  archive(@Actor() actor: ActorData, @CurrentStore() store: CurrentStoreData, @Param('id', UuidPipe) id: string) {
    return this.products.archive(actor, storeScope(store), id);
  }
}
