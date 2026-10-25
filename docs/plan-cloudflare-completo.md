# Plan: la oficina completa en Cloudflare (como Juancito Ads)

Decisión del dueño (25 oct 2026): llevar **toda** la oficina a Cloudflare con el mismo patrón que `CALENDARIOS-MARKETING-APP` (Worker + D1 + R2 + cron, despliegue por GitHub Actions), **con la interfaz actual intacta**. Se descartó correr `serve.mjs` en un contenedor: es menos estable y menos seguro (ver la conversación del 25 oct). La fase 1 (acceso, conectores MCP, agentes por API) ya está desplegada: `docs/cloudflare.md`.

## Qué hay que mover (inventario real)

- **La interfaz** es una sola página (`dist/command-centre-v2.html`, 2,2 MB) más 4 paquetes bajo demanda (`estudio-extra.js`, `tareas-vista.js`, `anuncios-vista.js`, `pieza-editor.js`). Un Worker la sirve tal cual: **no se rehace**.
- **La API que la alimenta**: la página usa 26 grupos de rutas `/api/*` (`node cloudflare/scripts/inventario.mjs` los lista y dice cuáles ya están en la nube). `serve.mjs` tiene unas 74 rutas propias más las de `tareas/`, `contenido/`, `anuncios/` y `oficina/`.
- **Lo que no cabe en un Worker y cambia de forma**: archivos en `data/` y en el Cerebro (→ D1 y R2), procesos `claude` (→ API de Anthropic con herramientas), relojes de `serve.mjs` (→ cron del Worker), el Chrome del dueño y los MCP locales (no existen en la nube).

## Reglas del puerto

1. **Una fase = una rama y un PR**, con tests y con la prueba viva (`prueba-viva.mjs`) ampliada.
2. **Lo puro se reutiliza, no se copia**: `knowledge.mjs`, `memory.mjs`, `safety.mjs`, `tareas/modelo.mjs`… se importan desde el Worker. Lo que toca archivos se reescribe contra D1/R2 **detrás de la misma interfaz**, así los tests de la lógica valen para los dos.
3. **Lo que aún no está portado contesta 501** con un mensaje en español («todavía no está en la nube»), nunca un error mudo. El inventario mide el avance.
4. **Los candados de envío siguen siendo candados.** Hoy `guard.mjs` revisa cada llamada de herramienta. Con el conector MCP de Anthropic eso no se puede interceptar llamada por llamada; por eso la fase 4 mueve el bucle de herramientas al Worker (cliente MCP propio) para volver a revisar cada llamada con `safety.mjs`.
5. **Nada de datos privados al repositorio** (la regla de siempre): la migración los sube desde la computadora del dueño a la nube, por una ruta autenticada, nunca por GitHub.
6. **Un agente corre minutos y un Worker no espera tanto**: las ejecuciones largas van por Cloudflare Queues (o Durable Objects) y la página consulta el avance.

## Fases

| Fase | Qué | Notas |
|---|---|---|
| 2 ✅ | **Cimientos + Cerebro** (hecha el 25 oct: interfaz servida con portero, Cerebro en D1, respaldo y migración): servir la interfaz real con el portero de sesión; el Cerebro (notas, búsqueda, memoria, grafo) en D1/R2; herramienta de **migración** desde la computadora (`data/`, notas) | Primera mudanza real. Antes: copia de seguridad de lo local |
| 3 | **Tareas, rutinas y calendario**: `tareas/almacen` a D1, rutinas con el cron, calendario | Ya hay modelo puro y tests |
| 4 | **Agentes completos**: bucle de herramientas en el Worker con cliente MCP propio y el guardián (`safety.mjs`), aprobaciones, calidad, costos | Aquí vuelven los candados por llamada |
| 5 | **Contenido y publicación en Meta** desde el cron; Analíticas | Patrón de `publicador.js` de Juancito |
| 6 | **Dimitri**, Negocio, Ajustes, Telegram (webhook nativo), disparadores | Los webhooks encajan de serie en Workers |
| 7 ✅ | **Anuncios de Meta y la Bandeja** (hecha el 25 oct, ver «Anuncios de Meta y la Bandeja en la nube» en `docs/cloudflare.md`) | Con el freno por uso y la regla del dinero |
| 8 | **Estudio** (imagen, video, voz, lotes): R2 + colas | Lo más pesado, al final |
| 9 | **Apagar lo local**: migración final y la oficina de la computadora pasa a ser opcional | |

## Pendientes de decisión del dueño
- Dominio propio (`oficina.panaclaw…`) o quedarse en `workers.dev`.
- Cuándo hacer la **copia de seguridad** de `data/` y del Cerebro locales (antes de la fase 2).
- Si el equipo de PanaClaw entra con usuarios propios (la fase 1 ya tiene roles admin · editor · lectura).
