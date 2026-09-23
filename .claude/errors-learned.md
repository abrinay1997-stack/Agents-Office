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
