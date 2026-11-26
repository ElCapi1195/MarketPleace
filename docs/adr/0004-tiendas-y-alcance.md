# ADR 0004: Tiendas, alcance y moderación

Estado: aceptado · 2026-11-25 · Desarrolla la spec aprobada

- **Los ciclos viven en `packages/core`:** tablas de transición de tienda y producto, permisos por miembro y reglas de motivo. Ningún otro código decide a qué estado se pasa.
- **Alcance obligatorio:** servicios y repositorios de productos y archivos reciben `Scope` (plataforma o una tienda). No hay valor por defecto que olvidar, y el filtro se aplica en la consulta.
- **Una tienda ajena no existe:** 404, nunca 403. La membresía se consulta en cada petición, así que quitar a alguien surte efecto al momento.
- **Ser administrador no abre el panel de una tienda.** Supervisa desde sus propias rutas, y nadie decide sobre una tienda de la que es miembro.
- **Historial inmutable:** `store_event` es de solo inserción por la base de datos, como la auditoría.
- **Documentos aparte:** otro volumen (`DOCUMENTS_DIR`), imágenes recodificadas y PDF comprobados, siempre como descarga y con cada consulta de revisión anotada. Un PDF no se puede recodificar sin añadir un motor pesado; se descarta el contenido activo a la vista y nunca se muestra dentro del sitio.
- **Moderación por versión:** se aprueba exactamente lo que se vio. Si la tienda cambia datos o fotos mientras se revisa, la decisión da conflicto.
- **`remoderateOn` del nicho** decide qué cambios devuelven un producto publicado a revisión; mientras tanto no se ve. `PAUSED` se omitió: archivar cubre el caso.
- **Invitaciones:** un solo uso, 7 días, ligadas al correo, con el token guardado como hash. Solo las envía una tienda verificada, para que nadie use la web como emisor de correo.
- **Provisional:** país y documentos exigidos. Están en el nicho y se cambian sin tocar el núcleo.
