# F1 Identidad Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Ejecución nativa.

**Goal:** Cuentas seguras: registro con email verificado, sesión revocable, 2FA TOTP, permisos, auditoría y límites, con sus pantallas.

**Architecture:** better-auth se monta en `/api/auth/*` con su adaptador Prisma; lo rodean módulos propios (permisos en `packages/core`, auditoría y límites con su repositorio). Un guard global deniega por defecto. Las pruebas usan un Postgres 17 real embebido y la app se conecta con un rol sin privilegios sobre la auditoría.

**Tech Stack:** better-auth 1.7.27, Prisma 7.10.1 + adapter-pg, @node-rs/argon2, nodemailer, embedded-postgres 17 (solo pruebas).

**Spec:** [marketplace-core-design](../specs/2026-11-24-marketplace-core-design.md)

## Global Constraints

- Archivos < 500 líneas; CRUD solo en `*.repository.ts` y en el adaptador de better-auth.
- Sin CORS; cookie `__Host-` HttpOnly Secure SameSite=Lax en producción; se verifica `Origin`.
- Argon2id. Contraseña de 12 a 128 caracteres. Respuestas sin enumeración de cuentas.
- 2FA TOTP obligatorio para roles con privilegios. Denegar por defecto.
- Auditoría solo-inserción: el rol de la app no puede hacer UPDATE, DELETE ni TRUNCATE, y un trigger lo impide además a cualquier otro rol.
- Nunca se guardan ni registran contraseñas, tokens ni el email en claro en la auditoría.
- Errores `{ error: { code, message, requestId } }` en nuestras rutas; las de better-auth conservan `{ code, message }`.
- Sin Docker local ni cambios en Proxmox/Dokploy.

## Review Focus

- Registrar un email existente: misma respuesta que uno nuevo y sin sesión (Tarea 4).
- Intentar fijar `platformRole`, `emailVerified` o `twoFactorEnabled` desde el cliente: se ignora o rechaza (Tarea 4).
- Contraseña correcta con 2FA activo: no hay sesión hasta el segundo paso (Tarea 4).
- Cambiar la contraseña con sesiones abiertas en otro equipo: se cierran (Tarea 4).
- Mayúsculas y espacios en el email al iniciar sesión: no esquivan el bloqueo por cuenta (Tarea 3).
- Redirecciones tras verificar hacia otro dominio: rechazadas (Tarea 4).

### Task 1: `@marketplace/core`, permisos

**Files:** `packages/core/src/{permissions,index}.ts`, `test/permissions.test.ts`
**Produces:** `platformRoles`, `type PlatformRole`, `type Permission`, `can(role, permission): boolean`, `requiresTwoFactor(role): boolean`.

- [x] Pruebas: matriz completa; rol desconocido sin permisos; `customer` sin 2FA obligatorio y el resto con él.

### Task 2: Base de datos

**Files:** `apps/api/prisma/{schema.prisma,migrations/*}`, `prisma.config.ts`, `src/database/{prisma.service,database.module}.ts`, `test/support/database.ts`
**Produces:** `createTestDatabase(): Promise<{ appUrl, ownerUrl, stop }>`, `createPrisma(url): PrismaClient`.

- [x] Pruebas: las migraciones se aplican; el rol de la app inserta y lee auditoría; UPDATE, DELETE y TRUNCATE fallan con el rol de la app y con el propietario; el rol de la app no puede crear tablas.

### Task 3: Auditoría y bloqueo por cuenta

**Files:** `src/modules/audit/{audit.repository,audit.service}.ts`, `src/modules/identity/{login-throttle.repository,login-throttle.service}.ts`
**Produces:** `AuditService.record(event)`, `LoginThrottle.assertAllowed(email)`, `.recordFailure(email)`, `.clear(email)`.

- [x] Pruebas: 8 fallos en 15 min bloquean; variantes de mayúsculas cuentan igual; vence solo; el email se guarda como HMAC; la auditoría descarta claves sensibles.

### Task 4: Registro, sesión y 2FA

**Files:** `src/modules/identity/{auth,auth.emails,password,session.guard,access.decorators,identity.controller,identity.module}.ts`, `src/modules/mail/*`
**Produces:** `createAuth(deps)`, decoradores `@Public()`, `@RequirePermission(p)`, `GET /api/me`, `GET /api/admin/audit`.

- [x] Pruebas HTTP de todo Review Focus; guard por defecto; 2FA obligatorio; revocar sesión; restablecer contraseña de un solo uso; cookie; Origin ajeno.

### Task 5: Pantallas

**Files:** `apps/web/features/account/*`, `apps/web/app/(account)/*`
**Produces:** `/entrar`, `/registro`, `/recuperar`, `/restablecer`, `/segundo-paso`, `/cuenta`.

- [x] Pruebas de validación y de mensajes de error; recorrido real en el navegador contra la API.

### Task 6: Cierre

- [x] Comprobaciones completas, amenazas y README actualizados, revisión de seguridad propia.
