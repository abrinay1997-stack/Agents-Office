# Manual de ABM pagado (marketing basado en cuentas)

Marketing basado en cuentas (ABM) con anuncios: apuntar a empresas concretas y nombradas en LinkedIn y Meta, acelerar el pipeline abierto y unir canales. Los anuncios de ABM son un movimiento de *influencia en el pipeline*, no de generación de contactos; mídelos en consecuencia. Aplica a quien vende a empresas (B2B): una agencia, una constructora, un proveedor industrial, un SaaS.

## Contenido

- Cuándo hacer ABM (sí o no)
- ABM en LinkedIn
- ABM en Meta
- Campañas de aceleración (anuncios sobre el pipeline abierto)
- Orquestación entre canales
- Remarketing entre canales con UTM
- Orquestación con ventas
- Cómo medir el ABM

## Cuándo hacer ABM (sí o no)

Haz ABM pagado cuando: la lista de cuentas objetivo tiene ≥ ~1.000 empresas (o aceptas la economía de 1:1 / 1:pocas), el valor de cada venta es de ~US$25.000 o más (o su equivalente en la moneda de la empresa), el ciclo de venta es de 60+ días, ventas y marketing están realmente alineados con la lista y (para Meta) hay enriquecimiento de contactos.

Sáltatelo cuando: la lista tiene menos de ~500 cuentas sin enriquecimiento, no hay datos propios, el presupuesto es menor de ~US$3.000 al mes o el ciclo es corto y transaccional: la segmentación estándar por cliente ideal rendirá más.

## ABM en LinkedIn

Tres movimientos, según el tamaño de la lista:

- **1:1**: agregas la empresa por nombre; creatividad totalmente personalizada para una cuenta.
- **1:pocas**: hasta ~10–20 cuentas por campaña, con un dolor o ángulo de industria compartido.
- **1:muchas**: lista subida (o segmentación nativa), creatividad a escala.

**Mecánica de las listas:**
- LinkedIn necesita **300 miembros emparejados como mínimo** para mostrar anuncios; apunta a 1.000+ filas (repetir nombres de empresa para rellenar la carga está bien: se deduplica al emparejar). Las listas de contactos emparejan mejor a escala (LinkedIn sugiere ~10.000 correos); **las listas de empresas superan a las de contactos** para la mayoría de los equipos: son más fáciles de conseguir, emparejan mejor y piden menos mantenimiento.
- Las audiencias ABM en frío necesitan ~15.000 miembros para entregar de forma confiable.
- **Segmenta las listas mezcladas.** Si la dejas como una sola audiencia, LinkedIn sirve de más a las empresas más grandes de la lista: hay cuentas que se quedaron en un 15 % de cobertura porque el algoritmo se estacionó en unas pocas empresas grandes. Sepáralas en bandas homogéneas (p. ej., grande / mediana / pequeña) con campañas y presupuestos distintos.
- La segmentación por lista suele comprar alcance bastante más barato que la segmentación firmográfica nativa, con más interacción de quienes deciden.
- Usa el informe de interacción por empresa (Audiencias → entrar a la lista) para encontrar cuentas prioritarias mal atendidas y sacarlas a una campaña dedicada.

**Creatividad 1:1 personalizada:** poner el nombre o el logo de la cuenta objetivo en la creatividad puede subir el CTR ~5–10 veces frente a anuncios genéricos. **Excepción legal: no mostres anuncios personalizados con nombre o logo de empresa en Alemania**: es ley de privacidad, no política de la plataforma. (Revisa también las reglas de privacidad de tu país.)

**Tope de frecuencia:** apunta a ~3 impresiones por persona a la semana en las cuentas prioritarias. Mecánica: arma una audiencia de interacción por empresa con las cuentas que superaron ~500 impresiones en los últimos 7 días y agrégala como *exclusión*; las cuentas salen solas de la rotación al enfriarse. Ajusta el umbral (300 si se nota fatiga, 750 para más presión).

## ABM en Meta

Meta no tiene segmentación nativa por empresa: la jugada es **traer tu propia audiencia emparejada**:

- **El problema del emparejamiento:** las exportaciones de CRM con correos de trabajo emparejan en Meta por debajo de ~5 %. Los proveedores de enriquecimiento (herramientas de grafo de identidad que resuelven identidades de trabajo a perfiles personales) suben el emparejamiento a ~40–85 %. Flujo: criterios firmográficos → emparejamiento por grafo de identidad → subir como Audiencia Personalizada → segmentar directamente o sembrar una audiencia similar del 1 %.
- **Tamaños mínimos:** audiencias de lista de cuentas ~1.000 empresas (5–10.000 es lo óptimo); los cortes de remarketing funcionan hasta ~100 cuentas; las semillas de audiencias similares quieren 500+.
- Advantage+ **choca con el ABM estricto**: no se queda ceñido a tu lista. Corre las campañas de ABM en manual (o híbrido: manual para la lista, Advantage+ para la capa amplia).
- El papel de Meta en el ABM es de «cobertura aérea» barata y de **multi-hilo** (llegar al comité de compra más allá de tu aliado interno) mientras LinkedIn hace la precisión; mira el reparto más abajo.

## Campañas de aceleración (anuncios sobre el pipeline abierto)

Anuncios dirigidos a cuentas que ya están en tu pipeline, para acelerar los tratos, no para originarlos:

- Segmenta el CRM por etapa (evaluación / propuesta / negociación), filtra los tratos que valen el gasto, sube la lista como audiencia y refréscala cada semana.
- **Usa un objetivo de reconocimiento o alcance, no de conversiones**: mantienes a la empresa presente para el comité de compra; no le pides a cuentas en el pipeline que «agenden una demo» que ya agendaron.
- Creatividad: casos de éxito, pruebas y respuestas a objeciones, ajustados a la etapa. El presupuesto escala con el valor del trato (los tratos grandes abiertos justifican US$100–200 al día de cobertura aérea; los estancados reciben una dosis de mantenimiento).

## Orquestación entre canales

Reparto por defecto para ABM B2B: **~60 % LinkedIn / ~30 % Meta / ~10 % otros**. LinkedIn compra precisión (la persona y la empresa correctas) a CPM de US$40–70; Meta compra presencia y alcance al comité a US$10–25. Empieza por LinkedIn para validar la audiencia y luego extiende a Meta. El ABM multicanal supera de forma consistente y material al de un solo canal en interacción y conversión: los canales se suman, no compiten.

## Remarketing entre canales con UTM

La audiencia barata de mejor calidad que puedes armar: hacer remarketing en una plataforma a quienes hicieron clic ya validado en otra.

1. Etiqueta todo el tráfico pagado con UTM consistentes (`utm_source=linkedin`, `utm_source=google&utm_medium=cpc`).
2. En Meta, arma una Audiencia Personalizada de sitio web con la regla **«la URL contiene `utm_source=linkedin`»** (o `utm_source=google`).
3. Haz remarketing a esa audiencia en Meta: calidad de audiencia de LinkedIn a CPM de Meta (alcance típicamente 50–70 % más barato).

Funciona en ambas direcciones (de quienes hicieron clic en búsqueda a remarketing en LinkedIn hace falta un volumen de búsqueda importante: vale la pena por encima de ~US$30.000 al mes de gasto en búsqueda). Requiere suficiente tráfico del canal de origen para superar los tamaños mínimos de audiencia. Usa un identificador consistente de cuenta o campaña en las UTM para que la atribución sobreviva al salto.

## Orquestación con ventas

Un ABM sin seguimiento de ventas es gasto en cartelera:

- Lleva las señales de interacción con los anuncios al CRM (exportaciones de interacción por empresa de LinkedIn, o conectores que sincronicen la interacción por cuenta) y trata un pico de interacción como un disparador para ventas: **contacto en ~48 horas** desde el pico.
- Manda los contactos nuevos a un canal compartido (un mensaje en Slack o WhatsApp del equipo) con una reacción de calidad por campaña (👍/👎): el ciclo de retroalimentación de calidad más barato que existe.
- Haz una sesión mensual entre ventas y marketing sobre la lista misma: quién interactúa, quién está callado, quién cerró, y vuelve a recortar la lista.
- Es normal esperar ~7–10 toques entre canales antes de una conversación de ventas con tratos de este tamaño.

## Cómo medir el ABM

Juzga el ABM por el movimiento de las cuentas, no por el costo por contacto (CPL):

- **Penetración de cuentas** (% de la lista alcanzada): apunta a ~40–60 %.
- **Costo por cuenta interesada** (no por clic): una banda de ~US$100–300 es razonable.
- **Tasa cuenta → oportunidad:** ~10–20 %.
- **Pipeline influenciado:** apunta a 3–5 veces el gasto; espera mejoras en tasa de cierre y velocidad en cuentas con interacción frente a las que no.
- **Incrementalidad:** deja fuera de los anuncios ~20 % de la lista y compara la formación de pipeline después de 21+ días: la única respuesta honesta a «¿hicieron algo los anuncios?».

Importes en la moneda de la empresa: úsalos como órdenes de magnitud, no como cifras fijas.

---

*Linaje del marco: adaptado (reexpresado y reestructurado) de manuales de profesionales, en especial ads-skills de Ivan Falco. Los umbrales son puntos de partida reportados por profesionales: recalíbralos con tus propias cuentas.*
