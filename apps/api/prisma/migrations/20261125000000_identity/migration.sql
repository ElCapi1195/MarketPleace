CREATE TABLE "user" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  "image" TEXT,
  "platformRole" TEXT NOT NULL DEFAULT 'customer',
  "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "user_platformRole_check" CHECK ("platformRole" IN ('customer', 'moderator', 'admin')),
  CONSTRAINT "user_email_lowercase_check" CHECK ("email" = lower("email"))
);
CREATE UNIQUE INDEX "user_email_key" ON "user" ("email");

CREATE TABLE "session" (
  "id" TEXT PRIMARY KEY,
  "token" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE UNIQUE INDEX "session_token_key" ON "session" ("token");
CREATE INDEX "session_userId_idx" ON "session" ("userId");

CREATE TABLE "account" (
  "id" TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMPTZ(3),
  "refreshTokenExpiresAt" TIMESTAMPTZ(3),
  "scope" TEXT,
  "password" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX "account_userId_idx" ON "account" ("userId");

CREATE TABLE "verification" (
  "id" TEXT PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");

CREATE TABLE "two_factor" (
  "id" TEXT PRIMARY KEY,
  "secret" TEXT NOT NULL,
  "backupCodes" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "verified" BOOLEAN NOT NULL DEFAULT true,
  "failedVerificationCount" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMPTZ(3)
);
CREATE INDEX "two_factor_secret_idx" ON "two_factor" ("secret");
CREATE INDEX "two_factor_userId_idx" ON "two_factor" ("userId");

CREATE TABLE "rate_limit" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "lastRequest" BIGINT NOT NULL
);
CREATE UNIQUE INDEX "rate_limit_key_key" ON "rate_limit" ("key");

CREATE TABLE "login_failure" (
  "id" BIGSERIAL PRIMARY KEY,
  "emailHash" CHAR(64) NOT NULL,
  "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "login_failure_emailHash_at_idx" ON "login_failure" ("emailHash", "at");

CREATE TABLE "audit_event" (
  "id" UUID PRIMARY KEY,
  "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "ipAddress" TEXT,
  "requestId" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX "audit_event_at_idx" ON "audit_event" ("at");
CREATE INDEX "audit_event_actorId_at_idx" ON "audit_event" ("actorId", "at");
CREATE INDEX "audit_event_targetType_targetId_at_idx" ON "audit_event" ("targetType", "targetId", "at");

-- Tablas de solo inserción. Reutilizable para los registros de pago (F4).
CREATE FUNCTION "forbid_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La tabla % es de solo inserción', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER "audit_event_append_only" BEFORE UPDATE OR DELETE ON "audit_event"
  FOR EACH ROW EXECUTE FUNCTION "forbid_mutation"();
CREATE TRIGGER "audit_event_no_truncate" BEFORE TRUNCATE ON "audit_event"
  FOR EACH STATEMENT EXECUTE FUNCTION "forbid_mutation"();

-- La aplicación se conecta con un rol sin propiedad ni DDL. Lo crea operaciones antes de migrar.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'marketplace_app') THEN
    RAISE EXCEPTION 'Falta el rol marketplace_app: créalo antes de migrar (ver README)';
  END IF;
END;
$$;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO marketplace_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "user", "session", "account", "verification", "two_factor", "rate_limit" TO marketplace_app;
GRANT SELECT, INSERT, DELETE ON "login_failure" TO marketplace_app;
GRANT USAGE ON SEQUENCE "login_failure_id_seq" TO marketplace_app;
GRANT SELECT, INSERT ON "audit_event" TO marketplace_app;
