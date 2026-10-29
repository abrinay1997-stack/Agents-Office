# Cuaderno de lecciones (orquestador)

Formato: fecha · síntoma → causa → arreglo → cómo evitarlo → carril/PR.

- **2026-10-29 · (i)** Un `check` rojo con muchas pruebas de humo fallando en cadena tras un solo timeout, y que pasa en el otro job del mismo commit → intermitente (carga del runner). Arreglo: repetir el job UNA vez (`rerun_failed_jobs`). Evitar: nunca saltar ni quitar una prueba. · transversal
- **2026-10-29 · (ii)** `contenido-siglas.test.mjs` y otras pruebas de navegador fallan en local → `dist/` viejo. Arreglo: `node build.mjs` antes de probar. · transversal
- **2026-10-29 · (iii)** `contenido-migracion.test.mjs` («más de 120 filas») falló una vez en CI bajo carga y pasa sola → intermitente. Re-run una vez; si repite, abrir issue. · carril C
- **2026-10-29 · (iv)** El log completo de un job no se descarga por red desde la sesión (proxy 403 al blob). Usar `get_job_logs` con `return_content` y `tail_lines` grande; buscar «not ok» / «✗».
- **2026-10-29 · (v)** `per_page` no limita `list_workflow_runs`: consultar un run por id.
- **2026-10-29 · (vi)** Al fusionar un PR, el resto queda probado contra un `main` viejo → actualizar la rama (`update_pull_request_branch`) y esperar CI nuevo antes de fusionar los que tocan `check.mjs`/`package.json`/`build.mjs`. Carril J siempre el último.
- **2026-10-29 · (vii)** `dist/command-centre-v2.html` y `src/braingraph.js` se regeneran solos: no se commitean.
- **2026-10-29 · (viii)** `.github/workflows/*` no se pueden probar en local; el entorno de GitHub `produccion` (SEG-07) debe existir sin revisores para que los despliegues sigan solos. El PR dependabot #62 (checkout/setup-node v7) toca TODOS los workflows: fusionarlo solo con CI verde y vigilando el primer despliegue.
- **2026-10-29 · (ix)** El despliegue solo se dispara si el PR toca `cloudflare/**`.
- **2026-10-29 · (x)** Un clon con índice obsoleto da avisos falsos del hook «cambios sin commitear»: usar worktrees limpios.
- **2026-10-29 · (xi)** «No hay Chromium en este entorno» puede ser falso: hay uno en /opt/pw-browsers/chromium (usar `executablePath` si el proyecto pinea otra versión).
- **2026-10-29 · (xii)** El tope de bytes de la página ya no vive literal en `check.mjs` (grep de 2306867 no lo halla); la cifra figura en los docs (tope 2.306.867 B, gzip 716.800). Medir con `node build.mjs` antes de sumar bytes entre ramas; margen tras Fase 0.0: ~141 KB brutos.
