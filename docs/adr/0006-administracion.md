# ADR 0006: Supervisión con rastro

Estado: aceptado · 2026-11-26 · Desarrolla la spec aprobada

- **Cada capacidad, su permiso:** resumen y denuncias de productos para quien modera; reservas, denuncias de reservas, cuentas y auditoría solo para administración. El resumen devuelve solo lo que el rol puede atender.
- **Intervenir exige motivo y deja rastro:** cancelar una reserva, suspender o restituir una cuenta y resolver una denuncia. La cancelación usa el mismo motor que las tiendas, con el actor `PLATFORM`.
- **Consultar también deja rastro:** abrir una reserva o una cuenta ajena anota `reservation.viewed` o `user.viewed` a nombre de quien consulta.
- **Sin listado de personas:** las cuentas se buscan por correo exacto. Es más incómodo y expone menos datos.
- **Suspender:** cierra las sesiones en la misma transacción, impide crear otras (también tras el segundo paso) y el guard rechaza cualquier sesión de una cuenta suspendida. Ni uno mismo ni otro administrador se suspenden desde la web: el rol se retira con `set-role`.
- **Denuncias:** de productos publicados y de reservas propias; una abierta por objetivo y persona, cinco como máximo. Quien resuelve no actúa sobre el objetivo desde la denuncia: la denuncia enlaza a la herramienta que corresponde, y cada paso queda con su propio motivo.
- **Pruebas:** la API limita a 6 los archivos de prueba simultáneos, porque cada uno arranca su propio Postgres.
