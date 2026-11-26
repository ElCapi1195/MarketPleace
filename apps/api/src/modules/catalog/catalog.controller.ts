import { catalogQuery, type CatalogQuery } from '@marketplace/contracts';
import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ZodPipe } from '../../common/zod.pipe.js';
import { Public } from '../identity/access.js';
import { CatalogService } from './catalog.service.js';

@Public()
@Controller('catalog')
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Get('home')
  home() {
    return this.catalog.home();
  }

  @Get('products')
  search(@Query(new ZodPipe(catalogQuery)) query: CatalogQuery) {
    return this.catalog.search(query);
  }

  @Get('products/:slug')
  detail(@Param('slug') slug: string) {
    return this.catalog.detail(slug);
  }
}
