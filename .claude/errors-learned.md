# Errores aprendidos — Agents Office

## [2026-09-22] — La búsqueda de notas partía las palabras con tilde

**Contexto:** Configurar la oficina con el brain de PanaClaw (notas en español).
**Error:** `relevantNotes()` en `serve.mjs` separaba palabras con `/[^a-z0-9]+/`, así que «página» quedaba en «p» + «gina» y «clínica» en «cl» + «nica». Las tareas escritas en español casi nunca encontraban la nota correcta; solo llegaba el MOC del departamento.
**Causa raíz:** La expresión regular solo acepta ASCII y no se normalizaban los acentos, ni en el texto de la tarea ni en las notas.
**Fix aplicado:** Función `fold()` que pasa a minúsculas y quita los diacríticos (`normalize('NFD')` + quitar `̀-ͯ`) antes de partir palabras y antes de comparar con el nombre y el texto de cada nota.
**Prevención:** Toda búsqueda léxica sobre texto en español normaliza acentos en los dos lados. Los nombres de notas del brain van sin tildes (`precios-webs`, `objeciones-plazo`).
**Archivos:** `serve.mjs:184-191`

## [2026-09-22] — Las notas del brain llegan recortadas al agente

**Contexto:** Decidir cómo cargar el conocimiento de PanaClaw en el brain.
**Error:** (evitado) Clonar el repositorio PanaClaw-WorkSpace tal cual dentro del brain habría dado notas de hasta 30.000 caracteres y muchos `README.md` con el mismo nombre.
**Causa raíz:** `contextText()` corta cada nota a 1.800 caracteres, `businessContext()` corta CLAUDE, index, business-model y voice a 1.200, y `vaultIndex()` indexa por nombre de archivo (dos notas con el mismo nombre se pisan).
**Fix aplicado:** Brain curado en `brain-panaclaw/`: notas atómicas de menos de 1.800 caracteres con nombres únicos; los procedimientos largos van como skills (6.000 + 8.000 caracteres, que llegan completos).
**Prevención:** Una nota del brain dice lo esencial en sus primeros 1.200–1.800 caracteres; lo que tenga pasos y plantilla es un skill.
**Archivos:** `serve.mjs:171-201` · `brain-panaclaw/`

## [2026-09-22] — La oficina real mostraba tareas y cifras inventadas

**Contexto:** Abrir la oficina de PanaClaw con el .bat después de configurarla.
**Error:** Aparecían 118 tareas de empresas ficticias («Nectar Foods», «Totara Legal») y cifras falsas en las tarjetas («costo por usuario $41»), mezcladas con el trabajo real. Además seguían los nombres viejos, porque el servidor era el proceso anterior a los cambios.
**Causa raíz:** (1) El .bat reutiliza el servidor si ya responde, así que no cargó la configuración nueva. (2) `tasks.js` siembra una «mañana creíble» y reparte tareas inventadas a los agentes sin trabajo, y `main.js` inventa actividad y métricas, también cuando la página la sirve el servidor real.
**Fix aplicado:** Servidor reiniciado. La simulación (siembra, tareas inventadas, `fireAgentEvent`, métricas) corre solo cuando la página se abre como archivo; servida por http muestra solo trabajo real, y las tarjetas cuentan «entregas reales» y «esperan tu OK».
**Prevención:** Después de cambiar la configuración, el roster o el código del servidor, hay que reiniciarlo: cerrar el proceso de `node serve.mjs` y volver a abrir el .bat.
**Archivos:** `src/tasks.js:236,963` · `src/main.js:20,349,1025`
