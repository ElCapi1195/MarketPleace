# ADR 0003: Vitrina con productos reales y archivos propios

Estado: aceptado por el usuario · 2026-11-25 · Sustituye la portada del [ADR 0002](0002-direccion-visual-materializa.md)

- **Portada de marketplace:** buscador y categorías siempre a la vista, un destacado grande, rejillas y pasos de la reserva. El recorrido temporal no se entendía como tienda y se eliminó. Se conservan los colores y las fuentes.
- **Fotos protagonistas:** todas ocupan 4:3 con `object-cover`, así una foto de móvil y un render conviven. El ámbar se reserva para la acción principal.
- **Fotos recodificadas:** se decodifican y se guardan en WebP a 1600 y 640 px. Nunca se conservan los bytes recibidos ni sus metadatos.
- **Modelos 3D `.glb`:** se guardan sin modificar, tras validar estructura, jerarquía, límites y ausencia de recursos externos. Sin Draco ni KTX2: exigirían descodificadores y abrir más la CSP. Único cambio en la CSP: `blob:` en `connect-src`.
- **`three` solo a petición:** se descarga al pulsar «Ver en 3D».
- **El archivo viaja como cuerpo de la petición**, no como formulario: se autoriza antes de leerlo y el tipo no simple exige comprobación de origen.
- **`storeId` obligatorio desde el primer producto**, aunque hoy solo publique la administración. F2 añade verificación y miembros.
- **Muestras:** modelos genéricos originales generados por `tools/sample-models` (requiere Chrome). Se cargan con los mismos servicios y validaciones que el panel.
- **Costes asumidos:** la búsqueda usa `contains` sobre texto plegado, suficiente al inicio; con miles de productos tocará un índice de texto. Un corte justo entre guardar el archivo y su fila puede dejar un archivo huérfano.
