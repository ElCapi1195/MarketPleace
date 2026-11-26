# F5 Administración Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Ejecución nativa, sin subagentes.

**Goal:** La plataforma supervisa e interviene con motivo y rastro: reservas, denuncias, cuentas y auditoría, con un resumen de lo pendiente.

**Architecture:** Cada capacidad es un servicio con su permiso de plataforma; toda intervención exige motivo, y toda consulta de datos personales queda en la auditoría. Las reservas reutilizan el único método que cambia estados, con el actor `PLATFORM`.

**Spec:** [marketplace-core-design](../specs/2026-11-24-marketplace-core-design.md): F5 y la fila «Abuso de administrador».

## Global Constraints

- Intervenir o suspender exige motivo; leer una reserva o una cuenta ajena se audita.
- Denuncias: de productos publicados y de reservas propias; máximo 5 abiertas por persona, sin duplicados; las de reservas solo las ve quien puede intervenir.
- Suspender: quien suspende no puede suspenderse ni suspender a un administrador; se cierran sus sesiones y no puede volver a entrar.
- Buscar cuentas por correo exacto; no hay listado de todas las personas (datos mínimos).
- Nadie resuelve denuncias sobre su propia tienda.

## Review Focus

- Moderador que pide una denuncia de reserva, la ficha de una reserva o una cuenta: 403 (T1–T3).
- Cuenta suspendida con la sesión abierta o con 2FA a medias: fuera en la siguiente petición (T3).
- Denunciar una reserva ajena o un borrador: 404, sin revelar que existe (T2).
- Cancelar desde la plataforma una reserva que la tienda acaba de cambiar: conflicto (T1).

### Task 1 (hecho): Reservas — `GET /api/admin/reservations`, `GET …/:id` (auditado), `POST …/:id/cancel`.
### Task 2 (hecho): Denuncias — `POST /api/reports`, `GET /api/reports/mine`, `GET /api/admin/reports`, `GET …/:id`, `POST …/:id/resolve`.
### Task 3 (hecho): Cuentas y auditoría — `GET /api/admin/users?email=`, `GET …/:id`, `POST …/:id/{suspend,reinstate}`; filtros en `GET /api/admin/audit`; `GET /api/admin/overview`.
### Task 4 (hecho): Pantallas — `/admin`, `/admin/{reservas,denuncias,usuarios,auditoria}`, denunciar desde ficha y reserva, mis denuncias.
### Task 5 (hecho): Cierre — suite, CSP de producción de todas las pantallas nuevas desde F2, ADR 0006, amenazas, README.
