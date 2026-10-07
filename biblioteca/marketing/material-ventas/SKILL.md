---
name: material-ventas
titulo: Material de ventas
description: Úsala cuando haya que crear material para cerrar ventas: presentación de ventas, hoja de una página, respuestas a objeciones, guion de demostración, ficha de competidor, propuesta, caso de éxito, análisis de ganadas y perdidas.
area: ventas-y-gtm
departments: [marketing, sales]
agents: [piper, lexi, gfx, riley]
origen: marketingskills/sales-enablement (MIT, Corey Haines)
---
# Material de ventas

Sirve para crear los documentos que ayudan al equipo comercial a cerrar: presentaciones, hojas de una página, respuestas a objeciones, guiones de demostración, fichas de competidor, propuestas y guías de ventas. Trabajas como especialista en habilitación comercial. Tu meta: material que la gente de ventas **de verdad usa**, no el que se queda en una carpeta.

Sirve igual para quien vende a otras empresas (B2B) que para un negocio de servicios, una constructora, una clínica, una agencia, una ferretería con venta a empresas o un SaaS. «Equipo de ventas» puede ser cinco vendedores o el dueño que cotiza por WhatsApp: adapta el formato (una presentación puede ser un PDF de cinco láminas; un guion de demostración puede ser la visita al local o la llamada de diagnóstico).

**Qué cubre y qué no.** Cubre todo documento o recurso que ayuda a cerrar tratos con clientes concretos. Las páginas públicas de comparación con la competencia son otra cosa: usa `paginas-comparativas`. Entrevistas con clientes o estudio de bajas: `investigacion-clientes`. Texto del sitio web: `redaccion-publicitaria`. Correos de prospección en frío: `correo-en-frio`. La oferta en sí (bonos, garantías, estructura de precio): `ofertas`.

## Antes de empezar

Lee las notas de la empresa en el Cerebro (`00-Empresa/perfil`, `00-Empresa/oferta`, `00-Empresa/voz`, `00-Empresa/clientes`, `00-Empresa/faq` y, sobre todo, `00-Empresa/marketing`) y las cifras de la empresa. Usa ese contexto y solo pregunta lo que no esté ahí o sea propio de este encargo. Si falta algo que necesitas, pregúntalo en una línea (o con `pedir_bloqueo` si sin eso no puedes seguir) o déjalo marcado como supuesto; nunca lo inventes. **Precios, descuentos, plazos y garantías salen de las cifras de la empresa, tal cual.**

Reúne este contexto (pregunta lo que falte):

1. **Propuesta de valor y diferencias.** ¿Qué venden y para quién? ¿Qué los distingue de la mejor alternativa? ¿Qué resultados pueden demostrar?
2. **Cómo se vende.** Autoservicio, ventas por teléfono, visita en campo, mixto, WhatsApp. Tamaño típico de la venta y duración del ciclo. Quiénes participan en la decisión.
3. **Qué material hace falta.** ¿Qué piezas concretas? ¿Para qué etapa del embudo? ¿Quién las usará (vendedor, prospectador, el contacto interno que te defiende, el prospecto)?
4. **Situación actual.** ¿Qué material existe hoy? ¿Qué funciona y qué no? ¿Qué le piden más al equipo de marketing?

## Principios

### Ventas usa lo que ventas cree
Involucra a los vendedores en la creación. Usa su lenguaje, no el de marketing. Si los vendedores reescriben tu presentación antes de enviarla, escribiste la presentación equivocada. Prueba los borradores con los mejores primero (pídele al dueño que se los muestre).

### Para una situación concreta, no genérico
Adapta a la persona, la etapa del trato y el caso de uso. Una presentación para el gerente técnico no se parece a la del gerente comercial. Una hoja para después de una reunión sirve a otro fin que la de una feria.

### Que se pueda escanear, no que lo diga todo
El vendedor necesita la información en 3 segundos, no en 30. Títulos en negrita, viñetas cortas, jerarquía visual. Si no encuentra la respuesta en plena llamada, el documento falló.

### Atado a resultados del negocio
Cada afirmación conecta con ingresos, eficiencia o menos riesgo. Una función sin el «¿y eso qué?» no vale nada. Cambia «analítica con IA» por «el informe que tomaba un día ahora toma una hora» (solo si es cierto y sale de datos de la empresa).

### Afirmaciones que el vendedor puede defender
El vendedor repite lo que escribes ante compradores que pueden comprobarlo. Todo lo que un comprador pueda desmentir en un minuto cuesta más de lo que aporta.
- **«Por qué ganamos» necesita evidencia**: entrevistas de ganadas y perdidas, grabaciones de llamadas, citas de clientes o razones del CRM respaldadas por alguna de esas (ver `referencias/analisis-ganadas-perdidas.md`). Sin ella, escribe las ventajas como **hipótesis** para que el equipo las pruebe, y di qué evidencia las confirmaría.
- **Lo que se dice de un competidor** sigue las reglas de evidencia de `paginas-comparativas`: con fecha, con fuente, «no aparece en su sitio» en vez de «no lo tienen», y sin afirmar como hecho sus motivos. El vendedor puede razonar por qué un competidor hizo algo, rotulado como suposición.
- **Incluye dónde pierden.** Un documento competitivo que admite cuándo el competidor es la mejor opción es uno en el que el equipo confía delante de un comprador.

## Presentación de ventas (pitch deck)

### Marco de 10 a 12 láminas

1. **El problema del mundo actual**: el dolor que vive hoy el comprador.
2. **El costo del problema**: qué cuesta no hacer nada (tiempo, dinero, riesgo).
3. **El cambio que está ocurriendo**: un cambio del mercado o la tecnología que crea urgencia.
4. **Tu enfoque**: cómo lo resuelves distinto.
5. **Recorrido del producto o servicio**: 3 o 4 flujos clave, no un desfile de funciones.
6. **Pruebas**: cifras, logotipos, reconocimientos.
7. **Un caso de éxito**, bien contado.
8. **Implementación y plazos**: cómo llegan de aquí a estar funcionando.
9. **Retorno y valor**: retorno esperado y tiempo de recuperación.
10. **Resumen de precios**: transparente, por niveles si aplica.
11. **Próximos pasos**: una acción clara con fecha.

### Principios de la presentación

- **Arco de historia, no desfile de funciones.** El mundo tiene un problema, hay una mejor manera, aquí está la prueba, así se llega.
- **Una idea por lámina.** Si necesitas dos puntos, usa dos láminas.
- **Diseñada para presentarse, no para leerse.** Las láminas apoyan la conversación; no la reemplazan. Poco texto, imágenes fuertes (puedes pedir imágenes al Estudio con `generar_imagen` o buscar en la galería con `buscar_en_galeria`).

### Adaptación según el comprador

| Comprador | Destaca | Resta peso a |
|-----------|---------|--------------|
| Técnico | Arquitectura, seguridad, integraciones, especificaciones | Cálculos de retorno, métricas de negocio |
| Quien paga (económico) | Retorno, tiempo de recuperación, costo total, riesgo | Detalle técnico, especificidades de la implementación |
| El contacto que te defiende por dentro | Argumentos para vender internamente, victorias rápidas, prueba de pares | Detalle técnico o financiero profundo |

**Guía lámina por lámina, versiones por comprador y errores comunes:** `referencias/marcos-de-presentacion.md`.

## Hojas de una página (leave-behind)

### Cuándo usarlas

- **Resumen posterior a la reunión**: refuerza lo conversado y mantiene el impulso.
- **Para que tu contacto venda por dentro**: lo arma para vender por ti.
- **Para ferias o eventos**: introducción rápida que lleva al seguimiento.

### Estructura

1. **El problema** en una frase.
2. **Tu solución**: qué haces y cómo.
3. **3 diferencias**: por qué tú y no las alternativas.
4. **Una prueba**: una cifra o una cita de cliente fuertes.
5. **Llamada a la acción**: siguiente paso claro, con un contacto concreto.

### Principios de diseño

- Una página, literalmente. Solo el frente, o frente y vuelta como máximo.
- Escaneable en 30 segundos: títulos en negrita, viñetas cortas, espacio en blanco.
- Logotipo, sitio web y un contacto con nombre (no `info@`).
- Con la marca, pero limpia: es una herramienta de ventas, no una pieza de marca.

**Plantillas por caso de uso y guía de diseño:** `referencias/plantillas-hoja-una-pagina.md`.

## Documentos de objeciones

### Categorías

| Categoría | Ejemplos |
|-----------|----------|
| Precio | «Es muy caro», «No hay presupuesto este trimestre», «El otro es más barato» |
| Momento | «No es el momento», «Quizá el próximo trimestre», «Estamos muy ocupados para implementarlo» |
| Competencia | «Ya usamos X», «¿En qué se diferencian?» |
| Autoridad | «Tengo que consultarlo con mi jefe», «Lo decide un comité» |
| Statu quo | «Lo que tenemos funciona bien», «Si no está roto, no lo arregles» |
| Técnica | «¿Se integra con X?», «Dudas de seguridad», «¿Escala?» |

### Marco de respuesta

Para cada objeción, documenta:

1. **El enunciado**: exactamente como lo oyen los vendedores.
2. **Por qué lo dicen**: la preocupación real detrás de las palabras.
3. **El enfoque de respuesta**: cómo reconocerla y reorientarla.
4. **Una prueba**: evidencia específica que atiende la preocupación.
5. **Una pregunta de seguimiento**: para que la conversación siga avanzando.

### Dos formatos

- **Tabla de consulta rápida** para llamadas en vivo: objeción, respuesta de una línea, prueba. Cabe en una pantalla.
- **Documento detallado** para preparación y entrenamiento: contexto completo, guiones, escenarios de ensayo.

**Biblioteca completa de objeciones con guiones:** `referencias/biblioteca-de-objeciones.md`.

### Objeción de un trato en vivo

Cuando el vendedor trae **una** objeción de un trato real («la gerente de finanzas acaba de decir que Acme cuesta la mitad y tengo una llamada en una hora»), responde a ese trato. No devuelvas un documento genérico.

1. **Precisa el momento**: quién lo dijo, su cargo, las palabras exactas, la etapa del trato y qué sigue (llamada, correo, compras). Al vendedor le falta tiempo: responde con tus supuestos declarados y pregunta solo lo que cambiaría la respuesta.
2. **Nombra la preocupación probable** detrás de la frase y di qué del trato apunta a ella. Si caben dos lecturas, dale al vendedor una pregunta que las distinga antes de discutir cualquiera.
3. **Da una respuesta que pueda decir tal cual**: reconoce, atiende la preocupación real, aporta una prueba, termina con una pregunta.
4. **Usa solo pruebas que el vendedor pueda respaldar.** Sácalas de la biblioteca de objeciones, los casos y las fichas de competidor. Si nada encaja, dilo y sugiere qué afirmación verificar. No inventes una cifra, un cliente ni un precio de la competencia, y no repitas como hecho lo que el comprador dice del competidor. «La mitad del precio» puede no incluir el mismo alcance: haz que pregunte qué incluye esa cifra.
5. **Di cuándo no pelear.** Si la objeción muestra una brecha real de ajuste, dilo y sugiere cómo descartar el trato con elegancia o acotar el alcance.

Después, sugiere que el vendedor registre la objeción y cómo salió. Las objeciones en vivo son la materia prima de la biblioteca y del análisis de ganadas y perdidas.

## Fichas de competidor (battle cards)

Una ficha de competidor es una guía reutilizable de **un** competidor, para usarse en muchos tratos. Para una sola objeción en vivo, usa «Objeción de un trato en vivo». Para páginas públicas de comparación, `paginas-comparativas`. Cada línea sigue lo de «Afirmaciones que el vendedor puede defender».

**Pregunta cuál competidor.** Si el pedido no lo nombra y el contexto no lo identifica, pregúntalo en una sola pregunta corta. Puedes proponer al candidato más probable para que el dueño lo confirme, pero no redactes hasta que lo confirme. Una ficha pulida del competidor equivocado parece terminada y nadie la cuestiona.

### Estructura

1. **Cuándo lo verás**: segmentos, tamaños de trato y situaciones en que aparece.
2. **Por qué los compradores lo consideran**: su atractivo real, en palabras del comprador.
3. **Dónde es fuerte**: con honestidad, para que no tomen al equipo por sorpresa.
4. **Dónde ganamos y para quién**: atado a evidencia.
5. **Preguntas de descubrimiento**: sacan a la luz los criterios en que eres más fuerte, sin hablar mal del otro.
6. **Objeciones principales**: con respuesta de una línea y prueba.
7. **Cuándo retirarse**: perfiles de trato donde el otro es la mejor opción.
8. **Última verificación**: fecha y qué cambió desde la versión anterior.

### Mantenerla al día

- Verifica de nuevo precios y paquetes cada trimestre, y cada vez que los vendedores oigan algo nuevo en los tratos.
- Etiqueta cada dato del competidor con su fuente y fecha, para poder encontrar y corregir una línea vieja.
- Una página. Si no encuentran la respuesta en plena llamada, recorta hasta que la encuentren.

Toma los datos del competidor de los expedientes de `perfil-competidores` cuando existan. Para revisar si las fichas existentes tienen afirmaciones viejas, mira la auditoría de materiales competitivos en `paginas-comparativas`.

## Análisis de ganadas y perdidas

Convierte los resultados del CRM, las grabaciones o notas de llamadas y las entrevistas con compradores en una respuesta con evidencia a «¿por qué ganamos y perdemos, y contra quién?». Es la evidencia que las fichas de competidor y las secciones «por qué ganamos» necesitan.

### Flujo

1. **Inventaría las fuentes** y su sesgo: razones de pérdida del CRM (las anota el vendedor, sesgadas a precio y momento), llamadas (lo que dijo el comprador durante el trato), entrevistas con compradores (las más francas, la muestra más pequeña).
2. **Incluye las ganadas.** Una razón de pérdida significa poco sin los tratos que ganaste contra el mismo competidor.
3. **Segmenta antes de contar.** Separa por competidor, segmento, tamaño del trato y etapa en que se perdió. «Perdemos por precio» en todo suele esconder «perdemos los tratos medianos contra un competidor por el tiempo de arranque».
4. **Codifica cada trato** con una razón principal (más las secundarias), una cita de respaldo y la fuente, para que las cuentas sumen. Que una sola persona codifique, o que dos codifiquen una muestra, para que «principal» signifique lo mismo siempre.
5. **Reporta conteos con el tamaño de la muestra.** «6 de 9 pérdidas contra Acme citan el tiempo de arranque» vale más que «el arranque es un tema principal». Di siempre el n. Los grupos pequeños son orientación, y con menos de unos 5 tratos es una señal que vigilar, no un hallazgo.
6. **Convierte los hallazgos en material.** Un trato con solo una razón de una palabra en el CRM es de baja confianza: confírmalo con llamadas o entrevistas antes de que cambie una ficha. Luego actualiza fichas, biblioteca de objeciones y preguntas de descubrimiento, y manda los vacíos del producto a quien lo desarrolla.

**Esquemas de codificación, preguntas de entrevista y formato del informe:** `referencias/analisis-ganadas-perdidas.md`.

## Calculadoras de retorno y propuesta de valor por persona, casos de éxito, propuestas, guías de ventas y fichas de persona

Todo esto, con sus estructuras completas, está en `referencias/otros-materiales.md`: diseño de calculadora de retorno (entradas, cálculos, salidas), propuesta de valor por rol, guion de demostración resumido, casos de éxito en formato de ventas, plantilla de propuesta, guía de ventas y ficha de persona compradora. Léelo cuando el pedido sea alguno de esos.

## Guiones de demostración

### Estructura del guion

1. **Apertura** (2 min): contexto, agenda, confirmar objetivos de la llamada.
2. **Resumen del descubrimiento** (3 min): lo que aprendiste, confirmar prioridades.
3. **Recorrido de la solución** (15–20 min): 3 o 4 flujos clave ligados a su dolor.
4. **Puntos de interacción**: preguntas durante la demostración, no solo al final.
5. **Cierre** (5 min): resume el valor y propone próximos pasos con fecha.

### Tipos de guion

| Tipo | Duración | Enfoque |
|------|----------|---------|
| Llamada de descubrimiento | 30 min | Calificar, entender el dolor, mapear el proceso de compra |
| Primera demostración | 30–45 min | Mostrar 3–4 flujos ligados a su dolor |
| Revisión técnica a fondo | 45–60 min | Arquitectura, seguridad, integraciones |
| Resumen ejecutivo | 20–30 min | Resultados de negocio, retorno, alineación estratégica |

### Principios

- **Demostración después del descubrimiento, no antes.** Si no conoces su dolor, adivinas qué funciones importan.
- **Personaliza a su caso.** Sus términos, sus datos (si se puede), su flujo.
- **Deja tiempo para preguntas.** Una demostración en la que el prospecto no habla es una que no cierra.

**Guiones completos por escena:** `referencias/guiones-de-demostracion.md`.

## Cómo entregarlo

Entrega el formato que corresponde a cada tipo de material, en Markdown, como texto de tu respuesta (el dueño lo pasa a su herramienta de diseño o presentaciones; si hace falta una imagen, propón el prompt para el Estudio).

| Material | Entrega |
|----------|---------|
| Presentación de ventas | Esquema lámina por lámina: titular, texto y notas del orador |
| Hoja de una página | Texto completo con guía de diseño (jerarquía visual, secciones) |
| Documento de objeciones | Tabla: objeción, respuesta, prueba, pregunta de seguimiento |
| Objeción en vivo | Preocupación probable, una respuesta lista para decir, prueba, pregunta de seguimiento |
| Informe de ganadas y perdidas | Alcance, hallazgos con conteos y citas, desglose por competidor, actualizaciones del material |
| Guion de demostración | Escena por escena con tiempos, guion y puntos de interacción |
| Calculadora de retorno | Campos de entrada, fórmulas, pantalla de resultado con datos de ejemplo (rotulados como ejemplo) |
| Guía de ventas | Documento estructurado con índice y secciones |
| Ficha de persona | Ficha de una página por persona |
| Propuesta | Texto sección por sección con notas de personalización |

### Preguntas propias de este trabajo (las que falten)

1. ¿Qué material necesitas? (presentación, hoja de una página, objeciones, etc.)
2. ¿Quién lo usará? (vendedor, prospectador, contacto interno, prospecto)
3. ¿Para qué etapa de la venta es? (prospección, descubrimiento, demostración, negociación, cierre)
4. ¿Quién es la persona objetivo? (cargo, antigüedad, área)
5. ¿Cuáles son las 3 objeciones que más oyen?

## Reglas

- Nunca inventes cifras, clientes, casos, logotipos, citas ni datos de la competencia. Sin dato, deja el hueco marcado «[dato por confirmar]».
- Los precios, descuentos y garantías vienen de las cifras de la empresa, tal cual.
- Todo dato de un competidor lleva fuente y fecha; di «no aparece en su sitio», no «no lo tienen».
- Lo que no tiene evidencia se llama hipótesis.
- Una ficha de competidor nunca se redacta sin saber cuál competidor.
- Un trato en vivo se contesta con respuesta para ese trato, no con un documento genérico.
- Nada sale al cliente sin el OK del dueño: entregas borradores. No dices que enviaste una propuesta ni una presentación.
- Si piden ayuda con una propuesta o un ofrecimiento para un cliente real, el vendedor humano la revisa antes de mandarla.

## Referencias

Pídelas por nombre con `leer_habilidad`:

- `marcos-de-presentacion` — al armar una presentación de ventas: guía lámina por lámina, versiones por tipo de comprador y errores típicos.
- `plantillas-hoja-una-pagina` — al armar una hoja de una página: cuatro plantillas (producto, caso de uso, después de una reunión, para el contacto interno) y guía de diseño.
- `biblioteca-de-objeciones` — al armar el documento de objeciones o responder una: tabla rápida y respuestas detalladas por categoría.
- `guiones-de-demostracion` — al escribir el guion de una llamada de descubrimiento, demostración, revisión técnica o resumen ejecutivo.
- `analisis-ganadas-perdidas` — al analizar por qué se ganan o se pierden tratos: fuentes, esquema de codificación, preguntas de entrevista, formato del informe.
- `otros-materiales` — calculadoras de retorno, propuesta de valor por rol, casos de éxito, propuestas, guías de ventas y fichas de persona.

## Habilidades relacionadas

- `paginas-comparativas`: páginas públicas de comparación y alternativas.
- `perfil-competidores`: los expedientes de competidores que alimentan las fichas.
- `investigacion-clientes`: entrevistas con compradores y voz del cliente.
- `redaccion-publicitaria`: texto del sitio y de piezas de marketing.
- `correo-en-frio`: correos de prospección saliente.
- `operaciones-ingresos`: ciclo de vida del prospecto, puntuación, enrutamiento y embudo.
- `precios`: decisiones de precios y paquetes.
- `contexto-marketing`: posicionamiento y mensajes de base.
- `ofertas`: la oferta que se vende.
