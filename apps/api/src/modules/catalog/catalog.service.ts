import { fold } from '@marketplace/core';
import type { CatalogHome, CatalogPage, CatalogQuery, CategoryCover, ProductDetail } from '@marketplace/contracts';
import type { VerticalConfig } from '@marketplace/verticals';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { VERTICAL } from '../../config/vertical.js';
import { CatalogRepository } from './catalog.repository.js';
import { categoryBranch } from './categories.js';
import { cardView, detailView } from './product.views.js';

const PAGE_SIZE = 12;
const MAX_WORDS = 8;
const FEATURED = 3;
const SHELF = 4;

@Injectable()
export class CatalogService {
  constructor(
    @Inject(CatalogRepository) private readonly catalog: CatalogRepository,
    @Inject(VERTICAL) private readonly vertical: VerticalConfig,
  ) {}

  async search({ q, category, kind, sort, page }: CatalogQuery): Promise<CatalogPage> {
    const words = fold(q).split(' ').filter(Boolean).slice(0, MAX_WORDS);
    // Un texto sin letras ni números ("%") no debe equivaler a no buscar.
    if (q !== '' && words.length === 0) return { items: [], total: 0, page, pageSize: PAGE_SIZE };
    const categories = category === undefined ? undefined : categoryBranch(this.vertical.categories, category);
    const filter = { words, categories, kind };
    const [rows, total] = await Promise.all([
      this.catalog.find(filter, sort, PAGE_SIZE, (page - 1) * PAGE_SIZE),
      this.catalog.count(filter),
    ]);
    return { items: rows.map(cardView), total, page, pageSize: PAGE_SIZE };
  }

  async detail(slug: string): Promise<ProductDetail> {
    const row = await this.catalog.findBySlug(slug);
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'El producto no existe.' });
    return detailView(row);
  }

  async home(): Promise<CatalogHome> {
    const roots = this.vertical.categories.filter(({ parent }) => parent === undefined);
    const [featured, recent, preorders, available, categories] = await Promise.all([
      this.catalog.find({ featured: true }, 'recent', FEATURED),
      this.catalog.find({ featured: false }, 'recent', FEATURED),
      this.catalog.find({ kind: 'PREORDER' }, 'soonest', SHELF),
      this.catalog.find({ kind: 'IN_STOCK' }, 'recent', SHELF),
      Promise.all(roots.map(({ slug }) => this.cover(slug))),
    ]);
    return {
      // Si faltan destacados, se completa con lo más reciente.
      featured: [...featured, ...recent].slice(0, FEATURED).map(cardView),
      preorders: preorders.map(cardView),
      available: available.map(cardView),
      categories,
    };
  }

  private async cover(slug: string): Promise<CategoryCover> {
    const filter = { categories: categoryBranch(this.vertical.categories, slug) };
    const [[row], total] = await Promise.all([this.catalog.find(filter, 'recent', 1), this.catalog.count(filter)]);
    return { slug, total, cover: row ? cardView(row).cover : null };
  }
}
