# Vitrina y subida de productos

Estado: aprobado por el propietario (2026-11-25). Sustituye la portada de [ADR 0002](../../adr/0002-direccion-visual-materializa.md) y adelanta parte de F3.

## Por qué

El recorrido temporal de la portada no se entiende como marketplace y los productos son dibujos. Se quiere un diseño atractivo, intuitivo y con equipos reales que se puedan subir.

## Decidido por el propietario

- Cada producto admite fotos y, opcionalmente, un modelo 3D.
- Ahora sube el administrador; las tiendas usarán el mismo panel tras la verificación (F2).
- Portada tipo vitrina: buscador y categorías a la vista, un destacado grande con dos secundarios, categorías con imagen y rejilla de productos. Sin recorrido.

## Enfoques

1. **Catálogo real en la API + almacenamiento propio (elegido).** Es la base definitiva de F3; cuesta más que una maqueta.
2. Solo pantallas con datos de ejemplo. Rápido, pero no permite subir.
3. Gestor de contenidos externo. Rápido, pero duplica usuarios, permisos y auditoría.

## Qué se construye

**Público:** portada; `/catalogo` con búsqueda, categoría, tipo (en existencia, preventa, servicio), orden y paginación; `/producto/[slug]` con galería, zoom, botón «Ver en 3D», precio, tienda, disponibilidad y los pasos de la reserva. `/lista` y `/preventas/[id]` desaparecen.

**Administración:** `/admin/productos` (lista, crear, editar, publicar, archivar) y, en la ficha, zona para arrastrar fotos, ordenarlas, describirlas, eliminarlas y subir el 3D con vista previa.

**API:** módulos `stores` (mínimo: nombre y estado; F2 lo amplía), `catalog` y `media`. `storeId` es obligatorio desde el primer producto. Permiso nuevo `catalog.manage`, solo admin, con 2FA. Cada cambio queda en la auditoría.

**Visual:** se conservan la marca y las letras de Materializa. Fondo claro, tarjetas con la foto como protagonista, destacado en índigo y ámbar solo para la acción principal. Móvil primero.

## Seguridad de las subidas

- Autenticación y permiso antes de leer el cuerpo; lectura en flujo con tope de tamaño.
- **Fotos** (JPEG, PNG, WebP; 10 MB, 40 Mpx): se valida el contenido real y se recodifican a WebP en dos tamaños, sin EXIF. El original no se guarda.
- **3D** (`.glb`; 15 MB): cabecera y longitudes verificadas, sin recursos externos, extensiones en lista blanca, topes de vértices y texturas.
- Nombres aleatorios fuera del árbol web, tras `StoragePort`; se sirven con tipo fijo y `nosniff`.
- La CSP solo se abre a `blob:` en `connect-src`, para las texturas del visor.

## Datos de ejemplo y desarrollo

- Los equipos de ejemplo serán **modelos 3D genéricos originales**, hechos para el proyecto, y sus imágenes. Sin marcas ni diseños de fabricantes.
- La base de datos de desarrollo pasa a ser persistente, para no perder lo subido al apagar.

## Queda fuera

Reservar (F4), verificación de tiendas (F2), moderación y edición por tiendas, reseñas, compresión Draco/KTX2, vídeo.

## Sería un fracaso si

Un visitante no encuentra un producto en un vistazo; alguien sin permiso sube o ve borradores; un archivo malicioso se guarda o se sirve; el 3D frena la página a quien no lo pide; o el núcleo se llena de términos del nicho.

## Decisiones mías, corregibles

`sharp` para imágenes y `three` para 3D, cargado solo al pulsar «Ver en 3D». Borradores privados. Archivar en lugar de borrar productos. 12 productos por página. Publicar exige al menos una foto.
