# ADR 0002: Dirección visual "Materializa"

Estado: portada y recorrido sustituidos por el [ADR 0003](0003-vitrina-y-archivos.md); siguen vigentes fuentes, colores y la regla sin estilos inline · 2026-11-24

- **Idea:** el producto es una línea de puntos y gana cuerpo, color y peso tipográfico al acercarse. El avance se ve en el objeto y siempre se dice también con texto.
- **Reutilizable:** los colores y las siluetas pertenecen al nicho; el núcleo solo dibuja capas y un progreso de 0 a 1.
- **Sin estilos inline:** la CSP bloquea `style="…"` en el HTML. Todo se expresa con clases y atributos de presentación SVG.
- **Fuentes:** Anybody (títulos, peso variable) y Hanken Grotesk (texto), autoalojadas.
- **Buscar rápido:** `/lista` ofrece buscador y categorías sin JavaScript.
- **Pendiente:** con fotos reales el efecto pasará de trazo a foto (F3). El panel de aprobación espera a identidad y permisos (F1 y F4).
