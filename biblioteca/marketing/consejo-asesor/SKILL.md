---
name: consejo-asesor
titulo: Consejo asesor de marketing
description: Úsala cuando el dueño quiera varias miradas expertas sobre una decisión de marketing («que lo revise el consejo», «¿qué diría Ogilvy?», «debatan esto»): perspectivas inspiradas en grandes autores, dónde chocan y una recomendación.
area: estrategia
departments: [marketing]
agents: [mlead, riley]
origen: marketingskills/marketing-council (MIT, Corey Haines)
---
# Consejo asesor de marketing

Sirve para reunir un **consejo asesor simulado**: perspectivas inspiradas en el trabajo publicado de grandes autores de marketing, aplicadas al problema concreto del dueño. El valor no está en ninguna opinión suelta sino en el **desacuerdo**: el banco está armado con miradas que chocan de forma útil, para que el dueño vea los costos reales de cada camino antes de elegir.

**Es una simulación, no las personas reales.** Cada perspectiva se apoya en lo que el autor escribió o dijo públicamente (ver «Reglas de fundamento»). Ningún asesor «habla»: el agente expone cómo se vería el caso desde los marcos publicados de esa persona.

## Antes de empezar

Lee las notas de la empresa en el Cerebro (`00-Empresa/perfil`, `00-Empresa/oferta`, `00-Empresa/clientes`, `00-Empresa/voz` y, sobre todo, `00-Empresa/marketing`) y las cifras de la empresa (precios, márgenes, comisiones: se usan tal cual). Si falta algo que necesitas, pregúntalo en una línea o déjalo marcado como supuesto; nunca lo inventes.

Después aclara solo lo que falte:
1. **La pregunta**: qué decisión o qué trabajo revisa el consejo (una estrategia, una página, un cambio de precio, un plan de lanzamiento, un cambio de marca, una cuenta de anuncios, el menú de un restaurante, la vitrina de una tienda).
2. **Lo que está en juego**: qué pasa si sale bien o mal y qué se ha probado ya.
3. **La modalidad**: opinión rápida, sesión del consejo o consejo completo (abajo). Por defecto: sesión del consejo.

Si la pregunta es grande o el dueño no la ha planteado bien, usa `pedir_bloqueo` para pedirle el dato que falta en vez de suponer.

## Modalidades

| Modalidad | Asientos | Cuándo |
|---|---|---|
| **Opinión rápida** | 1 asesor | «¿Qué diría Ogilvy de este titular?»: un asesor nombrado |
| **Sesión del consejo** (por defecto) | 3–5 asesores | Una decisión real que gana con miradas en conflicto |
| **Consejo completo** | Los 12 | Decisiones estratégicas mayores; la entrega es larga, ofrécelo solo cuando lo que está en juego lo justifique |

## El banco

Doce perspectivas elegidas para que choquen. Los expedientes completos están en `referencias/`: lee **solo** los de los asesores sentados.

| Perspectiva inspirada en… | Lente | Expediente |
|---|---|---|
| **Seth Godin** | Ser notable, el permiso, la audiencia mínima viable | `asesor-seth-godin.md` |
| **David Ogilvy** | Publicidad de marca basada en investigación, con disciplina de respuesta directa | `asesor-david-ogilvy.md` |
| **Eugene Schwartz** | Canalizar el deseo que ya existe; etapas de conciencia y de sofisticación | `asesor-eugene-schwartz.md` |
| **Claude Hopkins** | Publicidad científica: probarlo todo, dar razones para comprar | `asesor-claude-hopkins.md` |
| **Gary Halbert** | La multitud hambrienta: mercado y lista antes que producto y texto | `asesor-gary-halbert.md` |
| **Russell Brunson** | Embudos, escalera de valor, gancho-historia-oferta | `asesor-russell-brunson.md` |
| **Alex Hormozi** | Construcción de la oferta y ecuación de valor; volumen y apalancamiento | `asesor-alex-hormozi.md` |
| **April Dunford** | Posicionamiento frente a las alternativas reales | `asesor-april-dunford.md` |
| **Rory Sutherland** | Ciencia del comportamiento y «psico-lógica»; lo opuesto a una buena idea también puede ser buena idea | `asesor-rory-sutherland.md` |
| **Byron Sharp** | Ciencia de marca basada en evidencia: disponibilidad mental y física, alcance antes que lealtad | `asesor-byron-sharp.md` |
| **Ann Handley** | Oficio de escribir y contenido; marketing más lento y más valiente | `asesor-ann-handley.md` |
| **Gary Vaynerchuk** | Arbitraje de atención: ser nativo en canales subvalorados, con volumen | `asesor-gary-vaynerchuk.md` |

## Cómo sentar al consejo

Para una sesión, sienta 3–5 asesores:
1. **2–3 cuya lente encaje directamente** con el tipo de pregunta (tabla de abajo).
2. **Siempre al menos un disidente designado**: un asesor cuya postura publicada choque con hacia donde se inclina la pregunta. Un consejo que está de acuerdo es un espejo, no un consejo.
3. Respeta los pedidos explícitos («quiero a Hormozi y a Godin en esto»).

| Tipo de pregunta | Encajan bien | Disidentes naturales |
|---|---|---|
| Posicionamiento / mensaje | Dunford, Godin, Schwartz | Sharp (escéptico de la diferenciación) |
| Oferta / precio | Hormozi, Halbert, Brunson | Sutherland (precio ≠ lógica del valor), Godin (aviso de la carrera hacia abajo) |
| Construir marca / notoriedad | Sharp, Ogilvy, Sutherland | Hopkins, Halbert («enséñame las ventas») |
| Revisión de textos / creatividad | Ogilvy, Schwartz, Halbert, Handley | Sutherland (prueba lo ilógico) |
| Embudos / camino de conversión | Brunson, Hormozi, Hopkins | Godin (permiso antes que presión), Handley (estás gastando confianza) |
| Estrategia de contenido | Handley, Godin, Vaynerchuk | Sharp (el alcance gana a la profundidad), Hopkins (¿dónde está la respuesta?) |
| Anuncios pagados / medios | Hopkins, Sharp, Vaynerchuk | Godin (interrumpir es un impuesto) |
| Crecer / escalar | Hormozi, Vaynerchuk, Sharp | Handley (se erosiona la calidad), Dunford (escalar una posición borrosa) |
| Audiencia / elección de canal | Vaynerchuk, Sharp, Halbert | Godin (audiencia mínima viable frente a alcance masivo) |
| Estrategia de lanzamiento | Brunson, Godin, Halbert | Sharp (los lanzamientos se apagan; la disponibilidad se acumula) |

## Protocolo de la sesión

1. **Lee los expedientes** de los asesores sentados (con `leer_habilidad`).
2. **Búsqueda en vivo (opcional)**, ver abajo. Ofrécela cuando la pregunta sea tan concreta que las posturas documentadas quizá no la cubran, o cuando el dueño quiera fuentes.
3. **La perspectiva de cada asesor**: 2–4 párrafos por asesor.
   - Empieza aplicando sus *preguntas características* al caso del dueño.
   - Aplica sus marcos (el expediente los enumera) a los datos concretos; nada de consejo genérico con un nombre pegado.
   - Da la recomendación con la convicción que tendría esa perspectiva.
   - Escrita en tercera persona o como «desde esta perspectiva…», con el tono que describe el expediente, **sin citas inventadas** y sin hacer hablar a la persona en primera persona.
4. **El mapa de desacuerdos**, la sección más valiosa: identifica 2–4 conflictos genuinos entre las perspectivas, nombra el dilema de fondo de cada uno (por ejemplo: «Sharp frente a Godin aquí es en realidad alcance frente a resonancia: ¿qué restricción manda en *este* negocio?») y di qué evidencia lo resolvería.
5. **Síntesis**: el resumen de quien preside: la recomendación que mejor encaja con la etapa, la categoría y las restricciones de *este* negocio; qué advertencia de qué asesor se queda como alarma; y próximos pasos concretos con las habilidades que los ejecutan (ver «Habilidades relacionadas»).

## Búsqueda en vivo

Cuando el tema es muy concreto (un nicho, un cambio de canal, un cambio reciente de una plataforma) o el dueño quiere fuentes, ve más allá de los expedientes:
- **Si la búsqueda web está encendida**: busca `[nombre del asesor] + [tema]` por cada asesor sentado, prefiriendo fuentes primarias (sus libros, blogs, boletines, charlas) antes que artículos de recopilación.
- **Si no hay búsqueda web**: dilo, trabaja con los expedientes y no atribuyas posturas recientes sin fuente.

Incorpora lo encontrado con la fuente («En una entrevista de 2023 en X, Dunford sostuvo…»). Si la búsqueda contradice un expediente, confía en la búsqueda y señala la corrección.

## Reglas de fundamento (no negociables)

- **Rotula la sesión como simulación** una vez, arriba: *«Consejo simulado: cada perspectiva se construye a partir de los marcos y posturas publicados del autor, no es su revisión real.»*
- **Sin citas inventadas.** Cita textual solo de frases que se puedan verificar en el expediente o en la búsqueda, con la fuente nombrada (y en su idioma original si así está documentada, con la traducción al lado). Si no, parafrasea: «La postura de Hopkins en *Scientific Advertising* es…».
- **Sin respaldos ni condenas inventados.** Se puede simular a un asesor *aplicando su marco* al producto del dueño; nunca afirmes ni insinúes que la persona real opina sobre la empresa concreta del dueño.
- **Más cuidado con los vivos.** Godin, Brunson, Hormozi, Dunford, Sutherland, Sharp, Handley y Vaynerchuk están vivos y activos: sus posturas cambian. Para lo que dependa del momento, prefiere la búsqueda en vivo, y nunca los simules opinando sobre competidores con nombre o sobre polémicas.
- **Desacuerdo de fondo, no caricatura.** Cada perspectiva debe ser la versión más fuerte de esa mirada aplicada al caso: nada de hombres de paja para que la síntesis los tumbe.
- **Si el expediente y la pregunta no se tocan** (preguntarle a Hopkins por TikTok), dilo y razona por analogía explícita: «Hopkins nunca vio un feed de redes, pero su principio de la muestra gratis se traduce así…».

## Cómo entregarlo

```
> Consejo simulado: cada perspectiva se construye a partir de los marcos
> y posturas publicados del autor, no es su revisión real.

## La pregunta ante el consejo
[1–2 frases que la replantean + lo que está en juego]

## Sentados: [Asesor A], [Asesor B], [Asesor C] ([modalidad])
[Una línea de por qué este banco, incluido quién es el disidente]

---

### Perspectiva inspirada en [Asesor A]: [su lente, 3–5 palabras]
[2–4 párrafos]
**En una frase:** [una oración]

### Perspectiva inspirada en [Asesor B]: …
…

---

## Dónde no se pone de acuerdo el consejo
1. **[Conflicto]**: [A] dice X por [marco]; [B] dice Y por [marco].
   El dilema de fondo: [tensión]. Qué lo resolvería: [evidencia o prueba].
2. …

## Síntesis de quien preside
[Recomendación ajustada a la etapa y las restricciones de este negocio]
- **Hacer:** [2–4 pasos concretos]
- **Alarma:** [qué advertencia vigilar, de qué asesor, y la señal]
- **Ejecutar con:** [habilidades que siguen]
- **Supuestos:** [lo que no estaba en el Cerebro y se supuso]
```

En la opinión rápida (un asesor), la entrega es la misma sin el mapa de desacuerdos: la pregunta, la perspectiva, una dirección concreta de mejora (por ejemplo, una reescritura del titular en la línea de ese método) y el rótulo de simulación.

Si los próximos pasos son trabajo de otro departamento (Ventas arma la propuesta, Correos prepara la secuencia), proponlos con `crear_borrador_tarea`; nada se ejecuta sin el OK del dueño.

## Añadir un asesor propio

El dueño puede ampliar el banco («añade a mi asesor»). Arma un expediente con la estructura de `plantilla-asesor.md`: los mismos campos que los del banco (lente, marcos, posturas documentadas con fuente, preguntas características, para qué sirve y puntos ciegos, estilo, obras clave).
- **Figura pública** que no está en el banco: cada marco y postura debe salir de algo que publicó o dijo; investiga antes (búsqueda web si está encendida) y cita fuentes.
- **Persona privada** (el antiguo jefe del dueño, un socio, su mejor cliente): las posturas las da **el dueño**. Ordena lo que te dio, pregúntale lo que falta (marcos, puntos ciegos, estilo) y no inventes opiniones de una persona real.

La entrega es el **texto completo del expediente** para que el dueño lo guarde como nota en el Cerebro (sugiere un nombre, por ejemplo `Asesores/<nombre>`); en sesiones siguientes, si el dueño lo nombra, léelo de esa nota y trátalo como uno más del banco, con las mismas reglas de fundamento. Tú no creas archivos.

## Errores que hay que evitar

- **El consejo que asiente**: cinco perspectivas que bendicen el plan del dueño. Vuelve a sentar con un disidente de verdad. Si el dueño pide «que me den la razón», dilo con tacto: un consejo que solo valida no le sirve.
- **Consejo genérico con nombre**: si la perspectiva sobrevive cambiando el nombre, no es una perspectiva. Ánclala en los marcos concretos de ese autor.
- **Sopa de frases célebres**: pegar frases famosas en vez de aplicar el método que hay detrás.
- **Consejo para ejecutar**: el consejo decide la dirección; no escribe la página. Pasa a la habilidad de ejecución cuando la dirección esté clara.
- **Doce asesores para un titular**: el tamaño del banco va con lo que está en juego.

## Reglas

- El rótulo de simulación va siempre, también en la opinión rápida.
- Ninguna cita textual sin fuente verificable; ninguna opinión atribuida sobre la empresa del dueño.
- Nunca escribas en primera persona como si fueras el asesor.
- Siempre al menos un disidente en una sesión de 3 o más.
- No inventes cifras de la empresa ni del mercado; las de la empresa salen de las cifras del Cerebro.
- Las posturas recientes de un asesor vivo solo con búsqueda y fuente; si no hay búsqueda, dilo.
- El consejo recomienda; lanzar, publicar o gastar lo decide el dueño.

## Referencias

- `plantilla-asesor.md`: cuando el dueño quiera añadir un asesor propio.
- `asesor-seth-godin.md`: posicionamiento, nicho, comunidad, permiso.
- `asesor-david-ogilvy.md`: titulares, textos, marca a largo plazo, medir.
- `asesor-eugene-schwartz.md`: textos que no convierten, nivel de conciencia, mercados saturados.
- `asesor-claude-hopkins.md`: pruebas, afirmaciones concretas, muestras, costo por cliente.
- `asesor-gary-halbert.md`: mercado y lista antes que texto, respuesta directa.
- `asesor-russell-brunson.md`: embudos, escalera de valor, gancho-historia-oferta.
- `asesor-alex-hormozi.md`: oferta, precio, volumen, economía por cliente.
- `asesor-april-dunford.md`: posicionamiento y discurso de venta.
- `asesor-rory-sutherland.md`: replantear, percepción, señales, precio.
- `asesor-byron-sharp.md`: alcance, disponibilidad, activos distintivos, medios.
- `asesor-ann-handley.md`: voz, contenido, boletines.
- `asesor-gary-vaynerchuk.md`: redes orgánicas, atención subvalorada, volumen de contenido.

## Habilidades relacionadas

- **contexto-marketing**: cuando gana la mirada de Dunford, para fijar el posicionamiento en `00-Empresa/marketing`.
- **ofertas** / **precios**: cuando gana la dirección de Hormozi o Halbert.
- **redaccion-publicitaria** / **edicion-textos**: cuando el consejo revisó textos.
- **campanas-pagadas** / **creatividad-anuncios**: cuando el debate fue de medios o de creatividad.
- **estrategia-contenido** / **redes-sociales**: cuando gana Handley o Vaynerchuk.
- **psicologia-marketing**: para la mecánica de comportamiento de Sutherland y la disponibilidad de Sharp.
- **pruebas-ab**: cuando el mapa de desacuerdos dice «pruébalo» (Hopkins insistiría).
