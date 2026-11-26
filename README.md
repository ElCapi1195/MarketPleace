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

Base de desarrollo, sin Docker y persistente en `storage/dev-db`: `corepack pnpm --filter @marketplace/api dev:db`
API (puerto 4311): `corepack pnpm --filter @marketplace/api start:dev`
Web (puerto 4310): `corepack pnpm --filter @marketplace/web dev` (lee `.env`).

Productos de ejemplo, con `SHOW_SAMPLES=true` y la API compilada (solo desarrollo, se puede repetir): `corepack pnpm --filter @marketplace/api seed:samples`

Comprobaciones: `lint`, `check:core`, `typecheck`, `test`, `build`, `check:dist`.

## Cuentas

En desarrollo, sin `SMTP_URL`, los enlaces de los correos salen en la terminal de la API. Para dar un rol, con la cuenta ya verificada:

```bash
corepack pnpm --filter @marketplace/api set-role correo@ejemplo.com admin
```

Los roles `moderator` y `admin` exigen activar el segundo paso en `/cuenta`.

## Productos

Con rol `admin` y el segundo paso activo, `/admin/productos` permite crear productos, subir fotos (JPEG, PNG, WebP) y un modelo 3D (`.glb`, sin compresión), ordenarlos y publicarlos. En Blender: exportar como glTF Binary, sin Draco.

Los equipos de ejemplo son modelos originales. Para regenerarlos (necesita Chrome): `node tools/sample-models/generate.mjs`

## Tiendas

`/vender` explica el alta y `/tienda` reúne las tiendas propias. Quien solicita completa sus datos y documentos (los exige el nicho) y envía; un `moderator` o `admin` decide en `/admin/tiendas`, y los productos de las tiendas se aprueban en `/admin/moderacion`. Solo `admin` suspende. Todo el personal necesita el segundo paso.

Decisiones: [ADR 0004](docs/adr/0004-tiendas-y-alcance.md).

## Reservas

El cliente solicita desde la ficha y sigue su reserva en `/reservas`. La tienda las gestiona en `/tienda/<id>/reservas`: aprobar, proponer cambios, rechazar, avanzar y anotar dinero recibido o devuelto fuera de la web. Antes de aprobar debe escribir cómo contactarla y recoger. La API cierra cada minuto lo vencido, sin procesos aparte.

Plazos, máximo de activas y condiciones están en el nicho (`reservations`). Decisiones: [ADR 0005](docs/adr/0005-reservas.md).

## Administración

`/admin` resume lo pendiente según el rol. Desde ahí: tiendas, moderación, reservas (cancelar con motivo), denuncias, cuentas (buscar por correo exacto, suspender) y auditoría. Toda intervención exige motivo y toda consulta de datos personales queda registrada. Decisiones: [ADR 0006](docs/adr/0006-administracion.md).

## Despliegue en Dokploy

En Dokploy crea un servicio Compose enlazado al repositorio, rama `main` y archivo `deploy/compose.yaml`. Dokploy construye las imágenes en el CT110. Define los secretos en las variables del servicio, nunca en el repositorio:

- `VERTICAL=gamer`
- `PUBLIC_URL=https://<dominio>` y `TRUST_PROXY_HOPS=1`
- `AUTH_SECRET`: valor aleatorio de al menos 32 caracteres
- `POSTGRES_PASSWORD`, `APP_PASSWORD` y `REDIS_PASSWORD`: contraseñas aleatorias URL-safe
- `SMTP_URL` y `MAIL_FROM`: correo saliente válido

`db-init` crea o actualiza el rol restringido `marketplace_app`; `migrate` aplica las migraciones con el propietario de la base; la API inicia después de ambas tareas y usa `marketplace_app`. Los volúmenes de Postgres, Redis, fotos y documentos son persistentes. Fotos y documentos quedan en volúmenes privados separados; respalda las fotos junto con la base de datos.

En **Domains**, dirige el dominio HTTPS a `web:3000` y `/api` a `api:3001`. El proxy debe permitir cuerpos de hasta 15 MB para `/api`. `TRUST_PROXY_HOPS` debe coincidir con los saltos reales del proxy para que los límites por IP sean correctos.

## Crear un nicho

1. Copia `packages/verticals/src/demo.ts` y ajústalo.
2. Regístralo en `packages/verticals/src/registry.ts`.
3. Despliega con `VERTICAL=<id>`.

Nada más debería cambiar; `check:core` impide términos de nicho en el núcleo.
