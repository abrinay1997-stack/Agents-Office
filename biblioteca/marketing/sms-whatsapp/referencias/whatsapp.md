# Referencia de la plataforma de WhatsApp Business

Adaptada de una contribución de @Inflimity (PR #516) al repositorio original.

> Los datos de la plataforma son **de octubre de 2026** y vienen de la documentación de desarrolladores de Meta (los enlaces están en [Fuentes](#fuentes)). Meta cambia los precios y los límites con frecuencia. **Revisa la página de precios vigente antes de cotizarle costos a un cliente.** Nunca des una tarifa por país de memoria: pídela de la lista oficial o de la del proveedor.

---

## Cuándo encaja WhatsApp y cuándo el SMS

WhatsApp es la aplicación de mensajería por defecto en la mayor parte de América Latina, Europa, África, Medio Oriente y el sur y sudeste de Asia. En EE. UU. y Canadá, el SMS todavía llega a más gente.

| Situación | Mejor opción | Por qué |
|-----------|--------------|---------|
| Clientes sobre todo en América Latina, Europa, Medio Oriente y África, India, Sudeste Asiático | **WhatsApp** | Es donde ya ocurren las conversaciones |
| Clientes sobre todo en EE. UU. | **SMS** | Meta hoy no entrega plantillas de marketing a números de EE. UU. (+1) |
| Mensajes ricos de producto (imágenes, botones, listas) | **WhatsApp** | Formatos interactivos nativos, sin recargo de MMS |
| Conversaciones de venta o soporte de dos vías | **WhatsApp** | Chat en hilo, botones de respuesta, traspaso a una persona |
| La publicidad en redes es un canal de captación importante | **WhatsApp** | Los anuncios que abren WhatsApp abren una ventana gratuita |
| Avisos sencillos de una vía, códigos de acceso, lista con mucho EE. UU. | **SMS** | Configuración más simple, alcance universal |
| Programa en varios países | **Los dos** | WhatsApp donde la adopción es alta, SMS como respaldo |

**Pregunta primero**: ¿dónde están los clientes? Si más de la mitad está en EE. UU., el marketing por WhatsApp es, como mucho, una capa de soporte o transaccional hasta que Meta levante la restricción de marketing en EE. UU.

En un negocio local (restaurante, consultorio, taller, tienda de barrio), lo habitual es empezar con la **aplicación WhatsApp Business** (gratuita): catálogo, respuestas rápidas, etiquetas y mensaje de ausencia. Solo da el salto a la plataforma cuando haya volumen, automatización o varios agentes.

---

## Aplicación y plataforma

- **Aplicación WhatsApp Business**: gratuita, manual, un teléfono o unos pocos dispositivos vinculados. Sirve para quien atiende los chats en persona. No está hecha para automatizar ni para envíos masivos.
- **Plataforma WhatsApp Business (Cloud API)**: envío programático, plantillas, webhooks, automatización. Se accede directamente por Meta o por un proveedor autorizado (BSP).

Entre los proveedores hay API de mensajería (Twilio, Infobip, Sinch, MessageBird/Bird), herramientas centradas en WhatsApp (Wati, Interakt, AiSensy), herramientas de automatización de chat (ManyChat, respond.io) y plataformas de ciclo de vida que sumaron WhatsApp (Klaviyo, Brevo, Customer.io). Elige según tu entorno actual, los mercados a los que escribes y si necesitas un constructor de flujos sin código. Todos trasladan las tarifas por mensaje de Meta; la mayoría suma un margen o una cuota de plataforma.

---

## La ventana de atención al cliente de 24 horas

- **La ventana se abre** cuando el cliente te escribe. Dura 24 horas desde su último mensaje. Cada mensaje nuevo del cliente la reinicia.
- **Dentro de la ventana**: puedes mandar mensajes libres (texto, medios, botones y listas interactivas) sin aprobación previa.
- **Fuera de la ventana**: solo puedes mandar una **plantilla preaprobada**. Los mensajes libres fallan (error 131047, «mensaje de reenganche»).

Diseña los flujos en torno a esto. Un recordatorio de carrito una hora después del abandono casi siempre cae fuera de una ventana, así que debe ser una plantilla aprobada.

---

## Categorías de plantillas

Toda plantilla es de una de tres categorías. Meta revisa la categoría que eliges.

| Categoría | Qué califica | Ejemplos |
|-----------|--------------|----------|
| **Marketing** | Todo lo promocional, de difusión o de recaptación | Ofertas, lanzamientos, «ya hay stock», **recordatorios de carrito abandonado**, reactivación |
| **Utilidad** | No promocional Y específica del pedido o la cuenta de la persona (o crítica para ella) | Confirmación de pedido, aviso de envío, recordatorio de cita, aviso de cobro |
| **Autenticación** | Solo códigos de un solo uso, con los formatos prediseñados de Meta | Códigos de acceso, códigos de verificación |

Reglas que hacen tropezar a la gente:

- **Los recordatorios de carrito son marketing**, incluso cuando el usuario pidió que se lo recordaran. Las pautas de Meta ponen «Dejaste {{artículos}} en tu carrito» como ejemplo de recaptación.
- **El contenido mixto pasa a marketing.** Un aviso de pedido con un código promocional, o una encuesta de opinión con un descuento, es una plantilla de marketing.
- **Recategorización automática.** Desde el 9 de abril de 2025, una plantilla enviada como utilidad que Meta juzgue de marketing se aprueba como marketing. Meta también revisa de nuevo las plantillas aprobadas y las recategoriza (normalmente con un día de aviso, ninguno si el uso indebido se repite).
- **Apelaciones**: tienes 60 días desde la creación o el cambio de categoría para pedir una revisión.
- **Las plantillas de autenticación** no pueden llevar enlaces, medios ni emojis.

**Anatomía de una plantilla**: encabezado opcional (texto, imagen, video, documento), cuerpo con variables como `{{1}}`, pie opcional (a menudo la línea de baja) y botones opcionales (respuesta rápida, enlace, teléfono, copiar código). Envía valores de ejemplo realistas para cada variable. Los ejemplos vagos son una causa común de rechazo.

---

## Permiso y baja

Meta exige el permiso antes de escribirle a alguien. El permiso debe decirle claramente a la persona que recibirá mensajes de **tu empresa**, y debe cumplir la ley local (RGPD, LGPD, la ley de datos personales de tu país, la TCPA, etc.). Meta permite un permiso general para la empresa, pero nombrar a WhatsApp de manera explícita es la práctica más segura y la que muchas leyes esperan en la práctica; hazlo salvo que tengas una razón para no hacerlo.

Puedes conseguirlo por un formulario web, una casilla al pagar, SMS, un menú telefónico, en persona o dentro de un chat de WhatsApp. Meta recomienda permisos separados (o uno que nombre las categorías) para avisos de pedido y para ofertas.

Ejemplo de permiso al pagar (sin marcar por defecto):

> [ ] Quiero recibir avisos de mi pedido y ofertas de Acme por WhatsApp. Puedo darme de baja cuando quiera.

**Manejo de la baja:**

- Añade un botón de respuesta rápida como `Dejar de recibir promociones` a cada plantilla de marketing, o un pie como «Responde STOP para darte de baja».
- Cuando alguien se da de baja, márcalo en tu CRM de inmediato y detén todas las plantillas de marketing.
- Manda una sola confirmación: «Te diste de baja de las ofertas de Acme. Responde ALTA para volver.»
- Sigue mandando los mensajes de utilidad que aún necesite (avisos de pedido) si dio el permiso para ellos por separado.

Una baja fácil te protege. Si la única manera de dejar de recibir tus mensajes es el botón Bloquear, la gente bloqueará, y los bloqueos bajan tu calificación de calidad.

---

## Calificación de calidad y límites de mensajes

### Calificación de calidad

Cada número de teléfono tiene una calificación de calidad basada en cómo respondieron los destinatarios a tus mensajes en los **últimos 7 días**: bloqueos, reportes y los motivos dados («No me suscribí», «Spam», «Ya no lo necesito»).

| Calificación | Significado |
|--------------|-------------|
| **Verde (alta)** | Sana, apta para crecer |
| **Amarilla (media)** | Advertencia, sube la retroalimentación negativa |
| **Roja (baja)** | El número pasa al estado **Marcado** |

Si un número Marcado se recupera a media o alta en 7 días, nada cambia. Si no, tu **límite de mensajes baja un nivel**.

Las plantillas también tienen su propia calificación de calidad. Las plantillas de marketing y de utilidad nuevas o de baja calidad se **dosifican** (Meta retiene parte de un envío para recoger opiniones primero). La retroalimentación mala **pausa** la plantilla, y los mensajes retenidos fallan.

### Límites de mensajes

El límite de mensajes es a cuántos **usuarios únicos** puedes llegar con plantillas **fuera** de una ventana de servicio en 24 horas móviles. El límite ahora se comparte en todo tu **portafolio de empresa**, no se fija por número de teléfono, así que un número muy activo puede agotar el cupo de todos.

| Nivel | Usuarios únicos por 24 h |
|-------|--------------------------|
| Inicial por defecto | 250 |
| Tras la verificación o al crecer | 2.000 |
| Siguientes niveles | 10.000 → 100.000 → Ilimitado |

- **De 250 a 2.000**: completa la verificación de la empresa, o entrega 2.000 mensajes de plantilla de alta calidad a usuarios únicos en 30 días.
- **Por encima de 2.000**: es automático cuando has usado al menos la mitad de tu límite actual en los últimos 7 días con mensajes de alta calidad en todos los números y plantillas. Las subidas llegan en unas 6 horas.
- Las respuestas dentro de una ventana de servicio no cuentan para el límite.

### Límites de marketing por usuario

Meta también limita cuántas plantillas de marketing recibe **una sola persona** de todas las empresas, según su índice reciente de lectura. Los envíos bloqueados devuelven el error 131049. Espera al menos 24 horas antes de reintentar. Un mensaje de marketing enviado dentro de una ventana de servicio abierta no cuenta para este tope.

### Calentar un número nuevo

1. Haz primero la verificación de la empresa. Hace al negocio apto para crecer hacia 2.000, pero Meta aún aprueba o niega el aumento tras una revisión de calidad, así que revisa el límite real antes de programar envíos.
2. Manda tus primeras plantillas a altas recientes de alta intención (compradores de los últimos 30 días, personas que te escribieron).
3. Aumenta el volumen durante 1 o 2 semanas mientras el número se mantiene en verde.
4. Reparte los envíos grandes a lo largo de horas en lugar de disparar todo a la vez.
5. Mira los motivos de bloqueo en el administrador de WhatsApp después de cada campaña.

---

## Formatos de mensaje

| Formato | Límites | Ideal para |
|---------|---------|------------|
| **Botones de respuesta** | Hasta 3 botones, 20 caracteres cada uno | Sí/no, elegir un camino, baja |
| **Mensaje de lista** | Hasta 10 filas en hasta 10 secciones, títulos de fila de 24 caracteres | Categorías de producto, horarios de reserva, calificación |
| **Botones de enlace / llamada** (plantillas) | Abren un enlace o inician una llamada | Pago, rastreo, línea de soporte |
| **Encabezado multimedia** | Imagen, video o documento | Fotos de producto, lanzamientos, recibos |
| **Mensajes de catálogo / producto** | Toman datos de un catálogo comercial de Meta | Explorar y comprar dentro del chat |

Pautas de texto:

- Cada burbuja de 1 a 3 frases cortas (más o menos menos de 60 palabras).
- Usa botones en lugar de pegar enlaces en bruto.
- El formato de WhatsApp funciona: `*negrita*`, `_cursiva_`, saltos de línea.
- Uno o dos emojis están bien. A diferencia del SMS, no cambian el costo.
- Nombra tu marca en la primera línea de las plantillas, porque muchos usuarios no tendrán guardado tu número.
- Las imágenes del encabezado o del catálogo se pueden preparar con el Estudio de la oficina (`generar_imagen`, `buscar_en_galeria`).

---

## Precios (a octubre de 2026)

Meta pasó del precio por conversación al **precio por mensaje el 1 de julio de 2025**. Pagas por mensaje entregado, a una tarifa fijada por la categoría del mensaje y el código de país del destinatario.

| Tipo de mensaje | Cómo se cobra |
|-----------------|---------------|
| **Plantilla de marketing** | Se cobra en cada entrega, dentro o fuera de una ventana de servicio |
| **Plantilla de utilidad** | Se cobra fuera de una ventana. Dentro de una ventana abierta fue gratis desde el 1 de julio de 2025 hasta el **1 de octubre de 2026**, cuando Meta empezó a cobrarla |
| **Plantilla de autenticación** | Se cobra por entrega; consulta la tarifa vigente para el trato dentro de la ventana en tu mercado |
| **Mensaje de servicio** (respuesta libre) | Gratis desde el 1 de noviembre de 2024. Desde el **1 de octubre de 2026**, cada número de teléfono de la empresa recibe **1.000 mensajes de servicio gratis al mes** (sin acumulación); después se cobran por mensaje a la misma tarifa que utilidad/autenticación en ese mercado, sin niveles por volumen |
| **Meta Business Agent** (el agente de IA de Meta) | Se cobra por token desde el 1 de agosto de 2026, aproximadamente US$2 por millón de tokens. Nunca es gratis |
| **Cualquier mensaje en una ventana de punto de entrada gratuito** | Gratis (ver abajo) |

**Niveles por volumen**: las tarifas de utilidad y autenticación bajan al crecer el volumen mensual, medido en todo tu portafolio por mercado. Los niveles se reinician cada mes calendario. Marketing no tiene niveles por volumen, pero la API de mensajes de marketing permite fijar un precio máximo por entrega.

**Cuenta práctica**: las tarifas difieren mucho por país. Marketing es la categoría más cara en todos los mercados, a menudo varias veces la tarifa de utilidad. Toma las tarifas vigentes de las listas de Meta (o de tu proveedor, que incluyen su margen) y calcula el costo por pedido recuperado antes de lanzar un flujo.

Los cambios de octubre de 2026 hacen que las conversaciones de soporte más allá de las primeras 1.000 al mes por número, y los avisos de pedido dentro de la ventana, ahora cuesten dinero. Si tu caso de negocio antiguo suponía que «las respuestas son gratis», rehazlo.

---

## Anuncios que abren WhatsApp (Click-to-WhatsApp)

Los anuncios Click-to-WhatsApp (CTWA) corren en Facebook e Instagram y abren un chat de WhatsApp con tu empresa al tocarlos. Los anuncios se preparan con `campanas-pagadas` y `creatividad-anuncios`; el agente deja los textos y las imágenes como borradores y el dueño los aprueba y publica.

**Ventana de punto de entrada gratuito**: cuando alguien te escribe desde un anuncio CTWA o desde un botón de llamada a la acción de una página de Facebook y respondes en 24 horas, se abre una ventana de punto de entrada gratuito desde que respondes. Meta dice que puede quedar abierta hasta 7 días (a octubre de 2026). Mientras está abierta, Meta no cobra los mensajes de marketing, utilidad, autenticación ni servicio; los mensajes de Meta Business Agent siguen cobrándose. Revisa el vencimiento real de la ventana en tus datos de entrega en lugar de suponer el máximo.

Cómo aprovecharla:

1. **Engancha el anuncio con un motivo para chatear**: un cuestionario, ayuda con tallas, una cotización, un código para reclamar.
2. **Rellena el primer mensaje del usuario**: «¡Hola! Quiero mi código de bienvenida del 15 %.»
3. **Responde rápido con botones**: 2 o 3 preguntas de calificación como botones de respuesta.
4. **Convierte o pasa a una persona mientras la ventana gratuita está abierta**: enlace de pago, enlace de reserva o un asesor en vivo.
5. **Pide el permiso de marketing dentro del chat** para poder dar seguimiento con plantillas después.

---

## Guías de flujos

### 1. Recuperar carritos abandonados

- **Disparador**: 45 a 60 minutos después del abandono, solo para contactos con permiso de marketing por WhatsApp.
- **Tipo**: plantilla de marketing (fuera de la ventana, y los recordatorios de carrito son marketing por definición).
- **Salida**: detener al comprar, al darse de baja o a las 48 horas.
- **Segundo toque** (opcional, a las 24 horas): solo si el primero no se leyó o no se tocó, y reserva cualquier descuento para aquí.

```text
Encabezado: [imagen del producto]
Cuerpo: Hola {{1}}, te escribe Acme. Dejaste {{2}} en tu carrito. Te lo estamos guardando, pero el stock es limitado.
Pie: Responde STOP para dejar de recibir mensajes
Botones: [Enlace: Terminar mi compra] [Respuesta rápida: Tengo una pregunta]
```

«Tengo una pregunta» abre una ventana de servicio. Llévala al traspaso a soporte de más abajo.

### 2. Bienvenida (tras el alta o desde un anuncio CTWA)

- **Disparador**: inmediatamente tras el alta, o el primer mensaje entrante de un anuncio.
- **Tipo**: mensaje libre si acaban de escribirte (ventana abierta); si no, una plantilla de marketing.

```text
¡Hola {{1}}, bienvenido a Acme! Aquí tienes tu código: BIENVENIDO15. ¿Qué estás buscando hoy?
Botones: [Cuidado de la piel] [Cuidado del cabello] [Solo mirando]
```

Cada botón lleva a 2 o 3 productos sugeridos con un enlace de pago. Pide aquí el permiso de marketing si vienen de un anuncio.

### 3. Reenganche / reactivación

- **Audiencia**: clientes con permiso y sin compras en 60 a 90 días.
- **Tipo**: plantilla de marketing.
- **Frecuencia**: 1 o 2 envíos de marketing al mes a este segmento. Más trae bloqueos y errores del límite por usuario.

```text
Hola {{1}}, te escribe Acme. Tu {{2}} suele acabarse por estas fechas. ¿Quieres que te apartemos una recarga?
Botones: [Sí, reponer] [Ahora no] [Dejar de recibir promociones]
```

«Ahora no» lo suprime 30 días. «Dejar de recibir promociones» lo da de baja.

### 4. Traspaso a soporte

- **Disparador**: un botón de ayuda, una palabra clave como «asesor», o que el asistente automático falle dos veces.
- **Tipo**: mensajes de servicio (ventana abierta). Se cobran desde el 1 de octubre de 2026 pasado el cupo, así que resuelve con el menor número de mensajes posible.

```text
Entendido. Te conecto con alguien de nuestro equipo. El tiempo habitual de respuesta es de menos de 10 minutos entre las 9 a. m. y las 6 p. m.
```

Pasa el contexto del carrito o del pedido al asesor para que el cliente no tenga que repetirse. Fuera del horario de atención, di cuándo responderá una persona y ofrece una lista de preguntas frecuentes. Si la respuesta pasa de 24 horas, necesitarás una plantilla de utilidad para contestar.

### 5. Citas y recordatorios (negocios de servicios; añadido para la oficina)

- **Disparador**: 24 horas y 2 horas antes de la cita.
- **Tipo**: plantilla de utilidad (es específica de la cita de la persona; si lleva una promoción, pasa a marketing).
- **Botones**: [Confirmar] [Reprogramar] [Cancelar].
- Los cambios de cita que pida la persona entran por chat (ventana abierta) y los resuelve una persona del negocio.

---

## Fuentes

Todas consultadas en octubre de 2026.

- Precios: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- Cambios de precios de mensajes de servicio y utilidad (oct. 2026): https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages
- Límites de mensajes: https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits
- Calificación de calidad del número: https://www.facebook.com/business/help/896873687365001
- Categorización de plantillas: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization
- Dosificación de plantillas: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-pacing
- Límites de marketing por usuario (incluye la restricción de EE. UU.): https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/marketing-templates/per-user-limits/
- Permiso (opt-in): https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in
- Botones de respuesta: https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/interactive-reply-buttons-messages
- Mensajes de lista: https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/interactive-list-messages
- Anuncios Click-to-WhatsApp: https://developers.facebook.com/documentation/ads-commerce/marketing-api/ad-creative/messaging-ads/click-to-whatsapp
