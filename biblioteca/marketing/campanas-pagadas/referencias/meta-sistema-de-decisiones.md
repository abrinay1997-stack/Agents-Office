# Sistema de decisiones para Meta (B2B)

Un motor cuantificado de cortar / mantener / escalar para anuncios de Meta. Cada umbral sale de un solo número ancla, así que las decisiones se vuelven aritmética en vez de corazonadas. Va junto al manual estratégico de Meta de SKILL.md (la creatividad como segmentación, el volumen creativo): este archivo es la capa de *operación*. Los ejemplos son B2B con contratos grandes; el método (un número ancla y todo en múltiplos de ese número) sirve igual para una tienda o un negocio local si cambias «contacto calificado» por «venta» o «cita».

## Contenido

- TCPL: la variable ancla
- El techo de cantidad de anuncios
- Estructura de dos campañas (Escalamiento / Pruebas)
- Pruebas de destino (CBO por perfil, un conjunto de anuncios por destino)
- Etapa 1: revisión de entrega (día 7)
- Etapa 2: evaluación de calidad (semanal)
- Criterios de graduación
- Detección de fatiga
- Reglas de relevo
- Matemática de producción creativa
- Protocolo de escalamiento
- Cadencia semanal
- Formularios de contactos y la «amnesia social»
- Transición a Advantage+
- Anuncios de alianza (la palanca de alcance nuevo)
- El alcance móvil como señal de salud
- Puntos de comparación y estacionalidad

## TCPL: la variable ancla

TCPL = **costo objetivo por contacto calificado** (Target Cost Per Qualified Lead; calificado = cumple tu nivel de cliente ideal, no solo llenó un formulario). Fíjalo de una de tres maneras:

1. **Con la matemática del trato (la mejor):** TCPL = costo objetivo por demo × tasa de contacto-calificado-a-demo. ($2.000 por demo × 0,28 = $560.)
2. **Con el historial:** TCPL = CPL(calificado) de los últimos 30 días × 0,80: una mejora del 20 % es alcanzable solo con limpieza operativa (cortar los anuncios sin contactos calificados, graduar a los ganadores). Cuando tengas ambos, usa el más estricto.
3. **Cuenta nueva:** CAC objetivo × tasa de contacto-calificado-a-cliente, o un valor provisional según el rango de valor del contrato; reemplázalo con el método 2 a los 30 días.

Todas las reglas de abajo se expresan en múltiplos del TCPL. Revisa el TCPL cada mes. (Valores y tasas, de las cifras de la empresa o de su CRM; si faltan, pregunta o márcalos como supuesto.)

## El techo de cantidad de anuncios

Más anuncios activos de los que tu presupuesto puede alimentar = todos pasan hambre y ninguno recibe una lectura justa.

**Techo = (presupuesto diario × 14) / (2 × TCPL)**: es decir, en una ventana de evaluación de 14 días, cada anuncio necesita al menos 2 veces el TCPL de gasto para juzgarlo.

$1.000 al día con un TCPL de $500 → techo de 14 anuncios; corre **6–10** (ganadores + 2–3 espacios de prueba). En el techo, lanzar una prueba nueva exige cortar algo antes.

## Estructura de dos campañas (Escalamiento / Pruebas)

Corre dos campañas con presupuesto a nivel de campaña (CBO) sobre la **misma audiencia**:

- **Campaña de escalamiento (~80 % del presupuesto)**: solo anuncios graduados y probados.
- **Campaña de pruebas (~20 %)**: conceptos nuevos e iteraciones, con su propio presupuesto protegido.

Por qué: dentro de una sola CBO, los anuncios probados siempre dejan sin gasto a los nuevos: las pruebas nunca reciben lo suficiente para juzgarse. Por qué no ABO (presupuesto por conjunto) para probar: el reparto igual forzado sigue gastando en anuncios que Meta ya despriorizó. La separación es *protección de presupuesto*, no segmentación de audiencia.

**Validación primero con imagen:** lanza los conceptos nuevos primero como estáticos; produce la versión en video, carrusel o contenido de usuarios solo después de que la imagen pase las revisiones de abajo. Excepción: los conceptos que son video por naturaleza (testimonio, demostración, UGC). (Los estáticos se preparan con el Estudio: `generar_imagen`.)

## Pruebas de destino (CBO por perfil, un conjunto de anuncios por destino)

Una estructura complementaria para cuando **la página de destino, no la creatividad, es la mayor incógnita**: una CBO por perfil de cliente; dentro de ella, un conjunto de anuncios por tipo de destino (ficha de producto, artículo tipo lista o publirreportaje, cuestionario, página de demo) con las **mismas creatividades en cada conjunto**. Mantener la creatividad constante limpia la lectura: cualquier divergencia de CPM o rendimiento entre conjuntos es el destino.

Por qué funciona: el destino es un eje de prueba del mismo rango que la creatividad: un embudo perdedor puede esconder una creatividad ganadora, y distintos perfiles convierten por embudos de forma distinta. La CBO reparte el presupuesto entre destinos como lo hace entre anuncios, y los profesionales que lo corren reportan amplias diferencias de CPM y rendimiento entre destinos y ganancias significativas de alcance nuevo (~30 %) por la variedad añadida.

Encaje con la estructura de dos campañas: trata una prueba de destino como una prueba de concepto: córrela en la campaña de pruebas con presupuesto protegido, juzga cada conjunto contra el TCPL con los umbrales de gasto de siempre y luego gradúa la pareja ganadora creatividad × destino. *Patrón reportado por un profesional (Alexander Pauwelyn, 2026), no una mecánica documentada por la plataforma: valídalo con los datos de tu propia cuenta.*

## Etapa 1: revisión de entrega (día 7)

El reparto de gasto de la CBO es en sí una señal: Meta preselecciona tus anuncios. En el día 7, para cada anuncio de prueba:

- **Prueba de la parte justa:** gasto mínimo esperado = (presupuesto diario de la campaña ÷ anuncios activos) × 7 × 0,5. Por debajo → **corta** (Meta lo despriorizó activamente). Gasto cero → corta de inmediato.
- **En curso:** si un anuncio gastó ≥ 1× TCPL en total Y promedió menos de ~$10 al día en los últimos 7 días → corta. (El umbral de gasto acumulado evita que cortes anuncios que la CBO simplemente aún no exploró.)

Al iterar sobre un anuncio cortado por entrega, cambia **solo el gancho, lo visual o el formato**: la audiencia nunca llegó lo bastante lejos para que el texto o el llamado a la acción importaran.

## Etapa 2: evaluación de calidad (semanal, con datos móviles de 14 días)

Sigue el orden; detente en la primera acción que se dispare:

1. **Umbral de datos:** gasto < 3× TCPL → **espera** (no hay suficiente señal). Con un costo real por contacto calificado igual a la meta, 3× TCPL de gasto debería producir ~3 contactos calificados; cero contactos calificados con ese gasto tiene ~5 % de probabilidad: así que juzgar a 3× da ~95 % de confianza sin malgastar presupuesto (a 2× hay 13 % de falsos negativos; a 5× pagas de más por certeza).
2. **Cero contactos del píxel** con ≥3× TCPL → **relevo y abandona el concepto** (no itere un concepto muerto).
3. **Revisión de calidad** (la capa que Meta no puede ver; requiere tu CRM):
   - Contactos del píxel pero ninguno calificado → relevo; conserva el formato, cambia el ángulo.
   - Tasa de calificados <40 % → relevo; el anuncio atrae a la gente equivocada. Añade lenguaje que filtre por cliente ideal. (Con una tasa del 40 %, el costo real por contacto calificado es 2,5 veces el CPL del píxel que ves en el administrador de anuncios: dos anuncios idénticos dentro de la plataforma pueden diferir 60 %+ en costo real.)
   - 40–60 % → vigila una semana más. ≥60 % → sigue.
4. **Revisión de costo:** costo por contacto calificado ≤ TCPL → candidato a ganador. 1–1,5× TCPL → vigila (varianza normal). >1,5× TCPL → relevo (bajo rendimiento estructural, no ruido).

## Criterios de graduación (de Pruebas a Escalamiento)

Gradúa solo cuando se cumplan **todas**: ≥5 contactos calificados · tasa de calificados ≥60 % · costo por contacto calificado ≤ TCPL · corriendo ≥14 días · ≥1 contacto calificado en los últimos 7 días.

## Detección de fatiga

Bandas de frecuencia por tipo de campaña (segura / alerta / crítica):

| Tipo de campaña | Segura | Alerta | Crítica |
|---|---|---|---|
| Prospección en frío | 1,0–2,5 | 2,5–4,0 | >4,0 |
| Remarketing | 2,0–4,0 | 4,0–6,0 | >6,0 |
| ABM (audiencias pequeñas) | 2,0–5,0 | 5,0–8,0 | >8,0 |

Otras señales, por orden de urgencia: CTR baja 20 %+ frente a la línea base en 7 días; CPM sube 30 %+ en 2 semanas (indicador adelantado: se mueve antes que el CTR); rankings de relevancia del anuncio «por debajo del promedio»; CPA sube con segmentación estable.

Para **los anuncios de la campaña de escalamiento**, aplica un listón deliberadamente más estricto que las bandas generales: esos anuncios llevan ~80 % del gasto, así que ahí la fatiga cuesta más: alerta con frecuencia de 3,0–3,5 o costo +20 % → empieza ya 2 iteraciones (tardan ~14 días en estar listas); relevo con >3,5, costo +40 % o >1,5× TCPL durante 2 semanas.

**Vida útil esperada (B2B):** estáticos 14–28 días; video corto y carruseles 21–35; UGC y testimonios 28–42. Las audiencias B2B pequeñas acumulan frecuencia rápido: planea renovar cada 14–21 días.

**Retira (no itere)** cuando el CTR caiga 30 %+ desde su pico o la frecuencia cruce la banda crítica de arriba para el tipo de campaña: el concepto está agotado, no la ejecución.

**Rotación sin reiniciar el aprendizaje:** nunca edites la creatividad dentro de un anuncio que rinde: eso reinicia la fase de aprendizaje. Lanza anuncios nuevos junto a los existentes, o crea un conjunto nuevo con la misma segmentación. Pausar no reinicia; editar sí.

## Reglas de relevo

**Nunca pauses sin un reemplazo.** Ten preparadas 2–3 iteraciones; el reemplazo sale en vivo en 7 días, de inmediato ante fatiga crítica. Si la cartera está vacía, redirige el presupuesto a anuncios probados en lugar de dejar un zombi corriendo. Qué cambiar depende de por qué murió: corte por entrega → gancho y visual; corte por calidad → ángulo y lenguaje de cliente ideal; corte por costo → oferta y audiencia; fatiga → ejecución nueva del mismo concepto probado.

## Matemática de producción creativa

- **Capacidad de pruebas** ≈ (presupuesto mensual × 0,20) ÷ (3 × TCPL), por mes. Los cortes por entrega liberan presupuesto pronto, así que la capacidad real corre ~1,5–2 veces la base.
- **Tasas de acierto:** iteraciones sobre ganadores ~25 %; conceptos totalmente nuevos ~10 %; combinado ~1 de cada 6. Para obtener N ganadores, planea ~6× N pruebas.
- **Inventario mínimo de anuncios probados** ≈ presupuesto mensual ÷ $5.000: cada anuncio B2B probado absorbe unos $5.000 al mes antes de fatigarse. **No puedes escalar el presupuesto por delante de la oferta creativa**; si los anuncios probados están por debajo del mínimo, arregla el déficit creativo antes de subir el presupuesto.
- **Prioridad de iteración** al renovar un ganador (por impacto): 1. gancho (cambia quién se detiene) → 2. tratamiento visual → 3. formato → 4. texto del cuerpo / llamado a la acción.

## Protocolo de escalamiento

Escala solo cuando se cumplan todas: la cantidad de anuncios probados alcanza el mínimo del siguiente nivel de presupuesto; frecuencia de la cuenta <3,0; costo por contacto calificado ≤ TCPL durante 2+ semanas seguidas; 3+ reemplazos preparados.

- **Ritmo:** +20 % cada 5 días. Nunca +30 % o más de una vez: reinicia el aprendizaje.
- **Disparador de reversa:** costo por contacto calificado >1,5× TCPL tras un paso de escalamiento → recorta el presupuesto 20–30 % de inmediato, estabiliza 2 semanas y reanuda con +10 % por semana.
- **Chocar con el muro** (frecuencia promedio de toda la cuenta >3,5: una barrera de *escalamiento* a nivel de cuenta, distinta de las bandas de fatiga por anuncio de arriba): amplía las audiencias similares del 1 % al 2–3 %, agrega audiencias semilla nuevas, prueba amplio, activa audiencias entre canales con UTM (ver `abm-cuentas-objetivo.md`), reabre el remarketing.

## Cadencia semanal

- **Lunes: día de decisión:** saca los datos móviles de 14 días; corre la Etapa 2 en cada anuncio de prueba; corre la revisión de fatiga en cada anuncio de escalamiento.
- **Miércoles: día de lanzamiento:** lanza pruebas nuevas en los espacios liberados; corre la Etapa 1 en los anuncios que llegaron al día 7.
- **Viernes: día de escalamiento:** aplica los pasos de escalamiento o las reversas.
- **Cada mes:** auditoría de la biblioteca de creatividades + revisión del TCPL.

(En la oficina esta cadencia se puede convertir en una **rutina** semanal para el agente de anuncios, con el informe como entrega y las decisiones —pausar, escalar, relevar— esperando el OK del dueño.)

## Formularios de contactos y la «amnesia social»

El problema n.º 1 de calidad de contactos B2B en Meta: los formularios sin fricción que se autocompletan producen contactos que no recuerdan haber convertido («amnesia social»). **Fricción intencional = conciencia = calidad:**

- Usa el tipo de formulario **Mayor intención** (agrega un paso de revisión), no Mayor volumen.
- **Exige el correo de trabajo**: no se autocompleta desde el perfil de Facebook y obliga a un acto consciente. Es la mayor palanca de calidad.
- Agrega 1–3 preguntas de calificación de opción múltiple (con 4+ se dispara el abandono), de la más fácil a la más difícil.
- El mensaje de confirmación fija expectativas de lo que pasa después (combate la amnesia en la etapa de seguimiento).

Formulario frente a página de destino: si la página convierte ≥5 % → usa la página; si está por debajo de ~2 % → formulario; ofertas de demo o prueba → página; contenido o seminario web → formulario.

## Transición a Advantage+

Lo manual es donde aprendes; Advantage+ es donde ganas. Pasa una campaña a Advantage+ solo tras tener: una oferta probada, una audiencia validada y **~50 conversiones a la semana** en el evento de optimización (el listón para salir del aprendizaje; presupuesto necesario ≈ CPA objetivo × 50 ÷ 7 por día). Si no llegas a 50 por semana en el evento objetivo, optimiza un evento de mayor volumen más arriba en el embudo y haz remarketing a quienes convirtieron. Advantage+ choca con el ABM estricto (no se puede atar a una lista): ver `abm-cuentas-objetivo.md`. Mira el puntaje de campaña (Campaign Score) solo como dirección (70+ sano, <50 = peleas con el algoritmo), pero nunca cambies calidad de contactos por puntaje.

## Anuncios de alianza (la palanca de alcance nuevo)

Todo lo de arriba optimiza *la conversión dentro de una audiencia a la que Meta ya te muestra*. Los anuncios de alianza (partnership ads) son cómo llegas a una **nueva**. Andromeda segmenta por **perfil**, no por listas de intereses, y los seguidores de un creador *son* un perfil ya armado. Correr un anuncio como alianza (contenido de marca desde la cuenta del creador) hereda esa audiencia semilla, así que el algoritmo se expande desde personas que ya confían en el creador que da la cara. Es la palanca de mayor impacto en Meta ahora mismo; una cuenta seria sin anuncios de alianza va a una pelea de espadas con un cuchillo de mantequilla.

**Dónde encaja en el sistema de decisiones:** los anuncios de alianza son un movimiento de *escalamiento*, no un truco de pruebas. Cuando la cuenta choca con el muro (frecuencia >3,5, alcance móvil aplanándose; ver abajo), el paso «agrega audiencias semilla nuevas» del protocolo de escalamiento es en buena parte *esto*. Júzgalos contra el TCPL como cualquier otro anuncio, pero espera otro modo de fallo: un anuncio de alianza débil suele ser el *creador* equivocado, no el gancho equivocado.

**Manual de anuncios de alianza:**

1. **Prueba antes de promover.** No pagues por impulsar la publicación de un creador por fe. Deja que su contenido corra orgánicamente (o en una prueba barata de tráfico o interacción) primero; promueve solo las piezas que ya ganan guardados, compartidos y reproducción completa. El gasto pagado amplifica lo que funciona; no rescata a un creador plano.
2. **Elige por coincidencia de perfil, no por número de seguidores.** La audiencia semilla solo ayuda si los seguidores del creador *son* tu cliente ideal. Un creador de 15.000 seguidores cuya audiencia es exactamente tu comprador vence a un generalista de 500.000. Revisa la audiencia, no la métrica de vanidad.
3. **Lo básico del trato:** consigue **acceso de lista blanca / socio de contenido de marca** (correr anuncios *desde la cuenta del creador*, no solo reposts: esto es lo que desbloquea la audiencia semilla) con **derechos de uso** por una ventana definida (típicamente 3–6 meses, renovable) más **derechos de gasto y amplificación pagada**. Paga una tarifa fija por el contenido; añade precios por entregable para cortes extra. Evita el reparto puro de ingresos con creadores en frío: aún no puedes atribuir con claridad. (Los contratos y los pagos los gestiona y aprueba el dueño.)
4. **Táctica complementaria: encarga estáticos sencillos por creador.** Cuando contrates a un creador para el video de la alianza, encarga *también* unos estáticos rápidos y de baja producción (estilo captura de pantalla, «como lo publicaría en su propia historia»). Cada creador se vuelve entonces un **mini embudo**: el video de la alianza perfora el alcance frío nuevo, y los estáticos sencillos sostienen la conversión a mitad del embudo bajo el mismo rostro de confianza. Es barato de añadir y multiplica el retorno de la relación con el creador.

La guía por formato sobre *qué* formatos con creador al frente correr (contenido del fundador, «yapper», autoridad, investigación amateur, estáticos sencillos de creador, etc.) vive en la taxonomía de formatos de `creatividad-anuncios`.

## El alcance móvil como señal de salud

El **alcance móvil mes a mes** (personas únicas alcanzadas) es el medidor de audiencia nueva de la cuenta: lo que las métricas de conversión no pueden decirte. El CPL y el ROAS pueden verse bien mientras reciclas en silencio el mismo grupo que se encoge; la señal es que el alcance se aplana o cae mes a mes aunque el gasto se mantenga.

- **Síguelo cada mes** junto a la revisión del TCPL. Un alcance móvil a la baja es un indicador *adelantado* del muro de frecuencia (se mueve antes de que la frecuencia cruce 3,5 y antes de que se disparen los CPM).
- **Disparador:** alcance móvil a la baja mes a mes → **despliega anuncios de alianza** para recuperar alcance nuevo (audiencias semilla nuevas), antes de que las bandas de fatiga te obliguen. Trátalo como la misma clase de barrera que el techo de frecuencia del protocolo de escalamiento: una señal de escalamiento a nivel de cuenta, no una lectura de fatiga por anuncio.

## Puntos de comparación y estacionalidad

Rangos de Meta para SaaS B2B (reportados por profesionales; recalíbralos con tus primeros 30 días): CTR 1,0–1,5 % (alarma <0,8 %); CPM $10–20 (alarma >$25); CPL (formulario) $20–50 (alarma >$75); conversión de la página de destino 8–12 %. Estacionalidad: los CPM del primer trimestre son los más bajos del año (escala con decisión); el cuarto trimestre corre +60–80 % (considera reducir el gasto B2B y guardar presupuesto para enero). En comercio minorista y consumo, el pico de demanda de fin de año y de fechas comerciales (Día de las Madres, Black Friday, Navidad) manda al revés: ahí el cuarto trimestre es temporada alta; planea el presupuesto con el calendario de la empresa.

---

*Linaje del marco: este sistema de decisiones está adaptado (reexpresado, reconciliado y reestructurado) de sistemas operativos de profesionales, en especial ads-skills de Ivan Falco. Todos los umbrales son puntos de partida: recalíbralos con tu propia cuenta.*
