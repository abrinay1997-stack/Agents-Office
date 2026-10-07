# Ejemplo (parte 3 de 5): Retención, Referidos e Ingresos (secciones 6, 7 y 8)

Continúa de `ejemplo-2-adquisicion-activacion`. Quietude es una empresa **ficticia** con sede en EE. UU.; sus cifras y sus montos son de ejemplo. Fíjate en que la Sección 6 nombra con honestidad una cifra incómoda (la diferencia entre el 38 % y el 29 %) y la manda a «conciliar» en lugar de disimularla, y en que la Sección 8 parte de lo que de verdad se cobra, no de lo que se cree.

## 6. Retención

> *«Cuando alguien convierte, ¿se queda y se profundiza?»*

### Estado actual

**Cifra titular (según la presentación de la semilla): 38 % de retención a 12 meses**, casi el doble del promedio de la categoría (~20 %). Es la señal de retención más fuerte de la presentación y una de las afirmaciones menos aprovechadas que tiene Quietude.

**Instantánea de la tienda de aplicaciones, 2026-05-16:** 145 de pago, 42 dados de baja (~29 % de bajas mensuales). La definición no coincide con la afirmación del 38 %, por conciliar. Posiblemente: el 38 % es retención anual de cohorte (quienes pagaron el mes 1 y siguen pagando en el mes 12) y el 29 % es baja mensual bruta (quienes pagaron este mes y no pagaron el siguiente). Pueden ser ciertas las dos. Hay que aclarar cuál se reporta hacia fuera y cuál es la señal real de salud del producto.

### El plan

**Jugada 1: sacar primero el flujo 6 (poscompra del antifaz).**
Según la decisión del arranque y el documento de recomendación de la bienvenida: es el flujo listo para salir. Anclado en el hardware, no menciona pantallas de la aplicación, puede salir hoy. Cablea el camino de hardware a activación de la aplicación (quien compra el antifaz debe recibir una prueba gratis de 6 meses de Premium; formalizarlo como parte del flujo).

**Jugada 2: sacar el flujo 4 en segundo lugar (reactivación de usuarios inactivos).**
Cinco correos en 38 días. El lenguaje es universal: no depende del estado de la interfaz de la aplicación. Sale después de que el flujo 6 esté en vivo.

**Jugada 3: retener el flujo 2 (bienvenida).**
Ocho correos en 14 días. Se retiene hasta que la interfaz se estabilice tras el rediseño de la bienvenida. No saques un texto que habrá que reescribir en 8 semanas.

**Jugada 4: centro de preferencias de suscripción con temas a elegir.**
Según la decisión del arranque. Temas: eventos, novedades de la aplicación, somática y sistema nervioso, promociones del antifaz. Los usuarios se segmentan solos. Mejora la entregabilidad (menos quejas) y da al ciclo de vida una superficie de segmentación más rica.

**Jugada 5: reflexión de Mira posterior a la sesión (cuando se defina el alcance).**
La jugada de retención más poderosa a mediano plazo. Después de una sesión, Mira pregunta *«¿Qué notaste?»*. Opciones predefinidas y texto libre. Dos beneficios: (a) da a Mira datos previos para personalizar desde la sesión 2, (b) las respuestas se vuelven una mina de oro de contenido y de segmentación para el equipo. Pregunta de alcance para Devon: ¿Mira ya lo soporta o es un desarrollo nuevo?

**Jugada 6: flujo de hardware a activación de la aplicación.**
El camino «quien compra el antifaz se vuelve suscriptor Premium» se insinúa en la presentación de la semilla (costo combinado por cliente vía hardware) pero no se ve en el panel de la tienda de aplicaciones. Auditar el flujo actual: ¿una compra del antifaz en la tienda en línea entrega de verdad un código Premium gratis? ¿Cómo se canjea? ¿Cuál es la tasa de conversión? Esto es fundamental para la tesis de la «puerta de entrada de venta directa».

**Jugada 7: conciliar la métrica de retención.**
¿Cuál es la definición real del «38 % de retención a 12 meses»? ¿Cohorte? ¿Tipo de plan (mensual o anual)? Hay que hacerlo aunque la respuesta sea incómoda: el equipo y los inversionistas deben hablar de la misma métrica.

**Jugada 8: el plan anual como opción por defecto (cruza con Ingresos).**
Patrón de la industria: poner el anual por defecto reduce la ansiedad de baja y mejora el valor de vida. Se prueba en T2.

### Movimientos de 90 días de Retención

- Semanas 1–2: sale el flujo 6 (poscompra del antifaz). Atender los arreglos de la revisión del arranque (salto de línea del enlace al estudio, pie con el aviso legal de correo comercial, firma con el rostro del fundador, reseñas).
- Semanas 3–4: sale el flujo 4 (reactivación de usuarios inactivos).
- Semanas 5–6: el centro de preferencias de suscripción, construido y en vivo.
- Semanas 7–8: el flujo de hardware a activación de la aplicación, auditado y documentado. Arreglar cualquier fuga.
- Semanas 9–10: conciliación de la métrica de retención (con Devon).
- Semanas 11–12: campaña de recuperación para la cohorte de bajas: probar el texto de reactivación.

### Panorama de Retención a 12 meses

- T1: los flujos 6 y 4 disparándose. Centro de preferencias en vivo.
- T2: sale el flujo 2 (tras el rediseño de la bienvenida). La reflexión de Mira posterior a la sesión, en producción. Se prueba el plan anual por defecto.
- T3: lanzamiento general: las métricas de retención se vuelven a fijar con más volumen. Flujos de ciclo de vida por cohorte (antifaz contra instalación directa de la aplicación).
- T4: ciclo de vida completo que se compone. La retención deja de estar entre las tres preocupaciones principales; el foco pasa a Referidos e Ingresos.

### Habilidades y herramientas

- **Habilidades:** `secuencias-correo`, `retencion-clientes`, `redaccion-publicitaria`, `edicion-textos`, `pantallas-de-mejora`, `pruebas-ab`.
- **Herramientas y conexiones** (si la empresa las tiene conectadas): la **herramienta de correo del ciclo de vida** (validada en el arranque: un equipo no técnico puede lanzar flujos), la tienda en línea (los compradores del antifaz como fuente de eventos), pagos (estado de suscripción, cohortes de bajas) y analítica (eventos de sesión, curvas de retención). **Propias de la oficina:** Bandeja (`ver_bandeja`, `crear_borrador_respuesta`) para responder a quienes escriben por las redes; rutinas para el informe mensual de retención. Lo que se envíe a clientes lo aprueba el dueño.

---

## 7. Referidos

> *«¿Los usuarios retenidos traen más usuarios, y a qué costo?»*

### Estado actual

~5 embajadores interesados esperando (según el arranque). El servicio de enlaces ya está montado. Todavía no hay un programa formal. El boca a boca ocurre de forma natural según el desglose de adquisición de Alex.

Esta es una de las señales adelantadas más fuertes del negocio: 5 personas sin afiliación han levantado la mano pidiendo llevar Quietude a su red *antes de que exista un programa*. Esa señal no aparece en aplicaciones con un encaje producto-mercado más débil.

### El plan

**Jugada 1: lanzar el programa de embajadores con los 5 interesados.**
El Nivel 1 del programa. Páginas de aterrizaje por embajador (por ejemplo `quietude.app/with/sarah`). El servicio de enlaces rastrea la atribución. Falta definir la estructura de comisiones (según el arranque, monto por suscriptor o porcentaje de ingresos, por decidir). Salida suave con los 5: tratarlos como cohorte piloto, juntar opiniones y afinar antes de abrir las solicitudes.

**Jugada 2: construir el momento de compartir tras sentir el cambio.**
La reflexión de Mira posterior a la sesión (ver Retención) es el momento natural para mostrar una invitación a compartir. Después de que un usuario dice que sintió un cambio, ofrecer: *«¿Quieres compartir Quietude con alguien que lo necesite?»*. Una sola línea, nunca insistente. El mecanismo de boca a boca más potente: un flujo de regalar un mes en el que quien recibe tiene una introducción con descuento o gratis.

**Jugada 3: amplificación de los fundadores (Alex y Sam como embajadores cero).**
Alex menciona el trabajo del fCMO en sus presentaciones de la ronda (permiso concedido). Menciones recíprocas en el contenido del lado del fCMO. La red clínica de Sam → un grupo de embajadores profesionales.

**Jugada 4: piloto de la certificación Guías de Quietude (largo plazo, T3+).**
El programa de Guías es la capa de referidos de la fase 2 que se compone (según la presentación de la semilla). De 500 a 1.000 Guías en más de 50 ciudades entre el año 3 y el 5. Primer piloto de certificación: 3 a 5 anfitriones que dirigen sesiones en vivo, reciben una parte de los ingresos y marketing conjunto. Construye SEO local + prensa ganada + el volante de «embajadores de embajadores». Retener hasta que lo pagado y el ciclo de vida estén disparándose: Guías es una construcción de varios trimestres.

**Jugada 5: flujo de regalo del antifaz.**
Un referido de hardware es raro y potente. *«Envíale un antifaz de Quietude a un amigo. Recibe el antifaz + 3 meses de Premium gratis. Tú recibes un crédito para tu próxima compra.»* Las ventanas pico de fiestas y regalos son la prueba.

### Movimientos de 90 días de Referidos

- Semanas 1–4: programa de embajadores con su alcance definido, estructura de comisiones decidida, plantilla de página de aterrizaje por embajador construida y los 5 interesados en bienvenida.
- Semanas 5–8: se rastrean las primeras ventas impulsadas por embajadores con el servicio de enlaces. Se validan la atribución y el flujo de pago.
- Semanas 9–12: abrir solicitudes para los siguientes 10 a 15 embajadores. Empezar a definir el alcance de Guías.

### Panorama de Referidos a 12 meses

- T1: programa de embajadores en vivo con 5–10 activos.
- T2: 15–25 embajadores activos. El momento de compartir tras sentir el cambio, en producción (tras la reflexión de Mira).
- T3: se lanza el piloto de certificación de Guías (3–5 anfitriones). Flujo de regalo del antifaz en vivo para el pico de fiestas.
- T4: más de 50 embajadores + 5–10 Guías. Los referidos aportan del 15 % al 25 % de los suscriptores nuevos de venta directa.

### Habilidades y herramientas

- **Habilidades:** `referidos`, `redes-sociales`, `redaccion-publicitaria`, `arquitectura-web` (páginas de aterrizaje por embajador), `secuencias-correo`.
- **Herramientas y conexiones** (si la empresa las tiene conectadas): el servicio de enlaces (atribución; ya está en el sistema), pagos (contabilidad de comisiones y pagos), el repositorio del sitio (publicar las páginas de aterrizaje) y la herramienta de correo (ciclo de vida del embajador: bienvenida, resumen mensual de resultados, aviso de pago). **Propias de la oficina:** Estudio (material compartible para embajadores) y Contenido (publicaciones que ellos puedan reutilizar).

---

## 8. Ingresos

> *«¿Qué cobramos, quién paga y cómo se compone eso?»*

### Estado actual

| Producto | Precio | Señal de volumen |
|---|---|---|
| Aplicación Quietude + Mira | ~30 al mes | 145 suscriptores de pago (instantánea de la tienda de aplicaciones, 2026-05-16) |
| Antifaz Quietude | ~45 | 5.000 en existencias; ventas impulsadas por la prensa del influyente de la longevidad |
| Quietude Audio (altavoces) | ~7.500 | De nicho, liderado por el fundador |
| Quietude Spaces (instalación B2B) | 50.000–200.000 | Instalación insignia «Aurora» en marcha (~250.000 €), cartera de 4 recintos |
| Quietude Experiences (eventos) | Varía | Más de 15.000 participantes históricos |
| Guías de Quietude | Parte de los ingresos | Todavía no operativo |

**Ingresos a la fecha: ~500.000 con ~250.000 recaudados.** Eficiencia de capital. Hardware, B2B y suscripciones de la aplicación aportan.

**Ingreso mensual recurrente (instantánea de la tienda de aplicaciones): 592.** Con acceso limitado en la prueba, no en régimen estable. Los ~4 por suscriptor al mes que se desprenden, frente a 30 al mes de lista, sugieren una gran adopción del plan anual (que comprime el ingreso mensual pero mejora el valor de vida) o precios promocionales importantes: por conciliar con Alex.

### El plan

**Jugada 1: auditoría de precios.**
¿Qué se cobra de verdad hoy? ¿Precio de lista, mezcla de planes habitual, precio de introducción, ofertas de recuperación de bajas? La cuenta de ~4 por suscriptor al mes no cuenta una historia limpia: hace falta la verdad de base antes de recomendar cambios.

**Jugada 2: el plan anual como opción por defecto (prueba).**
Patrón de la industria; cruza con Retención. Se prueba en T2.

**Jugada 3: formalizar el paquete de hardware con la aplicación.**
Según el planteamiento de eventos y alianzas de la presentación de la semilla: el costo combinado por cliente vía hardware → suscripción a la aplicación es la jugada. Hoy, ¿qué recibe exactamente quien compra el antifaz? ¿Premium gratis? ¿Un código de prueba? Auditar y formalizar. El antifaz es la puerta de entrada; la aplicación es el valor de vida.

**Jugada 4: optimizar la tienda en línea del antifaz.**
La página actual rinde menos de lo que podría. Añadir: SEO (apuntar a «antifaz con peso», «antifaz de oscuridad total»), reseñas (decisión del arranque), política de devolución de 30 días (decisión del arranque) y un flujo de venta adicional hacia la aplicación Premium.

**Jugada 5: considerar una ficha del antifaz en un mercado en línea.**
El mercado se queda con margen pero es su propio motor de descubrimiento. Probar como distribución de la versión 2 si el volumen de la tienda lo valida.

**Jugada 6: casos de estudio de instalaciones B2B y material de ventas.**
Alex lleva las ventas B2B, pero marketing apoya con: casos de estudio posteriores a la instalación («Aurora» como insignia), reescritura de la página `/partner` con la voz y contenido de SEO del Pilar 4. Cada instalación B2B vale ~430.000 al año recurrentes + el multiplicador de caso de referencia.

**Jugada 7: licenciar datos (largo plazo; señalar para el sistema operativo).**
Según la bolsa de valor del año 10 al 15 de la presentación de la semilla: 100–160 millones al año. No es ingreso inmediato. Pertenece a la agenda estratégica de 24 meses. Se señala aquí para no perderlo de vista.

### Movimientos de 90 días de Ingresos

- Semanas 1–2: auditoría de precios. Conciliar el ingreso mensual recurrente implícito con el de lista.
- Semanas 3–4: se audita el flujo de hardware a activación de la aplicación (también es la jugada 6 de Retención).
- Semanas 5–8: reescritura de la página del antifaz en la tienda + optimización de SEO + reseñas + política de devolución. Se arma la estructura del caso de estudio de «Aurora» para después de la instalación.
- Semanas 9–12: se define el alcance de la prueba del plan anual por defecto.

### Panorama de Ingresos a 12 meses

- T1: se cierra la auditoría de precios. Se formaliza el flujo de hardware a activación de la aplicación.
- T2: prueba del plan anual por defecto en vivo. La tienda del antifaz produce una mejora medible.
- T3: se publican 1–2 casos de estudio de instalaciones B2B. Lanzamiento general + consideración de un nuevo nivel de precio (por ejemplo, ¿un plan superior con más Mira?).
- T4: precios optimizados con los resultados de las pruebas. El costo combinado de hardware → aplicación, seguido e informado. Primeras cifras de la tesis de licenciar datos (todavía muy temprano).

### Habilidades y herramientas

- **Habilidades:** `precios`, `pantallas-de-mejora`, `ofertas`, `material-ventas`, `operaciones-ingresos`, `pruebas-ab`, `redaccion-publicitaria`.
- **Herramientas y conexiones** (si la empresa las tiene conectadas): pagos (pruebas de precio, analítica de suscripciones, cohortes de bajas, cuentas del costo combinado por cliente), la herramienta de correo (ciclo de vida relacionado con la pantalla de pago y los precios), la tienda en línea (transacciones del antifaz), analítica (eventos de ingreso) y Notion (directorio de conocimiento comercial). **Los precios oficiales** salen de las cifras de la empresa: nunca de un texto del plan.

---
