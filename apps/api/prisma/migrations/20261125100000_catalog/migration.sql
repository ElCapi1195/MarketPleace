CREATE TABLE "store" (
  "id" UUID PRIMARY KEY,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "store_status_check" CHECK ("status" IN ('ACTIVE', 'SUSPENDED'))
);
CREATE UNIQUE INDEX "store_slug_key" ON "store" ("slug");

CREATE TABLE "product" (
  "id" UUID PRIMARY KEY,
  "storeId" UUID NOT NULL REFERENCES "store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "categorySlug" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "priceMinor" INTEGER NOT NULL,
  "depositMinor" INTEGER NOT NULL,
  "units" INTEGER,
  "availableOn" DATE,
  "attributes" JSONB NOT NULL DEFAULT '{}',
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "searchText" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdBy" TEXT,
  "publishedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "product_kind_check" CHECK ("kind" IN ('PREORDER', 'IN_STOCK', 'SERVICE')),
  CONSTRAINT "product_status_check" CHECK ("status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  CONSTRAINT "product_money_check" CHECK ("priceMinor" >= 0 AND "depositMinor" BETWEEN 0 AND "priceMinor"),
  CONSTRAINT "product_units_check" CHECK ("units" IS NULL OR "units" >= 0),
  CONSTRAINT "product_date_check" CHECK (("kind" = 'PREORDER') = ("availableOn" IS NOT NULL))
);
CREATE UNIQUE INDEX "product_slug_key" ON "product" ("slug");
CREATE INDEX "product_status_publishedAt_idx" ON "product" ("status", "publishedAt");
CREATE INDEX "product_status_categorySlug_idx" ON "product" ("status", "categorySlug");
CREATE INDEX "product_storeId_idx" ON "product" ("storeId");

CREATE TABLE "product_media" (
  "id" UUID PRIMARY KEY,
  "productId" UUID NOT NULL REFERENCES "product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "kind" TEXT NOT NULL,
  "alt" TEXT NOT NULL DEFAULT '',
  "position" INTEGER NOT NULL DEFAULT 0,
  "width" INTEGER,
  "height" INTEGER,
  "bytes" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_media_kind_check" CHECK ("kind" IN ('IMAGE', 'MODEL'))
);
CREATE INDEX "product_media_productId_position_idx" ON "product_media" ("productId", "position");
-- Un solo modelo 3D por producto, aunque lleguen dos subidas a la vez.
CREATE UNIQUE INDEX "product_media_single_model_key" ON "product_media" ("productId") WHERE "kind" = 'MODEL';

-- Los productos se archivan: la aplicación no puede borrarlos, ni tampoco las tiendas.
GRANT SELECT, INSERT, UPDATE ON "store", "product" TO marketplace_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "product_media" TO marketplace_app;
