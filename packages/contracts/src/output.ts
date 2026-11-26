import type { ListingKind, ProductStatus } from './input.js';

export interface MediaView {
  id: string;
  kind: 'IMAGE' | 'MODEL';
  alt: string;
  position: number;
  width: number | null;
  height: number | null;
  bytes: number;
}

export interface StoreView {
  id: string;
  name: string;
}

export interface ProductCard {
  slug: string;
  title: string;
  categorySlug: string;
  kind: ListingKind;
  priceMinor: number;
  units: number | null;
  availableOn: string | null;
  storeName: string;
  cover: MediaView | null;
  hasModel: boolean;
}

export interface ProductDetail extends ProductCard {
  description: string;
  depositMinor: number;
  attributes: Record<string, string | number | boolean>;
  images: MediaView[];
  model: MediaView | null;
}

export interface CatalogPage {
  items: ProductCard[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CategoryCover {
  slug: string;
  total: number;
  cover: MediaView | null;
}

export interface CatalogHome {
  featured: ProductCard[];
  preorders: ProductCard[];
  available: ProductCard[];
  /** Categorías principales, con sus descendientes contados. */
  categories: CategoryCover[];
}

export interface AdminProduct {
  id: string;
  version: number;
  slug: string;
  status: ProductStatus;
  store: StoreView;
  title: string;
  description: string;
  categorySlug: string;
  kind: ListingKind;
  priceMinor: number;
  depositMinor: number;
  units: number | null;
  availableOn: string | null;
  attributes: Record<string, string | number | boolean>;
  featured: boolean;
  media: MediaView[];
  updatedAt: string;
}
