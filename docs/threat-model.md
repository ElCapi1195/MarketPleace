# Modelo de amenazas

Objetivo: OWASP ASVS nivel 2. Se revisa al cerrar cada fase.

**Activos:** cuentas, documentos de tiendas, reservas y sus decisiones, registros manuales de pago, auditoría.
**Actores:** visitante, cliente, personal de tienda, moderador, admin, atacante externo, tienda maliciosa, empleado desleal.
**Límites de confianza:** Internet → proxy → web/API → Postgres/Redis/archivos. CT 110 aloja otros proyectos.

| Amenaza | Control | Fase | Estado |
|---|---|---|---|
| Configuración insegura o incompleta | Entorno y nicho validados al arrancar | F0 | Hecho |
| Fuga de detalles en errores | Filtro global y formato uniforme | F0 | Hecho |
| XSS y clickjacking | CSP con nonce, `frame-ancestors 'none'` | F0 | Hecho |
| Falsear la trazabilidad | `x-request-id` solo del servidor | F0 | Hecho |
| Base de datos expuesta | Red interna sin puertos | F0 | Escrito, sin desplegar |
| Falsear la IP del cliente | `TRUST_PROXY_HOPS` exacto por entorno | F0/F6 | Verificar al desplegar |
| Secretos en logs | Logger de better-auth desactivado (escribía correos); la auditoría descarta claves sensibles | F1 | Hecho; el stack de errores inesperados se registra completo |
| Fuerza bruta y robo de cuenta | Límite por IP y por cuenta, Argon2id, 2FA TOTP, sesiones revocables | F1 | Hecho |
| Enumeración de cuentas | Respuestas iguales, correo sin esperar al envío | F1 | Hecho |
| CSRF | SameSite=Lax, `Origin` verificado en toda la API, solo JSON | F1 | Hecho |
| Redirección abierta | Destinos internos en web y API | F1 | Hecho |
| Acceso a función olvidada | Guard global que deniega por defecto | F1 | Hecho |
| Borrar huellas | Rol de BD sin privilegios y triggers de solo inserción | F1 | Hecho |
| Acceso entre tiendas | `storeId` obligatorio + matriz de pruebas | F2–F4 | `storeId` listo; hoy solo publica la administración |
| Fotos maliciosas | Firma real, 40 Mpx, recodificar sin EXIF, tipo fijado por el servidor, `nosniff` | F3 | Hecho |
| Modelos 3D maliciosos | Estructura, ciclos, límites y texturas validados; sin recursos externos; sin extensiones desconocidas | F3 | Hecho |
| Agotar memoria subiendo | Autorizar antes de leer, tope de 10 y 15 MB | F3 | Hecho |
| Ver borradores por su id | Los archivos comprueban el estado del producto y la tienda en cada petición | F3 | Hecho |
| Documentos de tiendas | Volumen privado, descarga forzada, auditados | F2 | Pendiente |
| Sobreventa por concurrencia | Bloqueo de fila y versión al aprobar | F4 | Pendiente |
| Depósito inventado o alterado | Registro solo-inserción con autor y reverso | F4 | Pendiente |
| Abuso de administrador | Motivo obligatorio y auditoría | F5 | Pendiente |

## Riesgos aceptados y por revisar

- **Bloqueo por cuenta:** quien conozca un correo puede bloquear su acceso 15 minutos. Restablecer la contraseña lo levanta.
- **Token de sesión en claro en la base:** la cookie va además firmada, así que el valor de la base no basta sin `AUTH_SECRET`.
- **Contraseñas filtradas:** lista local corta. Consultar un servicio externo es una decisión de privacidad pendiente (F6).
- **Correos de desarrollo:** la terminal muestra enlaces de acceso. La API no arranca en producción sin SMTP.
- **Catálogo público sin límite por IP:** las lecturas son baratas y paginadas, pero falta un límite propio o del proxy (F6).
- **Fotos archivadas:** un navegador puede conservar hasta un día la copia que ya descargó.
- **Archivos huérfanos:** un corte durante la subida puede dejar un archivo sin fila; no es accesible. Limpieza en F6.
- **Cuentas sin verificar:** no caducan todavía (F6).
