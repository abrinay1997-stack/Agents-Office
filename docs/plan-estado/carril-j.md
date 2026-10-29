# Carril J — Fase 10.1 calidad base (rama `carril-j-101-calidad-base`)

- ✅ oxlint (`.oxlintrc.json`, `npm run lint`, ~0,6 s) con `no-undef` y `import/no-cycle` sobre todo el repo, **sin apagar reglas**: 0 ciclos; los globals legítimos (`axe` dentro de `page.evaluate`, `HTMLRewriter`/`WebSocketPair` de workerd, las constantes que esbuild sustituye `__AO_*_VERSION__`, `AO_MOVIL`) están declarados en `globals`. Paso nuevo en `check.mjs` («calidad»).
- ✅ **Bug real cazado por `no-undef`:** `src/tasks.js:1012` llamaba a `isLive()` (no existe en ese ámbito; la variable es `live`) → ReferenceError al ver el filtro «En espera» con una tarea en vivo. Corregido (un token).
- ✅ `.github/dependabot.yml`: npm raíz, npm `cloudflare/` y github-actions; semanal (lunes), agrupado, máx. 3 PR abiertos.
- ✅ `npm run audit:info` (`npm audit --omit=dev --audit-level=high || true`, informativo). Ejecutado una vez: 3 moderadas (`exceljs` → `uuid`), ninguna alta.
- ✅ `engines.node >=22` (CI ya usa 22) y `Dockerfile` a `node:22-slim` para no contradecirlo.
- ✅ Topes del código NUEVO: `topes-core.mjs` (puro) + `scripts/topes-codigo-nuevo.mjs` (compara contra `origin/main`; en clon superficial se omite y lo dice) + excepciones con motivo en `scripts/topes-excepciones.json`. Tope: línea añadida ≤ 300 caracteres; archivo nuevo ≤ 800 líneas y ≤ 120 KB. Datos, `dist/`, fixtures y lockfiles no cuentan.
- ✅ Helper de cuerpo validado: `cuerpo-core.mjs` (`validarCuerpo`, `leerCuerpoWeb`), puro, 400/413 en español, con test de cuerpos basura. **Aún no enganchado a rutas** (`anuncios/accion`, `contenido/aprobar`, `sub/studio` viven en archivos ajenos/grandes): siguiente paso en otro cambio.
- ✅ Matriz de zonas en puro: `cloudflare/tests/zona-matriz.test.mjs` (7 zonas, cambios de hora, día 31, bisiesto) sobre `worker/lib/zona.js`; genérica, sin helper de CON-08.
- ✅ `@ts-check` + `tsconfig.json` (`npm run tipos`) en 14 `*-core.mjs` que pasan limpios. Fuera por tener errores hoy: `agente-core` (2), `graph-core` (5), `modelos-core` (2), `roster-core` (2), `sub-core` (9); `safety.mjs` tiene 1 error. Sin `wrangler types` ni `cloudflare/worker/lib` (pendiente).
- ⏳ No hecho: `concurrency`/CI en jobs/Dependabot-workflows (carril 0a); matriz nocturna `TZ=` en CI (workflow); jscpd.
