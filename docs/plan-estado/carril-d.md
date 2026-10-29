# Carril D — estado (Fase 4: banco de presets en la nube)

Rama `carril-d-presets-nube`. Alcance de esta entrega: fases A y B de §3.4 (EST-12, EST-13, EST-14 parcial). Sin lotes, sin plantillas, sin entender video, sin el ejecutor local con `IMAGES` (fases C-E: otra entrega).

- ✅ **C01 — carga de la fábrica en el Worker.** `presets/fabrica-core.mjs` (puro: `juntar`, `cuentas`, `armarFabrica`), `presets/fabrica.mjs` (lee la carpeta y llama a `armarFabrica`; sigue exportando lo de siempre), `presets/fabrica-worker.js` (GENERADO por `scripts/generar-fabrica-worker.mjs`, `import … with { type: 'json' }`). Test `cloudflare/tests/presets-fabrica-worker.test.mjs`: resultado idéntico al local byte a byte, archivo generado al día, nada de `node:*` en lo que corre en el Worker. `wrangler deploy --dry-run` empaqueta (3,2 MB / ~790 KB gzip).
- ✅ **C02 — API pura.** `presets-api-core.mjs` (`pedidoLimpio`, `cifrasComoObjeto`, `propiosDeNotas`, `bancoDe`, `contextoDe`, `faltaLocal`, `listar`, `compilar`, `planAplicar`, `nombreLimpio`, `recetaDeGuardar`, `presetParaGuardar`). `presets.mjs` (local) quedó como E/S sobre ese núcleo, sin cambio de comportamiento (`tests/presets-*.test.mjs` verdes).
- ✅ **Nube: GET lista / compile / apply / guardar / borrar / versiones** en `cloudflare/worker/lib/estudio/presets.js`, enganchado en `modulos/estudio.js` (ya no hay 501 para `/api/media/presets*`). `trabajos.js`: `pedir` ya no rechaza el rastro `preset/receta/canal/esEscena` (sí los pasos con sharp: `post`, `pre`, `qa`, `local`); el archivo y `retry` los conservan.
- ✅ **Presets propios = notas del Cerebro en D1** (grupo «Estudio», `tipo: preset`); papelera de 30 días con la del Cerebro; versiones en `filas` colección `presets-versiones` (últimas 20 por preset).
- ✅ **Honestidad sin sharp:** `capacidades.local=false`; los presets que lo exigen salen `on:false` con motivo (no ocultos), nunca caen a la IA, y la QA no se inventa (aviso en el plan, sin `qa` en el archivo).
- ✅ **Dinero:** apply solo con el clic GENERAR; topes del día/mes de `trabajos.pedir`; solo administrador con motores de pago; la guía 3D recién subida va a la papelera si el pedido se rechaza.

## Reservas
- Migraciones: ninguna (0104-0119 sin usar).
- Tablas D1: ninguna nueva. `filas` gana la colección `presets-versiones` (declarada en `TABLAS` de `auditoria-transversal.test.mjs`).
- Flags: ninguno.
- Delta de bytes de la página (`dist/command-centre-v2.html`): 0 (nada de `src/` ni de la página cambió).
- Archivos tocados: `presets.mjs`, `presets/fabrica.mjs`, `cloudflare/worker/modulos/estudio.js`, `cloudflare/worker/lib/estudio/trabajos.js`, `cloudflare/tests/estudio.test.mjs` (el 501 de presets ya no existe), `cloudflare/tests/auditoria-transversal.test.mjs` (solo la descripción de `filas`), `CLAUDE.md` (una viñeta), `docs/cloudflare.md`.
- Cómo se deshace: quitar el bloque `/api/media/presets` de `modulos/estudio.js` (vuelve el 501); los datos del dueño (notas, versiones) se quedan.

## Entrega 2: Fase D, el ejecutor local con IMAGES (rama `carril-d-ejecutor-images`)
- ✅ `cloudflare/worker/lib/estudio/retoques.js` + `imagen-local.mjs` partido en `pipeline` (sharp) y `correrPasos` (el bucle, sin sharp). Interruptor `retoquesNube` (config del Estudio, **apagado por defecto**) + binding `IMAGES`. 15 pasos en `OPS_NUBE`; un preset se activa solo si TODOS los suyos están; los demás salen `on:false` con el paso que falta. Tres caminos: todo local (versión nueva, gratis), antes de la IA (`prep`) y después de la IA (cron). Detalle en `docs/cloudflare.md` → «Fase 4 (D)».
- Reservas: ninguna migración, ninguna tabla nueva, delta de bytes de la página 0 (nada de `src/`).
- **Probado:** `cloudflare/tests/retoques-nube.test.mjs` (7 casos, con un IMAGES falsificado con sharp: lista, apply todo-local, original intacto, historial, sin llamadas a motores, un paso no soportado = 400 sin crear nada, fondo blanco después de la IA por el cron, PNG propio válido, reducción a 2048 px, binding que no devuelve píxeles, `post` a mano por `/api/media/jobs` = 501) y `retoques-vivo.test.mjs` (workerd real: el Worker arranca con el módulo importado y la lista es la esperada).
- **NO probado:** el binding IMAGES real de Cloudflare. `wrangler dev --local` contesta `RGB/RGBA output is not supported in local mode`, así que `output({ format: 'rgba' })` y la orientación EXIF solo se podrán confirmar en producción con el interruptor encendido sobre una foto de prueba. Tampoco se midió CPU/tiempo de un retoque de 2048 px en un Worker real.
- **Sigue sin la nube:** encuadrar, ampliar, nitidez, ruido, enderezar, exportar por canal, LUT de fábrica, igualar serie, y la QA que mide.

## Pendiente (otra entrega)
- Fase C: sinónimos/búsqueda ya van (`listar` los usa); falta probar con presets propios con IA real.
- Fase D, lo que falta: encuadrar/exportar/nitidez/ruido/enderezar (necesitan un redimensionado propio o el binding con `fit`/`sharpen`/`rotate` de IMAGES) y la QA que mide.
- Fase E: lotes por cron (CSV primero), plantillas, entender video/audio.
