# Agents Office — for Claude Code

You are in the Agents Office repo. The owner will most often ask you to change **who the agents are and what they do**, to teach an agent **how a kind of work is done** (a brief or a skill), to put something **on the timetable** (a routine), or to change **which connectors the agents may use**. Do that by editing the JSON files and skill folders described below. Do not touch `src/`, `serve.mjs` or the build for those requests.

## Trabajo en equipo (PanaClaw) — reglas

Esta copia es la oficina de **PanaClaw**. El dueño (Abrinay) y la gente de PanaClaw la mejoran cada uno en su propia computadora y con su propia sesión de Claude Code; **GitHub** (`abrinay1997-stack/Agents-Office`, rama `main`) es lo que los une. Lo que alguien sube, el dueño lo trae con un doble clic y lo ve en su oficina como si se hubiera hecho en su máquina.

**Idioma:** con el dueño y con el equipo de PanaClaw, responde siempre en español.

**Qué viaja por GitHub:**
- el código;
- `office.config.equipo.json` (nombre PanaClaw, cerebro `brain-panaclaw`, qué conector usa cada departamento);
- las notas de empresa de `brain-panaclaw/`;
- el roster, las rutinas y las skills del cerebro (`brain-panaclaw/Agents Office/agents.json`, `routines.json`, `skills/`);
- la auditoría y este plan.

**Qué NO viaja (se queda en cada máquina):**
- `data/` (tareas, historial, trabajos del Estudio);
- `office.config.local.json` (ajustes de esa máquina, que ganan sobre los del equipo);
- las entregas y correcciones de los agentes (`brain-panaclaw/Agents Office/*`);
- las imágenes del Estudio;
- las keys (variables de entorno de Windows);
- la sesión de Claude de cada uno.

Por eso quien clona ve la misma oficina y el mismo cerebro, pero con el historial de tareas vacío.

**Reglas:**
1. **Antes de empezar, trae lo último:** `git pull`, o `Actualizar-Oficina.bat`.
2. **Trabaja en una rama con nombre** (p. ej. `mejora/aprobaciones`) y abre un Pull Request hacia `main`; el dueño lo acepta. Solo sube directo a `main` si el dueño lo pidió.
3. **Antes de subir:** `npm run check` en verde, y commits en español que digan qué cambió y por qué.
4. **Nunca subas** keys, `data/`, `office.config.local.json` ni las entregas de los agentes (el `.gitignore` ya lo impide: no lo fuerces). El repositorio puede ser público: lo que viaja lo puede leer cualquiera.
5. **Al arreglar un punto de la auditoría,** márcalo ✅ en `docs/auditoria-ux-2026-09-24.md` en el mismo commit. Al cambiar algo que el dueño usa, actualiza este archivo y el README.
6. **Avísense antes de tocar a la vez los archivos grandes:** `src/main.js`, `src/tasks.js`, `src/shell.html`, `serve.mjs`. Son los que más chocan.
7. **`dist/command-centre-v2.html` y `src/braingraph.js` se regeneran solos** al arrancar. Si chocan, quédate con cualquiera de las dos versiones y reconstruye con `node build.mjs`.

**El dueño, para ver el trabajo del equipo:** doble clic en **`Actualizar-Oficina.bat`**.
- Guarda primero sus cambios propios (rutinas, agentes, notas) en un commit local, así nunca se pierden.
- Descarta lo que se regenera solo, trae lo nuevo de GitHub e instala las librerías si cambiaron.
- Abre la oficina con el iniciador.
- Si él y el equipo tocaron la misma línea de un archivo, no cambia nada y lo dice. Entonces se le pide a Claude Code en esta carpeta: «combina mis cambios con los del equipo».

**Alguien nuevo del equipo, la primera vez:**
1. El dueño le da acceso de colaborador en GitHub.
2. Instala Node 20 o más nuevo, Git y Claude Code, y entra con su propia cuenta.
3. `git clone https://github.com/abrinay1997-stack/Agents-Office.git`.
4. Doble clic en `Agents-Office-Abrinay.bat`: instala las librerías la primera vez y abre la oficina ya como PanaClaw.
5. Para el Estudio usa sus propias keys (en variables de entorno de Windows) o el motor gratis «Prueba».

## Plan y pendientes (al 24 sep 2026)

**Hecho:**
- V4.2 (24 sep, misma rama): la auditoría del Estudio y del Calendario (`docs/auditoria-estudio-calendario-2026-09-24.md`, 98 puntos), con 31 ya arreglados:
  - Calendario: semana y día con horas de 00 a 24 y una línea de «ahora»; el mes a una línea por evento; fechas en español; arrastrar con el dedo; el enrutador ya no pierde una tarea; la AGENDA (tecla A, la vista del teléfono); las ejecuciones pasadas de cada rutina (hecha ✓, falló ⚠, saltada, no corrió); la ventanita de la rutina con el título entero y todas sus acciones a la vista.
  - Estudio: la galería en orden por filas y sin redibujarse; el error junto al campo; el resumen del formato en el pie; ayuda cuando falta una key; pestañas en el teléfono; en cada tarjeta ★, una acción con texto y el menú «⋯» (la papelera al final); «Mejorar el prompt» dice el idioma (en inglés con su traducción debajo, o en español); con el Estudio cerrado, lo que termina se avisa (número en la claqueta del dock y aviso con VER).
- V4.1 (24 sep, rama `claude/gracious-pascal-aryw2d`):
  - el centro de la oficina sin la red neuronal: solo el icono del Cerebro y Dimitri;
  - los 31 ⏳ de `docs/auditoria-ux-2026-09-24.md`: aprobaciones por borrador, ARCHIVADAS con DESHACER, trampas de foco (`src/modal.js`), hoja de atajos «?», teclado, papelera de notas, tablet;
  - la auditoría visual de 50 puntos (`docs/auditoria-visual-2026-09-24.md`), con 37 aplicados: tarjetas compactas y encuadre en pantallas estrechas, contraste AA en oscuro, landmarks;
- motor único en el servidor;
- Estudio V2 (41 modelos, Higgsfield, trabajos en segundo plano, Animar);
- barra superior V4 con dock de herramientas;
- Dimitri con sus cinco modos;
- filtros y búsqueda del Cerebro;
- calendario con rutinas en los seis departamentos;
- ficha del agente;
- auditoría de 100 puntos: los 100 arreglados.

**Siguiente, en este orden:**
1. Lo que queda abierto en `docs/auditoria-estudio-calendario-2026-09-24.md`. Lo que más molesta:
   - un trabajo en marcha sin tiempo estimado (A39) y «Cancelar» sin decir si se cobra (A40);
   - cancelar o eliminar en el calendario pregunta en vez de ofrecer DESHACER (B21);
   - el visor ampliado: sin posición «3 de 8» y sin «Variar» (A32, A35).
2. Las 13 recomendaciones 💡 de `docs/auditoria-visual-2026-09-24.md`. Casi todas son decisiones de diseño del dueño. Las que más cambian el día a día:
   - el tamaño de los nombres de los agentes en la vista general (8);
   - una agenda en lugar de la cuadrícula del calendario en el teléfono (38);
   - el punto rojo que parpadea en las tarjetas (9).
3. Probar el Estudio con una key real: Higgsfield `HF_KEY`, Nano Banana `GEMINI_API_KEY` o fal.ai `FAL_KEY`.
4. Las mejoras que el dueño vaya pidiendo. Una herramienta nueva entra como un botón más en el dock de la barra superior (ver «The top bar»).

**Reglas de la interfaz (V4.1):**
- Toda ventana modal nueva llama a `modal.open(el)` al abrirse y a `modal.close(el)` al cerrarse (`src/modal.js`). Mientras está abierta, el resto de la página queda inerte y Tab da la vuelta dentro de ella.
- Todo atajo nuevo va también en la hoja «?» (`keysSheet` en `src/main.js`).
- Los colores nuevos pasan 4,5:1 en claro y en oscuro.
- El anillo de foco usa `var(--focus)`.
- Nada que se vea en la oficina depende del ancho de la ventana sin probarlo a 390 px (teléfono), a 1024 px y a 1512 px.

## Changing the agents

The roster lives in `office.agents.json` (shipped defaults) and `office.agents.local.json` (the owner's copy, ignored by git). **Always write to `office.agents.local.json`**: if it does not exist, create it with `{"agents": []}` and add only the agents you are changing. Never edit `office.agents.json` unless asked to change the shipped defaults.

Each agent looks like:

```json
{ "id": "newt", "department": "marketing", "lead": false,
  "name": "NEWSLETTER", "role": "Newsletter Creator Agent",
  "does": "Writes the monthly newsletter your signups actually open.",
  "tools": ["beehiiv", "loops"],
  "brief": "Five bullets and a pull quote. Subject lines under 40 characters. Never open with the company name." }
```

You may change **name, role, does, tools, brief, model**. Keep `name` short and upper case (it is the label on the desk). `does` is what the agent reads about itself before every task, so write it as a job description in one or two sentences. `tools` names the connectors this agent usually reaches for (match the names shown in the top bar, lower case). `brief` is the owner's standing instructions to that one agent, read before every task and chat turn: up to 2,000 characters, a string or a list of lines. Anything longer, or anything with steps and a template, is a skill (next section). `model` is `sonnet`, `opus` or `fable`, or empty for the office default (Sonnet); set it only when the owner names one — a task or a routine can still set its own above it. `effort` is `low`, `medium`, `high`, `xhigh` or `max`, or empty for the office's setting and then the model's own (Opus runs at high); same rule, same precedence.

The roster is read in this order, later wins: `office.agents.json` → `<brain>/Agents Office/agents.json` → `office.agents.local.json`. The brain is the folder named by `brain` in `office.config.json` (or `office.config.local.json`, which wins). If the owner keeps their roster in the brain, write there instead of the local file.

Fixed, and the office ignores edits to them: `id`, `department`, `lead`. There are **six departments and 35 seats** and that is the office. Do not add or remove agents, departments or pods. When the owner wants a new kind of agent, **rename a seat** in the right department. When they want fewer, leave the seat as is; an idle agent costs nothing.

Department keys: `emails` (5 seats) · `sales` (6) · `marketing` (7) · `ops` (6) · `fin` (4) · `delivery` (7). Every department has a lead (Emails, Sales, Marketing, Operations, Accounting, Delivery) and the lead stays the lead.

After editing: run `npm run check` (it validates the roster and prints every problem), then tell the owner to restart the office (`npm start`). Names, roles and descriptions update on the next page load.

## Teaching an agent how a task is done (skills)

When the owner says "this is how we do X", "make the agent do it this way", "here is our SOP / template / an example I was happy with", or asks why the deliverables are generic, the answer is a **skill**. A skill is a folder with a `SKILL.md` and the files beside it, the same shape as a Claude Code skill. Full guide: `SKILLS.md`. Read it once before writing your first one.

**Where to write it:** `<brain>/Agents Office/skills/<name>/SKILL.md`, where `<brain>` is the folder from `office.config.local.json` → `office.config.json` (`brain`, default `./brain`). Create the folders if they do not exist. Never write the owner's skills into the repo's `skills/` folder; that holds the shipped examples and `git pull` would fight them. A skill of the same name in the brain replaces a shipped one.

**Decide brief or skill first.** Fits in a paragraph with no steps and no template → a `brief` on the agent. Has steps, a shape, rules, or a document to copy → a skill.

**What you need before writing.** The trigger (which tasks this covers), the source material (an SOP, an example, the owner's description), the shape of the finished thing, and the rules. If the owner gave you a document, read it in full first. If one of these is missing, ask one question for it; do not invent the owner's process.

**The folder:**

```
<brain>/Agents Office/skills/proposal/
  SKILL.md       front matter + instructions (under 6,000 characters)
  template.md    the shape of the finished thing, headings kept
  example.md     one real one the owner was happy with (optional, strip anything private the owner did not hand you)
```

**SKILL.md:**

```markdown
---
name: proposal
description: How we write a client proposal
agents: [piper]
---
# Writing a proposal
Use this for any request that ends in a document a client says yes or no to.   ← the trigger, first line

## Before you write
1. …what to read first, by note name (`10-Business/offer-ladder.md`)…
## The shape
Follow `template.md` beside this file, section for section.
## Rules
- short, absolute, one per line
```

**Binding.** `agents: [id, id]` for one or more agents (ids from `office.agents.json`; pick the seat whose `does` matches, and say which one you chose). `departments: [emails]` for a whole department (`emails`, `sales`, `marketing`, `ops`, `fin`, `delivery`). Neither binds it to every agent; only do that for a house style, and say so. Unknown ids are refused and a skill with no valid binding is skipped.

**Limits the loader enforces:** `SKILL.md` body 6,000 characters; each file beside it 4,000, all files together 8,000. Readable files are `.md .txt .csv .json .yaml .html`; anything else is listed by name only. Long reference material goes into the brain as ordinary notes, which the agent reads when the task calls for them; the skill just names them.

**Writing rules.** The first line after the heading says when the skill applies. Steps, then shape, then rules. Point at notes by name. Rules are short and absolute. One skill per kind of work. Never put a number in a skill that should come from the numbers ledger; say where it comes from instead.

**After writing:** run `npm run check` (it lists every skill, its binding and every problem in plain sentences; fix what is red). Skills and briefs take effect on the next task with no restart. Tell the owner: the folder path, which agent it is bound to, and one task to type to try it. Suggest they read the result and send it back with `revise: …` from the chat; when a correction is one they will want every time, fold it into the skill.

**Reading skills back.** http://localhost:4520/api/skills (server running) or `node -e "import('./skills.mjs').then(async m=>console.log(JSON.stringify(m.loadSkills((await import('./config.mjs')).loadConfig().brainPath,(await import('./roster.mjs')).loadRoster().agents).summary(),null,1)))"`.

## Lessons and the set-up interview

Two more things the office writes into the brain on its own. Both are plain files you may edit when the owner asks.

- **Corrections** — `<brain>/Agents Office/feedback/<agent-id>.md`. Every `revise: …` the owner sends lands here, sorted into "## Standing rules" (read by that agent before every task) and "## One-offs". One line each, `- date · rule ← "what the owner said" (task)`. When the owner says "fold the lessons into the skill", "make that a rule", "forget that", or "the agent keeps doing X": read this file, move the durable preferences into the agent's skill (or its `brief` if there is no skill) as short absolute rules, and delete the lines you moved so they are not said twice. Never invent a rule the owner did not give.
- **The interview** — the department lead's chat runs it when the owner says "set up" (`onboard.mjs`). It writes briefs into `<brain>/Agents Office/agents.json` and one skill into `<brain>/Agents Office/skills/<name>/`. An earlier skill of the same name is kept beside it as `SKILL.md.backup-<time>`; if the owner asks you to tidy up, merge what is worth keeping and delete the backup. `data/interviews.json` holds an interview in progress; delete it if one is stuck.

## Routines: tasks on the office's own clock

When the owner says "every Monday …", "each morning …", "on a schedule", "automatically at …", "make X happen every …", that is a **routine**: a task the office fires by itself at that time and runs without anyone typing. **Every department** can have routines (`emails`, `fin`, `sales`, `marketing`, `ops`, `delivery` — since 24 Sep 2026; the first release had three). One run can be skipped without pausing the routine: SALTAR ESTA in the calendar (P), or `POST /api/routines/<id>/skip {"at": <ms>}`.

**Where:** `<brain>/Agents Office/routines.json` (`<brain>` as above). Create it with `{"routines": []}` if it does not exist. Never write routines anywhere else.

```json
{ "id": "overdue-reminders", "dept": "fin", "agent": "invo",
  "title": "List the overdue invoices and draft the reminders",
  "text": "List the overdue invoices and draft the reminders. Xero read, Gmail drafts.",
  "when": { "kind": "weekly", "days": [1], "at": "09:00" },
  "needsOk": true, "paused": false }
```

- `id` short, unique, lower-case. `dept` one of the six. `agent` an id from the roster in that department; pick the seat whose `does` matches, and say which one you chose.
- `text` is what the agent is asked to do, written as the owner would type it. `title` is the card on the board (under 90 characters).
- `when`: `{"kind":"daily","at":"HH:MM"}` · `{"kind":"weekdays","at":"HH:MM"}` · `{"kind":"weekly","days":[1,4],"at":"HH:MM"}` (0 = Sunday) · `{"kind":"hourly","every":1,"from":"09:00","to":"17:00","weekdaysOnly":true}` · `{"kind":"minutes","every":2}` (filming only). Times are the machine's local clock, 24-hour.
- `when.start`: `"YYYY-MM-DD"`, optional (V3.2.1) — the routine starts on that date and never fires before it ("from next Monday", "starting 5 October"). Leave it out to start now. The owner can also set one by clicking a day in the calendar (P) with REPEAT on.
- `needsOk` (default true): the result waits in WAITING ON APPROVAL for the owner's tick before the agent sends, pays or changes anything. Leave it on unless the routine only reads and reports (a triage, a list, a reconciliation), and say which you chose and why.
- `paused: true` keeps it on the timetable without firing.
- `model`: `sonnet`, `opus` or `fable`, only when the owner names one; otherwise leave it out and the agent's or the office's model applies (the task beats the routine beats the agent beats the office).
- `effort`: `low`, `medium`, `high`, `xhigh` or `max`, only when the owner names one; otherwise the agent's, then the office's, then the model's own.
- `team: true` when the owner wants the whole department on it ("as a team", "get the team to …"): the department lead owns the routine (set `agent` to the lead's id; a specialist id is moved to the lead), plans the pieces when it fires, the desks work at once, the lead writes the final. Leave it out for a one-desk routine — a team costs two to four runs plus the lead's two.

The server re-reads the file every 20 seconds, so a routine lands without a restart; its next run is computed from the moment it is read. Run state (next run, last run) lives in `data/routines.json`, never in the brain file. After writing: run `npm run check` (it validates every routine and names every problem: unknown agent, wrong department, incomplete schedule, duplicate id), then tell the owner the title, the schedule in words, which agent has it, whether it waits for their OK, and that it shows under the SCHEDULED chip with a RUN NOW button to try it straight away.

## A task for a date (the calendar)

When the owner says "on Friday, …", "next Tuesday at 10, …", "on the 5th, …" for a one-off (not "every"), that is a **scheduled task**, not a routine. The office does these itself: the owner clicks the day in the calendar (P), or the page posts `{ "dept", "text", "at": <ms or ISO> }` to `/api/tasks`. There is no file to write for them (they live in `data/tasks.json`, state `scheduled`, fired by the server's clock); tell the owner to press P and click the day, and say what to type.

## Changing the connectors

The top bar shows the MCP servers **this machine's Claude Code** is connected to (`claude mcp list`). To add one: `claude mcp add …` or connect it in claude.ai; the office picks it up on restart. To decide what the agents may call, edit `office.config.json` (or `office.config.local.json`):

```json
"mcp": {
  "allow": [],
  "deny": ["Stripe"],
  "departments": { "Slack": ["emails", "ops"] }
},
"tools": { "web": true, "browser": true },
"teams": { "enabled": true, "max": 4 }
```

`allow` empty means every connected server. `deny` keeps a server in the bar but out of the agents' hands (`"Chrome"` works there too). `departments` says which pods a server is wired to; unknown servers default to every pod. `tools.web` gives the agents web search. `tools.browser` (V3.2 (16 Sep)) gives them the owner's own Chrome through Claude Code's Chrome integration — the run starts with `--chrome` and gets the `claude-in-chrome` server (open tabs, read pages, fill forms on sites the owner is signed in to); it needs the Claude in Chrome extension paired to this machine (`claude --chrome` once) and the Claude Code login. The bar shows a Chrome tile wired to every pod. `teams` (V3.2 (16 Sep)) is Agent Teams: `enabled` shows the TEAM button and makes "as a team" mean it; `max` caps the desks (2–6, default 4).

Agents get only connected servers (plus web when enabled, plus the browser when enabled and paired). They never get Bash, file tools or sub-agents. Their standing rule: read freely; send, post, pay, delete or change data outside this machine **only** when the owner's task explicitly asks for that exact action — in the browser too.

## Agent Teams

When the owner says "as a team", "get the team on it", "spawn three teammates to …", or presses TEAM in the bar, the department **lead** takes the task and splits it into two to `teams.max` independent pieces on the desks whose `does` or skills fit; the pieces run at the same time, one Claude process each; teammates may leave one-line notes (`@lead: …`, `@<id>: …`) which reach the lead; the lead writes the final from the pieces. This is the office's own build of the shape (lead · teammates · shared piece list · notes) from separate headless Claude sessions — Claude Code's own agent teams only spawn in an interactive terminal, so they are not what runs here. Nothing to write for a team task; it is the same roster, briefs and skills. To make a seat a better teammate, improve its `does` (the lead splits by it) and its skills. A team routine is `"team": true` in `routines.json` with the lead as `agent`.

## Dimitri (the deputy manager, «Subgerente» until 24 Sep 2026)

The owner's right hand, above the six departments: the ◆ tag beside the Brain at the centre of the office, or key S. The name is `office.config.json → "deputy": { "name": "Dimitri" }`. Dimitri (`sub.mjs`, page side `src/sub.js`) reads the company's notes, the office's live state and the latest deliverables, and answers in one of five modes: **charla** (a question or an opinion — it answers), **estado** (how the office is doing, from real data), **analisis** (a decision thought through: options, a recommendation), **plan** (work to be done — it splits it into pieces per department, instructions for each lead, why, a date, one desk or the team, and moves a piece put in the wrong department) or **pregunta** (one missing fact). Only a plan carries pieces, and nothing is sent until the owner presses ENVIAR A LOS JEFES. History: `data/subgerente.json`. To change how it thinks or distributes, edit `sub.mjs → systemPrompt`; better seat descriptions (`does`) and skills make it route better with no code change.

## The top bar (V4, 24 Sep 2026)

Brand (the business name) · the connector lane (its label opens the connectors' panel; the icons shrink to fit and never push anything) · a fixed **dock** of icon tools on the right: the model's logo (Claude or Meta), approvals ⚠ (it counts drafts; each click goes to the next one), the Estudio (clapperboard, E), the calendar (P), the keyboard shortcuts (?), and the task panel's switch (T). A new tool joins the dock as one more `<button class="tb-ic">` with an SVG, an `aria-label` and a `title` naming its key. The plan's usage (session · week) sits in the bottom-left corner.

## The Estudio (images and video)

Real image and video generation, for the owner (the clapperboard in the dock, key E) and for the agents. `media.mjs` is the engine, `estudio-mcp.mjs` the agents' tool, `src/studio.js` the window.

- **Engines** turn on when their key is in the Windows environment — never write a key into a file: `HF_KEY="id:secret"` (Higgsfield Cloud: Soul, Kling 3, Seedance 2/2.5, Flux 2, Ideogram 4, Recraft, Wan, MiniMax, LTX, PixVerse…; or `HF_API_KEY` + `HF_API_SECRET`; `HF_API_BASE_URL` overrides `https://api.higgsfield.ai`), `GEMINI_API_KEY` (Nano Banana), `XAI_API_KEY` (Grok), `OPENAI_API_KEY` (GPT Image), `FAL_KEY` (fal.ai: Flux, Seedream, Nano Banana, Ideogram, Kling 2.5, Seedance 1, Hailuo, Veo 3). `prueba` and `prueba-video` are free local cards for testing the flow.
- **Models** are the `CATALOG` in `media.mjs`: each one has its engine, the media it takes (`roles`: start/end frame, references, a source video; `needs` for the required ones) and its `settings` (enum / range / boolean, shown by the page). The Higgsfield request bodies are a port of open-higgsfield's mappers (`wide-trace/open-higgsfield`, `src/generation/to-platform.ts`); auth and uploads follow Higgsfield's own client. Your own fal or Higgsfield model: `office.config.json → media.custom: [{ "id", "name", "engine": "fal"|"higgsfield", "kind": "image"|"video", "path", "cost" }]`. Default models: `media.default: { "image": "…", "video": "…" }`.
- **Jobs**: every generation is a background job in `data/media-jobs.json` (queued → running → done/failed with the reason in plain words). Queue engines keep their request ids, so a restart resumes the poll. The page shows live tiles; a failed one says why and has REINTENTAR.
- **Agents** in `media.departments` (default marketing, delivery, sales, ops) get `generar_imagen`, `generar_video` (with `imagen_inicial`/`imagen_final` to animate), `buscar_en_galeria`, `estado_trabajo`, `estado_estudio`. An image usually comes back within the call as `![…](/media/…)`; a video hands back `⏳ Estudio: … (trabajo <id>)`, which the agent leaves in its deliverable and the office swaps for the file when the job ends (task result and its note).
- **Files**: `<brain>/Agents Office/media/YYYY-MM/` with a `.json` record beside each (prompt, model, settings, media used, size, who, task). Uploads (the owner's product photos, logos, faces) live there too, marked `upload`. Trash goes to `media/.papelera` (30 days, with undo). Budget: `media.dailyLimit` (a video counts 5), `media.maxPerRequest`, `media.concurrency` (jobs at once, default 3).
- To make an agent use it well, put the house style for prompts in its skill (e.g. `prompts-visuales`), and which model to prefer for which piece.

## Everything else

- `npm run check` is the loop. Run it after any change to code; fix what is red.
- `README.md` says what the product does. Keep it true to the code.
- Release: `node scripts/release.mjs --push` (owner only).
