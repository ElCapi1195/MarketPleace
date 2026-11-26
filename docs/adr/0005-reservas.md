# ADR 0005: Motor de reservas

Estado: aceptado · 2026-11-25 · Desarrolla la spec aprobada

- **Reglas puras en `packages/core`:** transiciones por acción y actor, plazos y dinero, sin base de datos. La tabla completa estado × acción × actor está probada.
- **Un solo método cambia el estado** (`ReservationRepository`): bloquea la reserva, comprueba la versión, ajusta unidades con el producto bloqueado y anota el evento, todo o nada. La base refuerza los invariantes con restricciones.
- **Las unidades se comprometen al aprobar** y cambian la versión del producto: quien lo editaba debe recargarlo en lugar de pisar el descuento.
- **Idempotencia por cliente y clave**, con la persona bloqueada: un doble clic devuelve la misma reserva y el máximo de activas no se supera.
- **Vencimiento por barrido en Postgres, sin BullMQ:** el plazo está en la fila, así que un barrido perdido lo recupera el siguiente; `SKIP LOCKED` y la comprobación con la fila bloqueada lo hacen idempotente y apto para varias instancias. La spec proponía BullMQ; hoy solo añadiría Redis y un proceso más. Se reconsidera si aparecen trabajos pesados.
- **Con dinero anotado no vence sola:** lo decide la tienda.
- **`READY` no vence solo:** el plazo habilita a la tienda a marcar que no se presentó.
- **Pagos de solo inserción.** Se corrigen con un reverso único; nada supera lo acordado ni lo recibido. Se rechazan textos con números de tarjeta (Luhn).
- **«Devolución pendiente» se calcula** de los movimientos: no hay una marca que pueda quedar desfasada.
- **Contacto tras aprobar:** la tienda ve correo y teléfono, y el cliente ve cómo contactar y recoger. Sin ese texto, la tienda no puede aprobar.
- **Decisiones no fijadas por la spec:** una unidad por reserva; una reserva activa por producto y cliente; el cliente cancela hasta `CONFIRMED` y después lo hace la tienda; el depósito se define por producto (fijo o ninguno), sin porcentaje.
- **Provisional:** el texto de las condiciones del nicho necesita revisión legal. Cambiarlo exige cambiar su versión.
- **Aviso conocido:** `pg` 8 advierte de consultas simultáneas en una transacción al cargar relaciones con Prisma. Es inofensivo hoy y deberá revisarse antes de pasar a `pg` 9.
