# Auditoría de Dimitri — 27 de octubre de 2026

**Pedido del dueño** (la noche del 26 al 27): que Dimitri conozca la oficina «en detalle, absolutamente todo» (cómo se crea una tarea, cómo se ajusta, cómo se publica, cada parámetro del Estudio, dónde están las skills y la biblioteca de cada jefe), que sepa **quién completó una tarea y quién hizo cada acción** (un agente, un equipo o una persona), que pueda **encontrar** campañas, calendarios, contenidos, imágenes y videos para analizarlos, que **hable de forma natural, clara y corta** (esa mañana recibió «un reporte enorme, difícil de entender»), que se vea **qué IA usa y cómo cambiarla**, que tenga **acceso a los conectores y pueda hacer lo que hace un agente**, y que el **Cerebro** deje escribir, editar y borrar notas propias y pedirle a Dimitri que añada información a una nota. Y que BRIAN (el asistente de D'CASA) sirva de espejo.

**Cómo se hizo.** Leí cómo funciona hoy: el prompt (`sub-core.mjs → systemPrompt`), los datos que recibe (`cloudflare/worker/lib/dimitri/datos.js`, `serve.mjs → subChatRun`), el modelo (`dimitri/modelo.js`, `agentes/llm.js`, `modelos-core.mjs`), sus ops, el informe del lunes y las pantallas (escritorio y celular). Y estudié BRIAN en un clon de solo lectura de `dcasapty/d_casa_new_word` (`docs/BRIAN.md`, `CONTEXTO_AGENTICO.md`, `GUIA.md`, `addons/dcasa_brian/`). **No se copió código de BRIAN**: se tomaron sus ideas.

## Lo que BRIAN hace bien y qué se tomó

| BRIAN | En Agents Office |
|---|---|
| Un **catálogo de herramientas** (verbo + objeto, pocos parámetros, resultados compactos ya formateados, errores que dicen cómo corregir) en vez de meterle todo al prompt | `consultas-core.mjs` + `cloudflare/worker/lib/dimitri/consultas.js`: 18 herramientas de lectura |
| **Niveles de permiso** (lectura · construcción · sensible · prohibido) y lo prohibido «no existe como herramienta» | Dimitri solo **lee** por sus herramientas; lo que cambia algo es una tarjeta con el clic del dueño (`sub.OPS`); no existe una herramienta para aprobar, enviar, publicar, pagar ni borrar |
| Una **guía del negocio** (`dcasa_guia`): qué logras, dónde queda, los pasos, buscada sin tildes y con las palabras de la gente, y una herramienta `buscar_en_guia` | `guia-oficina.mjs`: 45 entradas, buscada por cada mensaje (`<guia>`), con índice siempre en el prompt y la herramienta `buscar_en_guia` |
| **Ver a Brian trabajar**: cada paso del turno («Buscando productos…», con lo que tardó) y «Usó N herramientas» | pasos en vivo (NDJSON `paso`) y «Consulté N cosas» en escritorio y celular |
| Prompt **corto, de voz propia** («la voz del pana que sabe de casas: claro, cálido y breve… cierra con el siguiente paso»), fijo + variable | bloque **CÓMO HABLAS** primero en el prompt; el resto se parte en `fijo` / `variable` |
| **Caché de prompts** (marca en lo fijo): cada paso relee lo anterior a ~10 % del precio | la parte fija lleva `cache_control`; con consultas, cada vuelta cuesta una fracción |
| «**Para cada función nueva**: debe poder usarla Brian» (plantilla de PR) | regla nueva en `CLAUDE.md` + `tests/guia-oficina.test.mjs` falla si una vista no tiene entrada en la guía |
| Dice **con qué modelo corre** y se configura (`BRIAN_PROVEEDOR`/`MODELO`) | «Corres con …» en el prompt, «IA: …» en la cabecera, `ia` en `GET /api/sub` y en cada respuesta |
| Pastillas de estado (consumo de IA del mes, Telegram, MCP) | **pendiente** (P4) |
| Preselección de herramientas por mensaje para modelos pequeños | **pendiente** (P5): hoy son 18 y se ofrecen todas |

## Hallazgos

Estado: ✅ hecho (con prueba) · ⏳ pendiente (con su fase).

### Críticos

- ✅ **DIM2-01 · No conocía la oficina por dentro.** Solo tenía el `MAPA` (14 líneas) y la sección OPS. Nada de «cómo se crea / ajusta una tarea», «cómo se publica», «qué ajustes tiene cada modelo del Estudio», «dónde está la biblioteca de habilidades». Por eso hoy no supo contestar dónde están las skills de cada jefe. → `guia-oficina.mjs` (45 temas) entra por mensaje (`guiaPara`) y por herramienta; `tests/guia-oficina.test.mjs` prueba 13 preguntas reales del dueño.
- ✅ **DIM2-02 · No veía las skills ni la Biblioteca de ningún jefe.** En la nube, `conversar.js` pasaba `skillsOf: () => []`; en local veía las skills pero no los métodos de la Biblioteca. → el roster de su prompt trae las skills de cada agente y los métodos de la Biblioteca de cada jefe (`habilidadesOf`); `ver_agente` da la ficha completa (brief, modelo, skills, métodos, lecciones, calidad, últimas tareas).
- ✅ **DIM2-03 · Una sola llamada y sin consultas.** Todo lo que sabía tenía que venir precargado (~40 lecturas a D1 por turno); no podía buscar una tarea vieja, la bitácora, una imagen concreta, el detalle de una campaña, los costos ni una nota fuera de las 4 más parecidas. → un bucle corto (máx. 6 llamadas al modelo y 10 consultas por turno; la última vuelta va sin herramientas para que conteste) con 18 herramientas de lectura. **Solo en la nube**: la oficina de la computadora usa Claude Code como proceso y no tiene el bucle todavía (P1).
- ✅ **DIM2-04 · No sabía «quién hizo qué».** Solo veía los 8 últimos resultados. → `buscar_tareas` dice quién la tiene o la hizo, `ver_tarea` trae la bitácora (quién cambió qué y cuándo) y `historial_reciente` lista los movimientos de los últimos días por agente, equipo o persona.

### Altos

- ✅ **DIM2-05 · La voz.** El contrato decía «sé breve» pero dejaba ~220 palabras al análisis, y el informe del lunes pedía 180–260 palabras en cuatro secciones: de ahí «el reporte enorme». → bloque **CÓMO HABLAS** (respuesta primero, palabras sencillas, ~120 palabras de tope, nada de informes ni tablas, cierre con el siguiente paso); el resumen del lunes pasó a **≤ 110 palabras, sin títulos**, con lo que importa y una sola recomendación (`sub.informeSistema` / `informePedido`, en la nube y en local).
- ✅ **DIM2-06 · No sabía qué IA era.** Corre con el modelo de «Dimitri (chat, plan, estudio)» de Ajustes → Modelos (si nadie lo asignó, el valor por defecto de la oficina: Sonnet). → ahora lo sabe y lo dice, lo enseña la cabecera («IA: Claude Sonnet 5.5 · cambiar»; en el celular, en el saludo) y cada respuesta guarda con qué IA se contestó. Cambiarla ya se podía; ahora se ve dónde.
- ✅ **DIM2-07 · Sin conectores.** El prompt decía «tú no puedes llamarlos». → `ver_conectores`, `ver_herramientas_conector` y `usar_conector`: solo **herramientas de lectura** (la lista de lectura del conector + un verbo de lectura + el guardián con `writes:false`), a lo sumo 3 conectores y 6 llamadas por turno, y lo que devuelven pasa por el escudo contra órdenes escondidas. **No escribe ni envía por ahí** (ver P2).
- ✅ **DIM2-08 · El Cerebro no se escribía.** Solo se podía subir un documento; `deletable` era verdadero solo para las entregas de los agentes; en la nube ni eso (no había papelera). → escribir, editar y mandar a la papelera **cualquier nota**, en escritorio y celular, local y nube (`notas-core.mjs`, `cerebro-local.mjs`, `cerebro.js`, migración `0100_notas_papelera.sql`); la papelera guarda 30 días y devuelve la nota a su carpeta; editar no pisa lo que otra persona cambió (`base`/`modified` → 409); Dimitri **crea** una nota o **añade** a una (`nota_crear`, `nota_agregar`), con el clic del dueño y DESHACER; **no** puede reemplazar ni borrar. Límite conocido: en la nube, una nota nueva con `[[enlaces]]` aparece como neurona suelta hasta recalcular el mapa (P8).

### Medios

- ✅ **DIM2-09 · No se veía qué leía.** → pasos en vivo y guardados («Consulté 3 cosas · Claude Sonnet 5.5» desplegable).
- ✅ **DIM2-10 · Costo.** ~16.000 caracteres de prompt en cada turno, sin caché. → la parte fija (95 %) lleva `cache_control`; no depende de la hora ni del mensaje (`tests/dimitri-auditoria.test.mjs` lo prueba). **Falta medir el ahorro con una factura real.**
- ✅ **DIM2-11 · Sin margen en el prompt** (15.921 de 16.000). Se reordenó; el tope del test pasó a 19.000 (lo fijo mide ~18.200) y está dicho en el test.
- ✅ **DIM2-12 · Un modelo sin herramientas** (Muse Spark) no puede consultar. Contesta con lo que hay en el prompt (`<estado>`, `<notas>`, `<guia>`), el prompt se lo dice, y la cabecera dice «solo conversa».
- ✅ **DIM2-13 · No había regla «función nueva → guía».** → `CLAUDE.md` y `tests/guia-oficina.test.mjs` (`COBERTURA`).

## Lo que Dimitri puede y no puede hacer ahora

| Puede (nube) | No puede, a propósito |
|---|---|
| Contestar con 18 consultas de lectura: guía, tareas y su bitácora, agentes, equipo, Cerebro, Contenido, anuncios, analíticas, galería, rutinas, costos, aprobaciones y conectores | Aprobar, enviar, publicar, pagar ni borrar |
| Proponer planes, cambios del calendario y de las tareas, creativos del Estudio, **y notas** (crear / añadir) — con tu clic y DESHACER | Gastar sin tu GENERAR o tus dos clics; reemplazar una nota |
| Leer con los conectores del equipo (solo herramientas de lectura) | Escribir o enviar con un conector (sale del alcance de un chat: ver P2) |
| Decir con qué IA corre y dónde se cambia | |

«Hacer lo que hace un agente»: Dimitri ya hace lo que un agente hace **en lectura y análisis** (consulta, compara, resume, redacta y deja el resultado en una nota). Lo que un agente hace con aprobación —enviar un correo, publicar, pagar— sigue pasando por el mismo candado (borrador → tu OK → guardián), porque ese candado es lo que te protege; se propone P2 para que Dimitri pueda *proponer* ese envío directamente con tu clic.

## Plan

| Fase | Qué | Estado |
|---|---|---|
| **D0 (esta noche)** | Guía, consultas, voz, resumen corto, IA visible, conectores de lectura, pasos visibles, caché, Cerebro editable y notas con Dimitri | ✅ desplegado con esta auditoría |
| **D1** | **P1** Dimitri local con consultas (hoy tiene la guía, la voz, el informe corto y las ops de notas, pero no el bucle). **P3** evaluaciones con el modelo real: 30 preguntas del dueño («¿dónde está la biblioteca?», «¿quién hizo la tarea X?», «analiza esta campaña») con un juez, como `scripts/evals-skill.mjs` | ⏳ |
| **D2** | **P2** Dimitri propone un envío por un conector (correo, mensaje) y lo hace el servidor al pulsar «Enviar» (guardián con `writes:true` solo para esa llamada, destinatarios = los del borrador). **P4** pastillas de estado en su cabecera (gasto de IA del mes, conectores) | ⏳ |
| **D3** | **P5** preselección de herramientas por mensaje para modelos pequeños. **P6** leer adjuntos (Excel, PDF) en el chat. **P7** renombrar conversaciones. **P8** recalcular los enlaces del mapa de la nube al guardar una nota | ⏳ |

## Cómo comprobarlo

```bash
node --test tests/guia-oficina.test.mjs tests/dimitri-auditoria.test.mjs tests/cerebro-escribir.test.mjs
node --test cloudflare/tests/dimitri-consultas.test.mjs cloudflare/tests/cerebro-escribir.test.mjs
npm run check
```

Y a mano, en la nube, con Dimitri: «¿dónde está la biblioteca de habilidades de cada jefe?», «¿quién completó la última tarea de Marketing?», «¿qué parámetros tiene el modelo de video?», «¿qué IA estás usando?», «anota en una nota nueva lo que decidimos hoy», «añade a la nota *precios* que el combo vale lo que diga la cifra». Se ve cada consulta mientras piensa, y debajo de la respuesta, «Consulté N cosas».

## Notas honestas

- **No se probó contra un modelo real.** Las pruebas usan un modelo de mentira que *pide* herramientas (13 casos en `cloudflare/tests/dimitri-consultas.test.mjs`); cuánto las usa y qué tan bien responde Claude de verdad se ve con P3.
- Las pruebas de navegador del celular y del Cerebro de escritorio no se corrieron esta noche; los botones nuevos siguen las reglas de `CLAUDE.md` (44 px, 16 px) pero hay que mirarlos en el teléfono.
- La página de escritorio quedó a ~5 KB de su tope de 2,2 MB; lo siguiente que crezca va en un paquete aparte.
