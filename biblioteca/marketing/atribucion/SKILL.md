---
name: atribucion
titulo: Atribución de marketing
description: Úsala cuando haya que saber qué marketing causa de verdad las ventas, elegir o leer un modelo de atribución, conciliar cifras que no coinciden entre Google, Meta, analítica y CRM, o diseñar cómo medir por cuenta propia.
area: pagados-y-medicion
departments: [marketing, ops]
agents: [mlead, ada, riley, report]
origen: marketingskills/attribution (MIT, Corey Haines)
palabras: [atribución, qué canal funciona, retorno, ROI, de dónde vienen las ventas, modelo de atribución]
---
# Atribución de marketing

Sirve para responder la pregunta más difícil del marketing: **¿cuál de mis esfuerzos causó de verdad esta venta y estos ingresos?** Aquí es donde más dinero se pierde: en canales que se ven bien en un panel y mal en otro, en el «directo» y la «búsqueda de marca» que esconden el origen real, y en modelos que convierten una opinión en un hecho sin avisar.

Esta habilidad tiene dos pilares. Antes de empezar, define cuál necesita el dueño:

- **(A) Interpretación:** elegir un modelo de atribución, elegir cómo medir y **conciliar las cifras que se contradicen** entre herramientas. Sirve para cualquiera, aunque no tenga ningún ingeniero.
- **(B) Atribución propia (datos propios):** instrumentar y unir la atribución por cuenta propia cuando la empresa controla su sitio o su app. Es el camino de construcción: úsalo cuando el dueño diga «quiero medirlo yo mismo» o cuando la conversión ocurra en un dominio que no es suyo (un sistema de reservas, un pago alojado fuera). **Tú no programas ni instalas nada:** entregas el diseño y las instrucciones para quien lo implemente (el dueño, su desarrollador o su proveedor de analítica).

La mayoría de los pedidos empiezan en (A). Pasa a (B) solo cuando hay control de la superficie y ganas de construir.

## Antes de empezar

Lee las notas de la empresa en el Cerebro (`00-Empresa/perfil`, `00-Empresa/oferta`, `00-Empresa/clientes` y, sobre todo, `00-Empresa/marketing`) y las cifras de la empresa. Si falta algo, pregúntalo en una línea (o con `pedir_bloqueo` si sin eso no puedes seguir) o déjalo marcado como supuesto; nunca lo inventes. **Las cifras que dé el dueño (ventas, gasto, conversiones por herramienta) se usan tal cual.**

Pregunta solo lo que falte: ¿qué decisión informa esto (presupuesto, apagar un canal)? · ¿cuál es la conversión principal y dónde ocurre (compra, cita, llamada, WhatsApp, visita a la tienda)? · ¿qué cifra reporta cada herramienta (Google, Meta, analítica, CRM o libro de ventas)? · ¿cuánto dura el ciclo y cuántas personas deciden? · ¿cuánto se invierte al mes y en qué canales, dentro y fuera de línea? · ¿se pregunta «¿cómo nos conociste?» y dónde se guarda?

No tienes acceso a las cuentas de anuncios ni a la analítica salvo que la empresa tenga conectado algo que lo permita: pídele al dueño las cifras (captura, tabla, reporte exportado). Para redes orgánicas puedes usar `ver_analiticas` y `ver_informe_mes` si Meta está conectada.

## Límites: lo que esta habilidad NO hace

- **Eventos, plan de medición, UTM, GA4/GTM** → `medicion-analitica` (la atribución *supone que el seguimiento ya existe*).
- **Píxeles, API de conversiones, seguimiento del servidor** → `campanas-pagadas` (aquí solo se corrige el sesgo de lo que reportan).
- **Etapas del embudo, ciclo de vida, ingresos desde el CRM** → `operaciones-ingresos`.
- **Aparecer en buscadores de IA** → `seo-para-ia` (aquí solo se nombra el punto ciego).

## Pilar A: Interpretación

### 1. Qué puede y qué no puede decirte la atribución

- **Es una dirección, no la verdad:** un modelo de causalidad con datos incompletos (cookies que caducan, aparatos distintos, contactos fuera de línea).
- **Todo modelo es una opinión:** primer contacto da todo el crédito al primer anuncio; último contacto, al clic de cierre. Elegir uno es elegir a quién creerle la historia: dilo en voz alta.
- **La brecha es normal:** lo que suman los canales casi siempre supera las ventas reales, porque cada plataforma se adjudica la misma venta. Reduce y explica la brecha; no esperes que cuadre.

Si el dueño exige «el número verdadero»: «Podemos darte un número **defendible y consistente** y una lectura de qué canales suben; una verdad única no existe, y con esto decidimos de todos modos».

### 2. Modelos de atribución

Primer contacto, último contacto, último no directo, lineal, decaimiento temporal, basado en posición (40/40/20) y basado en datos (Shapley). La tabla completa (regla de crédito, para qué sirve, cómo miente) y un recorrido resuelto de seis maneras están en `referencias/modelos-atribucion.md`; léela antes de recomendar uno. **Todo modelo es una opinión**, y el último no directo es solo una variante del último contacto.

**Reglas prácticas:**
- Con ciclo largo, nunca reportes un solo modelo: muestra **primer y último contacto lado a lado**. La distancia entre ellos *es* el hallazgo.
- El modelo basado en datos necesita volumen (Google recomienda unas 200 conversiones y 2.000 interacciones con anuncios en 30 días); con menos, se parece al último clic. Con poco volumen, prefiere último clic, o primer y último contacto lado a lado sobre tus propios datos.
- Google Ads y GA4 retiraron en 2023 el primer clic, el lineal, el decaimiento y el de posición como modelos de reporte: hoy ofrecen basado en datos y último clic. Los demás se calculan sobre tu propio recorrido (CRM, almacén de datos).
- Importa menos el modelo que ser **consistente** y acompañarlo de una verificación fuera del modelo (la pregunta al cliente, §4).

### 3. Los tres paradigmas de medición

Los modelos reparten el crédito *dentro* de lo que rastreas; los paradigmas llegan a la *causalidad*, cada vez más rigurosos y caros: **MTA** (unir contactos por persona), **MMM** (regresión de inversión contra resultados en el tiempo, incluye lo fuera de línea) e **incrementalidad** (experimento: expuestos contra no expuestos). La comparación, cómo leer una prueba y las correcciones documentadas están en `referencias/paradigmas-de-medicion.md`.

**Cómo elegir:** presupuesto pequeño y ciclo corto → buenos UTM + último no directo + una pregunta al cliente rinden más que un modelo sofisticado. Presupuesto medio y varios canales → MTA para el día a día + incrementalidad periódica en lo más grande. Presupuesto grande con inversión fuera de línea y de marca → MMM + incrementalidad para validarlo. **La incrementalidad es el desempate** cuando dos canales reclaman las mismas conversiones.

### 4. Atribución declarada por el cliente

La señal más desaprovechada y, a menudo, la más honesta para ciclos largos y boca a boca: una pregunta «¿cómo supiste de nosotros?» en el momento de la conversión (en un mostrador o consultorio, que la persona la anote en el sistema). Atrapa lo que el seguimiento no ve: podcasts, WhatsApp, recomendaciones. Lista de tus canales **más un «otro / cuéntanos más»** abierto. Es insumo de triangulación, no evangelio: la gente recuerda el contacto *memorable*, así que **descuenta su peso** al convertirla en crédito. Detalle en `referencias/conciliar-fuentes.md`.

### 5. Conciliar fuentes que se contradicen

El pedido típico: **«Google dice 50, Meta 40, la analítica 60 y mi CRM 35: ¿quién tiene razón?»** Ninguno. Cada fuente se inclina a un lado (las plataformas se cuentan a sí mismas de más; la analítica favorece el último clic no directo y manda lo desconocido a «directo»; el CRM depende de lo que alguien capturó; la pregunta al cliente favorece lo memorable). Cómo triangular:
1. **Una sola fuente de verdad para el conteo de ventas** (CRM, sistema de la tienda o libro de ventas, donde el dinero es real). Lo demás explica *de dónde vinieron*, no *cuántas hubo*.
2. **Nunca sumes entre plataformas:** una conversión con dos reclamantes es una conversión. Quita duplicados contra el total real.
3. **Lee el acuerdo en dirección**, no la coincidencia absoluta.
4. **Desempata** con la pregunta al cliente y, si lo justifica lo que está en juego, con incrementalidad. **No** conviertas la brecha plataforma-analítica en un multiplicador.
5. **Presupuesta la brecha:** «las plataformas reclaman N; verificamos M; la diferencia es sobreconteo, vistas y lo no rastreado».
6. Cuando tengas una prueba o una encuesta confiable, aplica una **corrección documentada por canal**, no un multiplicador inventado.

El resultado es un reparto honesto con niveles de confianza, no una conciliación falsa al decimal. Tabla de sesgos y detalle en `referencias/conciliar-fuentes.md`.

### 6. Los puntos ciegos

Dónde se esconden las conversiones y hacen parecer débiles a canales reales: **directo** (el cajón de sastre: un problema de medición, no un canal), **búsqueda de marca** (gente que te descubrió en otro lado; sepárala de la no marca o desfinanciarás la parte alta), **tráfico privado** (WhatsApp, mensajes, grupos, podcasts: solo la pregunta al cliente lo ve), **tráfico de IA** (nómbralo y pasa el fondo a `seo-para-ia`) y **lo fuera de línea** (mostrador, ferias, llamadas; en un negocio local puede ser lo principal).

El hilo conductor: **cuando «directo» y «búsqueda de marca» dominan, tu parte alta del embudo está funcionando y tu atribución lo está escondiendo.** Dilo explícitamente: es el error de lectura más común del marketing.

### 7. Bifurcación por tipo de negocio

Resumen (las guías completas, en `referencias/por-tipo-de-negocio.md`):
- **Ciclo largo con venta asistida (B2B, servicios de alto valor, constructora, agencia):** CRM como fuente de verdad, primer contacto + basado en posición lado a lado, la pregunta al cliente como señal fuerte y el embudo e ingresos (`operaciones-ingresos`) como marcador real.
- **Tienda en línea o marca directa (ciclo corto):** ancla en el ROAS de la plataforma pero desconfía de él; MMM cuando la inversión sea material; incrementalidad en los canales grandes; encuesta después de la compra.
- **Negocio local o de servicios con cita (clínica, taller, restaurante, ferretería):** la conversión suele ocurrir fuera de la pantalla. La fuente de verdad es la agenda o el libro de ventas; la pregunta «¿cómo nos conociste?» en el primer contacto, siempre anotada, más números de llamada y cupones por canal. Un modelo sofisticado sobra.

---

## Pilar B: Atribución propia (datos propios)

Úsalo cuando la empresa **controla el sitio o la app** y quiere medir por sí misma, sobre todo si la conversión termina en un **dominio ajeno** (sistema de citas, pago alojado fuera). La especificación está en `referencias/seguimiento-propio.md`; **tú la entregas para quien programe**, no la ejecutas. La idea:

1. **Unir lo anónimo con lo conocido:** identificador anónimo con el origen de primer contacto; en la conversión, `identify()` con un identificador estable (correo o ID) fusiona el historial.
2. **Cerrar el hueco de `identify()`:** el fallo más común es que nada lo llame. **Audita primero** y cierra solo lo que falte. (Enfoque adaptado de Tessa Kriesel con PostHog.)
3. **Dominio ajeno:** al hacer clic se agrega el identificador *anónimo* al enlace por el paso de metadatos de la herramienta; esta lo devuelve en su webhook y el receptor fusiona y registra la conversión.
4. **Salvaguardas:** solo el identificador anónimo y, ante la duda, **nada**; limpia el primer contacto (redirecciones, subdominios propios, pruebas); verifica la firma del webhook; respeta las leyes de protección de datos de tu país y el RGPD si hay clientes europeos.
5. **Último tramo:** conversión por canal de primer contacto, recorrido completo guardado para los modelos del §2 y `origen`, `confianza` y `base` escritos en el CRM por cuenta (refinamientos de Tessa Kriesel).

## Cómo entregarlo

Entrega una **lectura de atribución**, no un volcado de datos. Un documento en Markdown con esta forma:

```markdown
# Lectura de atribución: [fecha]

## La pregunta
[Qué decisión informa, p. ej. «¿dónde ponemos el presupuesto del próximo trimestre?»]

## Fuente de verdad
[Qué sistema define el conteo de ventas y por qué]

## Qué dice cada fuente
| Canal | Reportado por la plataforma | Analítica | CRM / libro de ventas | Declarado por el cliente | Nuestra lectura |
|-------|----------------------------|-----------|----------------------|--------------------------|-----------------|
[Sin duplicados contra la fuente de verdad; nunca sumado]

## Comparación de modelos (si el ciclo es largo)
[Primer contacto contra último contacto lado a lado; la distancia es el hallazgo]

## Confianza y huecos
[La brecha de atribución, los puntos ciegos, lo que no podemos ver]

## Recomendación
[Decisión de reparto con niveles de confianza; la prueba de desempate que vale la pena correr]
```

Si el trabajo es del Pilar B, añade una sección «Especificación para quien lo implemente» con los pasos, las salvaguardas y la lista de verificación de `referencias/seguimiento-propio.md`. Si la recomendación exige trabajo de otro departamento (p. ej., instalar el seguimiento o ajustar el CRM), propónlo con `crear_borrador_tarea`. Si conviene repetir la lectura cada mes, propón una rutina.

## Reglas

- Nunca inventes cifras: ni ventas, ni gasto, ni porcentajes, ni resultados de pruebas. Lo que no esté en las notas, en las cifras o en lo que te pasó el dueño se marca como supuesto o pendiente.
- Nunca sumes conversiones entre plataformas.
- Nunca afirmes una atribución como verdad: siempre con su nivel de confianza y sus huecos.
- Un solo modelo, consistente; cambiar de modelo para que un canal se vea bien destruye la confianza en todo el programa.
- No conviertas la diferencia entre plataformas en un multiplicador sin una prueba de incrementalidad.
- Con datos personales, cierra ante la duda y respeta las leyes de protección de datos de tu país.
- Entregas borradores y especificaciones: cambiar presupuestos, apagar canales o instalar seguimiento lo decide y lo aprueba el dueño.

## Referencias

- `modelos-atribucion`: la tabla de modelos, un recorrido resuelto de seis maneras y Shapley sin tecnicismos. Para explicar por qué dos modelos discrepan o elegir uno.
- `paradigmas-de-medicion`: MTA, MMM e incrementalidad, cómo leer una prueba y las correcciones documentadas. Cuando la inversión sea material o dos canales reclamen lo mismo.
- `conciliar-fuentes`: la pregunta al cliente, la tabla de sesgos, cómo triangular y los puntos ciegos. Cuando las cifras no coincidan.
- `por-tipo-de-negocio`: guías de ciclo largo, tienda en línea, negocio local y mixto. Para definir fuente de verdad, modelo y herramientas.
- `seguimiento-propio`: la especificación del Pilar B. Cuando el dueño quiera medir por su cuenta o la conversión viva en un dominio ajeno.

## Habilidades relacionadas

- `medicion-analitica`: eventos, plan de medición, UTM y GA4. Se hace *antes* de la atribución.
- `campanas-pagadas`: píxeles de plataformas, API de conversiones y seguimiento del lado del servidor.
- `operaciones-ingresos`: etapas del embudo, ciclo de vida del prospecto y reportes de ingresos desde el CRM. La atribución los alimenta.
- `seo-para-ia`: el punto ciego del tráfico de IA en profundidad.
- `pruebas-ab`: experimentos controlados; la mentalidad de incrementalidad aplicada a cambios del sitio.
