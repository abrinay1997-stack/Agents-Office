# Ejemplo (parte 4 de 5): hoja de ruta, panorama de 12 meses y mapa de operaciones (secciones 9, 10 y 11)

Continúa de `ejemplo-3-retencion-referidos-ingresos`. Quietude es una empresa **ficticia** con sede en EE. UU.; sus cifras y sus montos son de ejemplo.

Una diferencia con el plan original, que es la forma en que se trabaja en la oficina: la hoja de ruta de la Sección 9 termina con una **tabla de reparto** (pieza, departamento, puesto, prioridad, fecha límite y «espera a»), que es lo que Dimitri convierte en tareas para los jefes de cada departamento o lo que se deja como borradores con `crear_borrador_tarea`. En el original, la columna era solo «Responsable».

## 9. Hoja de ruta de 90 días

La capa de ejecución táctica. Cada jugada lleva la etiqueta de su etapa AARRR para que se vea la prioridad.

### Semanas 1–2: Destrabar

| Jugada | Etapa | Responsable |
|---|---|---|
| Eliminar la exigencia obligatoria de audífonos | Activación | Casey + Devon |
| Documentar la decisión de consolidar dominios | Adquisición | Casey + Alex |
| Redactar el plan de redirecciones 301 (página por página) | Adquisición | Casey |
| Reescritura de la ficha de la tienda de aplicaciones: primera pasada | Activación + Adquisición | Casey + Alex + Sam (revisión de voz) |
| Sale el flujo 6 (poscompra del antifaz) | Retención | Casey + la herramienta de correo conectada |
| Documento de alcance del programa de embajadores | Referidos | Casey |
| Se arranca la auditoría de precios | Ingresos | Casey + Alex |

### Semanas 3–4: Cimientos

| Jugada | Etapa | Responsable |
|---|---|---|
| Se ejecutan las redirecciones 301 de la consolidación de dominios | Adquisición | Devon + Casey |
| Consola de búsqueda y analítica web montadas en `quietude.app` | Adquisición | Casey |
| Borrador del centro del Pilar 1 de SEO (regulación del sistema nervioso) | Adquisición | Casey |
| Centro `/science` construido con el estudio de psicofisiología revisado por pares | Adquisición + marca | Casey + Sam |
| Bienvenida Variante 3 (primero sentirlo): prototipada y probada | Activación | Casey + Devon |
| Sale el flujo 4 (usuarios inactivos) | Retención | Casey |
| Programa de embajadores: los 5 interesados en bienvenida | Referidos | Casey |
| Se audita el flujo de hardware a activación de la aplicación | Retención + Ingresos | Casey + Devon |
| Reescritura de la ficha de la tienda de aplicaciones: versión final y salida | Activación + Adquisición | Alex + Sam + Casey |

### Semanas 5–8: Velocidad

| Jugada | Etapa | Responsable |
|---|---|---|
| Se publican el centro del Pilar 1 y 3 páginas satélite | Adquisición | Casey |
| Se publican el centro del Pilar 2 (antifaz) y la lista comparativa | Adquisición | Casey |
| Se pone en práctica el ritmo del LinkedIn de Alex (programación de publicaciones) | Adquisición | Alex + Casey |
| Primer empujón de prensa: el estudio + el gancho del influyente de la longevidad a 5 medios | Adquisición | Casey + Alex |
| Lectura de la Variante 3; se decide si sale o se itera | Activación | Casey |
| Bienvenida Variante 1 (primero la confianza): prototipada y probada | Activación | Casey + Devon |
| Centro de preferencias de suscripción construido | Retención | Casey |
| Reescritura de la tienda en línea del antifaz (SEO + reseñas + devolución) | Adquisición + Ingresos | Casey + Alex |
| Primera atribución de embajador verificada con el servicio de enlaces | Referidos | Casey |

### Semanas 9–12: Composición

| Jugada | Etapa | Responsable |
|---|---|---|
| Se publica la pieza angular del Pilar 4 (WELL / B2B) | Adquisición | Casey |
| Se publican 3 páginas satélite más del Pilar 1 | Adquisición | Casey |
| La Filosofía del Sonido se publica en `/research/sound-philosophy` | Adquisición + marca | Alex + Casey |
| Lectura de la Variante 1; empieza la construcción de la Variante 2 (primero sentirse visto; depende de Mira) | Activación | Casey + Devon |
| Campaña de recuperación para la cohorte de bajas | Retención | Casey |
| Se define el alcance de la prueba del plan anual por defecto | Ingresos | Casey + Alex |
| Se abren las solicitudes de embajadores para los siguientes 10–15 | Referidos | Casey |
| Revisión de 90 días + recalibración del plan del 2.º trimestre | Transversal | Casey + Alex |

### Cómo se reparte entre departamentos (como lo haría Dimitri)

Esta tabla es la que se entrega para repartir el trabajo. Muestra el mismo plan de las semanas 1–2 en piezas con departamento, puesto sugerido, prioridad, fecha límite y dependencias (el día 1 es el lunes 2026-06-01). Las demás semanas siguen el mismo molde. Las piezas de un mismo objetivo van en un **proyecto** de la vista Tareas (aquí, «Plan de marketing Quietude»).

| Pieza | Etapa | Departamento | Puesto sugerido | Prioridad | Fecha límite | Espera a |
|---|---|---|---|---|---|---|
| Quitar la exigencia de audífonos (lo hace el equipo de producto: se abre como pedido al dueño con `pedir_bloqueo`) | Activación | Operaciones | `olead` | alta | 2026-06-05 | n/a |
| Documentar la decisión de consolidar dominios | Adquisición | Marketing | `mlead` | alta | 2026-06-05 | n/a |
| Plan de redirecciones 301 página por página | Adquisición | Marketing | `riley` | alta | 2026-06-10 | Documentar la decisión de dominios |
| Reescritura de la ficha de la tienda de aplicaciones: primera pasada (borrador para revisión de voz) | Activación + Adquisición | Marketing | `iggy` + `gfx` (capturas con el Estudio) | alta | 2026-06-12 | n/a |
| Flujo 6 (poscompra del antifaz): textos y lógica listos para que el dueño los apruebe | Retención | Marketing | `newt` | alta | 2026-06-09 | n/a |
| Alcance del programa de embajadores | Referidos | Ventas | `lexi` | media | 2026-06-12 | n/a |
| Auditoría de precios: cifras reales de cobro (lee las cifras de la empresa y pide lo que falte) | Ingresos | Finanzas | `invo` o el puesto de contabilidad | media | 2026-06-12 | n/a |

Lo recurrente se vuelve **rutina**: la lectura semanal de indicadores (lunes, Marketing, `mlead`, espera el OK solo si va a enviarse algo), el informe mensual de retención, el calendario de contenido de cada semana y la revisión trimestral.

---

## 10. Panorama de 12 meses

Hitos por trimestre con lo que se libera con cada nivel de recursos nombrado de forma explícita.

### T1: meses 1–3 (jun–ago de 2026)

**Estado de recursos:** a punto de cerrar la preinversión. Presupuesto pagado = 0. Solo el fCMO + trabajo liderado por los fundadores + costo de herramientas.

**Foco:** cimientos. Tapar las fugas. Plantar el terreno de SEO. Poner en marcha el ciclo de vida.

**Resultados al final de T1:**
- La exigencia de audífonos eliminada; ganadora de la bienvenida identificada.
- Los cuatro pilares de SEO sembrados (centro + primeras páginas satélite).
- Flujos de ciclo de vida 4 y 6 en vivo.
- Ficha de la tienda de aplicaciones con la voz de marca.
- 5 embajadores activos.
- Auditoría de precios cerrada.
- Dominio consolidado.

**Metas de indicadores:** mejora del día 1 al pago de la bienvenida del 25 % al 50 %. Tráfico orgánico de 500 a 1.500 al mes. Tasa de conversión de la ficha de la tienda +20 %.

### T2: meses 4–6 (sep–nov de 2026)

**Estado de recursos:** cierre de la semilla (meta de ~3.er trimestre de 2026). Primer desbloqueo de presupuesto pagado: prueba de 5.000–10.000 al mes.

**Foco:** validar lo pagado. Escalar la bienvenida ganadora. Sumar el flujo 2.

**Resultados al final de T2:**
- Adquisición pagada disparándose en anuncios de la tienda de aplicaciones y Meta.
- Bienvenida ganadora publicada de forma permanente.
- Flujo 2 (correos de bienvenida) publicado.
- Reflexión de Mira posterior a la sesión, en producción.
- 15–25 embajadores activos.
- Primer caso de referencia de una instalación B2B («Aurora») publicado.
- Plan anual por defecto probado.

**Metas de indicadores:** costo de adquisición pagado combinado < 50. Tráfico orgánico de 1.500 a 3.500 al mes. Curvas de retención con mejora visible.

### T3: meses 7–9 (dic de 2026–feb de 2027)

**Estado de recursos:** despliegue de la semilla. Lo pagado escala a 20.000–50.000 al mes si la economía por cliente se sostiene. Primera contratación de marketing (gerente de ciclo de vida y contenido).

**Foco:** escalar y diversificar. Lanzamiento general de la aplicación. Los casos de referencia B2B se componen.

**Resultados al final de T3:**
- Lanzamiento general de la aplicación con un nuevo momento de salida al mercado (prensa + renovación de la creatividad de anuncios + ciclo de contenido del Pilar 3, ciencia del audio espacial).
- Primer piloto de certificación Guías de Quietude (3–5 anfitriones).
- Los cuatro pilares produciendo contenido cada semana.
- Flujo de regalo del antifaz en vivo para el pico de fiestas.
- Nueva persona de marketing en bienvenida.

**Metas de indicadores:** costo de adquisición combinado (pagado + orgánico) estabilizándose. Conversión del lanzamiento general +50 % sobre la línea de base de la prueba. El piloto de Guías valida el modelo de parte de ingresos + marketing conjunto.

### T4: meses 10–12 (mar–may de 2027)

**Estado de recursos:** antes de la Serie A. Sigue el escalamiento de lo pagado. La presentación de la Serie A en marcha.

**Foco:** componer. Posicionarse para la Serie A.

**Resultados al final de T4:**
- Canales que se componen (orgánico + embajadores + Guías + ciclo de vida) aportando más del 50 % de los suscriptores nuevos.
- Más de 50 embajadores, 5–10 Guías.
- 4 pilares de SEO + más de 30 piezas de contenido en vivo.
- Lo pagado escalando a 50.000–150.000 al mes si se valida.
- Narrativa de la Serie A: evidencia clínica + mejora de activación + ciclo de vida que se compone + una cartera de casos de referencia B2B.

**Metas de indicadores:** trayectoria clara del ritmo de ingresos recurrentes anuales de venta directa. Relación valor de vida / costo de adquisición > 3. Narrativa del fundador + datos + casos de referencia listos para la Serie A.

---

## 11. Mapa de operaciones de marketing

Esto es lo que hace ejecutable el plan con el tamaño del equipo de Quietude. Un equipo fundador de 4 personas + fCMO + herramientas con agentes puede entregar la producción de un equipo de marketing tradicional de 15 a 20 personas, porque la biblioteca de habilidades de marketing y las conexiones hacen la orquestación.

### La tesis

Cada jugada del desglose AARRR de arriba se asigna a (a) una o más habilidades de marketing que vuelven operativo el trabajo y (b) una o más conexiones o herramientas que permiten ejecutarlo sin una persona dedicada por canal.

El trabajo del fCMO es:
1. Definir la estrategia y el orden (este documento).
2. Correr las habilidades contra el contexto correcto en el momento correcto.
3. Mantener el contexto compartido (`quietude-context`; en la oficina, el Cerebro) y las herramientas para que Alex, Sam y las futuras contrataciones puedan engancharse.
4. Pasar el trabajo operativo a personas (o a futuras contrataciones) solo donde el costo de la ejecución con agentes supere el de la ejecución humana.

### Habilidades asignadas a las etapas AARRR

| Etapa | Habilidades principales | Habilidades de apoyo |
|---|---|---|
| **Adquisición** | `auditoria-seo`, `seo-para-ia`, `seo-programatico`, `datos-estructurados`, `estrategia-contenido`, `paginas-comparativas`, `campanas-pagadas`, `creatividad-anuncios`, `redes-sociales` | `lanzamientos`, `herramientas-gratis`, `medicion-analitica`, `correo-en-frio`, `redaccion-publicitaria`, `arquitectura-web` |
| **Activación** | `activacion-clientes`, `registro`, `pantallas-de-mejora`, `conversion-paginas`, `redaccion-publicitaria`, `edicion-textos` | `arquitectura-web`, `pruebas-ab`, `psicologia-marketing`, `ventanas-emergentes` |
| **Retención** | `secuencias-correo`, `retencion-clientes` | `redaccion-publicitaria`, `edicion-textos`, `pruebas-ab`, `pantallas-de-mejora` |
| **Referidos** | `referidos`, `redes-sociales` | `redaccion-publicitaria`, `arquitectura-web`, `secuencias-correo` |
| **Ingresos** | `precios`, `pantallas-de-mejora`, `material-ventas`, `operaciones-ingresos` | `pruebas-ab`, `redaccion-publicitaria`, `ofertas` |
| **Transversales** (marca, inteligencia) | `contexto-marketing`, `investigacion-clientes`, `psicologia-marketing` | `ideas-marketing`, `consejo-asesor` |

### Conexiones y herramientas asignadas a las etapas

| Etapa | Conexiones que Quietude ya tiene | Capa de herramientas (el sistema del fCMO) |
|---|---|---|
| **Adquisición** | Consola de la tienda de aplicaciones (manual), tienda en línea, analítica web (en curso), Notion | Servicio de datos de búsqueda, programación de publicaciones, repositorio del sitio, navegador, extracción de páginas |
| **Activación** | Consola de la tienda de aplicaciones, herramienta de correo, tienda en línea | Consola de la tienda (con navegador para automatizar capturas), herramienta de diseño, repositorio de la aplicación, pagos |
| **Retención** | **Herramienta de correo (con conexión del asistente, validada en el arranque)**, pagos, tienda en línea | Herramienta de correo, pagos, analítica |
| **Referidos** | Servicio de enlaces, pagos | Servicio de enlaces, pagos, repositorio (páginas por embajador), herramienta de correo |
| **Ingresos** | Pagos, tienda en línea, herramienta de correo | Pagos, tienda en línea, analítica, Notion |
| **Transversales** | Notion, repositorio de contexto compartido | Notion, repositorio, extracción de páginas, notas de trabajo del fCMO |

En la oficina, además: **Estudio** (imágenes y video), **Contenido** (borradores para las nueve redes), **Analíticas y Bandeja**, **Tareas y rutinas**, y el **Cerebro** con las cifras de la empresa. Mira `mapa-de-operaciones` para la versión completa.

### El desbloqueo de la herramienta de correo (ejemplo concreto)

Según la llamada de arranque: *«Construido en vivo en la llamada: se redactó un flujo de carrito abandonado con la conexión del asistente a la herramienta de correo. Se validó que un equipo no técnico puede usar el patrón de la habilidad por su cuenta.»*

Esta es la prueba operativa de que el sistema funciona. Alex, que no es desarrollador, redactó un flujo de ciclo de vida que funciona con el asistente y la herramienta de correo en tiempo real en una llamada de arranque. El mismo patrón aplica a: la salida del flujo 4 (reactivación de inactivos), el centro de preferencias, la campaña de recuperación, el flujo de regalo del antifaz y el ciclo de vida del embajador. El papel del fCMO pasa a ser orquestación y control de calidad de la voz de marca, no escribir a mano cada correo.

### Lo que se libera con cada nivel de recursos

| Nivel | Personas | Herramientas | Canales vivos |
|---|---|---|---|
| **Preinversión cerrándose (ahora)** | fCMO + equipo fundador | Todas las herramientas de hoy + la biblioteca de habilidades del fCMO + la capa de conexiones | Solo orgánico (SEO, contenido, tienda de aplicaciones, LinkedIn, eventos, boca a boca, embajadores) |
| **Cierre de la semilla (~T3 de 2026)** | + primera contratación de marketing (ciclo de vida y contenido) a fines del T3 | + cuentas de anuncios (tienda de aplicaciones, Meta, LinkedIn) | + piloto de adquisición pagada de 5.000–10.000 al mes |
| **Despliegue de la semilla (T3–T4 de 2026)** | + diseñador (posiblemente por horas) | + más analítica (si hace falta) | + escalar lo pagado a 20.000–50.000 al mes + piloto de certificación de Guías |
| **Serie A (2027)** | + responsable de rendimiento pagado + responsable de contenido | + gasto dedicado en herramientas (~2.000–5.000 al mes de software) | + lo pagado a 50.000–150.000 al mes + internacional + expansión B2B por sectores |

La biblioteca de habilidades escala estas etapas. Cada canal que se suma no exige un aumento de personal de uno a uno, porque cada habilidad guarda el flujo de trabajo.

---
