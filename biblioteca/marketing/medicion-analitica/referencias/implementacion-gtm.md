# Implementación con Google Tag Manager

Guía detallada del seguimiento con Google Tag Manager (GTM). Tú redactas las instrucciones; las aplica quien administra el contenedor.

## Contenido
- Estructura del contenedor (etiquetas, activadores, variables)
- Convención de nombres
- Patrones de la capa de datos
- Configuraciones comunes de etiquetas (etiqueta de configuración de GA4, de evento de GA4, píxel de Facebook)
- Vista previa y depuración
- Espacios de trabajo y versiones
- Gestión del consentimiento
- Patrones avanzados (secuencias, excepciones, variables de JavaScript)

## Estructura del contenedor

### Etiquetas (tags)

Las etiquetas son fragmentos de código que se ejecutan cuando algo las activa.

**Tipos comunes:**
- Configuración de GA4 (la base)
- Evento de GA4 (eventos personalizados)
- Conversión de Google Ads
- Píxel de Facebook (Meta)
- Etiqueta de LinkedIn Insight
- HTML personalizado (para otros píxeles)

### Activadores (triggers)

Los activadores definen cuándo se dispara una etiqueta.

**Integrados:**
- Vista de página: todas las páginas, DOM listo, ventana cargada
- Clic: todos los elementos, solo enlaces
- Envío de formulario
- Profundidad de desplazamiento
- Temporizador
- Visibilidad de un elemento

**Personalizados:**
- Evento personalizado (desde la capa de datos)
- Grupos de activadores (varias condiciones)

### Variables

Las variables capturan valores dinámicos.

**Integradas (actívalas según haga falta):**
- Texto del clic, URL del clic, ID del clic, clases del clic
- Ruta de la página, URL de la página, host de la página
- Referente
- Elemento del formulario, ID del formulario

**Definidas por el usuario:**
- Variables de la capa de datos
- Variables de JavaScript
- Tablas de búsqueda
- Tablas de expresiones regulares
- Constantes

---

## Convención de nombres

### Formato recomendado

```
[Tipo] - [Descripción] - [Detalle]

Etiquetas:
GA4 - Event - Signup Completed
GA4 - Config - Base Configuration
FB - Pixel - Page View
HTML - LiveChat Widget

Activadores:
Click - CTA Button
Submit - Contact Form
View - Pricing Page
Custom - signup_completed

Variables:
DL - user_id
JS - Current Timestamp
LT - Campaign Source Map
```

---

## Patrones de la capa de datos

### Estructura básica

```javascript
// Inicializar (en el <head>, antes de GTM)
window.dataLayer = window.dataLayer || [];

// Enviar un evento
dataLayer.push({
  'event': 'event_name',
  'property1': 'value1',
  'property2': 'value2'
});
```

### Datos al cargar la página

```javascript
// Se define al cargar la página (antes del contenedor de GTM)
window.dataLayer = window.dataLayer || [];
dataLayer.push({
  'pageType': 'product',
  'contentGroup': 'products',
  'user': {
    'loggedIn': true,
    'userId': '12345',
    'userType': 'premium'
  }
});
```

### Envío de formulario

```javascript
document.querySelector('#contact-form').addEventListener('submit', function() {
  dataLayer.push({
    'event': 'form_submitted',
    'formName': 'contact',
    'formLocation': 'footer'
  });
});
```

### Clic en un botón

```javascript
document.querySelector('.cta-button').addEventListener('click', function() {
  dataLayer.push({
    'event': 'cta_clicked',
    'ctaText': this.innerText,
    'ctaLocation': 'hero'
  });
});
```

### Eventos de tienda

```javascript
// Ver un producto
dataLayer.push({ ecommerce: null }); // Limpia lo anterior
dataLayer.push({
  'event': 'view_item',
  'ecommerce': {
    'items': [{
      'item_id': 'SKU123',
      'item_name': 'Nombre del producto',
      'price': 99.99,
      'item_category': 'Categoría',
      'quantity': 1
    }]
  }
});

// Añadir al carrito
dataLayer.push({ ecommerce: null });
dataLayer.push({
  'event': 'add_to_cart',
  'ecommerce': {
    'items': [{
      'item_id': 'SKU123',
      'item_name': 'Nombre del producto',
      'price': 99.99,
      'quantity': 1
    }]
  }
});

// Compra
dataLayer.push({ ecommerce: null });
dataLayer.push({
  'event': 'purchase',
  'ecommerce': {
    'transaction_id': 'T12345',
    'value': 99.99,
    'currency': 'USD',   // la moneda de la empresa
    'tax': 5.00,
    'shipping': 10.00,
    'items': [{
      'item_id': 'SKU123',
      'item_name': 'Nombre del producto',
      'price': 99.99,
      'quantity': 1
    }]
  }
});
```

---

## Configuraciones comunes de etiquetas

### Etiqueta de configuración de GA4

**Tipo de etiqueta:** Google Analytics: configuración de GA4

**Ajustes:**
- ID de medición: G-XXXXXXXX
- Enviar vista de página: marcado (para las vistas de página)
- Propiedades de usuario: añade las dimensiones a nivel de usuario

**Activador:** todas las páginas

### Etiqueta de evento de GA4

**Tipo de etiqueta:** Google Analytics: evento de GA4

**Ajustes:**
- Etiqueta de configuración: elige la tuya
- Nombre del evento: {{DL - event_name}} o escrito a mano
- Parámetros del evento: añade los parámetros de la capa de datos

**Activador:** evento personalizado que coincida con el nombre del evento

### Píxel de Facebook (Meta): base

**Tipo de etiqueta:** HTML personalizado

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
  fbq('init', 'TU_ID_DE_PIXEL');
  fbq('track', 'PageView');
</script>
```

**Activador:** todas las páginas

### Píxel de Facebook (Meta): evento

**Tipo de etiqueta:** HTML personalizado

```html
<script>
  fbq('track', 'Lead', {
    content_name: '{{DL - form_name}}'
  });
</script>
```

**Activador:** evento personalizado `form_submitted`

(El ID del píxel lo pone quien administra la cuenta de Meta de la empresa. Si la empresa usa Meta, el píxel también se puede cargar solo con el consentimiento de marketing, ver más abajo.)

---

## Vista previa y depuración

### Modo de vista previa

1. Pulsa «Vista previa» en GTM.
2. Escribe la URL del sitio.
3. El panel de depuración de GTM se abre abajo.

**Qué revisar:**
- Etiquetas que se dispararon en este evento.
- Etiquetas que no se dispararon (y por qué).
- Variables y sus valores.
- Contenido de la capa de datos.

### Consejos de depuración

**La etiqueta no se dispara:**
- Revisa las condiciones del activador.
- Comprueba que la capa de datos recibe el envío.
- Revisa la secuencia de etiquetas.

**Valor de variable incorrecto:**
- Revisa la estructura de la capa de datos.
- Comprueba la ruta de la variable (objetos anidados).
- Revisa el momento (puede que el dato aún no exista).

**Disparos múltiples:**
- Revisa que el activador sea único.
- Busca etiquetas duplicadas.
- Revisa las opciones de disparo de la etiqueta.

---

## Espacios de trabajo y versiones

### Espacios de trabajo

Usa espacios de trabajo para colaborar en equipo:
- El espacio por defecto, para producción.
- Espacios separados para cambios grandes.
- Combínalos cuando estén listos.

### Gestión de versiones

**Buenas prácticas:**
- Nombra cada versión de forma descriptiva.
- Añade notas que expliquen los cambios.
- Revisa los cambios antes de publicar.
- Anota cuál es la versión en producción.

**Ejemplo de notas de versión:**
```
v15: Se añadió el seguimiento de la conversión de compra
- Etiqueta nueva: GA4 - Event - Purchase
- Activador nuevo: Custom Event - purchase
- Variables nuevas: DL - transaction_id, DL - value
- Probado: Chrome, Safari, móvil
```

---

## Gestión del consentimiento

### Integración con el modo de consentimiento

```javascript
// Estado por defecto (antes del consentimiento)
gtag('consent', 'default', {
  'analytics_storage': 'denied',
  'ad_storage': 'denied'
});

// Actualizar al dar el consentimiento
function grantConsent() {
  gtag('consent', 'update', {
    'analytics_storage': 'granted',
    'ad_storage': 'granted'
  });
}
```

### Resumen del consentimiento en GTM

1. Activa «Resumen del consentimiento» en Administración.
2. Configura el consentimiento de cada etiqueta.
3. Las etiquetas respetan el estado de consentimiento automáticamente.

Jerarquía recomendada: necesarias (siempre), analítica (GA4, mapas de calor), marketing (píxeles de anuncios). Cada etiqueta se asigna a la que le corresponde.

---

## Patrones avanzados

### Secuencia de etiquetas

**Configura etiquetas que se disparen en orden:**
Configuración de la etiqueta > Ajustes avanzados > Secuencia de etiquetas

**Usos:**
- La etiqueta de configuración antes de las de evento.
- Inicialización de un píxel antes del seguimiento.
- Limpieza después de una conversión.

### Manejo de excepciones

**Excepciones de activador** (evitan que se dispare una etiqueta):
- Excluir ciertas páginas.
- Excluir el tráfico interno.
- Excluir durante las pruebas.

### Variables de JavaScript personalizadas

```javascript
// Obtener un parámetro de la URL
function() {
  var params = new URLSearchParams(window.location.search);
  return params.get('campaign') || '(not set)';
}

// Obtener el valor de una cookie
function() {
  var match = document.cookie.match('(^|;) ?user_id=([^;]*)(;|$)');
  return match ? match[2] : null;
}

// Obtener un dato de la página
function() {
  var el = document.querySelector('.product-price');
  return el ? parseFloat(el.textContent.replace('$', '')) : 0;
}
```
