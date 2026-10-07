---
name: operaciones-ingresos
titulo: Operaciones de ingresos (RevOps)
description: Úsala cuando haya que ordenar el camino del prospecto a la venta: etapas, puntuación, asignación, embudo de ventas, traspaso de marketing a ventas, limpieza del CRM o el tablero de cifras comerciales.
area: ventas-y-gtm
departments: [marketing, sales]
agents: [lexi, ilm, mlead]
origen: marketingskills/revops (MIT, Corey Haines)
palabras: [embudo de ventas, CRM, calificación de leads, MQL, pipeline, traspaso a ventas]
---

# Operaciones de ingresos (RevOps)

Sirve para diseñar y mejorar los sistemas que conectan marketing, ventas y atención al cliente en un solo motor de ingresos: qué es un prospecto calificado, quién lo atiende y en cuánto tiempo, cómo avanza una venta, qué se automatiza y qué se mide.

Úsala cuando el dueño hable de: RevOps, puntuación o calificación de prospectos, asignación de prospectos, MQL o SQL, etapas del embudo de ventas, mesa de aprobación de descuentos, automatizaciones del CRM, traspaso de marketing a ventas, datos sucios, «los prospectos no le llegan a ventas», «¿cuándo le paso el prospecto a ventas?». Para escribir correos en frío usa `correo-en-frio`; para secuencias de correo, `secuencias-correo`; para decisiones de precio, `precios`. RevOps es el sistema y el proceso, no el texto de los mensajes.

**Para cualquier empresa.** El marco nació en empresas B2B con equipos de ventas grandes, pero sirve igual a escala pequeña: una clínica dental (consulta por WhatsApp → cita agendada → paciente → paciente que recomienda), una constructora (solicitud de cotización → visita técnica → propuesta → contrato), una agencia o un SaaS. Con uno o dos vendedores, las mismas ideas caben en una hoja de cálculo o en el CRM que tengan: definiciones claras, un responsable y un tiempo de respuesta.

## Antes de empezar

Lee las notas de la empresa en el Cerebro (`00-Empresa/perfil`, `00-Empresa/oferta`, `00-Empresa/clientes`, sobre todo `contexto-marketing` con el cliente ideal) y las cifras de la empresa (precios, comisiones, ticket medio). Si falta algo que necesitas, pregúntalo en una línea o déjalo marcado como supuesto; nunca lo inventes.

Reúne este contexto (pregunta solo lo que no esté):
1. **Forma de vender:** ¿el producto se vende solo (prueba gratis, compra en línea, PLG), lo vende un vendedor, o una mezcla?
2. **Ticket medio:** valor medio de una venta o contrato anual, en la moneda de la empresa.
3. **Ciclo de venta:** días desde el primer contacto hasta la venta cerrada.
4. **Herramientas:** CRM, automatización de marketing, agenda de citas, enriquecimiento de datos, WhatsApp Business.
5. **Situación actual:** cómo se manejan hoy los prospectos, qué funciona y qué no.
6. **Objetivo:** convertir más, responder más rápido, tapar fugas en el traspaso, o armar todo desde cero.
7. Además: ¿qué CRM usan (o piensan usar)? ¿Cuántos prospectos llegan al mes? ¿Hay una definición de prospecto calificado hoy? ¿Dónde se atascan? ¿Hay tiempos de respuesta acordados entre marketing y ventas?

Trabaja con lo que te den. Si hay un problema claro, empieza por ahí. No te bloquees por datos que faltan: usa lo que hay y di qué fortalecería la solución. Si la empresa tiene conectado su CRM (HubSpot, Salesforce, Pipedrive u otro), puedes leerlo; si no, pide al dueño una exportación o las cifras.

## Principios

- **Una sola fuente de verdad.** Un sistema de registro para cada prospecto y cuenta. Si los datos viven en varios lugares, chocan. Elige el CRM como fuente y sincroniza todo con él (aunque el «CRM» sea una hoja de cálculo bien llevada).
- **Definir antes de automatizar.** Etapas, puntuación y reglas de asignación, primero en papel. Automatizar un proceso roto solo produce resultados rotos más rápido.
- **Medir cada traspaso.** Cada paso entre equipos es una fuga posible: marketing → ventas, quien califica → quien cierra, ventas → atención al cliente. Cada uno necesita un tiempo de respuesta acordado (SLA), una forma de seguirlo y un responsable.
- **Alinear al equipo de ingresos.** Marketing, ventas y atención deben acordar las definiciones. Si marketing llama «calificado» a algo que ventas no quiere trabajar, la definición está mal. Las reuniones de alineación no son opcionales.

## Ciclo de vida del prospecto

| Etapa | Entra cuando | Sale cuando | Responsable |
|---|---|---|---|
| **Suscriptor** | Se apunta a contenido (blog, boletín) | Da datos de su empresa o muestra interés | Marketing |
| **Prospecto (lead)** | Contacto identificado con datos básicos | Cumple el mínimo de encaje | Marketing |
| **MQL** (calificado por marketing) | Supera el umbral de encaje + interés | Ventas lo acepta o rechaza dentro del SLA | Marketing |
| **SQL** (calificado por ventas) | Ventas lo acepta y lo califica en una conversación | Se crea oportunidad o se recicla | Ventas |
| **Oportunidad** | Presupuesto, autoridad, necesidad y plazo confirmados | Ganada o perdida | Ventas (quien cierra) |
| **Cliente** | Venta ganada | Amplía, renueva o se va | Atención / gestión de cuentas |
| **Promotor** | Alta recomendación (NPS), refiere, da testimonio | Participa en el programa | Atención + marketing |

**Un MQL necesita encaje Y interés:**
- **Encaje:** ¿se parece al cliente ideal? (tamaño, sector, cargo, herramientas, zona).
- **Interés:** ¿muestra intención de compra? (vio precios, pidió demo o cotización, volvió varias veces).

Ninguno basta solo. Una empresa perfecta que nunca interactúa no es MQL. Un estudiante que descarga todos los ebooks tampoco.

**SLA del traspaso MQL → SQL** (escríbelo y acuérdalo):
- Aviso del MQL al vendedor asignado.
- Contacto en **4 horas** hábiles.
- Califica o rechaza en **48 horas**.
- El rechazado vuelve a un seguimiento de reciclaje con un código de motivo.

Plantillas completas de etapas, criterios por tipo de negocio, SLA y códigos de rechazo: `referencias/ciclo-de-vida.md`.

## Puntuación de prospectos

**Explícita (encaje), quién es:** tamaño, sector, facturación; cargo, nivel, área; herramientas que usa, zona.
**Implícita (interés), qué hace:** visitas (sobre todo precios, demo, casos de éxito); descargas, asistencia a webinars; correos abiertos y clics; uso del producto (si se vende solo).
**Negativa (descalifica):** dominio de un competidor; correo de estudiante o personal (en B2B); bajas y quejas de spam; cargos que no compran (practicante, estudiante).

**Cómo armar el modelo:**
1. Define los atributos del cliente ideal y su peso.
2. Saca las señales de alta intención de las ventas ganadas.
3. Pon puntos a cada atributo y comportamiento.
4. Fija el umbral de MQL (suele estar entre 50 y 80 sobre 100).
5. Pruébalo con datos históricos: ¿habría detectado las ventas ganadas?
6. Lánzalo, mide y recalibra cada trimestre.

**Errores comunes:** dar demasiado peso a las descargas (investigar ≠ comprar); no tener puntuación negativa; ponerlo y olvidarlo; puntuar igual todas las visitas (la página de precios no es una entrada del blog).

Plantillas detalladas, modelos de ejemplo y calibración: `referencias/modelos-de-puntuacion.md`.

## Asignación de prospectos

| Método | Cómo funciona | Sirve para |
|---|---|---|
| **Rotación (round-robin)** | Reparte por igual | Zonas iguales, ventas de tamaño parecido |
| **Por territorio** | Por zona, sector o segmento | Equipos regionales, especialistas |
| **Por cuenta** | Cuentas con nombre a vendedores con nombre | Venta a cuentas clave (ABM) |
| **Por habilidad** | Por complejidad, línea de producto o idioma | Varias líneas, equipos en varios países |

- Asigna primero a la **coincidencia más específica**, luego a la general.
- Siempre un **responsable de respaldo**: un prospecto sin dueño se enfría rápido.
- La rotación debe tener en cuenta **capacidad y disponibilidad** (vacaciones, carga).
- Registra cada decisión de asignación para revisarla.

**Velocidad de respuesta:** es el factor que más pesa en la conversión. Según Lead Connect / InsideSales.com, contactar en **5 minutos** hace 21 veces más probable calificar; pasados **30 minutos** la conversión cae mucho, y a las **24 horas** el prospecto está prácticamente frío. Diseña reglas que prioricen la velocidad, avisa al instante y escala si se incumple el SLA. En un negocio local que recibe consultas por WhatsApp o Instagram, esto es responder el mismo rato, no al día siguiente.

Árboles de decisión, territorios, cuentas clave y cadena de escalamiento: `referencias/reglas-de-asignacion.md`.

## Etapas del embudo de ventas

| Etapa | Campos obligatorios | Sale cuando |
|---|---|---|
| **Calificada** | Contacto, empresa, origen, puntuación de encaje | Llamada de diagnóstico agendada |
| **Diagnóstico** | Dolores, solución actual, plazo | Necesidad confirmada, demo agendada |
| **Demo / evaluación** | Requisitos técnicos, quién decide | Evaluación positiva, piden propuesta |
| **Propuesta** | Precio, condiciones, mapa de interesados | Propuesta entregada y revisada |
| **Negociación** | Cambios pedidos, cadena de aprobación, fecha de cierre | Condiciones acordadas, contrato enviado |
| **Ganada** | Contrato firmado, condiciones de pago | Traspaso a atención completo |
| **Perdida** | Motivo de pérdida, competidor (si hay) | Análisis registrado |

En un negocio de servicios las etapas pueden ser: solicitud → visita o diagnóstico → cotización → seguimiento → aceptada / rechazada. Lo que importa es que cada etapa tenga criterio de salida y campos obligatorios.

**Higiene de etapas:** campos obligatorios por etapa (no se avanza sin ellos); alertas de negocios estancados (p. ej. el doble del tiempo medio en esa etapa); detección de saltos de etapa (de Calificada a Propuesta sin Diagnóstico); disciplina con la fecha de cierre (cada aplazamiento con motivo; nada de aplazar en silencio).

**Métricas del embudo:** conversión por etapa (dónde mueren); tiempo medio por etapa (dónde se atascan); velocidad del embudo (ingreso por día que pasa por él); cobertura (valor del embudo frente a la meta; suele buscarse 3–4 veces); tasa de cierre por origen (qué canales traen ingreso real).

## Automatizaciones del CRM

- **Esenciales:** avanzar la etapa sola cuando se cumplen criterios; crear tarea de seguimiento al asignar un MQL; aviso al jefe si se incumple el SLA; disparadores por etapa (enviar propuesta, actualizar previsión, avisar a atención al cerrar).
- **Marketing → ventas:** aviso instantáneo del MQL con su contexto; aviso al vendedor cuando el prospecto agenda; resumen diario de acciones de alta intención; aviso cuando un prospecto dormido vuelve a la web.
- **Agenda de citas:** rotación de reuniones; enrutar por criterio (cuentas grandes a vendedores sénior); completar la ficha antes de la llamada; seguimiento automático si el prospecto no se presenta.

En la oficina, varias de estas cosas pueden ser **rutinas** (el resumen diario de prospectos activos, la revisión semanal de negocios estancados) o **disparadores** (un formulario o un WhatsApp que crea la tarea para el puesto de prospectos entrantes). Propónselas al dueño con el agente, la frecuencia y si esperan su OK; tú no las activas. Recetas por plataforma: `referencias/automatizaciones.md`.

## Mesa de aprobación de negocios (deal desk)

**Cuándo hace falta:** ventas por encima de un umbral (el original usa 25.000 al año; fija el de la empresa); condiciones de pago fuera de lo normal (a 90 días, facturación trimestral); contratos de varios años con precio especial; descuentos por volumen más allá de la lista; cláusulas legales o niveles de servicio a medida.

| Tamaño / condición | Aprueba |
|---|---|
| Precio de lista | Automático |
| Descuento de 10–20 % | Jefe de ventas |
| Descuento de 20–40 % | Dirección comercial |
| Más de 40 % o condiciones a medida | Revisión de la mesa |
| Varios años / cuentas grandes | Finanzas + legal |

Ajusta los tramos a la empresa: los porcentajes y umbrales salen de las cifras de la empresa y del dueño, no de aquí. Documenta cada excepción y revisa cada trimestre cuáles se piden más: si todos piden la misma, debería volverse estándar.

## Higiene y enriquecimiento de datos

- **Duplicados:** reglas de coincidencia (dominio del correo + nombre de la empresa + teléfono); prioridad al fusionar (el registro del CRM gana al de la herramienta de marketing; la actividad más reciente gana en cada campo); deduplicación semanal automática con revisión manual de casos dudosos.
- **Campos obligatorios** por etapa, bloqueando el avance si faltan; perfilado progresivo (no pedir todo de entrada). Listas desplegables en vez de texto libre para que los nombres sean consistentes.
- **Enriquecimiento:** herramientas como Clearbit (tiempo real, empresas de tecnología), Apollo (datos de contacto y secuencias) o ZoomInfo (base B2B grande), u otras que la empresa tenga. Solo si la empresa las tiene conectadas.
- **Auditoría trimestral:** fusionar duplicados; validar correos de contactos viejos; archivar contactos sin actividad en 12+ meses; revisar la distribución por etapa (cuellos de botella); comprobar en una muestra que el enriquecimiento sea correcto.

## Tablero de cifras

| Métrica | Fórmula | Referencia orientativa |
|---|---|---|
| Prospecto → MQL | MQL / prospectos | 5–15 % |
| MQL → SQL | SQL / MQL | 30–50 % |
| SQL → oportunidad | oportunidades / SQL | 50–70 % |
| Velocidad del embudo | (n.º de negocios × ticket medio × tasa de cierre) / ciclo medio | Depende del ticket |
| Costo de adquisición (CAC) | gasto de ventas + marketing / clientes nuevos | Valor de vida : CAC > 3:1 |
| Valor de vida : CAC | valor de vida del cliente / CAC | 3:1 a 5:1 sano |
| Velocidad de respuesta | del formulario al primer contacto | Ideal < 5 min |
| Tasa de cierre | ganadas / oportunidades | 20–30 % (varía) |

Las referencias son orientación general, no metas de la empresa. Tres vistas: **marketing** (volumen de prospectos, tasa de MQL, origen, costo por MQL); **ventas** (valor del embudo, conversión por etapa, velocidad, precisión de la previsión); **dirección** (CAC, valor de vida : CAC, ingreso frente a meta, cobertura). Si el tablero se arma con datos de la oficina, el puesto `dash` de Operaciones puede construirlo: propónlo con `crear_borrador_tarea`.

## Cómo entregarlo

Según lo que se pidió, uno o varios de estos documentos, cada uno listo para implementar tal cual:
1. **Documento de etapas:** tabla con definición, criterio de entrada y salida, responsable y SLA de cada etapa; códigos de rechazo y reciclaje.
2. **Especificación de puntuación:** atributos de encaje e interés con sus puntos, puntuación negativa, umbral de MQL y cómo se calibrará.
3. **Reglas de asignación:** árbol de decisión con la lógica, respaldo y cadena de escalamiento.
4. **Configuración del embudo:** etapas, campos obligatorios, alertas y disparadores.
5. **Tablero:** métricas, de dónde sale cada dato, referencia y cadencia de revisión.
6. **Plan de limpieza** (si los datos están sucios): primero lo de más impacto, luego la prevención.

Si se conoce el CRM, añade los pasos concretos en esa plataforma. Cierra con una lista de **supuestos** (lo que no te dijeron y supusiste) y **qué decide el dueño**.

## Reglas

- Nunca inventes cifras de la empresa: ticket, conversión, metas y comisiones salen de las cifras de la empresa o del dueño. Las referencias del sector se dicen como orientación.
- Primero las definiciones, después la automatización.
- Todo traspaso lleva SLA, responsable y forma de medirlo.
- Toda regla de asignación tiene respaldo.
- No cambias el CRM ni activas automatizaciones: dejas la especificación lista. Cambiar el CRM, enviar avisos o mensajes a prospectos o activar rutinas lo aprueba el dueño.
- Los datos de prospectos son personales: respeta las leyes de protección de datos del país (y RGPD si aplica) al proponer enriquecimiento o importaciones.

## Referencias

- `referencias/ciclo-de-vida.md` — plantillas de cada etapa, criterios de MQL por tipo de negocio, SLA y códigos de rechazo y reciclaje; léela al definir etapas o el traspaso.
- `referencias/modelos-de-puntuacion.md` — tablas de puntos de encaje, interés y negativos, tres modelos de ejemplo y cómo calibrar el umbral; léela al armar la puntuación.
- `referencias/reglas-de-asignacion.md` — árboles de decisión, rotación, territorios, cuentas clave y velocidad de respuesta; léela al diseñar la asignación.
- `referencias/automatizaciones.md` — recetas en HubSpot, Salesforce, herramientas de agenda y Zapier/Make; léela cuando el CRM sea conocido o se pida automatizar.

## Habilidades relacionadas

- `correo-en-frio` — los correos de prospección.
- `secuencias-correo` — los seguimientos y secuencias de nutrición.
- `precios` — decisiones de precio y paquetes.
- `medicion-analitica` — seguimiento de métricas y atribución.
- `atribucion` — de qué canal viene cada venta.
- `lanzamientos` — planes de salida al mercado.
- `material-ventas` — presentaciones, guiones y respuestas a objeciones.
- `prospeccion` — listas y búsqueda de prospectos.
