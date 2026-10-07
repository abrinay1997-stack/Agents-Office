# Listas de configuración por plataforma

Listas completas para dejar lista cada plataforma de anuncios grande. Úsalas como lista de revisión en el borrador que entregas: el dueño (o quien administre la cuenta) marca lo que ya está hecho y aplica lo que falta.

## Contenido
- Configuración de Google Ads (base de la cuenta, seguimiento de conversiones, integración con analítica, audiencias, campaña lista, extensiones, protección de marca)
- Configuración de Meta Ads (administrador comercial, píxel y seguimiento, dominio y eventos agregados, audiencias, catálogo, creatividades, cumplimiento)
- Configuración de LinkedIn Ads (administrador de campañas, etiqueta Insight y seguimiento, audiencias, formularios de contactos, anuncios de documento, creatividades, presupuesto)
- Configuración de X (Twitter) Ads (cuenta, seguimiento, audiencias, creatividad)
- Configuración de TikTok Ads (cuenta, píxel y seguimiento, audiencias, creatividad)
- Lista universal antes del lanzamiento

## Configuración de Google Ads

### Base de la cuenta

- [ ] Cuenta de Google Ads creada y verificada
- [ ] Datos de facturación agregados
- [ ] Zona horaria y moneda bien puestas (no se pueden cambiar después)
- [ ] Acceso dado a las personas del equipo

### Seguimiento de conversiones

- [ ] Etiqueta de Google instalada en todas las páginas
- [ ] Acciones de conversión creadas (compra, contacto, registro, llamada, mensaje de WhatsApp)
- [ ] Valores de conversión asignados (si aplica)
- [ ] Conversiones mejoradas activadas
- [ ] Conversiones de prueba que se disparan bien
- [ ] Importar conversiones desde GA4 (opcional)

### Integración con analítica

- [ ] Google Analytics 4 vinculado
- [ ] Etiquetado automático activado
- [ ] Audiencias de GA4 disponibles en Google Ads
- [ ] Seguimiento entre dominios configurado (si hay varios dominios)

### Audiencias

- [ ] Etiqueta de remarketing verificada
- [ ] Audiencias de visitantes del sitio creadas:
  - Todos los visitantes (180 días)
  - Visitantes de páginas clave (precios, demo, servicios)
  - Quienes convirtieron (para excluir)
- [ ] Listas de Customer Match subidas
- [ ] Segmentos similares activados

### Campaña lista

- [ ] Listas de palabras clave negativas creadas:
  - Negativas universales (gratis, empleo, trabajo, opiniones, reclamos)
  - Negativas de competidores (si hace falta)
  - Términos irrelevantes de la industria
- [ ] Segmentación por ubicación definida (incluir y excluir)
- [ ] Idioma definido
- [ ] Programación de anuncios configurada (si es B2B, horario de oficina; si es un negocio local, horario en que atienden)
- [ ] Ajustes de puja por dispositivo considerados

(Las listas de negativas son un punto de partida para una cuenta nueva y vacía. En una cuenta que ya corre, **no inventes negativas**: pide el informe de términos de búsqueda; ver `auditoria-y-criterio.md`.)

### Extensiones de anuncios (activos)

- [ ] Enlaces de sitio (4–6 páginas relevantes)
- [ ] Texto destacado (beneficios clave, ofertas)
- [ ] Fragmentos estructurados (funciones, tipos, servicios)
- [ ] Extensión de llamada (si las llamadas valen)
- [ ] Extensión de formulario de contactos (si se usa)
- [ ] Extensiones de precio (si aplica)
- [ ] Extensiones de imagen (donde estén disponibles)
- [ ] Extensión de ubicación (negocios locales: tienda, consultorio, sucursal)

### Protección de marca

- [ ] Campaña de marca corriendo (proteger los términos de la marca)
- [ ] Campañas contra competidores consideradas
- [ ] Términos de marca en las listas de negativas de las campañas que no son de marca

---

## Configuración de Meta Ads

### Administrador comercial (Business Manager)

- [ ] Administrador comercial creado
- [ ] Negocio verificado (si se corren ciertos tipos de anuncio)
- [ ] Cuenta publicitaria creada dentro del administrador
- [ ] Método de pago agregado
- [ ] Acceso del equipo con los roles correctos

### Píxel y seguimiento

- [ ] Píxel de Meta instalado en todas las páginas
- [ ] Eventos estándar configurados:
  - PageView (automático)
  - ViewContent (páginas de producto o servicio)
  - Lead (envío de formularios)
  - Purchase (conversiones)
  - AddToCart (si es tienda en línea)
  - InitiateCheckout (si es tienda en línea)
- [ ] API de Conversiones (CAPI) configurada para seguimiento desde el servidor
- [ ] Calidad de coincidencia de eventos (Event Match Quality) > 6
- [ ] Eventos de prueba revisados en el Administrador de eventos

### Dominio y eventos agregados

- [ ] Dominio verificado en el administrador comercial
- [ ] Medición de eventos agregados configurada
- [ ] Los 8 eventos principales priorizados por importancia
- [ ] Eventos web priorizados para el seguimiento en iOS 14+

### Audiencias

- [ ] Audiencias personalizadas creadas:
  - Visitantes del sitio (todos, 30/60/90/180 días)
  - Visitantes de páginas clave
  - Quienes vieron el video (25 %, 50 %, 75 %, 95 %)
  - Quienes interactuaron con la página o Instagram
  - Lista de clientes subida
- [ ] Audiencias similares creadas (1 %, 1–3 %)
- [ ] Audiencias guardadas para segmentaciones comunes

### Catálogo (tiendas en línea)

- [ ] Catálogo de productos conectado
- [ ] Feed de productos que se actualiza bien
- [ ] Campañas de ventas de catálogo activadas
- [ ] Anuncios dinámicos de producto configurados

### Creatividades

- [ ] Imágenes en los tamaños correctos:
  - Feed: 1080x1080 (1:1)
  - Historias y Reels: 1080x1920 (9:16)
  - Horizontal: 1200x628 (1,91:1)
- [ ] Videos en los formatos correctos
- [ ] Variaciones de texto del anuncio listas
- [ ] Parámetros UTM en todas las URL de destino

(Las imágenes y videos de los anuncios se pueden preparar con el Estudio de la oficina: `generar_imagen`, `generar_video`, `buscar_en_galeria`.)

### Cumplimiento

- [ ] Categorías especiales de anuncios declaradas (si es vivienda, crédito, empleo o política)
- [ ] La página de destino cumple las políticas de Meta
- [ ] Sin contenido prohibido en los anuncios

---

## Configuración de LinkedIn Ads

### Administrador de campañas (Campaign Manager)

- [ ] Cuenta del administrador de campañas creada
- [ ] Página de empresa conectada
- [ ] Datos de facturación agregados
- [ ] Acceso del equipo configurado

### Etiqueta Insight y seguimiento

- [ ] Etiqueta Insight de LinkedIn instalada en todas las páginas
- [ ] Etiqueta verificada y disparándose
- [ ] Seguimiento de conversiones configurado:
  - Conversiones por URL
  - Conversiones por evento específico
- [ ] Valores de conversión definidos (si aplica)

### Audiencias

- [ ] Audiencias emparejadas (Matched Audiences) creadas:
  - Audiencias de remarketing del sitio
  - Lista de empresas subida (para ABM)
  - Lista de contactos subida
- [ ] Audiencias similares creadas
- [ ] Audiencias guardadas para segmentaciones comunes

### Formularios de contactos (si se usan)

- [ ] Plantillas de formulario creadas
- [ ] Campos elegidos (los mínimos, para convertir mejor)
- [ ] URL de la política de privacidad agregada
- [ ] Mensaje de agradecimiento configurado
- [ ] Integración con el CRM lista (o un proceso de exportación en CSV)

### Anuncios de documento (si se usan)

- [ ] Documentos subidos (PDF, presentación)
- [ ] Control de acceso configurado (completo o con vista previa)
- [ ] Formulario de contactos conectado

### Creatividades

- [ ] Anuncios de imagen única: 1200x627 (1,91:1) o 1080x1080 (1:1)
- [ ] Imágenes de carrusel listas
- [ ] Especificaciones de video cumplidas (si se usa)
- [ ] Texto del anuncio dentro de los límites de caracteres:
  - Texto de introducción: 600 máximo, 150 recomendado
  - Título: 200 máximo, 70 recomendado

### Presupuesto

- [ ] Presupuesto realista para los CPC de LinkedIn (suelen ser de US$8–15 o más)
- [ ] Tamaño de audiencia validado (50.000+ recomendado)
- [ ] Presupuesto diario o total decidido
- [ ] Estrategia de puja elegida

---

## Configuración de X (Twitter) Ads

### Cuenta

- [ ] Cuenta de anuncios creada
- [ ] Método de pago agregado
- [ ] Cuenta verificada (si se pide)

### Seguimiento

- [ ] Píxel de X instalado
- [ ] Eventos de conversión creados
- [ ] Etiqueta del sitio verificada

### Audiencias

- [ ] Audiencias propias (tailored) creadas:
  - Visitantes del sitio
  - Listas de clientes
- [ ] Audiencias similares a seguidores identificadas
- [ ] Intereses y palabras clave investigados

### Creatividad

- [ ] Texto de la publicación dentro de 280 caracteres
- [ ] Imágenes: 1200x675 (1,91:1) o 1200x1200 (1:1)
- [ ] Especificaciones de video cumplidas (si se usa)
- [ ] Tarjetas configuradas (sitio web, app, etc.)

---

## Configuración de TikTok Ads

### Cuenta

- [ ] Cuenta de TikTok Ads Manager creada
- [ ] Verificación del negocio completa
- [ ] Método de pago agregado

### Píxel y seguimiento

- [ ] Píxel de TikTok instalado
- [ ] Eventos configurados (ViewContent, Purchase, etc.)
- [ ] API de eventos (Events API) configurada (recomendado)

### Audiencias

- [ ] Audiencias personalizadas creadas
- [ ] Audiencias similares creadas
- [ ] Categorías de intereses identificadas

### Creatividad

- [ ] Video vertical (9:16) listo
- [ ] Contenido de aspecto nativo (no demasiado pulido)
- [ ] Los primeros 3 segundos son un gancho convincente
- [ ] Subtítulos agregados (la mayoría mira sin sonido)
- [ ] Música o sonidos elegidos (con licencia si hace falta)

---

## Lista universal antes del lanzamiento

Antes de lanzar cualquier campaña:

- [ ] Seguimiento de conversiones probado con una conversión real
- [ ] La página de destino carga rápido (<3 s)
- [ ] La página de destino funciona bien en el teléfono
- [ ] Los parámetros UTM funcionan
- [ ] Presupuesto bien puesto (diario o total)
- [ ] Fechas de inicio y fin correctas
- [ ] La segmentación coincide con la audiencia prevista
- [ ] Creatividad de los anuncios aprobada (por el dueño)
- [ ] Equipo avisado del lanzamiento
- [ ] Tablero de reportes listo

Recuerda: lanzar, activar o gastar presupuesto lo aprueba el dueño. Tú dejas esta lista revisada y el borrador de la campaña.
