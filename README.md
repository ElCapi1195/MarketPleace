# Marketplace B2C

Núcleo reutilizable de marketplace con tiendas verificadas y reservas con aprobación. Primer nicho: `gamer`.

- Diseño: [docs/superpowers/specs](docs/superpowers/specs/2026-11-24-marketplace-core-design.md)
- Decisiones: [docs/adr](docs/adr/0001-arquitectura-base.md) · Amenazas: [docs/threat-model.md](docs/threat-model.md)

## Uso

Requiere Node 24. Copia `.env.example` a `.env`.

```bash
corepack pnpm install
```

```bash
corepack pnpm build
```

Base de desarrollo, sin Docker y desechable (se vacía al cerrarla): `corepack pnpm --filter @marketplace/api dev:db`
API (puerto 4311): `corepack pnpm --filter @marketplace/api start:dev`
Web (puerto 4310): `corepack pnpm --filter @marketplace/web dev` (lee `.env`).

`SHOW_SAMPLES=true` muestra productos ficticios (solo desarrollo).

Comprobaciones: `lint`, `check:core`, `typecheck`, `test`, `build`, `check:dist`.

## Cuentas

En desarrollo, sin `SMTP_URL`, los enlaces de los correos salen en la terminal de la API. Para dar un rol, con la cuenta ya verificada:

```bash
corepack pnpm --filter @marketplace/api set-role correo@ejemplo.com admin
```

Los roles `moderator` y `admin` exigen activar el segundo paso en `/cuenta`.

## Despliegue

Lo gestiona Codex. `deploy/` y `.forgejo/workflows/` son borradores: solo se validó la sintaxis de `compose.yaml`; las imágenes no se han construido ni desplegado. Pendiente de incorporar ahí desde F1:

- `packages/core` y `prisma generate` en la imagen de la API.
- Antes de migrar, crear el rol `marketplace_app` (sin propiedad ni DDL) y usarlo en `DATABASE_URL`. Las migraciones (`prisma migrate deploy`) usan el propietario en `MIGRATION_DATABASE_URL`.
- Variables nuevas de la API: `PUBLIC_URL` (https), `AUTH_SECRET` (aleatorio, ≥ 32), `SMTP_URL`, `MAIL_FROM`.
- `TRUST_PROXY_HOPS` exacto: de él dependen los límites por IP.

## Crear un nicho

1. Copia `packages/verticals/src/demo.ts` y ajústalo.
2. Regístralo en `packages/verticals/src/registry.ts`.
3. Despliega con `VERTICAL=<id>`.

Nada más debería cambiar; `check:core` impide términos de nicho en el núcleo.
