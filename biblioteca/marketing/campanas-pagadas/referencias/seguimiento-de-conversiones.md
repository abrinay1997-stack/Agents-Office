# Configuración del seguimiento de conversiones

Cómo configurar los píxeles de seguimiento de conversiones en las plataformas de anuncios. Esta guía cubre instalación, configuración de eventos y validación: todo lo que necesita quien hace marketing para que el gasto en anuncios se atribuya bien. Tú no instalas nada (no tienes acceso al sitio ni a las cuentas): entregas las instrucciones y los fragmentos de código para que el dueño, su desarrollador o quien administre el sitio los instale; y la lista de validación para comprobarlo.

---

## Por qué importa

Sin seguimiento de conversiones:
- Las plataformas de anuncios no pueden optimizar para tus metas reales
- Vuelas a ciegas en ROAS y CPA
- No se pueden crear audiencias de remarketing
- Desperdiciarás presupuesto en impresiones que no convierten

Deja bien el seguimiento antes de gastar un solo peso en anuncios.

---

## Vista general de los píxeles por plataforma

| Plataforma | Nombre del píxel o etiqueta | API de eventos | Eventos clave |
|----------|---------------|:----------:|------------|
| **Google Ads** | Etiqueta de Google (gtag.js) | Conversiones mejoradas | purchase, sign_up, generate_lead |
| **Meta** | Píxel de Meta + CAPI | API de Conversiones | Purchase, Lead, ViewContent, AddToCart |
| **LinkedIn** | Etiqueta Insight | API de Conversiones | conversion (por URL o por evento) |
| **TikTok** | Píxel de TikTok | Events API | Purchase, ViewContent, AddToCart, CompleteRegistration |
| **X (Twitter)** | Píxel de X | - | Purchase, SignUp, Download |

Para un negocio local o de servicios, además de formularios cuentan las **llamadas** (extensión o botón de llamada) y los **clics a WhatsApp**: defínelos como acciones de conversión; muchas veces son la conversión más valiosa.

---

## Google Ads

### Instalar la etiqueta de Google

Va en todas las páginas, en el `<head>`:

```html
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-XXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'AW-XXXXXXXXX');
</script>
```

Reemplaza `AW-XXXXXXXXX` por tu ID de conversión de Google Ads > Herramientas > Conversiones.

### Crear las acciones de conversión

En Google Ads > Objetivos > Conversiones > Nueva acción de conversión:

| Conversión | Categoría | Valor | Conteo |
|-----------|----------|-------|-------|
| Compra | Compra | Dinámico (valor del pedido) | Cada una |
| Registro / contacto | Registro | Fijo (valor estimado de X) | Una |
| Solicitud de demo o de cotización | Contacto | Fijo (valor estimado de X) | Una |
| Inicio de prueba gratis | Registro | Fijo (valor estimado de X) | Una |

(Los valores fijos salen de las cifras de la empresa o de una estimación que el dueño confirme; no los inventes.)

### Disparar los eventos de conversión

```javascript
// Compra
gtag('event', 'conversion', {
  'send_to': 'AW-XXXXXXXXX/CONVERSION_LABEL',
  'value': 99.00,
  'currency': 'USD',   // usa la moneda de la empresa
  'transaction_id': 'ORDER-123'
});

// Contacto / registro
gtag('event', 'conversion', {
  'send_to': 'AW-XXXXXXXXX/CONVERSION_LABEL',
  'value': 50.00,
  'currency': 'USD'    // usa la moneda de la empresa
});
```

### Conversiones mejoradas (Enhanced Conversions)

Envía datos propios con hash (correo, teléfono) para mejorar la atribución tras las restricciones de cookies. Se activan en Google Ads > Objetivos > Configuración > Conversiones mejoradas.

```javascript
gtag('set', 'user_data', {
  'email': 'usuario@ejemplo.com',      // gtag lo convierte en hash solo
  'phone_number': '+11234567890'
});
```

### Alternativa con Google Tag Manager

Si usas GTM en vez de gtag.js directo:
1. Instala el contenedor de GTM en todas las páginas
2. Crea las etiquetas de conversión de Google Ads en GTM
3. Define los disparadores de los eventos de conversión (envío de formularios, compras)
4. Usa la capa de datos (Data Layer) para pasar valores dinámicos (importe del pedido, ID de transacción)
5. Prueba con el modo Vista previa de GTM antes de publicar

---

## Meta (Facebook e Instagram)

### Instalar el píxel de Meta

Va en todas las páginas, en el `<head>`:

```html
<script>
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', 'YOUR_PIXEL_ID');
  fbq('track', 'PageView');
</script>
```

Reemplaza `YOUR_PIXEL_ID` con el ID del Administrador de eventos de Meta.

### Eventos estándar

```javascript
// Ver un producto o una página clave
fbq('track', 'ViewContent', {
  content_name: 'Plan Pro',
  content_category: 'Precios',
  value: 29.00,
  currency: 'USD'
});

// Captura de contacto (envío de formulario, solicitud de demo)
fbq('track', 'Lead', {
  content_name: 'Solicitud de demo',
  value: 50.00,
  currency: 'USD'
});

// Compra
fbq('track', 'Purchase', {
  value: 99.00,
  currency: 'USD',
  content_type: 'product',
  contents: [{ id: 'plan-pro', quantity: 1 }]
});

// Agregar al carrito (tienda en línea)
fbq('track', 'AddToCart', {
  content_ids: ['SKU-123'],
  content_type: 'product',
  value: 49.00,
  currency: 'USD'
});
```

### API de Conversiones (CAPI)

Seguimiento desde el servidor que funciona junto al píxel. Es necesario para un seguimiento exacto tras iOS 14+ y las restricciones de cookies.

Se configura por:
- **Integración directa**: envía eventos desde tu servidor a la API de Meta
- **Integraciones de socios**: Shopify, WooCommerce, Segment, etc. traen CAPI integrada
- **Puerta de enlace de la API de Conversiones**: la solución administrada por Meta vía AWS

Clave: envía los mismos eventos desde el píxel (navegador) Y desde CAPI (servidor), con un `event_id` compartido para deduplicar.

### Medición de eventos agregados

Necesaria para el seguimiento en iOS 14+. En el Administrador de eventos > Medición de eventos agregados:
1. Verifica tu dominio
2. Configura y prioriza tus 8 eventos principales por importancia para el negocio
3. La compra suele ser el n.º 1 y el contacto (Lead) el n.º 2

---

## LinkedIn

### Instalar la etiqueta Insight

Va en todas las páginas, antes de `</body>`:

```html
<script type="text/javascript">
  _linkedin_partner_id = "YOUR_PARTNER_ID";
  window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
  window._linkedin_data_partner_ids.push(_linkedin_partner_id);
  (function(l) {
    if (!l){window.lintrk = function(a,b){window.lintrk.q.push([a,b])};
    window.lintrk.q=[]}
    var s = document.getElementsByTagName("script")[0];
    var b = document.createElement("script");
    b.type = "text/javascript";b.async = true;
    b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
    s.parentNode.insertBefore(b, s);})(window.lintrk);
</script>
```

### Seguimiento de conversiones

LinkedIn admite dos métodos:

**Por URL**: se dispara cuando alguien visita una URL concreta (p. ej., `/gracias`).
Se configura en Campaign Manager > Analizar > Seguimiento de conversiones > Crear conversión.

**Por evento**: se dispara a mano ante acciones concretas:

```javascript
window.lintrk('track', { conversion_id: YOUR_CONVERSION_ID });
```

### CAPI de LinkedIn

Para seguimiento desde el servidor, LinkedIn ofrece una API de Conversiones. Se configura con integraciones de socios (Segment, Tealium) o con llamadas directas a la API. Deduplica solo con la etiqueta Insight cuando está bien configurada.

---

## TikTok

### Instalar el píxel de TikTok

Va en todas las páginas, en el `<head>`:

```html
<script>
  !function (w, d, t) {
    w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
    ttq.methods=["page","track","identify","instances","debug","on","off",
    "once","ready","alias","group","enableCookie","disableCookie","holdConsent",
    "revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e)
    {t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
    for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
    ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;
    n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
    ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",
    o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,
    ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},
    ttq._o[e]=n||{};var s=document.createElement("script");
    s.type="text/javascript",s.async=!0,s.src=r+"?sdkid="+e+"&lib="+t;
    var a=document.getElementsByTagName("script")[0];
    a.parentNode.insertBefore(s,a)};
    ttq.load('YOUR_PIXEL_ID');
    ttq.page();
  }(window, document, 'ttq');
</script>
```

### Eventos estándar

```javascript
// Ver contenido
ttq.track('ViewContent', {
  content_id: 'plan-pro',
  content_type: 'product',
  content_name: 'Plan Pro',
  value: 29.00,
  currency: 'USD'
});

// Registro completo
ttq.track('CompleteRegistration', {
  content_name: 'Prueba gratis'
});

// Compra
ttq.track('Purchase', {
  content_id: 'plan-pro',
  content_type: 'product',
  value: 99.00,
  currency: 'USD',
  quantity: 1
});

// Agregar al carrito
ttq.track('AddToCart', {
  content_id: 'SKU-123',
  content_type: 'product',
  value: 49.00,
  currency: 'USD'
});
```

### Events API (desde el servidor)

La Events API de TikTok funciona como la CAPI de Meta: envía los mismos eventos desde tu servidor para mejorar la atribución. Usa `event_id` para deduplicar con los eventos del píxel del navegador.

### Coincidencia avanzada (Advanced Matching)

Pasa datos del usuario con hash para una mejor atribución:

```javascript
ttq.identify({
  email: 'usuario@ejemplo.com',       // hash automático
  phone_number: '+11234567890'
});
```

---

## Lista de validación

Después de instalar cualquier píxel, verifica antes de salir en vivo:

### En el navegador

- [ ] El píxel se dispara en todas las páginas (compruébalo con una extensión del navegador)
- [ ] Los eventos de conversión se disparan en el momento correcto (tras la acción confirmada, no al hacer clic en el botón)
- [ ] Los parámetros del evento traen los valores correctos (moneda, importe, ID de contenido)
- [ ] No hay eventos duplicados en la misma acción
- [ ] Los eventos se disparan en escritorio y en el teléfono

### En la plataforma

- [ ] Los eventos aparecen en el administrador de eventos o en los diagnósticos de la plataforma
- [ ] Las conversiones de prueba muestran los valores correctos
- [ ] La calidad de coincidencia de eventos es aceptable (Meta: puntaje > 6)
- [ ] Los eventos desde el servidor se deduplican con los del navegador (no se cuentan doble)

### Herramientas de depuración

| Plataforma | Herramienta |
|----------|------|
| Google | Google Tag Assistant, pestaña Red de las herramientas de desarrollo de Chrome |
| Meta | Meta Pixel Helper (extensión de Chrome), Eventos de prueba del Administrador de eventos |
| LinkedIn | Validador de la etiqueta Insight en Campaign Manager |
| TikTok | TikTok Pixel Helper (extensión de Chrome), Administrador de eventos |
| Todas | Modo Vista previa de GTM (si usas Google Tag Manager) |

---

## Errores comunes

- **Disparar el evento de compra al hacer clic en el botón en vez de al confirmar el pago**: dispáralo siempre en la página de éxito o de gracias, o tras la confirmación del servidor
- **Falta de deduplicación entre el píxel y los eventos del servidor**: sin un `event_id` compartido, contarás doble las conversiones
- **No probar en el teléfono**: muchos píxeles fallan en navegadores móviles o en visores web dentro de apps
- **Valores de prueba escritos a mano**: quita los importes de transacciones de prueba antes de salir en vivo
- **Olvidar excluir el tráfico interno**: las visitas de tu equipo inflan los datos de conversión
- **Instalar píxeles sin gestión del consentimiento**: el RGPD (GDPR), la CCPA y las leyes de protección de datos de tu país exigen el consentimiento del usuario antes de disparar píxeles de seguimiento en las regiones que correspondan
- **Píxel instalado pero sin acciones de conversión creadas**: el píxel recoge datos, pero la plataforma no optimizará sin acciones de conversión definidas

---

## Cuándo usar seguimiento desde el servidor

El seguimiento solo desde el navegador es cada vez menos confiable por:
- La transparencia de seguimiento de apps de iOS 14+
- La desaparición de las cookies de terceros
- Los bloqueadores de anuncios (30 %+ en audiencias técnicas)

**Usa seguimiento desde el servidor (CAPI / Events API) cuando:**
- Corres anuncios en Meta o TikTok (muy recomendado)
- Tu audiencia es experta en tecnología (más uso de bloqueadores)
- Necesitas una atribución exacta de compras e ingresos
- Gastas >US$5.000 al mes en alguna plataforma (o su equivalente en la moneda de la empresa)

**El seguimiento desde el servidor es opcional cuando:**
- Solo corres Google Ads (las conversiones mejoradas cubren la mayoría de los huecos)
- El gasto es bajo o estás en fase de pruebas
- Es B2B solo con LinkedIn (la etiqueta Insight sigue siendo confiable)
