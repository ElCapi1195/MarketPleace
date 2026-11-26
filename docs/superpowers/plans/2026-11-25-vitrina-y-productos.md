# Vitrina y productos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Ejecución nativa, sin subagentes.

**Goal:** Portada, catálogo y ficha de marketplace con productos reales, y un panel donde el administrador los crea y sube fotos y modelos 3D.

**Architecture:** `packages/contracts` fija entradas (Zod) y respuestas. La API suma `stores`, `catalog` y `media`, con el almacenamiento tras `StoragePort`. La web lee el catálogo en el servidor y administra desde el cliente con la misma sesión; `features/catalog` sustituye a `features/arrivals`.

**Tech Stack:** sharp 0.35.5, three 0.187.0, lo ya instalado.

**Spec:** [vitrina-y-productos](../specs/2026-11-25-vitrina-y-productos-design.md)

## Global Constraints

- Archivos < 500 líneas; Prisma solo en `*.repository.ts`; controladores sin repositorios; núcleo sin términos de nicho.
- Sin `style=`; CSP intacta salvo `blob:` en `connect-src`.
- Fotos JPEG, PNG o WebP: 10 MB, 40 Mpx, recodificadas a WebP (1600 y 640 px), sin EXIF. `.glb`: 15 MB.
- `catalog.manage`: solo admin con 2FA. `storeId` obligatorio. Cambios auditados.
- 12 por página; publicar exige una foto; se archiva, no se borra.
- Sin Docker local, Proxmox ni Dokploy.

## Review Focus

- Un archivo `.jpg` que en realidad es SVG, HTML o un binario: 415 y no se guarda nada (T2).
- Pedir la foto de un borrador o archivado conociendo su id: 404 sin sesión de admin (T4).
- Dos subidas simultáneas sobre el último hueco de fotos: entra una (T4).
- `.glb` con jerarquía cíclica o `uri` externo: rechazado (T2).
- Búsqueda con `%`, `_`, tildes o página inexistente: no falla ni devuelve todo (T3).
- Precio `1.299,90` o `0,1`: se guarda exacto en unidades menores o se rechaza (T6).

### Task 1: Contratos, permiso y tablas

**Files:** `packages/contracts/*`, `packages/core/src/{permissions,text}.ts`, `apps/api/prisma/{schema.prisma,migrations/20261125100000_catalog}`, `test/support/dev-db.ts`
**Produces:** `productInput`, `catalogQuery`, `storeInput`, `mediaPatch`; tipos `ProductCard`, `ProductDetail`, `AdminProduct`, `CatalogPage`, `CatalogHome`, `MediaView`; `fold(text)`; permiso `catalog.manage`.

- [x] Pruebas: permisos; depósito > precio, preventa sin fecha y campos extra rechazados; `fold`; restricciones de la BD.

### Task 2: Archivos

**Files:** `apps/api/src/modules/media/{glb,image,storage,read-body}.ts`
**Produces:** `inspectGlb(buffer): GlbInfo`, `processImage(buffer): Promise<{ lg, sm, width, height }>`, `StoragePort { put, open, remove }`, `diskStorage(dir)`, `readBody(req, limit)`.

- [x] Pruebas: tipos reales, EXIF eliminado, bomba de píxeles, GLB truncado, `uri`, extensión desconocida, ciclo, textura enorme; claves que intentan salir del directorio.

### Task 3: Tiendas y catálogo

**Files:** `apps/api/src/modules/stores/*`, `apps/api/src/modules/catalog/*`
**Produces:** `GET /api/catalog/{home,products,products/:slug}`; `GET|POST /api/admin/stores`; `GET|POST /api/admin/products`, `GET|PATCH /api/admin/products/:id`, `POST …/:id/{publish,archive}`.

- [x] Pruebas HTTP: anónimo, cliente, moderador y admin sin 2FA denegados en todo `/admin`; borrador invisible; atributos validados por nicho; versión antigua → 409; búsqueda, filtros, orden, página.

### Task 4: Medios por HTTP

**Files:** `apps/api/src/modules/media/{media.controller,media.service,media.repository}.ts`
**Produces:** `POST /api/admin/products/:id/media`, `PATCH|DELETE /api/admin/media/:id`, `GET /api/media/:id/:variant`, `GET /api/admin/media/:id/:variant`.

- [x] Pruebas: Review Focus, 413, límite de fotos, un solo 3D, orden, borrado de archivos, cabeceras.

### Task 5: Equipos de ejemplo

**Files:** `tools/sample-models/*`, `packages/verticals/assets/*`, `packages/verticals/src/samples/*`, `apps/api/src/scripts/seed-samples.ts`

- [x] Modelos genéricos originales en `.glb` (pasan `inspectGlb`) e imágenes 1600×1200; la semilla es repetible y se niega en producción.

### Task 6: Web pública

**Files:** `apps/web/features/catalog/*`, `apps/web/app/{page,catalogo,producto/[slug]}`, `features/shell/*`, `lib/{server-api,security/csp}.ts`; borrar `features/arrivals`, `app/lista`, `app/preventas`.

- [x] Pruebas: dinero, disponibilidad, pasos, parámetros de URL, CSP; recorrido en navegador, 375 y 1280 px.

### Task 7: Panel

**Files:** `apps/web/features/admin/*`, `apps/web/app/admin/productos/*`

- [x] Pruebas: formulario a entrada, mensajes; recorrido real: cuenta admin con 2FA, crear, subir foto y 3D, publicar, verlo en la portada.

### Task 8: Cierre

- [x] Suite completa, ADR 0003, amenazas, README, revisión propia.
