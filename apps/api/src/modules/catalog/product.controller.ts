import { productInput, productPatch, type ProductInput, type ProductPatch } from '@marketplace/contracts';
import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { Actor, type ActorData } from '../../common/actor.js';
import { UuidPipe } from '../../common/uuid.pipe.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { RequirePermission } from '../identity/access.js';
import { ProductService } from './product.service.js';

const listQuery = z.object({ page: z.coerce.number().int().min(1).max(1000).default(1) });

@Controller('admin/products')
@RequirePermission('catalog.manage')
export class ProductController {
  constructor(@Inject(ProductService) private readonly products: ProductService) {}

  @Get()
  list(@Query(new ZodPipe(listQuery)) { page }: z.output<typeof listQuery>) {
    return this.products.list(page);
  }

  @Post()
  create(@Actor() actor: ActorData, @Body(new ZodPipe(productInput)) input: ProductInput) {
    return this.products.create(actor, input);
  }

  @Get(':id')
  get(@Param('id', UuidPipe) id: string) {
    return this.products.get(id);
  }

  @Patch(':id')
  update(@Actor() actor: ActorData, @Param('id', UuidPipe) id: string, @Body(new ZodPipe(productPatch)) input: ProductPatch) {
    return this.products.update(actor, id, input);
  }

  @Post(':id/publish')
  @HttpCode(200)
  publish(@Actor() actor: ActorData, @Param('id', UuidPipe) id: string) {
    return this.products.publish(actor, id);
  }

  @Post(':id/archive')
  @HttpCode(200)
  archive(@Actor() actor: ActorData, @Param('id', UuidPipe) id: string) {
    return this.products.archive(actor, id);
  }
}
