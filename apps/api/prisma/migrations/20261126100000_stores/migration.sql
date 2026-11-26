ALTER TABLE "store" DROP CONSTRAINT "store_status_check";
UPDATE "store" SET "status" = 'APPROVED' WHERE "status" = 'ACTIVE';
ALTER TABLE "store"
  ALTER COLUMN "status" SET DEFAULT 'DRAFT',
  ADD COLUMN "about" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "legalName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "taxId" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "phone" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "address" TEXT NOT NULL DEFAULT '',
  ADD CONSTRAINT "store_status_check"
    CHECK ("status" IN ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'NEEDS_INFO', 'APPROVED', 'REJECTED', 'SUSPENDED')),
  -- Nadie revisa una solicitud incompleta.
  ADD CONSTRAINT "store_complete_check"
    CHECK ("status" NOT IN ('SUBMITTED', 'IN_REVIEW') OR ("legalName" <> '' AND "taxId" <> '' AND "phone" <> '' AND "address" <> ''));
CREATE INDEX "store_status_updatedAt_idx" ON "store" ("status", "updatedAt");

CREATE TABLE "store_member" (
  "storeId" UUID NOT NULL REFERENCES "store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "role" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("storeId", "userId"),
  CONSTRAINT "store_member_role_check" CHECK ("role" IN ('OWNER', 'MANAGER', 'STAFF'))
);
CREATE INDEX "store_member_userId_idx" ON "store_member" ("userId");

CREATE TABLE "store_document" (
  "id" UUID PRIMARY KEY,
  "storeId" UUID NOT NULL REFERENCES "store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "key" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "bytes" INTEGER NOT NULL,
  "uploadedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "store_document_type_check" CHECK ("type" IN ('application/pdf', 'image/webp'))
);
CREATE UNIQUE INDEX "store_document_storeId_key_key" ON "store_document" ("storeId", "key");

CREATE TABLE "store_event" (
  "id" UUID PRIMARY KEY,
  "storeId" UUID NOT NULL REFERENCES "store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "action" TEXT NOT NULL,
  "fromStatus" TEXT NOT NULL,
  "toStatus" TEXT NOT NULL,
  "reason" TEXT NOT NULL DEFAULT '',
  "actorId" TEXT NOT NULL
);
CREATE INDEX "store_event_storeId_at_idx" ON "store_event" ("storeId", "at");
CREATE TRIGGER "store_event_append_only" BEFORE UPDATE OR DELETE ON "store_event"
  FOR EACH ROW EXECUTE FUNCTION "forbid_mutation"();
CREATE TRIGGER "store_event_no_truncate" BEFORE TRUNCATE ON "store_event"
  FOR EACH STATEMENT EXECUTE FUNCTION "forbid_mutation"();

CREATE TABLE "store_invitation" (
  "id" UUID PRIMARY KEY,
  "storeId" UUID NOT NULL REFERENCES "store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "email" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "invitedBy" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "store_invitation_role_check" CHECK ("role" IN ('MANAGER', 'STAFF')),
  CONSTRAINT "store_invitation_email_check" CHECK ("email" = lower("email"))
);
CREATE UNIQUE INDEX "store_invitation_tokenHash_key" ON "store_invitation" ("tokenHash");
CREATE UNIQUE INDEX "store_invitation_storeId_email_key" ON "store_invitation" ("storeId", "email");

ALTER TABLE "product" DROP CONSTRAINT "product_status_check";
ALTER TABLE "product"
  ADD COLUMN "rejection" TEXT NOT NULL DEFAULT '',
  ADD CONSTRAINT "product_status_check" CHECK ("status" IN ('DRAFT', 'PENDING_MODERATION', 'PUBLISHED', 'REJECTED', 'ARCHIVED'));

GRANT SELECT, INSERT, UPDATE, DELETE ON "store_member", "store_document", "store_invitation" TO marketplace_app;
GRANT SELECT, INSERT ON "store_event" TO marketplace_app;
