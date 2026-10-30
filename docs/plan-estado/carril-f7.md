# Carril Fase 7 · seguridad — estado

- **SEG-02** (PR #91): detector con normalización + herramientas con URL libre fuera del chat. Revisión del 29 oct: el destino se decide sobre el texto crudo, controles C0, confusables ampliados, bloqueo auditado.
- **Pendiente SEG-02:** (a) lista `dominiosPermitidos` por conector (evita el falso positivo de «busca https://ejemplo.com» en un conector que sí lee webs): requiere una columna en `conectores` y su pantalla, no se hizo; (b) ✅ el banco de ataques de VAN-03 existe desde el 30 oct 2026 (`tests/fixtures/banco-ataques.mjs`, ver `docs/plan-estado/carril-van.md`).
- **Pendiente:** SEG-05 (rama `mejora/fase7-seg05`), SEG-06, SEG-09, `?token=` en dos versiones, `npm audit` en CI.
