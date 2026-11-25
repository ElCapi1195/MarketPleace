# ADR 0001: Arquitectura base

Estado: aceptado · 2026-11-24

| Decisión | Motivo | Coste |
|---|---|---|
| Núcleo + configuración por nicho; un despliegue por marketplace | Aísla los datos de cada negocio | Más despliegues |
| Monolito modular (NestJS) | Transacciones simples para aprobar reservas | Escala por réplica completa |
| Web y API en el mismo origen, sin CORS | Cookies `__Host-` y menos superficie CSRF | El proxy debe enrutar `/api` |
| `@Inject(token)` explícito siempre | No depender de `emitDecoratorMetadata`, que Vitest y los compiladores rápidos tratan distinto | Algo más de código |
| Prisma 7.10.1 fijado, desde F1 | `latest` es 8.0.0-rc y better-auth admite hasta 7 | Migración futura a 8 |
| TypeScript 6.0.3 | typescript-eslint y la integración Nest de better-auth no admiten 7 | Migración futura a 7 |
| Nonce CSP por petición | Permite prohibir scripts y estilos inline | Todas las páginas son dinámicas |
| `/api/health` no consulta dependencias | Si cae la base, reiniciar la API no ayuda | `ready` es la señal completa |
