# Implementación de GA4

Guía detallada para Google Analytics 4. Tú redactas las instrucciones; las aplica quien tiene acceso a la propiedad de GA4 y al sitio.

## Contenido
- Configuración (flujos de datos, eventos de medición mejorada, eventos recomendados)
- Eventos personalizados (gtag.js, Google Tag Manager)
- Conversiones (crearlas, valores)
- Dimensiones y métricas personalizadas (cuándo, pasos, ejemplos)
- Audiencias (crearlas, ejemplos)
- Depuración (DebugView, tiempo real, problemas comunes)
- Calidad del dato (filtros, entre dominios, sesiones)
- Integración con Google Ads (vincular, exportar audiencias)

## Configuración

### Flujos de datos

- Un flujo por plataforma (web, iOS, Android).
- Activa la medición mejorada para el seguimiento automático.
- Configura la retención de datos (2 meses por defecto, 14 meses como máximo).
- Activa Google Signals (para multidispositivo, si hay consentimiento).

### Eventos de medición mejorada (automáticos)

| Evento | Descripción | Configuración |
|---|---|---|
| page_view | Carga de página | Automático |
| scroll | Desplazamiento hasta el 90 % | Se activa o desactiva |
| outbound_click | Clic hacia otro dominio | Automático |
| site_search | Se usó el buscador | Configurar el parámetro |
| video_engagement | Reproducción de videos de YouTube | Se activa o desactiva |
| file_download | PDF, documentos, etc. | Extensiones configurables |

### Eventos recomendados

Usa los eventos predefinidos de Google cuando puedas, para tener mejores informes:

**Todas las propiedades:**
- login, sign_up
- share
- search

**Tienda en línea:**
- view_item, view_item_list
- add_to_cart, remove_from_cart
- begin_checkout
- add_payment_info
- purchase, refund

**Juegos:**
- level_up, unlock_achievement
- post_score, spend_virtual_currency

Referencia: https://support.google.com/analytics/answer/9267735

---

## Eventos personalizados

### Implementación con gtag.js

```javascript
// Evento básico
gtag('event', 'signup_completed', {
  'method': 'email',
  'plan': 'free'
});

// Evento con valor
gtag('event', 'purchase', {
  'transaction_id': 'T12345',
  'value': 99.99,
  'currency': 'USD',   // la moneda de la empresa
  'items': [{
    'item_id': 'SKU123',
    'item_name': 'Nombre del producto',
    'price': 99.99
  }]
});

// Propiedades de usuario
gtag('set', 'user_properties', {
  'user_type': 'premium',
  'plan_name': 'pro'
});

// ID de usuario (para quienes inician sesión)
gtag('config', 'GA_MEASUREMENT_ID', {
  'user_id': 'USER_ID'
});
```

### Google Tag Manager (dataLayer)

```javascript
// Evento personalizado
dataLayer.push({
  'event': 'signup_completed',
  'method': 'email',
  'plan': 'free'
});

// Propiedades de usuario
dataLayer.push({
  'user_id': '12345',
  'user_type': 'premium'
});

// Compra en tienda
dataLayer.push({
  'event': 'purchase',
  'ecommerce': {
    'transaction_id': 'T12345',
    'value': 99.99,
    'currency': 'USD',
    'items': [{
      'item_id': 'SKU123',
      'item_name': 'Nombre del producto',
      'price': 99.99,
      'quantity': 1
    }]
  }
});

// Limpiar ecommerce antes de enviar (buena práctica)
dataLayer.push({ ecommerce: null });
dataLayer.push({
  'event': 'view_item',
  'ecommerce': {
    // ...
  }
});
```

---

## Conversiones

### Crear conversiones

1. **Recoge el evento**: comprueba que el evento llega a GA4.
2. **Márcalo como conversión**: Administración > Eventos > Marcar como conversión.
3. **Define cómo se cuenta**:
   - Una vez por sesión (contactos, registros).
   - Cada evento (compras).
4. **Impórtalo a Google Ads**: para pujas optimizadas por conversión.

### Valores de conversión

```javascript
// Evento con valor de conversión
gtag('event', 'purchase', {
  'value': 99.99,
  'currency': 'USD'
});
```

O define un valor por defecto en Administración al marcar la conversión. Si no es una venta directa (un contacto, una cita), usa un valor estimado con base en las cifras de la empresa (tasa de cierre y valor medio de una venta), y márcalo como estimado.

---

## Dimensiones y métricas personalizadas

### Cuándo usarlas

**Dimensiones personalizadas:**
- Propiedades por las que quieres segmentar o filtrar.
- Atributos del usuario (tipo de plan, sector).
- Atributos del contenido (autor, categoría).

**Métricas personalizadas:**
- Valores numéricos que se suman.
- Puntajes, conteos, duraciones.

### Pasos

1. Administración > Visualización de datos > Definiciones personalizadas.
2. Crea la dimensión o la métrica.
3. Elige el alcance:
   - **Evento**: por evento (content_type).
   - **Usuario**: por usuario (account_type).
   - **Artículo**: por producto (product_category).
4. Escribe el nombre del parámetro (debe coincidir con el parámetro del evento).

### Ejemplos

| Dimensión | Alcance | Parámetro | Descripción |
|---|---|---|---|
| Tipo de usuario | Usuario | user_type | Gratis, prueba, de pago |
| Autor del contenido | Evento | author | Autor de la entrada del blog |
| Categoría del producto | Artículo | item_category | Categoría de la tienda |

---

## Audiencias

### Crear audiencias

Administración > Visualización de datos > Audiencias

**Usos:**
- Audiencias de remarketing (exportar a Ads).
- Análisis por segmentos.
- Eventos disparados por la audiencia.

### Ejemplos de audiencias

**Visitantes con intención alta:**
- Vieron la página de precios.
- No convirtieron.
- En los últimos 7 días.

**Usuarios comprometidos:**
- 3 o más sesiones.
- O 5 o más minutos de participación en total.

**Compradores:**
- Evento de compra.
- Para excluirlos o para audiencias similares.

---

## Depuración

### DebugView

Se activa con:
- Parámetro de URL: `?debug_mode=true`
- Extensión de Chrome: GA Debugger
- gtag: `'debug_mode': true` en la configuración

Se ve en: Informes > Configurar > DebugView

### Informes en tiempo real

Comprueba los eventos en unos 30 minutos:
Informes > Tiempo real

### Problemas comunes

**Los eventos no aparecen:**
- Mira primero DebugView.
- Comprueba que gtag o GTM se disparan.
- Revisa los filtros de exclusión.

**Faltan los valores de los parámetros:**
- No se creó la dimensión personalizada.
- El nombre del parámetro no coincide.
- Los datos aún se procesan (24 a 48 h).

**Las conversiones no se registran:**
- El evento no se marcó como conversión.
- El nombre del evento no coincide.
- El método de conteo (una vez o cada vez).

---

## Calidad del dato

### Filtros

Administración > Flujos de datos > [Flujo] > Configurar ajustes de etiqueta > Definir tráfico interno

**Excluye:**
- Direcciones IP internas (la oficina, el consultorio, la tienda).
- Tráfico de desarrolladores.
- Entornos de prueba.

### Seguimiento entre dominios

Cuando varios dominios comparten analítica (por ejemplo, el sitio y una tienda en otro dominio):

1. Administración > Flujos de datos > [Flujo] > Configurar ajustes de etiqueta.
2. Configura tus dominios.
3. Lista todos los dominios que deben compartir sesiones.

### Ajustes de sesión

Administración > Flujos de datos > [Flujo] > Configurar ajustes de etiqueta

- Tiempo de espera de la sesión (30 min por defecto).
- Duración de la sesión con interacción (10 s por defecto).

---

## Integración con Google Ads

### Vincular

1. Administración > Vínculos de productos > Vínculos de Google Ads.
2. Activa el etiquetado automático en Google Ads.
3. Importa las conversiones en Google Ads.

### Exportar audiencias

Las audiencias creadas en GA4 se pueden usar en Google Ads para:
- Campañas de remarketing.
- Coincidencia de clientes (Customer Match).
- Audiencias similares.

(Los nombres de los menús cambian con las versiones de GA4: si un paso no coincide, busca el equivalente y avísale a quien lo instala.)
