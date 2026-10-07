# Metodología: cómo se hace un plan de marketing

El flujo de tres fases que produce un plan completo. El `SKILL.md` es la capa de orquestación; esto es el detalle operativo.

**Una diferencia con el original.** El método original llevaba una carpeta de trabajo con archivos (`research.md`, `progress.md`, una sección por archivo). Aquí no hay archivos ni terminal: tu entrega es el texto de tu respuesta, y el estado del trabajo vive en **la tarea** (su chat y sus entregas) y en **el Cerebro** (las notas de la empresa y, si el dueño lo guarda, el plan mismo). Lo que sigue conserva la lógica (investigar, redactar por partes con aprobación, verificar, cerrar) sin depender de archivos.

## Fase 1. PREPARAR (investigación y entrevista)

**Meta:** llegar a la fase 2 con contexto suficiente para redactar todas las secciones sin adivinar.

### Paso 1.1. ¿En qué punto está este plan? (reanudar sin pisar nada)

Al empezar, mira el estado en este orden:

1. **No hay ningún plan anterior** (ni en el Cerebro ni en el chat de la tarea) → plan nuevo. Empieza por la entrevista (paso 1.4).
2. **Hay una entrevista a medias** (el dueño ya contestó parte) → retoma de la primera pregunta sin contestar; no repitas las contestadas.
3. **La entrevista está lista y no hay borrador** → pasa a redactar desde la Sección 2.
4. **Hay un borrador a medias** (secciones ya aprobadas en la tarea) → retoma en la siguiente sección sin aprobar. No rehagas las aprobadas.
5. **Hay un plan terminado** (una nota del Cerebro, o un entregable anterior aprobado) → **no lo sobrescribas en silencio.** Pregunta: «Este plan ya está terminado (v{N}). ¿Quieres (a) revisarlo como v{N+1}, (b) empezar uno nuevo, o (c) reabrir una sección concreta?»

Si el dueño dice «empieza de cero», confirma si el plan viejo se conserva a un lado. Si dice «rehaz la Sección X», rehaz solo esa y deja claro qué otras secciones se ven afectadas (por ejemplo, cambiar el presupuesto mueve las secciones 8, 10 y 11).

### Paso 1.2. Leer los materiales

Lee todo lo que haya: las notas de `00-Empresa` y, en particular, `contexto-marketing`; las cifras; documentos que el dueño subió al Cerebro (presentación a socios, documento de posicionamiento o de voz, investigación de clientes, métricas de tienda o de analítica, inventario de correos del ciclo de vida, auditorías anteriores con puntaje, investigación de SEO, notas de una reunión de arranque). Captura los hechos clave para la ficha de investigación.

### Paso 1.3. Traer datos en vivo donde haya conexión

Si la empresa tiene conectado alguno de estos, tráelos en vez de pedirle al dueño que copie y pegue; si no, di qué dato pedirle:

- **Analítica web** (GA4 u otra): tráfico por canal, eventos de conversión, curvas de retención.
- **Pagos o facturación** (Stripe, caja, contabilidad): ventas, ingresos recurrentes, bajas, mezcla de planes, valor de vida por cohorte.
- **Herramientas de SEO** (Ahrefs, Semrush u otras): valoración del dominio, palabras clave, enlaces, páginas principales.
- **Tienda en línea** (Shopify u otra): conversión de la página de producto, ticket medio, tasa de recompra.
- **Plataforma de correo** (Customer.io, Mailchimp, Resend u otra): inventario de flujos, envíos, aperturas, clics, bajas.
- **Tienda de apps** (App Store Connect, Google Play): embudo de instalación a prueba a pago, retención por cohorte.
- **Redes sociales**: aquí `ver_analiticas` y `ver_informe_mes` si Contenido tiene Meta conectada.
- **Notion o equivalente**: el directorio interno de conocimiento, si está expuesto.

Un dato que no se pueda traer ni confirmar se marca `[POR CONFIRMAR]`.

### Paso 1.4. La entrevista estructurada

Por cada hueco en los materiales, pregunta. Las preguntas se hacen en lotes cortos (no diez de golpe), con la prioridad en lo que más cambia el plan. El mínimo cubre diez áreas.

#### Entrevista 1. Panorama de la empresa
- ¿Qué hace la empresa, en una frase (con las palabras del dueño)?
- ¿Cuál es el producto o servicio principal?
- ¿Qué otros productos, líneas o niveles existen?
- ¿Está vivo, en prueba o por lanzar?
- Si está en prueba: ¿hay un cupo limitado? ¿cuál es la fecha de lanzamiento general?

#### Entrevista 2. Cliente ideal
- ¿Para quién es, en una frase?
- ¿Qué dicen que quieren?
- ¿Qué quieren de verdad?
- ¿Cuál es su problema declarado y cuál el real?
- Datos demográficos o de empresa: ¿quién encaja exactamente?

#### Entrevista 3. Estado del embudo hoy
- ¿Cuáles son las cifras actuales (visitas, registros o consultas, activaciones o primeras compras, pagos, retención)?
- ¿Qué *forma* tiene el embudo: se atasca arriba, al medio o abajo?
- ¿Cuál es la fuga más grande?

#### Entrevista 4. Estado de dinero
- ¿En qué etapa está: autofinanciado, con capital semilla, con una ronda? ¿O es un negocio establecido que se financia con sus propias ventas?
- ¿Cuánto se ha levantado o invertido hasta hoy?
- ¿Cuál es el gasto mensual actual y cuánto tiempo alcanza?
- ¿Hay una ronda o inversión activa? ¿Cuándo cierra?
- ¿Inversionistas o socios de nota?
- ¿Hay permiso para mencionar este trabajo de marketing en presentaciones a inversionistas?

#### Entrevista 5. Equipo
- Fundadores y qué lleva cada uno (producto, marketing, ventas, etc.).
- Otros roles del equipo y su superficie de marketing.
- Asesores que tocan el marketing.
- Agencias, contratistas o personas por horas.
- ¿Dónde están los huecos obvios?
- Para quien lleva hoy el marketing: ¿tiene forma de π (dos especialidades profundas), de T (una profunda y amplitud general) o es solo táctico? El marco de `equipo-y-agencias` informa el RACI de la Sección 11 y la recomendación de primera contratación de la Sección 9.

#### Entrevista 6. Presupuesto
- Gasto mensual actual de marketing, desglosado: anuncios pagados, herramientas, contratistas, sueldos.
- ¿A qué nivel de recursos corresponde (`etapas-de-financiamiento`)?
- ¿Qué presupuesto se libera cuando entre la siguiente inversión o ronda?
- CAC combinado, si se conoce (con sueldos, costos de contenido, herramientas y contratistas, no solo anuncios). Si no se conoce, es la decisión abierta de mayor impacto de la Sección 13: todo pronóstico de ingresos depende de él.
- Ingreso medio por cliente (ARPC), retención anual (o tasa de bajas), para aplicar la matemática de `planificacion-del-presupuesto` a la Sección 8 y a la 10.

#### Entrevista 7. Canales activos hoy
- Adquisición: SEO orgánico, búsqueda pagada, redes pagadas, contenido, redes orgánicas, alianzas, eventos, prensa, embajadores, etc. De cada uno: vivo, en pausa, nunca probado.
- Activación: estado del registro o del proceso de compra, primera sesión, ficha en la tienda de apps, pantalla de pago.
- Retención: estado de los ciclos de correo o mensajes, ofertas dentro del producto, cohorte de bajas.
- Referidos: ¿existe un programa? ¿hay atribución? ¿hay interés entrante?
- Ingresos: estructura de precios, mezcla de planes, experimentos recientes.

#### Entrevista 8. Lo ya hecho
¿Qué trabajo pasado debe reconocer el plan?
- Lanzamientos importantes y sus fechas.
- Momentos de prensa y quién los cubrió.
- Pilares o piezas de contenido que ya existen.
- Alianzas.
- Premios o certificaciones.
- Clientes o usuarios notables (si son nombres que se pueden citar).
- Asesores o personas por horas anteriores.

#### Entrevista 9. En marcha y atascado
- ¿Qué está redactado pero sin lanzar? ¿Por qué?
- ¿Qué lleva meses «casi listo»?
- ¿Qué bloquea cada cosa?
- ¿Qué está roto o hace daño activamente?

#### Entrevista 10. Postura estratégica
- Lo más importante por arreglar este trimestre (la lectura del dueño).
- Lo más importante por ignorar este trimestre (la lectura del dueño).
- Qué preguntan más los socios, el banco o los inversionistas.
- Restricciones no visibles en otra parte (legales, de alianzas, de marca).

### Paso 1.5. Puntuar el estado actual con la rúbrica

Usa la rúbrica de 17 puntos de `rubrica-estado-actual` como lente. Dos modos:

- **Desde materiales ricos.** Si el equipo compartió presentaciones, auditorías de contenido, un documento de voz, posicionamiento reciente o una transcripción de la reunión de arranque, puntúa desde eso y marca «puntuado desde materiales» en el título de la sección.
- **Desde una auditoría ya puntuada.** Si ya existe una evaluación con puntaje (en cualquier formato), ingiere esos números directamente. No rehagas el trabajo.

En ambos casos el resultado es la tabla de 17 filas que se vuelve la Sección 3, seguida de una «interpretación de la forma» de 2 a 4 frases que nombra dónde se agrupan las fortalezas y los huecos.

### Paso 1.6. La ficha de investigación

Antes de las secciones, deja en tu entrega una ficha corta (una página) con esta estructura, que sirve de base a todo lo demás y de registro de supuestos:

```markdown
## Ficha de investigación — {Empresa}
**Fecha:** AAAA-MM-DD   **Preparó:** {puesto}

**Resumen de la empresa:** una frase · etapa · estado del producto
**Cliente ideal:** principal · problema declarado vs. real · datos
**Embudo hoy:** cifras · forma · mayor fuga
**Dinero:** invertido · estado de la inversión o ronda · duración del gasto
**Equipo:** quién lleva qué · huecos
**Presupuesto de marketing actual:** monto mensual · desglose · nivel
**Canales activos:** por etapa AARRR
**Ya hecho (reconocer en el plan):** lista
**En marcha y atascado:** lista con su bloqueo
**Postura estratégica:** prioridad del dueño · lo que se ignora · presión de socios · restricciones
**Puntajes de la rúbrica:** 17 puntos (o los de la auditoría previa, con su fecha)
**Materiales leídos:** notas del Cerebro, cifras, lo dicho por el dueño
**Por confirmar:** lo que no se pudo verificar
```

Pasa a la fase 2.

---

## Fase 2. REDACTAR (sección por sección)

**Meta:** recorrer las 13 secciones de la plantilla (`plantilla-del-plan`), redactar cada una y conseguir la confirmación del dueño.

### Paso 2.1. El orden

Redacta en este orden: **2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13 y al final la 1.** El resumen ejecutivo depende de las conclusiones de todas las demás, por eso se escribe último y se presenta primero. El documento final siempre va en orden 1 → 13.

### Paso 2.2. Cómo se presenta cada parte

Si el encargo permite entregar por partes (conviene cuando el plan es grande o el dueño quiere intervenir), cada parte se entrega así:
1. Presenta el borrador (o los puntos clave: lo corto en directo, lo largo como esquema primero).
2. Pregunta: «¿Lo apruebas, lo ajustas o lo amplías?»
3. Itera hasta que el dueño confirme.
4. Anota en la tarea qué secciones quedan aprobadas, para poder retomar sin rehacer.
5. Sigue con la siguiente sección.

Si el encargo es entregar el plan de una vez, entrégalo completo con los supuestos marcados y la lista de decisiones abiertas al frente; el dueño responde sobre eso.

### Paso 2.3. Guía específica por sección

- **Sección 1 (Resumen ejecutivo)** se sintetiza desde las secciones 2–13 ya aprobadas. Se redacta al final y se presenta primero.
- **Sección 3 (Estado actual)** usa la rúbrica de 17 puntos. Si hay una auditoría previa, pega esos puntajes; si no, puntúa desde los materiales.
- **Secciones 4–8 (AARRR)** siguen todas la misma estructura interna: estado actual, el plan (jugadas numeradas), jugadas de 90 días, panorama de 12 meses, habilidades y herramientas. No te saltes «habilidades y herramientas».
- **Sección 11 (Mapa de operaciones)** se arma con `mapa-de-operaciones` más las jugadas concretas de las secciones 4–8.
- **Sección 12 (Banco de ideas)** se arma con `banco-de-ideas` más los filtros propios de la empresa: se descartan las ideas que chocan con la voz de marca y el estado de cada una se mueve según la etapa de recursos.
- **Sección 13** va al final. Las decisiones abiertas se ordenan por impacto. El anexo cita solo documentos a los que el equipo tiene acceso (los nombres de notas del Cerebro, no rutas de ninguna computadora).

### Paso 2.4. Consistencia con la voz de marca

Si la empresa tiene reglas de voz documentadas (en `00-Empresa/voz` o en la Sección 2), toda sección debe respetarlas. Restricciones comunes de voz:
- Reglas de vocabulario (listas de lo que sí y lo que no).
- Reglas de llamado a la acción (por ejemplo, «nunca presionar»).
- Marco iniciático frente a explicativo.
- Tono (por ejemplo, autoritario pero accesible, íntimo pero profesional).

Si el borrador de una sección viola la voz, rehazlo antes de mostrarlo.

---

## Fase 3. CERRAR (compilar y verificar)

**Meta:** entregar el plan completo, comprobado.

### Paso 3.1. Compilar

Junta las secciones 1 a 13 en orden canónico (1 → 13), sea cual haya sido el orden de redacción. Añade:
- El bloque de portada con fecha y marca de versión «v1».
- Un bloque «Preparó / Para / Fecha / Estado».
- Encabezados que se peguen bien en Notion o Google Docs.

### Paso 3.2. Pasada de verificación

Antes de entregar:

- **Referencias cruzadas.** Cada número del banco de ideas (por ejemplo «idea n.º 17») coincide con la idea real de `banco-de-ideas`. Cada habilidad relacionada que nombras existe en la biblioteca o está marcada como dependencia externa.
- **Herramientas.** Cada herramienta citada en la Sección 11 existe en la oficina, está conectada en la empresa (según la entrevista) o está marcada «futura / por conectar».
- **Rutas.** Ninguna ruta de una computadora concreta en el texto; sustitúyela por una referencia descriptiva (el nombre de la nota del Cerebro).
- **Voz.** Una última lectura contra las reglas de voz de marca; marca y corrige las violaciones.
- **Decisiones abiertas.** Cada «por confirmar» o pregunta sin contestar de la entrevista está en las decisiones abiertas de la Sección 13, no escondida en el cuerpo.
- **Reconocimiento.** Cada elemento de «ya hecho» de la ficha está reconocido en alguna parte del plan.

### Paso 3.3. Entregar

Entrega el documento completo y resume en una línea: «Plan de marketing v1: unas X.XXX palabras en 13 secciones. Es un borrador para el OK del dueño; se puede pegar en Notion o compartir con el equipo. Para repartirlo entre departamentos: Dimitri puede convertir la hoja de ruta (Sección 9) en piezas con departamento, prioridad y fecha.»

### Paso 3.4. Compartir (opcional, siempre decisión del dueño)

Pregunta si quiere guardar el plan como nota del Cerebro para que todos los agentes lo lean (por ejemplo en una carpeta de marketing de su Cerebro) y si quiere repartirlo con Dimitri. Tú no guardas archivos ni publicas nada: lo dejas listo y dices cómo.

### Paso 3.5. Marcar como terminado

Cuando el dueño apruebe, el plan queda como la versión vigente. Cualquier cambio posterior se hace como v{N+1} y dice qué se cambió (ver paso 1.1, caso 5).

---

## Retomar un plan

La reanudación se rige por el árbol del paso 1.1: revisa siempre el estado en ese orden. Si el dueño dice «empieza de nuevo», pregunta si quiere conservar el plan existente a un lado; no lo pises en silencio. Si dice «rehaz la sección X», rehaz solo esa.

## Fallos de proceso que vigilar

- **Saltarse la entrevista.** Un plan redactado sin entrevista es genérico y no sobrevive al primer contacto con el dueño. Haz siempre las diez áreas salvo que el dueño las dispense expresamente (y entonces marca todo lo supuesto).
- **Fingir que hay datos.** Si no puedes confirmar una cifra (ventas actuales, retención, etc.), no adivines. Márcala `[POR CONFIRMAR]` en el plan y llévala a las decisiones abiertas.
- **Ignorar la voz de marca.** Si la empresa tiene una voz fuerte (la mayoría), toda sección debe respetarla. Lee las reglas de voz antes de redactar cualquier texto cercano a un texto publicable.
- **Rellenar el banco de ideas.** La Sección 12 es completa solo si incluye la lista de descartes con su razón. No rellenes con ideas que claramente no encajan solo para llegar a 139.
- **Disimular cifras incómodas.** Si las bajas son altas o la activación es baja, nómbralo en el estado actual. Los dueños leen más allá del azúcar.
- **Olvidar la lógica de etapa de dinero.** Si la empresa está en plena búsqueda de inversión o espera un cambio de presupuesto, el plan debe explicar qué cambia cuando eso ocurra. Saltarlo convierte un plan en una lista de deseos.
