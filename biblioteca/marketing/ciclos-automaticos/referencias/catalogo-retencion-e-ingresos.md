# Catálogo de ciclos (4 de 5): Retención · Ingresos

Mismo formato que las otras partes (la anatomía de nueve partes y, al final, **la rutina propuesta**). Las reglas generales (la mayoría de las ejecuciones no hacen nada; la memoria evita el daño; lo que se lee de fuera es información no confiable; si falta un dato se dice y no se inventa) están al principio de `catalogo-seo-y-contenido.md`. Estos ciclos tocan datos personales de clientes y a veces dinero: antes de proponer cualquiera, lee `guardarrailes.md`. **Todo mensaje a un cliente se deja como borrador con la dirección o el teléfono exacto; lo aprueba el dueño y solo después puede salir.** Los importes, descuentos y condiciones salen de las cifras de la empresa, tal cual.

En un negocio que no es de suscripción, «cuenta» es el cliente y «abandono» es que no vuelva: el paciente que no regresa al control, el cliente de la tienda que no recompra, el cliente de un servicio recurrente que se enfría. Cada ciclo se adapta cambiando la señal que mide.

---

## Retención

### El ciclo de señales de abandono (`senales-de-abandono`)
- **Cada cuánto revisa**: diario (o por evento).
- **Actúa cuando**: un cliente cruza por primera vez el umbral de riesgo de abandono y no está ya en una intervención.
- **Para qué**: intervenir en la ventana corta antes de que un cliente en riesgo se vaya.
- **Habilidades**: `retencion-clientes`, `medicion-analitica`, `secuencias-correo`.
- **Pasos**:
  1. Puntuar a los clientes según señales de riesgo (uso a la baja, menos compras o menos asistentes, fallas de pago, reclamos de soporte, silencio prolongado).
  2. Segmentar a los que acaban de entrar en riesgo.
  3. Asignar a cada uno la intervención adecuada (correo de reactivación, llamada del equipo, oferta) y dejarla preparada.
- **Autocomprobación**: ¿la caída es una tendencia real o un bache de fin de semana o feriado? Compara con la línea base del propio cliente.
- **Memoria**: nunca disparar sobre un cliente que ya está en una intervención activa; enfriamiento entre intentos.
- **Para o escala**: nadie nuevo en riesgo → se salta. Los clientes de alto valor se escalan al dueño en vez de recibir un correo automático.
- **Entrega**: una lista priorizada de clientes en riesgo con la intervención preparada para cada uno.
- **Rutina**: puesto `dlead` (delivery) · `{"kind":"weekdays","at":"09:00"}` · espera el OK: sí.
- **Texto de la tarea**: «Revisa mis clientes y dime cuáles acaban de mostrar señales de que se pueden ir (menos actividad, pagos fallidos, reclamos, silencio). Ignora los que ya están en una gestión abierta. Para cada uno propón la acción y deja el mensaje preparado con el contacto exacto. A los clientes grandes márcalos aparte para que los atienda yo. No envíes nada.»
- **Necesita**: datos de actividad por cliente (sistema de ventas, reservas o uso) y el historial de gestiones anteriores (la entrega previa de la rutina).

### El ciclo de renovación de secuencias de correo (`renovar-secuencias-de-correo`)
- **Cada cuánto revisa**: mensual.
- **Actúa cuando**: un correo de una secuencia rinde mal en interacción real o tiene contenido caduco.
- **Para qué**: mantener las secuencias automáticas rindiendo a medida que cambian el negocio y la audiencia.
- **Habilidades**: `secuencias-correo`, `medicion-analitica`, `edicion-textos`.
- **Pasos**:
  1. Reunir el rendimiento por correo: clics, conversiones, respuestas, bajas, quejas de spam y rebotes (**no las aperturas**: medirlas es poco fiable tras los cambios de privacidad).
  2. Marcar los de peor rendimiento y las referencias caducas (funciones viejas, fechas, precios).
  3. Redactar reescrituras o pruebas de asunto para los peores.
- **Autocomprobación**: ¿hay suficientes envíos por correo para que las tasas signifiquen algo?
- **Memoria**: la fecha de la última revisión de cada correo; enfriamiento antes de volver a probarlo.
- **Para o escala**: todas las secuencias sanas → se salta. **Pausa y escala cualquier secuencia con quejas o rebotes en aumento: es una emergencia de entregabilidad, no un retoque de texto.**
- **Entrega**: reescrituras de correo y pruebas de asunto como borradores.
- **Rutina**: puesto `newt` (marketing) · `{"kind":"monthly","day":6,"at":"09:00"}` · espera el OK: sí.
- **Texto de la tarea**: «Revisa el rendimiento de los correos de nuestras secuencias automáticas del último mes (clics, respuestas, bajas, quejas y rebotes, no aperturas) y marca los más flojos y los que mencionan precios, fechas o ofertas que ya cambiaron. Redacta la reescritura de los 3 peores. Si alguna secuencia tiene quejas o rebotes en aumento, dímelo primero.»
- **Necesita**: estadísticas por correo del programa de correo (conector o informe pegado). Sin secuencias automáticas, este ciclo no aplica.

### El ciclo de reactivación (`reactivacion`)
- **Cada cuánto revisa**: semanal.
- **Actúa cuando**: un cliente cruza por primera vez el umbral de inactividad.
- **Para qué**: recuperar a los clientes dormidos antes de perderlos para siempre.
- **Habilidades**: `secuencias-correo`, `sms-whatsapp`, `ofertas`.
- **Pasos**:
  1. Identificar a quienes acaban de cruzar el umbral de inactividad.
  2. Elegir el ángulo de reconquista (una novedad, una oferta, «te extrañamos», aviso de baja por inactividad).
  3. Redactar el mensaje y marcar la exclusión para no volver a contactarlos la semana siguiente.
- **Autocomprobación**: ¿están realmente dormidos o son clientes de baja frecuencia por naturaleza? No molestes a cuentas sanas.
- **Memoria**: los intentos de reconquista por cliente; exclusión después de cada envío durante el enfriamiento.
- **Para o escala**: tras N intentos sin respuesta, pasar a la baja por inactividad, no a otro correo.
- **Entrega**: un mensaje de reconquista como borrador + la lista de exclusión actualizada.
- **Rutina**: puesto `newt` (marketing) · `{"kind":"weekly","days":[2],"at":"10:00"}` · espera el OK: sí.
- **Texto de la tarea**: «Identifica los clientes que llevan más de [N] días sin comprar o sin volver y que no han recibido un mensaje de reconquista en los últimos 60 días. Elige el mejor ángulo, redacta el mensaje (correo o WhatsApp) y déjalo con el contacto exacto de cada uno. Respeta a quien se dio de baja. No envíes nada.»
- **Necesita**: la lista de clientes con su última compra o visita y la lista de bajas. El umbral N lo da el dueño (en una peluquería, 60 días; en una tienda de ropa, 120; en una clínica, el plazo de su control).

### El ciclo de entregabilidad del correo (`entregabilidad-del-correo`)
- **Cada cuánto revisa**: semanal.
- **Actúa cuando**: suben los rebotes, las quejas o las bajas, o se degrada la higiene de la lista.
- **Para qué**: proteger la reputación del remitente y la llegada a la bandeja de entrada.
- **Habilidades**: `secuencias-correo`, `medicion-analitica`.
- **Pasos**:
  1. Vigilar rebotes, quejas de spam, bajas, la salud del dominio (DKIM, SPF y DMARC) y las señales de llegada a bandeja.
  2. Marcar las tasas de problema en aumento o los fallos de autenticación.
  3. Recomendar acciones: suprimir los rebotes duros, retirar a los inactivos crónicos, arreglar la autenticación, bajar el ritmo de envío.
- **Autocomprobación**: ¿el pico es de un solo envío o es tendencia? Relaciónalo con las campañas recientes.
- **Memoria**: las direcciones ya suprimidas y la fecha de la última limpieza.
- **Para o escala**: todo sano → se registra y se salta. **Un pico de quejas se escala de inmediato:** el daño a la reputación se acumula rápido.
- **Entrega**: un informe de entregabilidad + una lista de acciones de higiene.
- **Rutina**: puesto `newt` (marketing) · `{"kind":"weekly","days":[1],"at":"08:30"}` · espera el OK: no.
- **Texto de la tarea**: «Revisa la salud de nuestros correos de marketing de la última semana: rebotes, quejas, bajas y la configuración del dominio (SPF, DKIM, DMARC). Dime si hay una tendencia preocupante y qué limpieza o ajuste recomiendas. Si todo está sano, responde "sano".»
- **Necesita**: estadísticas del programa de correo y, para el dominio, que el dueño o quien lo administre pase los resultados de la revisión.

### El ciclo de la voz del cliente (`voz-del-cliente`)
- **Cada cuánto revisa**: semanal.
- **Actúa cuando**: llegó opinión nueva (encuestas de satisfacción, tickets de soporte, reseñas, llamadas, mensajes).
- **Para qué**: enviar cada opinión a la acción correcta **y** minarla para sacar insumos de marketing.
- **Habilidades**: `investigacion-clientes`, `retencion-clientes`, `referidos`, `redaccion-publicitaria`.
- **Pasos**:
  1. Reunir la opinión nueva de todas las fuentes.
  2. Encaminarla: detractores o en riesgo → gestión de rescate (`retencion-clientes`); promotores → pedido de referido o de reseña (`referidos`); dolor o deseo recurrente → experimento e insumo de texto.
  3. Extraer el lenguaje textual del cliente para los textos, las preguntas frecuentes y el manejo de objeciones.
- **Autocomprobación**: ¿un tema es un patrón real o una sola voz fuerte? Exige un mínimo de casos antes de actuar sobre él.
- **Memoria**: los identificadores de opiniones ya procesadas; nunca encaminar dos veces la misma.
- **Para o escala**: sin opinión nueva → se salta. Las quejas delicadas o legales se escalan al dueño.
- **Entrega**: acciones encaminadas + un resumen de lenguaje e ideas para marketing (las frases textuales sirven para actualizar `00-Empresa/marketing`).
- **Rutina**: puesto `riley` (marketing) · `{"kind":"weekly","days":[5],"at":"09:00"}` · espera el OK: no.
- **Texto de la tarea**: «Reúne la opinión nueva de esta semana (reseñas, mensajes, comentarios, correos de clientes) y dime: qué clientes necesitan una atención de rescate, quiénes están contentos y a quién podríamos pedirle una reseña o un referido, y qué frases textuales de clientes valen para nuestros textos. Pide al menos 3 casos antes de llamar patrón a algo. Si no hay opinión nueva, dilo.»
- **Necesita**: las reseñas, encuestas y mensajes (bandeja de Contenido, correo, o lo que el dueño pegue).

---

## Ingresos

### El ciclo de conversión de la prueba (`conversion-de-la-prueba`)
- **Cada cuánto revisa**: diario.
- **Actúa cuando**: un usuario en prueba (o un cliente con una muestra, una cita de cortesía, un primer trabajo a prueba) llega a un momento relevante para convertir: mitad de la prueba, cerca de vencer, activado pero sin pagar.
- **Para qué**: pasar más pruebas a pago con empujones bien cronometrados.
- **Habilidades**: `secuencias-correo`, `pantallas-de-mejora`, `medicion-analitica`, `ofertas`.
- **Pasos**:
  1. Segmentar las pruebas activas por etapa y nivel de activación.
  2. Asignar a cada una el empujón adecuado (resumen del valor logrado, consejo de uso, aviso de vencimiento, oferta).
  3. Dejar el empujón preparado.
- **Autocomprobación**: ¿el usuario está lo bastante activado para que un empujón de pago funcione, o necesita vivir más valor primero?
- **Memoria**: los empujones enviados por prueba; respetar el ritmo; excluir a quienes ya pagaron.
- **Para o escala**: ninguna prueba en una etapa accionable → se salta. No saturar a una misma prueba con mensajes.
- **Entrega**: empujones por etapa como borradores.
- **Rutina**: puesto `ona` (delivery) · `{"kind":"weekdays","at":"09:30"}` · espera el OK: sí.
- **Texto de la tarea**: «Revisa las pruebas o muestras activas y dime cuáles están a mitad, cerca de vencer o activadas sin pagar. Para cada una redacta el mensaje adecuado a su etapa (con el contacto exacto), usando solo los precios y ofertas de las cifras de la empresa. No envíes nada y no insistas con quien ya recibió un mensaje en los últimos días.»
- **Necesita**: la lista de pruebas con su fecha y su actividad. Solo aplica si el negocio tiene pruebas, muestras o primer trabajo a prueba.

### El ciclo de intención de compra (`intencion-de-compra`)
- **Cada cuánto revisa**: diario.
- **Actúa cuando**: un usuario gratis o en prueba (o un prospecto) muestra una intención de compra respaldada por su uso (límites alcanzados, uso de funciones clave, invitaciones a su equipo, varias visitas a precios, cotizaciones pedidas).
- **Para qué**: atrapar a los de alta intención y dejar preparado el contacto en el momento justo.
- **Habilidades**: `medicion-analitica`, `material-ventas`, `operaciones-ingresos`.
- **Pasos**:
  1. Puntuar a los usuarios gratis o en prueba según las señales de intención.
  2. Mostrar a los recién calificados.
  3. Dejar preparado el movimiento adecuado (aviso de mejora en el producto, contacto de ventas para los de alto valor, correo dirigido).
- **Autocomprobación**: ¿la señal es intención real de compra o uso casual? Calibra el umbral para evitar falsos positivos.
- **Memoria**: los casos ya trabajados; no volver a encaminarlos dentro del enfriamiento.
- **Para o escala**: nadie nuevo calificado → se salta. Los de alto valor pasan a una persona; el ciclo no cierra ventas solo.
- **Entrega**: una lista priorizada de prospectos calientes con el movimiento preparado.
- **Rutina**: puesto `ilm` (sales) · `{"kind":"weekdays","at":"08:30"}` · espera el OK: sí.
- **Texto de la tarea**: «Revisa los prospectos y usuarios de hoy y dime quiénes muestran intención real de comprar (pidieron precio, volvieron varias veces, llegaron a un límite). Para cada uno deja preparado el siguiente paso y el mensaje, y avísame de los de más valor para que los atienda una persona. No envíes nada.»
- **Necesita**: señales de uso o de interés por persona (CRM, formularios, el sitio).

### El ciclo de experimentos en la página de precios (`experimentos-pagina-de-precios`)
- **Cada cuánto revisa**: mensual (las pruebas duran más).
- **Actúa cuando**: no hay una prueba en marcha en la página y hay una hipótesis que vale la pena, o una prueba en marcha concluyó.
- **Para qué**: mejorar de forma continua la conversión de la página de precios **y la calidad del ingreso**.
- **Habilidades**: `precios`, `pruebas-ab`, `conversion-paginas`.
- **Pasos**:
  1. Revisar la conversión de la página de precios, la mezcla de planes y el ingreso por visitante.
  2. Generar una hipótesis de precio, paquete o texto, o leer una prueba concluida.
  3. Entregar el diseño y el análisis a `pruebas-ab`; promover un ganador limpio.
- **Autocomprobación**: juzga a los ganadores por **ingreso por visitante, mezcla de planes, devoluciones, bajas de plan, abandono y carga de soporte: no solo por la tasa de conversión.** ¿La prueba en marcha terminó de verdad estadísticamente antes de darla por concluida?
- **Memoria**: la prueba en marcha y el registro de pruebas concluidas; nunca iniciar una prueba que choque con otra en la misma página.
- **Para o escala**: hay una prueba en marcha → se espera. **No promuevas una variante que sube la conversión pero baja el ingreso por visitante o sube las devoluciones o el abandono.** Cambiar precios en vivo lo decide el dueño.
- **Entrega**: el resultado de una prueba + la siguiente hipótesis.
- **Rutina**: puesto `mlead` (marketing) · `{"kind":"monthly","day":2,"at":"09:00"}` · espera el OK: no.
- **Texto de la tarea**: «Revisa cómo está funcionando nuestra página de precios (conversión, qué plan eligen, ingreso por visitante). Si hay una prueba que ya terminó, léela y dime si hay un ganador limpio (sin perder ingreso ni subir devoluciones); si no hay prueba en marcha, propón una hipótesis. Los precios los tomas de las cifras de la empresa.»
- **Necesita**: tráfico y ventas por plan, y una herramienta de pruebas A/B si la empresa tiene una. Sin tráfico suficiente, el ciclo no mide nada.

### El ciclo de optimización de la pantalla de mejora (`optimizacion-pantalla-de-mejora`)
- **Cada cuánto revisa**: mensual.
- **Actúa cuando**: no hay una prueba de la pantalla en marcha y hay una hipótesis, o una concluyó.
- **Para qué**: mejorar la conversión a pago dentro del producto sin degradar la calidad del ingreso.
- **Habilidades**: `pantallas-de-mejora`, `pruebas-ab`, `medicion-analitica`.
- **Pasos**:
  1. Reunir vistas de la pantalla → conversión a pago y puntos de abandono.
  2. Formar una hipótesis (momento de aparición, encuadre, plan ancla) o leer una prueba concluida.
  3. Entregar la ejecución a `pruebas-ab`.
- **Autocomprobación**: segmenta por plan o cohorte: un número agregado puede esconder un segmento que se hunde. Mira las devoluciones y las bajas de plan junto a la conversión.
- **Memoria**: pruebas en marcha y concluidas; sin pruebas que choquen.
- **Para o escala**: hay una prueba en marcha → se espera. No promuevas una mejora de conversión que sube devoluciones o abandono.
- **Entrega**: el resultado de una prueba + la siguiente hipótesis.
- **Rutina**: puesto `mlead` (marketing) · `{"kind":"monthly","day":4,"at":"09:00"}` · espera el OK: no. Solo para negocios con un producto digital o una membresía.
- **Texto de la tarea**: «Revisa cuántos clientes ven nuestra pantalla de pasar a un plan de pago dentro del producto y cuántos pasan, por tipo de plan. Si hay una prueba concluida, léela; si no, propón una hipótesis (cuándo aparece, cómo se plantea, qué plan se muestra primero). No promuevas nada que suba devoluciones o bajas.»
- **Necesita**: datos de la pantalla (vistas y conversiones), disponibles solo en un producto con esa pantalla.

### El ciclo de ampliación y venta adicional (`ampliacion-y-venta-adicional`)
- **Cada cuánto revisa**: semanal.
- **Actúa cuando**: un cliente de pago muestra una señal de ampliación (uso cerca del límite, más usuarios, un nuevo uso, compra repetida, pide algo que no tiene contratado).
- **Para qué**: crecer el ingreso de los clientes existentes con ventas adicionales o cruzadas bien cronometradas.
- **Habilidades**: `operaciones-ingresos`, `material-ventas`, `secuencias-correo`.
- **Pasos**:
  1. Puntuar a los clientes de pago según señales de ampliación.
  2. Mostrar a los recién listos para ampliar.
  3. Dejar preparado el movimiento adecuado (aviso de mejora por uso, contacto del responsable de la cuenta, oferta cruzada).
- **Autocomprobación**: ¿el cliente está lo bastante sano para que una venta adicional no dañe la relación? No le ofrezcas más a un cliente en riesgo: eso es trabajo del ciclo de señales de abandono.
- **Memoria**: los contactos de venta adicional por cliente; respetar el ritmo.
- **Para o escala**: nadie listo → se salta. Las cuentas estratégicas pasan a una persona.
- **Entrega**: una lista priorizada con el movimiento preparado.
- **Rutina**: puesto `lexi` (sales) · `{"kind":"weekly","days":[2],"at":"09:00"}` · espera el OK: sí.
- **Texto de la tarea**: «Revisa mis clientes actuales y dime a quiénes les conviene una ampliación (compran más seguido, piden algo que no tienen, llegaron al límite de su plan). Descarta a cualquiera con señales de riesgo. Deja preparado el mensaje de cada uno con las condiciones de las cifras de la empresa. No envíes nada y avísame de las cuentas grandes.»
- **Necesita**: datos de compras o uso por cliente y su estado de salud.

### El ciclo de cobros fallidos (`cobros-fallidos`)
- **Cada cuánto revisa**: diario.
- **Actúa cuando**: un pago falla o una tarjeta está por vencer; en un negocio que factura, una factura vence sin pago.
- **Para qué**: recuperar el abandono involuntario, a menudo el trabajo de retención de mayor retorno.
- **Habilidades**: `operaciones-ingresos`, `secuencias-correo`.
- **Pasos**:
  1. Detectar pagos fallidos y tarjetas por vencer (o facturas vencidas).
  2. Preparar la secuencia de recobro: calendario de reintentos y mensajes que escalan para actualizar el medio de pago o pagar.
  3. Encaminar las fallas persistentes a una persona.
- **Autocomprobación**: ¿la falla es involuntaria (un problema de la tarjeta) o una cancelación intencional? No le cobres con insistencia a quien decidió irse.
- **Memoria**: la etapa de recobro por cliente; seguir el calendario de reintentos; detenerse al recuperarse el pago.
- **Para o escala**: tras el último reintento, escalar o desactivar según la política: no repetir para siempre. Un recordatorio de pago es un envío: lo aprueba el dueño y solo va a las direcciones del borrador aprobado.
- **Entrega**: la cola de recobro activa + el estado de recuperación, con cada mensaje como borrador.
- **Rutina**: puesto `invo` (fin) · `{"kind":"weekdays","at":"09:00"}` · espera el OK: sí.
- **Texto de la tarea**: «Revisa los pagos fallidos, las tarjetas por vencer y las facturas vencidas de hoy. Dime en qué etapa de recobro está cada cliente, quién ya pagó, y redacta el recordatorio que toca (amable al principio, más firme después) con el contacto exacto. Descarta a quien canceló a propósito. Pasa a una persona a los que ya agotaron los reintentos. No envíes nada.»
- **Necesita**: la lista de facturas o cobros con su estado (Xero, Stripe o la herramienta de cobros de la empresa, si está conectada; si no, el dueño pega el listado). Las leyes de cobro de tu país mandan sobre el tono y la frecuencia.
