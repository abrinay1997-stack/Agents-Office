# Carril A · Fase 1 — galería del Estudio

## 1.a — carpetas en árbol: modelo, API, `arbol()` puro y tests (rama `fase-1a-carpetas-arbol`)

Todo detrás del flag **`estudio.carpetasArbol`** (apagado por defecto). Local: `office.config.local.json → "estudio": { "carpetasArbol": true }`. Nube: `PUT /api/media/limites { "carpetasArbol": true }` (administrador). Con el flag apagado nada cambia (nombre único global, tope 200, borrar deja los archivos en «Sin carpeta»).

- ✅ EST-01 modelo y API (local `media/galeria.mjs` + `serve.mjs`; nube `lib/estudio/galeria.js` + `modulos/estudio.js`): `parentId`, `orden`, `tipo`, `color`, `creadaPor`, `loteId`; nombre único entre hermanos (con « (2)» automático para lotes/agentes); profundidad 8; tope 500 con aviso desde 490; `GET /api/media/folders`, `POST {name,parentId?}`, `PATCH /:id {name?,parentId?,orden?}`, `PATCH /reorder {parentId,ids}`, `DELETE /:id {confirmar,dejar?}`, `POST /deshacer {token}`; ciclo → 422 `codigo:'ciclo'`; filtro de galería recursivo (`GF.matcher({sub})`).
- ✅ Lo puro: `arbol()`, `normalizarCarpetas`, `validarMover`, `planBorrado`… en `media/galeria-core.mjs` (migración perezosa: un `folders.json` viejo es válido; `v:2` al guardar).
- ✅ Borrar una carpeta = decisión del dueño: borra subcarpetas y archivos (a la papelera 30 días). Sin `confirmar` devuelve 409 `confirmar` con los números y no toca nada; con números que ya no cuadran 409 `desfase`; un archivo usado por una pieza de Contenido → 409 `en-uso` sin tocar nada (o `dejar:true`: esos quedan en «Sin carpeta»). DESHACER 30 s con token (carpeta, subcarpetas con los mismos ids y archivos). Solo administrador en la nube.
- ✅ EST-02/04 (nube): conteos con un `group by` sobre `json_extract(json,'$.folder')` (índice nuevo), borrar/deshacer por lotes de 90 ids, `mutarDoc` con versión (ya existía) para cada cambio de carpetas.
- ⏳ EST-03 (un lote/agente reutiliza su carpeta): solo el soporte (`creadaPor`, `loteId`, `auto`); cambiar `lotes.mjs` y la búsqueda por nombre de Dimitri queda para 1.b.
- ⏳ "Quitar de las piezas y borrar" (necesita EST-10, `liberar`): no existe aún; solo `dejar`.
- ⏳ 1.b (UI escritorio) y 1.c (móvil).

Migración reservada: **`0103_estudio_carpetas_indice.sql`** (solo un índice; se deshace con `drop index estudio_archivos_carpeta`). No crea tabla: nada que declarar en `TABLAS`. Doc nuevo `estudio.carpetas-borradas` (listado en `restablecer.js`).

Archivos: `media/galeria-core.mjs`, `media/galeria.mjs`, `media.mjs`, `src/galeria-filtro.js` (+1 param opcional), `serve.mjs` (solo las rutas de carpetas), `cloudflare/worker/lib/estudio/{galeria,entorno}.js`, `cloudflare/worker/modulos/estudio.js`, `cloudflare/worker/lib/restablecer.js`, `tests/fixtures/media-fachada.json` (re-fotografiada: +6 exports).
Tests nuevos: `tests/carpetas-arbol-core.test.mjs`, `tests/media-carpetas-arbol.test.mjs`, `tests/media-carpetas-servidor.test.mjs`, `cloudflare/tests/estudio-carpetas-arbol.test.mjs`.
