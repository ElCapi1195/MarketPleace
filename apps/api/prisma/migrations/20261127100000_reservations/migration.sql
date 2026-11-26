ALTER TABLE "store" ADD COLUMN "pickupInfo" TEXT NOT NULL DEFAULT '';

CREATE TABLE "reservation" (
  "id" UUID PRIMARY KEY,
  "code" TEXT NOT NULL,
  "customerId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "storeId" UUID NOT NULL REFERENCES "store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "productId" UUID NOT NULL REFERENCES "product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "idempotencyKey" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  "version" INTEGER NOT NULL DEFAULT 1,
  "kind" TEXT NOT NULL,
  "productTitle" TEXT NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "requestedPriceMinor" INTEGER NOT NULL,
  "requestedDepositMinor" INTEGER NOT NULL,
  "requestedAvailableOn" DATE,
  "priceMinor" INTEGER NOT NULL,
  "depositMinor" INTEGER NOT NULL,
  "availableOn" DATE,
  "offerPriceMinor" INTEGER,
  "offerDepositMinor" INTEGER,
  "offerAvailableOn" DATE,
  "termsVersion" TEXT NOT NULL,
  "phone" TEXT NOT NULL DEFAULT '',
  "note" TEXT NOT NULL DEFAULT '',
  "unitHeld" BOOLEAN NOT NULL DEFAULT false,
  "approvedAt" TIMESTAMPTZ(3),
  "expiresAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "reservation_status_check" CHECK ("status" IN (
    'PENDING_REVIEW', 'AWAITING_CUSTOMER', 'AWAITING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS', 'READY',
    'COMPLETED', 'NO_SHOW', 'REJECTED', 'CANCELLED', 'EXPIRED')),
  CONSTRAINT "reservation_kind_check" CHECK ("kind" IN ('PREORDER', 'IN_STOCK', 'SERVICE')),
  CONSTRAINT "reservation_money_check" CHECK (
    "requestedPriceMinor" >= 0 AND "requestedDepositMinor" BETWEEN 0 AND "requestedPriceMinor"
    AND "priceMinor" >= 0 AND "depositMinor" BETWEEN 0 AND "priceMinor"),
  -- Una propuesta existe entera y solo mientras el cliente decide.
  CONSTRAINT "reservation_offer_check" CHECK (
    ("offerPriceMinor" IS NULL) = ("offerDepositMinor" IS NULL)
    AND ("offerPriceMinor" IS NULL OR "offerDepositMinor" BETWEEN 0 AND "offerPriceMinor")
    AND (("status" = 'AWAITING_CUSTOMER') = ("offerPriceMinor" IS NOT NULL))),
  -- Nada se compromete antes de aprobar, ni sigue comprometido al cerrar sin entrega.
  CONSTRAINT "reservation_held_check" CHECK (
    NOT "unitHeld" OR "status" IN ('AWAITING_CUSTOMER', 'AWAITING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS', 'READY', 'COMPLETED')),
  CONSTRAINT "reservation_approved_check" CHECK (
    "approvedAt" IS NOT NULL OR "status" IN ('PENDING_REVIEW', 'REJECTED', 'CANCELLED', 'EXPIRED')),
  CONSTRAINT "reservation_deadline_check" CHECK (
    ("expiresAt" IS NOT NULL) = ("status" IN ('PENDING_REVIEW', 'AWAITING_CUSTOMER', 'AWAITING_DEPOSIT', 'READY')))
);
CREATE UNIQUE INDEX "reservation_code_key" ON "reservation" ("code");
CREATE UNIQUE INDEX "reservation_customerId_idempotencyKey_key" ON "reservation" ("customerId", "idempotencyKey");
-- Una reserva activa por producto y cliente.
CREATE UNIQUE INDEX "reservation_active_key" ON "reservation" ("customerId", "productId")
  WHERE "status" IN ('PENDING_REVIEW', 'AWAITING_CUSTOMER', 'AWAITING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS', 'READY');
CREATE INDEX "reservation_customerId_createdAt_idx" ON "reservation" ("customerId", "createdAt");
CREATE INDEX "reservation_storeId_status_createdAt_idx" ON "reservation" ("storeId", "status", "createdAt");
CREATE INDEX "reservation_productId_idx" ON "reservation" ("productId");
CREATE INDEX "reservation_expiry_idx" ON "reservation" ("expiresAt")
  WHERE "status" IN ('PENDING_REVIEW', 'AWAITING_CUSTOMER', 'AWAITING_DEPOSIT');

CREATE TABLE "reservation_event" (
  "id" UUID PRIMARY KEY,
  "reservationId" UUID NOT NULL REFERENCES "reservation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "action" TEXT NOT NULL,
  "fromStatus" TEXT NOT NULL,
  "toStatus" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "actorId" TEXT,
  "reason" TEXT NOT NULL DEFAULT '',
  CONSTRAINT "reservation_event_actor_check" CHECK ("actor" IN ('CUSTOMER', 'STORE', 'PLATFORM', 'SYSTEM')),
  CONSTRAINT "reservation_event_actorId_check" CHECK (("actor" = 'SYSTEM') = ("actorId" IS NULL))
);
CREATE INDEX "reservation_event_reservationId_at_idx" ON "reservation_event" ("reservationId", "at");

CREATE TABLE "payment_record" (
  "id" UUID PRIMARY KEY,
  "reservationId" UUID NOT NULL REFERENCES "reservation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "kind" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "method" TEXT NOT NULL,
  "reference" TEXT NOT NULL DEFAULT '',
  "note" TEXT NOT NULL DEFAULT '',
  "recordedBy" TEXT NOT NULL,
  "reversesId" UUID REFERENCES "payment_record" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_record_kind_check" CHECK ("kind" IN ('DEPOSIT', 'BALANCE', 'REFUND')),
  CONSTRAINT "payment_record_method_check" CHECK ("method" IN ('CASH', 'TRANSFER', 'TERMINAL', 'OTHER')),
  -- Solo un reverso lleva importe negativo.
  CONSTRAINT "payment_record_amount_check" CHECK (
    ("reversesId" IS NULL AND "amountMinor" > 0) OR ("reversesId" IS NOT NULL AND "amountMinor" < 0))
);
CREATE UNIQUE INDEX "payment_record_reversesId_key" ON "payment_record" ("reversesId");
CREATE INDEX "payment_record_reservationId_at_idx" ON "payment_record" ("reservationId", "at");

CREATE TRIGGER "reservation_event_append_only" BEFORE UPDATE OR DELETE ON "reservation_event"
  FOR EACH ROW EXECUTE FUNCTION "forbid_mutation"();
CREATE TRIGGER "reservation_event_no_truncate" BEFORE TRUNCATE ON "reservation_event"
  FOR EACH STATEMENT EXECUTE FUNCTION "forbid_mutation"();
CREATE TRIGGER "payment_record_append_only" BEFORE UPDATE OR DELETE ON "payment_record"
  FOR EACH ROW EXECUTE FUNCTION "forbid_mutation"();
CREATE TRIGGER "payment_record_no_truncate" BEFORE TRUNCATE ON "payment_record"
  FOR EACH STATEMENT EXECUTE FUNCTION "forbid_mutation"();

GRANT SELECT, INSERT, UPDATE ON "reservation" TO marketplace_app;
GRANT SELECT, INSERT ON "reservation_event", "payment_record" TO marketplace_app;
