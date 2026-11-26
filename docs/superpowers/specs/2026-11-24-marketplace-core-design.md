<!-- Estado: aprobado por el usuario el 2026-11-24 -->

> **Cambio del usuario (2026-11-24):** Claude se ocupa solo de desarrollo y diseño; el despliegue (Dokploy, imágenes, CI remoto, backups) lo hace el usuario con Codex. Todo lo de despliegue de este documento queda como referencia para ese trabajo.
# Marketplace B2C gamer sobre un núcleo reutilizable

## Contexto

Se necesita un marketplace gamer (consolas, accesorios, servicios) **seguro** y con una **estructura B2C reutilizable** en otros nichos. No procesa pagos: publica anuncios y gestiona reservas, sobre todo **preventas** de artículos sin existencia. Como una preventa puede obligar a la tienda a comprar a su proveedor, alguien autorizado la revisa y aprueba.

`D:\Market Place` está vacío: proyecto nuevo, no hay código que reutilizar.

### Decidido por el usuario
| Tema | Decisión |
|---|---|
| Vendedores | Solo tiendas verificadas |
| Reservas | Un solo flujo con aprobación: preventa, en existencia y servicio |
| Aprobación | Personal autorizado de la tienda; el admin de plataforma supervisa e interviene |
| Dinero | Depósitos y pagos fuera de la web; registro manual opcional |
| Stack | Next.js + NestJS, Tailwind |
| Reutilización | Núcleo + configuración por nicho, un despliegue aislado por marketplace |
| Docker | Dokploy del CT 110 (`appweb`, 192.168.0.110). No se usa Docker Desktop local |

### Propuesto por mí (corregible)
- UI en español preparada para i18n, móvil primero; moneda y país salen de la configuración.
- Navegar es libre; reservar exige cuenta con email verificado.
- Servicios sin agenda: solicitud + aprobación. Notificaciones por email.
- La solicitud **no** bloquea unidades; se comprometen **al aprobar**. Evita que cuentas falsas vacíen el stock.
- Si la tienda aprueba con otro precio o fecha, el cliente debe aceptarlo.

### Fuera de v1
Pasarela de pago, custodia de dinero, particulares vendiendo, chat interno, agenda de citas, alquiler por fechas, reseñas, app móvil, multi-tenant.

**Sería un fracaso si** una tienda ve datos de otra, si una preventa se confirma sin decisión registrada, o si crear otro nicho obliga a tocar el núcleo.

## Enfoques considerados
1. **Núcleo + config por nicho (elegido):** datos aislados, simple de operar; cuesta un despliegue por marketplace.
2. **Multi-tenant:** menos despliegues, pero un fallo de aislamiento expone a todos.
3. **Paquetes versionados:** máxima flexibilidad, demasiado mantenimiento para empezar.

## Arquitectura

Monolito modular en monorepo (pnpm workspaces + Turborepo).

```
apps/
  web/        Next.js 16 · React 19 · Tailwind 4 (solo presentación)
  api/        NestJS 12 (HTTP) + entrada worker (BullMQ), misma imagen
packages/
  contracts/  Esquemas Zod y tipos compartidos web/api
  core/       Dominio puro: estados, permisos, dinero (sin framework ni BD)
  verticals/  Esquema del nicho + gamer/ + demo/ (prueba de reutilización)
  ui/         Componentes Tailwind
  config/     tsconfig, eslint
docs/         specs, ADR, runbooks, amenazas
deploy/       Dockerfiles y compose de Dokploy
```

**Capas en cada módulo de `apps/api/src/modules/*`:** `controller` (HTTP y validación) → `service` (caso de uso y autorización) → `core` (reglas) → `repository` (único lugar con CRUD/Prisma). En web: `app/` (rutas) → `features/` → `lib/api` (cliente tipado). ESLint impone `max-lines: 500` y las fronteras entre capas.

**Módulos:** identity, stores, verification, catalog, listings, media, reservations, payment-records, moderation, notifications, audit, admin.

**Configuración de nicho** (`packages/verticals/gamer`): marca y tokens visuales, categorías y atributos (plataforma, estado, región, almacenamiento), tipos de reserva activos, plazos, límites, documentos exigidos a tiendas, moneda, textos legales. Se valida con Zod al arrancar; si es inválida, la app no inicia. El núcleo no contiene términos gamer.

**Versiones** (consultadas hoy en npm): Next 16.4, Nest 12.6, Tailwind 4.3, Zod 4.6, better-auth 1.7 + `@thallesp/nestjs-better-auth` 2.8, BullMQ 6, Vitest 5, Playwright 1.65, PostgreSQL 17, Redis 8.
- **Prisma 7.10.1 fijado:** `latest` apunta a 8.0.0-rc y better-auth solo admite hasta 7.
- **TypeScript 6.x:** la integración Nest de better-auth no admite 7.

## Reservas

```
PENDING_REVIEW ─► REJECTED
   ├─ aprueba con cambios ─► AWAITING_CUSTOMER ─ acepta ─┐
   └─ aprueba ──────────────────────────────────────────►┤
                         sin depósito ─► CONFIRMED       │
                         con depósito ─► AWAITING_DEPOSIT ┘
AWAITING_DEPOSIT ─ depósito registrado ─► CONFIRMED
CONFIRMED ─► IN_PROGRESS (compra a proveedor / servicio) ─► READY ─► COMPLETED
                                                                └─► NO_SHOW
Antes de COMPLETED: CANCELLED (actor + motivo).  Con plazo vencido: EXPIRED.
```

- Transiciones definidas en `packages/core` (actor, permiso y precondiciones); ningún otro código cambia el estado.
- Tienda: aprueba con permiso `reservation.approve`; nadie aprueba su propia reserva. El admin interviene con motivo obligatorio.
- Al solicitar se congelan precio, fecha estimada, política de depósito y términos aceptados.
- Aprobar: transacción + bloqueo de fila del cupo/stock + versión optimista. Sin unidades → 409.
- Crear exige clave de idempotencia; máximo de reservas activas por usuario según el nicho.
- Vencimientos por worker, idempotentes, más barrido periódico por si se pierde un trabajo. (Se resolvió solo con el barrido: ADR 0005.)
- **Registro manual de pagos:** `payment_records` solo-inserción (depósito, saldo, devolución; unidades menores + ISO 4217; método, referencia, quién). Se corrige con reverso, nunca editando. Sin datos de tarjeta. Política por tienda: ninguno, fijo o porcentaje.
- Cancelar con depósito registrado marca "devolución pendiente" hasta anotar el reembolso.

**Otros ciclos:**
- Tienda: `DRAFT → SUBMITTED → IN_REVIEW → NEEDS_INFO | APPROVED | REJECTED`, y `SUSPENDED` (oculta anuncios, bloquea solicitudes nuevas).
- Anuncio: `DRAFT → PENDING_MODERATION → PUBLISHED → PAUSED | REJECTED | ARCHIVED`; cambiar título, categoría, precio o fotos puede volver a moderación según el nicho.

## Seguridad (objetivo: OWASP ASVS nivel 2)

| Riesgo | Control |
|---|---|
| Robo de cuenta | Argon2id, email verificado, límites por IP y cuenta, respuestas sin enumeración, sesiones revocables; **2FA TOTP obligatorio** para admin y personal de tienda; reautenticación en acciones sensibles |
| Sesión/CSRF | Mismo origen (`/api` por Traefik), cookie `__Host-` HttpOnly Secure SameSite=Lax, verificación de Origin, sin CORS |
| Acceso entre tiendas (IDOR) | Denegar por defecto; rol de plataforma + permisos por miembro; repositorios que exigen `storeId`; matriz de pruebas actor × recurso × acción |
| Inyección/XSS | Zod en todo límite, Prisma parametrizado, texto sin HTML, CSP con nonce |
| Archivos | Magic bytes, tamaño, recodificar imágenes y quitar EXIF, nombres aleatorios; documentos en volumen privado, autorizados y auditados, siempre como descarga |
| Fraude | Verificación de tiendas, moderación, límites, denuncias, suspensión, reservas rechazadas/no-show visibles para la tienda solo como conteo |
| Repudio | Auditoría solo-inserción; rol de BD de la app sin UPDATE/DELETE sobre auditoría y pagos; migraciones con rol distinto |
| Secretos | Solo en Dokploy; esquema de entorno validado; logs con redacción; gitleaks en CI |
| Dependencias | Lockfile, auditoría y escaneo de imagen en CI; contenedores no-root, FS de solo lectura |
| Privacidad | Datos mínimos, retención de documentos, exportación y borrado/anonimización de cuenta |

Errores con formato uniforme (código + requestId) sin filtrar detalles internos. El almacenamiento va tras `StoragePort` (volumen hoy, S3 después).

## Despliegue en CT 110 (verificado en solo lectura)

Dokploy 0.31.4, Docker 28.5, Traefik 3.6; 4 núcleos, ~5 GB RAM y 44 GB de disco disponibles. **Comparte host con producción de otros proyectos.**

- Proyecto propio en Dokploy. `web` y `api` en `dokploy-network`; `postgres`, `redis` y `worker` solo en red interna, sin puertos publicados.
- Límites de memoria: web 512, api 512, worker 384, postgres 768, redis 128 MB (≈2,3 GB).
- Entornos `dev` y `prod` separados con bases distintas. Node corre en este PC contra Postgres/Redis de `dev` por túnel SSH.
- Imágenes construidas en CI y descargadas por Dokploy, para no compilar Next junto a producción. Preferencia: Forgejo (CT 120), si tiene runner; su disponibilidad no está comprobada. Si no hay, se decide contigo antes de compilar en el 110.
- Backup diario de Postgres y volumen fuera del CT, con restauración probada. Healthchecks y rollback por etiqueta.
- Cada creación o cambio en Dokploy/Proxmox se confirma antes. No se tocan otros proyectos, CT ni Traefik global.

## Fases

Cada fase: plan detallado con `writing-plans` → TDD → revisión de código → demo y tu visto bueno.

- **F0 Base:** `git init`, spec en `docs/superpowers/specs/2026-11-24-marketplace-core-design.md`, ADR, modelo de amenazas, monorepo, lint/pruebas/CI, entorno `dev` en Dokploy.
- **F1 Identidad:** registro, sesión, 2FA, roles/permisos, auditoría, límites, errores.
- **F2 Tiendas:** solicitud, documentos, verificación, miembros, suspensión.
- **F3 Catálogo:** nicho gamer, anuncios, imágenes, moderación, búsqueda (full-text de Postgres). Antes de la UI: 2–3 direcciones visuales para elegir (`frontend-design` / `ui-ux-pro-max`).
- **F4 Reservas:** motor de estados, aprobación, depósito manual, vencimientos, emails.
- **F5 Administración:** supervisión, intervención, denuncias, consulta de auditoría.
- **F6 Producción:** revisión ASVS, carga, backup/restauración, despliegue, guía "crear un nicho nuevo".

**Al aprobar se ejecuta F0 y me detengo para tu revisión.**

## Verificación

- **Unitarias (core):** toda transición válida e inválida; dinero; permisos.
- **Integración (BD `test` en CT 110):** 20 aprobaciones simultáneas sobre 1 unidad → exactamente 1 éxito; idempotencia; vencimiento repetido; auditoría y pagos rechazan UPDATE/DELETE con el rol de la app.
- **Autorización:** la matriz completa, incluida tienda A contra datos de tienda B y cliente contra reserva ajena.
- **E2E (Playwright):** tienda se registra → admin verifica → publica → cliente preordena → tienda aprueba con depósito → registra depósito → completada; más rechazo, cambio de precio, vencimiento y cancelación con devolución.
- **Reutilización:** el nicho `demo` arranca y pasa la suite sin cambios en `apps/` ni `packages/core`; CI falla si hay términos gamer en el núcleo.
- **F0 en concreto:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` en verde, `/api/health` responde, la web carga y la API llega a Postgres/Redis de `dev`.

## Pendiente del usuario (no bloquea empezar F0)

| Dato | Para |
|---|---|
| Acceso a Dokploy: crear tú un token de API, o iniciar sesión tú en el navegador | Infra de F0 |
| Acceso SSH por clave al CT 110 (o confirmar uno existente) para el túnel | Infra de F0 |
| SMTP | F1 |
| País y documentos exigidos a tiendas | F2 |
| Nombre, dominio, moneda | F3 / F6 |

