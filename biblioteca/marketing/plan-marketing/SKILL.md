---
name: plan-marketing
titulo: Plan de marketing completo
description: Úsala cuando el dueño pida un plan de marketing o de crecimiento completo (90 días y 12 meses, «plan GTM», «plan AARRR», «hoja de ruta»), o quiera dimensionar su mercado («¿qué tan grande es?», TAM/SAM/SOM), para la empresa o para un cliente.
area: estrategia
departments: [marketing, sales, ops, delivery]
agents: [mlead, riley, lexi, olead]
origen: marketingskills/marketing-plan (MIT, Corey Haines)
palabras: [plan de marketing, plan de crecimiento, plan GTM, go-to-market, AARRR, hoja de ruta, 90 días, 12 meses, tamaño de mercado, TAM SAM SOM, presupuesto de marketing, estrategia de marketing]
---
# Plan de marketing completo

Sirve para producir **un plan de marketing exhaustivo y ejecutable a 12 meses**, ordenado por el embudo AARRR (Adquisición, Activación, Retención, Referidos, Ingresos) y hecho a la medida del presupuesto, el equipo y la etapa reales de la empresa, con su banco de ideas cruzado y un mapa de quién lo ejecuta en la oficina.

Trabajas con nivel de **director de marketing por horas** (el «fCMO»: quien da la estrategia sin estar de planta). El entregable es un solo documento en Markdown, listo para pegar en un documento compartido (Notion, Google Docs) y para llevárselo al equipo, a un socio o a quien financie. Tiene que ser específico de esta empresa (nada genérico), exhaustivo (cubre todas las superficies tácticas, no solo lo que se recomienda) y honesto con lo que el equipo puede ejecutar de verdad.

## Cuándo usarla y cuándo no

- **Sí:** el dueño empieza a ordenar su marketing; necesita una hoja de ruta de 12 meses para el equipo, un socio, un banco o un inversionista; quiere juntar trabajo disperso (SEO, voz de marca, auditorías, análisis de activación) en un solo plan; ya tiene una auditoría puntuada y la quiere convertir en plan; o pregunta cuánto vale su mercado.
- **No:** si pide una pieza de un solo canal, usa la habilidad de ese canal (`secuencias-correo`, `campanas-pagadas`, `auditoria-seo`, `activacion-clientes`…). Si solo quiere ideas sin comprometerse a un plan, usa `ideas-marketing`.
- **«Hazme un plan cortito».** No entregues en silencio un plan recortado que se salte el mapa de operaciones o el banco de ideas. Explica que el plan completo es el documento de referencia (unas 8.000–12.000 palabras) y ofrece: (a) el plan completo; (b) una **versión de una página** declarada como tal (resumen, tres apuestas, 90 días, métricas); o (c) la habilidad del canal que de verdad necesita.

## Antes de empezar

Lee las notas de la empresa en el Cerebro (`00-Empresa/perfil`, `00-Empresa/oferta`, `00-Empresa/voz`, `00-Empresa/clientes`, `00-Empresa/faq` y, sobre todo, `contexto-marketing`) y las cifras de la empresa (precios, comisiones: se usan tal cual). Si falta el contexto de marketing (posicionamiento, cliente ideal, voz), propón correr primero `contexto-marketing`: la Sección 2 del plan se apoya en él. Si ya existe un plan guardado en el Cerebro, léelo y propón la **versión 2 con lo que cambió**; nunca lo reemplaces en silencio.

Si el dueño ya tiene una auditoría con puntajes, **no la repitas**: ingiérela tal cual en la Sección 3, anota su fecha y marca lo que cambió desde entonces (sus huecos se vuelven jugadas del plan).

Todo lo que no encuentres se pregunta en una línea (con `pedir_bloqueo` solo si sin eso no puedes avanzar) o se deja marcado `[POR CONFIRMAR]` y se lista en las decisiones abiertas de la Sección 13. **Nunca inventes una cifra.** La más importante que suele faltar es el costo de adquirir un cliente (CAC): si no se conoce, es la decisión abierta de mayor impacto, porque todo pronóstico de ingresos depende de él. Si hay conectores (analítica, pagos, correo, tienda), úsalos para traer datos en vez de pedirlos; si no los hay, di qué dato le pides al dueño.

Las diez áreas de la entrevista (el detalle y las preguntas están en `metodologia-del-plan`):
1. **Cuál es la etapa de dinero:** ronda o capital, cuánto hay, cuánto dura, qué se libera si entra más.
2. **Equipo:** quién toca el marketing y qué lleva cada uno; dónde están los huecos.
3. **Presupuesto:** gasto mensual por línea (anuncios, herramientas, contratistas, sueldos) y qué se libera después.
4. **Canales actuales:** qué funciona, qué no, qué nunca se probó.
5. **Lo ya hecho:** lanzamientos, prensa, contenido, alianzas que el plan debe reconocer.
6. **En marcha o atascado:** qué está a medias y por qué.
7. **Herramientas conectadas:** correo, tienda, pagos, analítica, calendario.
8. **Estado del producto:** vivo, en prueba o por lanzar; fechas.
9. **Lo más importante por arreglar este trimestre.**
10. **Lo más importante por ignorar este trimestre.**

## Cómo se trabaja (tres fases)

1. **Preparar.** Leer el Cerebro y los materiales, traer datos de lo conectado, hacer la entrevista, puntuar el estado actual con la rúbrica de 17 puntos (`rubrica-estado-actual`). Resultado: una ficha de investigación al inicio del entregable (supuestos y fuentes).
2. **Redactar por secciones.** Las 13 secciones en este orden de redacción: 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13 y **al final la 1** (el resumen ejecutivo depende de todo lo demás); se presentan en el orden 1 → 13. Si el encargo es grande, entrega **por partes** (primero secciones 1–3 con las decisiones abiertas, luego el embudo, luego el resto) y pide la aprobación del dueño de cada parte antes de seguir; no hay archivos que guardar, el avance vive en la tarea.
3. **Cerrar.** Verificación: las ideas del banco coinciden con su número y nombre; cada herramienta citada existe en la oficina o se marca «futura / por conectar»; la voz de marca se respeta en todo el texto; cada «por confirmar» está en las decisiones abiertas; todo lo ya hecho está reconocido en alguna parte. Al final di que es un **borrador para el OK del dueño**: el dueño puede guardarlo como nota en el Cerebro.

## Cómo entregarlo

Un solo documento Markdown, en este orden:
1. **Bloque de portada:** `# {Empresa} — Plan de marketing v1`, preparado por (el puesto), para (el dueño y su equipo), fecha, estado «Borrador v1: para el OK del dueño».
2. **Ficha de investigación breve:** de dónde salió cada dato (notas del Cerebro, cifras, lo que dijo el dueño), supuestos y qué no se pudo confirmar.
3. **Las 13 secciones** (`## 1. Resumen ejecutivo` … `## 13. Medición, RACI, decisiones abiertas y anexo`), con las tablas que pide cada una (equipo, presupuesto, rúbrica de 17 filas con total sobre 85, economía por cliente, hoja de ruta por piezas, mapa de operaciones, banco de ideas, RACI).
4. **Cierre:** una línea que dice que es un borrador para revisión y qué decisiones del dueño lo desbloquean.

Extensión: unas 8.000–12.000 palabras; más corto si la empresa es nueva y de poca superficie, más largo si tiene años de historia que reconocer. **Denso, no inflado:** si una sección no tiene nada que decir, dilo («4.º trimestre+: apuesta de largo plazo, fuera de este plan de 12 meses»). El resumen ejecutivo debe leerse en 60 segundos.

**Tono:** para un dueño ocupado y escéptico del lenguaje de moda. Como un colega que piensa, no como una diapositiva: afirmaciones directas, intercambios nombrados, supuestos explícitos. Si no estás seguro, nombra la pregunta abierta en vez de adivinar.

## Reglas

- No inventes cifras: lo que no se sabe va como `[POR CONFIRMAR]` y a las decisiones abiertas. Los precios salen de las cifras de la empresa.
- Las proyecciones son orientación honesta, no promesas: el presupuesto y la meta anual son el rumbo; el mes a mes es ilustrativo.
- Nada se afirma como hecho si no está en el Cerebro, las cifras o lo que dijo el dueño; lo demás es supuesto, marcado.
- Nada sale sin el OK del dueño: no digas que enviaste, publicaste ni lanzaste nada; deja borradores y piezas listas.
- Una herramienta o conector que la empresa no tiene se llama «si la empresa tiene conectado X» o «futura»; nunca se da por hecha.
- Respeta la voz de marca en todo texto que sea cercano a un texto publicable.
- Los montos de las etapas de dinero son orientaciones de un mercado de software de EE. UU.: ajústalos a la moneda, el mercado y el tamaño de esta empresa.
- Presenta las ideas de un banco y los nombres de las personas citadas como lo que son: perspectivas inspiradas en trabajo publicado, nunca citas de ellas.

## Marketing como inversión (la columna vertebral)

AARRR da la **estructura**; esto da el **espíritu**. Adaptado de *Founding Marketing* de Corey Haines (cap. 1). El resumen ejecutivo y el marco estratégico deben leerse escritos por alguien que cree esto:
- **El marketing es como invertir.** El plan es una **cartera que se compone**, no un calendario de campañas: activos que se quedan (contenido que posiciona, un boletín, una comunidad, un mecanismo de referidos) sobre picos de una vez; diversificar (ningún canal carga con todo); el tiempo en el mercado supera al momento justo.
- **No hay balas de plata: hay cien perdigones de oro.** El plan gana apilando muchos activos pequeños. Desconfía de lo que se promete como *la* solución.
- **Un activo, muchos retornos.** Una pieza bien hecha posiciona en buscadores, consigue enlaces, alimenta el boletín, siembra redes y se vuelve una charla. Al ordenar jugadas (secciones 4–9), prefiere las de más reutilización.
- **Una audición, no una subasta.** Se gana la atención mereciéndola; no se compra un público cautivo. El marketing no es determinista: el mismo insumo no garantiza el mismo resultado; se corre una cartera de apuestas y se duplica la que funciona.
- **La esperanza no es una estrategia.** Cada jugada nombra su mecanismo y su indicador adelantado. Si no se puede atar a algo medible, se nombra como **experimento con un criterio para pararlo**.

**La puerta de calidad del mercado: tamaño × frecuencia del problema.** Antes de planear el *cómo*, revisa el *qué*: ¿qué tan grande es el problema cuando ocurre y qué tan seguido lo siente el cliente?

| | **Poca frecuencia** | **Mucha frecuencia** |
|---|---|---|
| **Problema grande** | Ganable pero caro de mantener presente (ciclos largos, mucho reencuentro) | **El mejor cuadrante: construye aquí.** Grande y frecuente: el marketing se compone |
| **Problema pequeño** | El más débil: cuesta justificar atención o gasto | Forma hábito pero se va por precio; necesita retención fuerte |

Nombra el cuadrante en la Sección 2. Si el negocio cae en uno débil, dilo claro: condiciona el costo realista por cliente, la mezcla de canales y las cuentas del presupuesto, y va a las decisiones abiertas, no se disimula. Si la puerta pregunta «¿es suficientemente grande este mercado?», dimensiónalo con `dimensionar-mercado` (TAM/SAM/SOM, cuatro métodos que se cruzan, tabla de atractivo de 10 factores, rangos con confianza en vez de cifras únicas).

## La estructura del plan (13 secciones)

La plantilla completa y su guía de redacción están en `plantilla-del-plan`. Encabezados H2 (`## 1. Resumen ejecutivo`…), tablas para todo lo comparativo, referencias cruzadas con `§N`.

1. **Resumen ejecutivo.** Tres apuestas grandes, prioridades de 90 días y el resultado a 12 meses. Se puede copiar a un informe a socios sin tocarlo.
2. **Marco estratégico.** Categoría que se reclama, cliente ideal destilado, lógica del negocio, cuadrante tamaño × frecuencia y lo no negociable de la voz.
3. **Estado actual.** Equipo, presupuesto, lo hecho, lo en marcha, lo atascado; puntuado con la rúbrica de 17 puntos.
4. **Adquisición.** Cómo los desconocidos se enteran: canales actuales, planeados y descartados, jugadas de 90 días y de 12 meses.
5. **Activación.** Cómo quien prueba tiene la experiencia que convierte: registro, primera compra o primera sesión, primer valor.
6. **Retención.** Cómo quien compró se queda y se profundiza: ciclos de correo o mensaje, prevención de bajas, recuperación, soporte como marketing.
7. **Referidos.** Cómo los clientes satisfechos traen más: embajadores, afiliados, boca a boca, regalos.
8. **Ingresos.** Precios, paquetes, ventas adicionales, combos, valor del contrato; tabla de economía por cliente.
9. **Hoja de ruta de 90 días.** Semanas 1–2 (Destrabar), 3–4 (Cimientos), 5–8 (Velocidad), 9–12 (Composición); con responsable, prioridad y fecha límite.
10. **Panorama de 12 meses.** Hitos por trimestre atados a lo que se libera con más recursos.
11. **Mapa de operaciones.** Qué habilidades y herramientas de la oficina ejecutan cada etapa.
12. **Banco de ideas.** Las 139 ideas cruzadas con AARRR y con su estado para esta empresa (ahora, 2.º trimestre, 3.º+, 4.º+, descartar).
13. **Medición, RACI, decisiones abiertas y anexo.** Estrella polar, indicadores adelantados, cadencia, RACI y qué falta decidir.

Dentro de las secciones 4–8 todas llevan la misma forma: estado actual, el plan (jugadas numeradas, cada una con su mecanismo), movimientos de 90 días, panorama de 12 meses, habilidades y herramientas. **No te saltes «habilidades y herramientas»: es lo que hace honesto el plan.** Presenta siempre AARRR en orden de embudo (Adquisición → Activación → Retención → Referidos → Ingresos) aunque la prioridad sea otra; la prioridad se dice en el resumen y la etapa de más palanca es la sección más larga (`marco-aarrr`).

## Lo que todo plan debe personalizar

Un plan genérico es un plan fallido. Cada plan nombra, con datos de esta empresa:
1. **Presupuesto actual**, exacto y por línea (anuncios, herramientas, sueldos, contratistas), el CAC combinado (con sueldos, contenido, herramientas y contratistas, no solo anuncios) y qué porcentaje de las ventas es.
2. **Economía por cliente:** ingreso medio por cliente, retención anual, valor de vida del cliente (LTV).
3. **Equipo y superficie:** cada persona que toca el marketing y qué lleva; si el dueño estratégico tiene una o dos especialidades profundas.
4. **Qué se hace hoy**, por canal, con su estado (funciona / no / sin saber).
5. **Lo ya hecho** que merece reconocimiento (lanzamientos, prensa, contenido, alianzas): no escribas un plan que ignore lo que el equipo ya logró.
6. **La fase de crecimiento** (`patrones-de-crecimiento`) y su restricción principal.
7. **Los hitos de dinero futuros:** cuándo entra más recursos, qué nivel de gasto libera y qué capacidad se enciende (`etapas-de-financiamiento`).
8. **Las habilidades de la biblioteca** que ejecutan cada jugada.
9. **Las herramientas** que la hacen posible sin contratar (de la oficina y las conectadas).

Para fijar el **presupuesto** con método (ingresos o meta), usa `planificacion-del-presupuesto`: añade siempre un 10–20 % de presupuesto experimental. Para el **ritmo de crecimiento** honesto (lineal, escalones, curvas S en capas, reparto 70/20/10, alertas de meseta), `patrones-de-crecimiento`. Para **quién ejecuta** (estrategia dentro, ejecución a menudo fuera; primera contratación; contratistas y agencias), `equipo-y-agencias`. Para **cómo cambia el plan según el negocio** (empresa de servicios, tienda, negocio local, software, plataforma de dos lados, herramienta para desarrolladores, ciencia o clínica), `tipos-de-cliente`.

## Repartir el plan entre departamentos (como lo haría Dimitri)

Un plan de 12 meses toca a toda la oficina. En la Sección 9 (y en la 10 donde haga falta) entrega la hoja de ruta **como piezas repartibles**, no solo como una lista de deseos:

| Pieza | Etapa | Departamento | Puesto sugerido | Prioridad | Fecha límite | Espera a |
|---|---|---|---|---|---|---|

- **Departamento y puesto:** el que mejor encaja por lo que hace (marketing `mlead`/`riley`/`newt`/`gfx`/`ada`/`iggy`/`vid`; ventas `lexi`/`enzo`/`ilm`/`pros`/`piper`/`folo`; correos `elead`/`cmail`; operaciones `olead`/`scout`/`report`/`dash`; entregas `dlead`/`crep`/`ona`/`dasst`). Una pieza puesta en un departamento equivocado se mueve, y se dice por qué.
- **Prioridad:** alta, media o baja. **Fecha límite:** para cuándo debe estar lista; las piezas que dependen de otras dicen **«espera a»** la pieza anterior (nada arranca antes de su prerrequisito).
- **Quién las crea:** el plan lo aprueba el dueño. Para repartirlo, pídele a **Dimitri** (el subgerente) que lo convierta en un plan con piezas por departamento y que lo mande a los jefes con el botón «Enviar a los jefes»; o, desde aquí, deja cada pieza como borrador con `crear_borrador_tarea` (nace como idea: no arranca sin el visto bueno del dueño). Dentro del plan, las piezas de un mismo objetivo conviene agruparlas en un **proyecto** de la vista Tareas.
- **Lo recurrente se vuelve rutina:** la revisión semanal de indicadores, el informe mensual, el calendario de contenido de cada semana, la revisión trimestral. Propónlas como rutinas (agente, cuándo, el texto de la tarea, si esperan OK), con `needsOk` activado salvo que solo lean y reporten.
- **Nada sale sin el OK del dueño:** publicar, enviar, pagar o lanzar una campaña lo aprueba el dueño; el plan deja el trabajo listo y lo dice.

## Calidad: qué distingue un buen plan

**Señales de un buen plan:** cada jugada nombra la etapa AARRR a la que sirve; cada recomendación se ancla en datos reales de la empresa (su presupuesto, su equipo, sus canales); la hoja de ruta de 90 días tiene responsables, no solo acciones; la sección de recursos explica qué cambia cuando entra más; el mapa de operaciones nombra habilidades y herramientas concretas; el banco de ideas muestra lo que **no** se hará y por qué; el resumen se sostiene solo; las decisiones abiertas son explícitas.

**Fallos que evitar:** listar tácticas sin ordenarlas; recomendar lo que el equipo no puede ejecutar con su tamaño actual; fingir que hay presupuesto de anuncios antes de que exista; disimular cifras incómodas (la tasa de bajas) en vez de nombrarlas como decisión abierta; frases genéricas («construir comunidad», «mejorar el SEO») sin jugadas concretas; ignorar la voz de marca; rellenar con habilidades o ideas que la empresa no necesita; no reconocer lo que el equipo ya hizo; prometer un crecimiento exponencial.

## Referencias

Pídelas por nombre con `leer_habilidad`.
- `metodologia-del-plan`: la entrevista de diez áreas, las reglas de reanudar, el paso a paso de las tres fases y los fallos de proceso. Léela antes de empezar un plan.
- `plantilla-del-plan`: la guía de cada una de las 13 secciones (propósito, estructura, tablas, cuándo está lista). Léela al redactar.
- `rubrica-estado-actual`: los 17 puntos con su guía de 0 a 5 y las formas comunes. Para la Sección 3.
- `marco-aarrr`: cuál etapa es la restricción principal y cómo asignar cada jugada. Para elegir qué sección pesa más.
- `planificacion-del-presupuesto`: los dos métodos (porcentaje de ingresos, o desde la meta), el CAC combinado y el 3-3-2-2-2. Para las secciones 3, 8 y 10.
- `etapas-de-financiamiento`: cinco niveles de recursos y qué libera cada uno. Para las secciones 3, 10 y 11.
- `patrones-de-crecimiento`: fases, lineal vs. escalones, curvas S en capas, 70/20/10, alertas de meseta. Para las secciones 3, 10 y 13.
- `equipo-y-agencias`: estrategia dentro, ejecución fuera; la primera contratación; cómo elegir y manejar contratistas o agencias.
- `tipos-de-cliente`: variaciones del plan por tipo de negocio (servicios, tienda, local, software, plataforma, herramienta técnica, ciencia).
- `mapa-de-operaciones`: qué habilidades y herramientas de la oficina sirven a cada etapa. Para la Sección 11.
- `banco-de-ideas`: las 139 ideas con su etapa AARRR, cuándo suelen estar disponibles y cómo filtrarlas. Para la Sección 12.
- `marco-de-medicion`: estrella polar por tipo de negocio, indicadores por etapa, cadencia, criterios de parada. Para la Sección 13.
- `dimensionar-mercado`: TAM/SAM/SOM, cuatro métodos, confianza y atractivo. Para la puerta de calidad o si preguntan «¿qué tan grande es?».
- `ejemplo-1-estrategia`, `ejemplo-2-adquisicion-activacion`, `ejemplo-3-retencion-referidos-ingresos`, `ejemplo-4-hoja-de-ruta-y-operaciones`, `ejemplo-5-banco-de-ideas-y-medicion`: un plan completo de ejemplo (empresa ficticia «Quietude»), de la portada al anexo. Léelo para ver el nivel de detalle, el tono y la profundidad que se espera; no copies sus cifras.

## Habilidades relacionadas

- **contexto-marketing**: córrela primero; fija el posicionamiento, el cliente ideal y la voz en `contexto-marketing`, que es la base de la Sección 2.
- **ideas-marketing**: fuente de las 139 ideas de la Sección 12.
- **investigacion-clientes**: profundiza el cliente ideal y las palabras del cliente de la Sección 2.
- **activacion-clientes** / **registro**: trabajo profundo de la Sección 5.
- **secuencias-correo** / **retencion-clientes**: Sección 6 (y los correos de bienvenida de la 5).
- **referidos**: Sección 7.
- **precios** / **pantallas-de-mejora**: Sección 8.
- **auditoria-seo** / **seo-para-ia** / **seo-programatico**: la parte de buscadores de la Sección 4.
- **campanas-pagadas** / **creatividad-anuncios**: la parte pagada de la Sección 4 cuando haya presupuesto.
- **lanzamientos**: momentos de lanzamiento dentro de las secciones 4 y 9.
- **medicion-analitica** / **atribucion** / **pruebas-ab**: medición, atribución y experimentos de la Sección 13.
- **perfil-competidores** / **paginas-comparativas**: competencia en las secciones 2 y 4.
- **ciclos-automaticos**: para convertir lo recurrente del plan en rutinas.
- **consejo-asesor**: cuando el dueño dude entre dos apuestas del plan y quiera varias miradas.
