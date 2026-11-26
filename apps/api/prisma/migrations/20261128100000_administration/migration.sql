ALTER TABLE "user"
  ADD COLUMN "suspendedAt" TIMESTAMPTZ(3),
  ADD COLUMN "suspensionReason" TEXT NOT NULL DEFAULT '';

CREATE TABLE "report" (
  "id" UUID PRIMARY KEY,
  "reporterId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "targetType" TEXT NOT NULL,
  "productId" UUID REFERENCES "product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "reservationId" UUID REFERENCES "reservation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "storeId" UUID NOT NULL REFERENCES "store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "reason" TEXT NOT NULL,
  "details" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "resolution" TEXT NOT NULL DEFAULT '',
  "resolvedBy" TEXT,
  "resolvedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "report_target_check" CHECK (
    ("targetType" = 'PRODUCT' AND "productId" IS NOT NULL AND "reservationId" IS NULL)
    OR ("targetType" = 'RESERVATION' AND "reservationId" IS NOT NULL AND "productId" IS NULL)),
  CONSTRAINT "report_reason_check" CHECK ("reason" IN ('FRAUD', 'PROHIBITED', 'MISLEADING', 'IMPERSONATION', 'NO_DELIVERY', 'PAYMENT_ISSUE', 'OTHER')),
  CONSTRAINT "report_status_check" CHECK ("status" IN ('OPEN', 'RESOLVED', 'DISMISSED')),
  CONSTRAINT "report_resolution_check" CHECK (("status" = 'OPEN') = ("resolvedAt" IS NULL) AND ("status" = 'OPEN' OR ("resolvedBy" IS NOT NULL AND "resolution" <> '')))
);
CREATE INDEX "report_status_targetType_createdAt_idx" ON "report" ("status", "targetType", "createdAt");
CREATE INDEX "report_reporterId_status_idx" ON "report" ("reporterId", "status");
-- Una abierta por persona y objetivo.
CREATE UNIQUE INDEX "report_open_product_key" ON "report" ("reporterId", "productId") WHERE "status" = 'OPEN' AND "productId" IS NOT NULL;
CREATE UNIQUE INDEX "report_open_reservation_key" ON "report" ("reporterId", "reservationId") WHERE "status" = 'OPEN' AND "reservationId" IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON "report" TO marketplace_app;
