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
| Acceso entre tiendas | `Scope` obligatorio, 404 a lo ajeno y matriz de pruebas | F2–F4 | Hecho en tiendas, productos, archivos, documentos y equipo; reservas en F4 |
| Fotos maliciosas | Firma real, 40 Mpx, recodificar sin EXIF, tipo fijado por el servidor, `nosniff` | F3 | Hecho |
| Modelos 3D maliciosos | Estructura, ciclos, límites y texturas validados; sin recursos externos; sin extensiones desconocidas | F3 | Hecho |
| Agotar memoria subiendo | Autorizar antes de leer, tope de 10 y 15 MB | F3 | Hecho |
| Ver borradores por su id | Los archivos comprueban el estado del producto y la tienda en cada petición | F3 | Hecho |
| Documentos de tiendas | Volumen propio, recodificados o comprobados, descarga forzada, consultas auditadas | F2 | Hecho |
| Tienda falsa | Verificación con documentos, motivo e historial inmutable | F2 | Hecho |
| Revisor juez y parte | Nadie decide sobre su tienda ni sus productos | F2 | Hecho |
| Cambiazo tras aprobar | Vuelta a moderación y decisión ligada a la versión vista | F2 | Hecho |
| Invitación robada o reutilizada | Ligada al correo, un uso, 7 días, hash | F2 | Hecho |
| Tienda sin dueño | Último propietario protegido con bloqueo de fila | F2 | Hecho |
| Usar la web para enviar spam | Solo tiendas verificadas invitan; máximo 20 pendientes | F2 | Hecho |
| Sobreventa por concurrencia | Bloqueo de reserva y producto, versión y restricciones | F4 | Hecho (20 aprobaciones simultáneas, 1 éxito) |
| Vaciar el stock con solicitudes falsas | Solicitar no compromete unidades; máximo de activas; una por producto | F4 | Hecho |
| Reserva duplicada o reintentada | Clave de idempotencia por cliente | F4 | Hecho |
| Cambiar precio o condiciones a última hora | Lo visto viaja con la solicitud y queda congelado; términos con versión | F4 | Hecho |
| Aprobar la propia reserva | Rechazado en decisiones y pagos | F4 | Hecho |
| Obtener contactos sin compromiso | Correo y teléfono solo tras aprobar; los correos no llevan datos | F4 | Hecho |
| Depósito inventado o alterado | Solo inserción, autor en auditoría, reverso único, visible para el cliente | F4 | Hecho; si la tienda no lo anota, el cliente debe reclamar (F5) |
| Datos de tarjeta en notas | Detección por Luhn y rechazo | F4 | Hecho |
| Abuso de administrador | Motivo obligatorio y auditoría | F5 | Pendiente |

## Riesgos aceptados y por revisar

- **Bloqueo por cuenta:** quien conozca un correo puede bloquear su acceso 15 minutos. Restablecer la contraseña lo levanta.
- **Token de sesión en claro en la base:** la cookie va además firmada, así que el valor de la base no basta sin `AUTH_SECRET`.
- **Contraseñas filtradas:** lista local corta. Consultar un servicio externo es una decisión de privacidad pendiente (F6).
- **Correos de desarrollo:** la terminal muestra enlaces de acceso. La API no arranca en producción sin SMTP.
- **Catálogo público sin límite por IP:** las lecturas son baratas y paginadas, pero falta un límite propio o del proxy (F6).
- **Fotos archivadas:** un navegador puede conservar hasta un día la copia que ya descargó.
- **Archivos huérfanos:** un corte durante la subida puede dejar un archivo sin fila; no es accesible. Limpieza en F6.
- **PDF con contenido oculto:** lo que vaya en flujos comprimidos no se detecta. Se descargan y conviene abrirlos con un visor actualizado; analizarlos con antivirus queda para F6.
- **Retención de documentos:** no se borran solos tras decidir. Falta el proceso en segundo plano (F6). El cifrado en reposo depende del volumen.
- **Segundo paso desactivado:** quien lo quite pierde el acceso a su tienda hasta reactivarlo.
- **Suplantar una marca en el nombre de la tienda:** lo detecta quien revisa, no la web.
- **Aprobar para ver contactos:** una tienda verificada puede aprobar y cancelar solo para ver un correo. Queda en el historial; supervisión en F5.
- **Plazos largos y reloj:** dependen de la hora del servidor de base de datos y de la API.
- **Cuentas sin verificar:** no caducan todavía (F6).
