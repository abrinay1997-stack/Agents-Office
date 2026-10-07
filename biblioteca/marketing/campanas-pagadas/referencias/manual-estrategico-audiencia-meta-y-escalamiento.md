# Manual estratégico: audiencia, Meta moderno, remarketing, página de destino y escalamiento

El detalle completo de las secciones estratégicas de la habilidad `campanas-pagadas`: dónde aplicar el conocimiento de la audiencia, el manual de Meta en la era Andromeda, el remarketing con ofertas distintas, la coherencia entre anuncio y página de destino, y los informes y la disciplina de escalamiento. Los porcentajes y las mejoras que cita son referencias de profesionales: recalíbralas con la cuenta real y no las presentes como promesas.

## Conocer a la audiencia y segmentar

Conocer a fondo a la audiencia sigue siendo el trabajo de mayor palanca en publicidad pagada: datos demográficos, cargos, dolores, miedos, esperanzas, las palabras exactas que usa, a quién sigue, qué ha probado, por qué le falló y qué compra. **Reúne todos los identificadores que puedas.**

Lo que cambió en 2026 es **dónde aplicas ese conocimiento.** Como los algoritmos de las plataformas encuentran mucho mejor a la persona correcta, meter todos los identificadores en los *filtros de segmentación* rinde menos que ponerlos en la *creatividad* (titulares, texto, imágenes, ganchos, ejemplos). La disciplina de hoy: **conocimiento de la audiencia → primero a la creatividad, después a los filtros.** Cuánto se inclina la balanza varía mucho por plataforma.

| Plataforma | Conocimiento → creatividad | Conocimiento → filtros | Notas |
|----------|------------------------------|-------------------------------------|-------|
| **Meta** (era Andromeda) | **80 %+** | 20 % | El algoritmo premia audiencia amplia + creatividad específica. Apilar intereses ahora perjudica. |
| **Google Búsqueda** | 40 % | **60 %** | Las palabras clave siguen siendo la señal dominante: concordancias, capas de intención y negativas aún mandan. |
| **Google Performance Max / Demand Gen** | **70 %** | 30 % | Las señales de audiencia son orientativas, no deterministas. Mandan la creatividad y la calidad del feed. |
| **LinkedIn** | 40 % | **60 %** | Los filtros de cargo, empresa e industria aún dan precisión real. La creatividad logra el clic; la firmografía logra que lo vea la persona correcta. |
| **TikTok** | **70 %** | 30 % | Modelo cercano al de Meta: segmentación amplia + creatividad de aspecto nativo gana. |
| **X (Twitter)** | 50 % | 50 % | Intereses y seguidores aún cuentan, pero la diferenciación creativa rinde mucho con menos competencia. |

Son proporciones orientativas, no exactas: pruébalas en la cuenta real.

**Cómo llevar cada identificador a la creatividad:**
- **Datos demográficos** (edad, lugar, ocupación) → palabras que disparan identidad en titulares («para dentistas», «para dueños de ferreterías»)
- **Dolores y miedos** → titular + primera línea del texto (las palabras textuales que los clientes usan sobre el problema)
- **Esperanzas y resultados deseados** → texto de transformación y llamados a la acción
- **Objeciones y «por qué no compré la vez pasada»** → anuncios de remarketing que manejan objeciones
- **Su lenguaje y vocabulario** → toda la voz del texto; nunca uses jerga de la industria que ellos no usan
- **Base de clientes actual** → siguen alimentando las audiencias similares
- **Nicho o segmento con el que se identifican** → palabras de identidad en el titular

**Conceptos que siguen valiendo:** las **audiencias similares** se basan en los mejores clientes (por valor de por vida), no en todos; el **remarketing** se segmenta por etapa del embudo; las **exclusiones** (clientes actuales y quienes convirtieron hace poco) evitan gastar en quien ya compró.

**Fallo común:** compensar una creatividad débil con segmentación hiperprecisa. Si la creatividad es genérica y apilas 12 intereses + 3 filtros demográficos + una audiencia personalizada, tienes una audiencia pequeña que ve un mal anuncio. Mejor: reúne los mismos identificadores, escribe 5 variantes que hablen a segmentos distintos, segmenta de forma amplia y deja que el algoritmo empareje cada creatividad con su segmento. Detalle por plataforma: `segmentacion-de-audiencias.md`.


## El manual moderno de Meta (era Andromeda, 2026+)

Meta lanzó el algoritmo **Andromeda** en 2025 y cambió por completo los anuncios de Meta. El manual viejo (apilar intereses, video pulido, escalar con un solo ganador) rinde menos. El nuevo:

- **El volumen creativo es la restricción (estáticos > video pulido).** Andromeda es «un panda hambriento»: necesita creatividad fresca constante o se fatiga. Los estáticos suelen superar al video porque Meta puede mostrar más estáticos por sesión (son más baratos de entregar) y producirlos es mucho más barato y rápido, lo que da el volumen que Andromeda necesita. **Dedica 1 hora por semana** a producir creatividades frescas para tu oferta ganadora. Volumen > pulido. (Los estáticos y videos se producen con el Estudio: `generar_imagen`, `generar_video`, `buscar_presets`, `aplicar_preset`.)
- **La creatividad ES la segmentación (audiencia amplia + creatividad específica).** Antes: apilar intereses y esperar. Ahora: segmenta amplio (solo el país) y deja que la creatividad segmente. El **texto largo funciona mejor que el corto** en 2026: da a Meta un contexto más amplio para entender a quién mostrar el anuncio. Pruébalo: toma tu mejor anuncio con segmentación por intereses, duplícalo, quita toda la segmentación (solo el país), corre ambos 7 días lado a lado y compara CPA. Lo amplio suele ganar.
- **El truco de una sola palabra (palabras que disparan identidad).** Toma tu anuncio ganador y duplícalo insertando una palabra de nicho o identidad en el titular o el texto. *«Cómo conseguir 462 contactos a la semana en automático»* → *«…462 contactos **dentales**…»* / *«…contactos **de abogados**…»* / *«…contactos **inmobiliarios**…»*. La palabra dispara identidad en quien mira Y sirve de señal de segmentación para Andromeda. Baja mucho el CPL y abre bolsas de audiencia que un anuncio genérico no alcanzaba.
- **Granja de variantes con IA (la prueba de las 100 personas).** Toma tu anuncio ganador y pídele a un asistente: *«Lee este anuncio y sé su autor. Si te muestro el siguiente anuncio que te pida escribir para 100 personas, ni 1 de cada 100 podría decir que lo escribió una persona distinta. Ahora escríbelo para [demografía o nicho].»* El resultado debe leerse casi igual, con cambios sutiles de relevancia. Aplícalo en secuencia: texto → titulares → creatividad. Mete todas las variantes en una CBO y deja que la IA de Meta reparta el gasto.
- **Campañas zombi.** Tras una CBO, Meta deja sin gasto al 80 % de las variantes. Toma las variantes muertas en las que tienes **mucha convicción** y lánzalas en un conjunto aparte («campaña zombi»): típicamente resucita un 20 % como ganadoras que el primer reparto pasó por alto.
- **No hagas que los anuncios parezcan anuncios.** Cientos de millones de personas usan bloqueadores: la estética de anuncio pulido mata el rendimiento. Estudia qué contenido rinde de forma nativa en tu nicho en TikTok, Instagram y YouTube y produce anuncios con esa estética. **Técnica de la cuenta auxiliar:** crea una cuenta limpia de Instagram o TikTok, sigue a todos los influyentes y páginas de tu nicho y dale «me gusta» a su contenido: tu feed se vuelve una vista curada de lo que gana de forma nativa. Si tienes un video orgánico con millones de vistas, **corre ese mismo video como anuncio**: contenido probado + distribución pagada = la jugada de mayor palanca.


## Remarketing

| Etapa del embudo | Audiencia | Mensaje | Meta |
|--------------|----------|---------|------|
| Alta | Lectores del blog, quienes vieron video | Educativo, prueba social | Pasar a consideración |
| Media | Visitantes de precios o de servicios | Casos de éxito, demos | Pasar a decisión |
| Baja | Quienes abandonaron el carrito, usuarios de prueba | Urgencia genuina, manejo de objeciones | Convertir |

| Etapa | Ventana | Tope de frecuencia |
|-------|--------|---------------|
| Caliente (carrito / prueba) | 1–7 días | Se tolera más |
| Tibia (páginas clave) | 7–30 días | 3–5 veces por semana |
| Fría (cualquier visita) | 30–90 días | 1–2 veces por semana |

**Exclusiones:** clientes actuales (salvo venta adicional) y quienes convirtieron hace poco (ventana de 7–14 días); visitantes que rebotaron (<10 s); páginas irrelevantes (empleo, soporte).

**Haz remarketing con ofertas DISTINTAS (no con la misma).** La receta convencional vuelve a mostrar el mismo producto a quien no compró. El principio: **la razón n.º 1 por la que alguien no compró es que la oferta no era la adecuada para esa persona.** Mostrar lo mismo con más fuerza no ayuda. Haz remarketing con **otros** productos, servicios u ofertas de tu catálogo: quien miró proteína y no compró → creatina; quien descargó un imán de prospectos y no agendó → otro imán sobre un tema relacionado; quien vio precios y no se registró → una auditoría o evaluación gratis. La mejora suele ser grande: una audiencia con ROAS de 2–3 en la oferta original puede llegar a 6+ con otra oferta (cifra orientativa de profesionales).

**El marco de 4 componentes del remarketing:** corre estos 4 tipos de anuncio a la vez:
1. **Anuncio de manejo de objeciones**: responde directo a las razones más comunes por las que no compraron. Para hallarlas, **llama por teléfono a cada contacto** que no convirtió y pregunta por qué. Las objeciones textuales se vuelven el titular de este anuncio.
2. **Carrusel de testimonios y pruebas**: varias imágenes con testimonios y pruebas que respaldan lo que dijo el anuncio original.
3. **CBO de otras ofertas**: tus otros anuncios mejor rendidores de otros productos o servicios, en una CBO, hacia la misma audiencia.
4. **Anuncio de auditoría o evaluación con valor primero**: envuelve tu llamada en una pieza gratuita de valor; compren o no, se van con algo útil. Baja la fricción para interactuar.

Los cuatro juntos, sobre la misma audiencia que no convirtió con el anuncio de la parte alta, elevan mucho el ROAS de todo el embudo.


## Coherencia con la página de destino (el truco del titular espejo)

La coherencia entre anuncio y página de destino es la palanca más subestimada. La mayoría gasta el 90 % del esfuerzo en los anuncios y el 10 % en la página; invierte esa proporción.

**Titular espejo.** Meta es la mejor herramienta de pruebas A/B que existe: los titulares de tus anuncios se exponen a ~1.000 veces la audiencia que llega a tu página, así que obtienes datos significativos de qué titular funciona *mucho antes* que en la página. La jugada: 1. corre **20–40 titulares** distintos como variaciones de anuncio · 2. identifica el de mejor rendimiento (por CTR y conversión posterior) · 3. **repite ese titular ganador en tu página**: redacción exacta en el H1, el subtítulo y la apertura del texto · 4. espera un **aumento mínimo del 15–20 %** en la conversión de la página solo con este cambio (cifra orientativa de profesionales). Funciona porque quien hizo clic espera *esa promesa concreta*; si la página la repite palabra por palabra, el mensaje coincide y la conversión sigue. Ver `conversion-paginas`.

**Mínimo tres pruebas A/B a la vez.** En todo momento deberías tener al menos 3 pruebas corriendo en algún lugar del embudo (creatividad, página, oferta o flujo posterior a la conversión). Si no, topaste tu curva de mejora. Ver `pruebas-ab`.


## Informes y análisis

**Revisión semanal:** gasto frente a ritmo del presupuesto · CPA/ROAS frente a metas (separando marca de no marca) · mejores y peores anuncios · rendimiento por audiencia · frecuencia (riesgo de fatiga) · tasa de conversión de la página. (Es una buena **rutina** semanal de la oficina para `ada`: el informe es la entrega y las decisiones esperan el OK del dueño.)

**Atribución:** la atribución de la plataforma está inflada; usa UTM de forma consistente; compara los datos de la plataforma con GA4; mira el CAC combinado, no solo el CPA de la plataforma. Ver `atribucion` y `medicion-analitica`.

**Marca frente a no marca (mídelos por separado).** Donde la gente puede buscar tu nombre, separa marca de no marca *antes* de evaluar u optimizar nada. Una búsqueda de marca es demanda que ya existía: un CPA de marca barato o un ROAS de marca alto es una lectura de tu reconocimiento, no de la eficiencia de los medios. **Informa el combinado, optimiza sobre lo no marca:** el ROAS/CAC combinado es el número de salud general; pero la métrica contra la que fijas metas, pujas y presupuestos es el **ROAS de no marca**. Nunca presentes un CPA de marca bajo como un logro: solo es señal si mides incrementalidad (por ejemplo, con un grupo de control sin la campaña de marca).

**Disciplina de escalamiento (el efectivo neto > el porcentaje de ROAS).** El fallo más común: un negocio con ROAS de 40 que gasta poco y se niega a escalar porque «si gasto más, bajará mi ROAS». Es el marco equivocado. El flujo de efectivo neto > el ROAS: bajar de 10 a 5 suena mal, pero si el gasto pasa de 10 mil a 100 mil, el beneficio total sube muchísimo. Juzga el espacio para escalar con el ROAS combinado del negocio, pero optimiza sobre el de no marca. Mejor aún: optimiza el flujo de caja libre neto. **Encuentra tu ROAS de equilibrio:** 1. calcula lo máximo que puedes pagar por un cliente y seguir siendo rentable (con el valor de por vida) · 2. ese es tu techo de CPA o ROAS de equilibrio · 3. **escala hasta acercarte a ese techo**, no hasta que el ROAS de la cuenta baje de una preferencia arbitraria. Ver también `periodo-de-recuperacion.md`.

**La revisión de 3 horas del dueño:** bloquea **3 horas al mes** en el calendario para revisar tú mismo los números, no lo que diga el analista ni el gestor de medios. La confianza que da es irreemplazable, y es lo que permite escalar con convicción: «los datos dan confianza; la confianza da velocidad».

**Llama a los contactos que no convirtieron:** cada contacto que descargó un imán o entró al embudo sin comprar recibe una llamada: qué no entendió, cuál fue el bloqueo real. Esas respuestas textuales se vuelven anuncios de manejo de objeciones: un ciclo de aprendizaje a creatividad que la mayoría se salta.


