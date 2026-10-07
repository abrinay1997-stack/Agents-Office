# Biblioteca de eventos

Lista completa de eventos que se pueden seguir, por tipo de negocio y contexto. Elige solo los que sirvan a una decisión. Los nombres están en inglés porque es lo habitual en GA4 y en las herramientas de producto; si la empresa prefiere español, tradúcelos todos y úsalos siempre igual.

## Contenido
- Eventos del sitio de marketing (navegación, interacciones con botones y formularios, conversiones)
- Eventos del producto o la app (activación, uso, errores y soporte)
- Eventos de monetización (precios y pago, gestión de suscripciones)
- Eventos de tienda en línea (exploración, carrito, pago, posventa)
- Eventos de negocios locales y de servicios
- Eventos B2B / SaaS (equipo, integraciones, cuenta)
- Propiedades de los eventos (parámetros)
- Secuencias de embudo

## Eventos del sitio de marketing

### Navegación y participación

| Nombre del evento | Descripción | Propiedades |
|---|---|---|
| page_view | Se cargó una página (enriquecida) | page_title, page_location, content_group |
| scroll_depth | El usuario llegó a un umbral de desplazamiento | depth (25, 50, 75, 100) |
| outbound_link_clicked | Clic hacia un sitio externo | link_url, link_text |
| internal_link_clicked | Clic dentro del sitio | link_url, link_text, location |
| video_played | Empezó un video | video_id, video_title, duration |
| video_completed | Terminó un video | video_id, video_title, duration |

### Botones y formularios

| Nombre del evento | Descripción | Propiedades |
|---|---|---|
| cta_clicked | Clic en un llamado a la acción | button_text, cta_location, page |
| form_started | El usuario empezó un formulario | form_name, form_location |
| form_field_completed | Se llenó un campo | form_name, field_name |
| form_submitted | Formulario enviado con éxito | form_name, form_location |
| form_error | Falló la validación del formulario | form_name, error_type |
| resource_downloaded | Se descargó un material | resource_name, resource_type |

### Conversiones

| Nombre del evento | Descripción | Propiedades |
|---|---|---|
| signup_started | Empezó el registro | source, page |
| signup_completed | Terminó el registro | method, plan, source |
| demo_requested | Se envió el formulario de demostración | company_size, industry |
| contact_submitted | Se envió el formulario de contacto | inquiry_type |
| newsletter_subscribed | Alta en la lista de correo | source, list_name |
| trial_started | Empezó la prueba gratis | plan, source |

## Eventos del producto o la app

### Activación (primeros pasos)

| Nombre del evento | Descripción | Propiedades |
|---|---|---|
| signup_completed | Cuenta creada | method, referral_source |
| onboarding_started | Empezó la activación | - |
| onboarding_step_completed | Terminó un paso | step_number, step_name |
| onboarding_completed | Terminó todos los pasos | steps_completed, time_to_complete |
| onboarding_skipped | El usuario saltó la activación | step_skipped_at |
| first_key_action_completed | Llegó al momento «ajá» | action_type |

### Uso principal

| Nombre del evento | Descripción | Propiedades |
|---|---|---|
| session_started | Empezó una sesión | session_number |
| feature_used | Interacción con una función | feature_name, feature_category |
| action_completed | Acción principal hecha | action_type, count |
| content_created | El usuario creó contenido | content_type |
| content_edited | El usuario modificó contenido | content_type |
| content_deleted | El usuario borró contenido | content_type |
| search_performed | Búsqueda dentro de la app | query, results_count |
| settings_changed | Cambió ajustes | setting_name, new_value |
| invite_sent | Invitó a otras personas | invite_type, count |

### Errores y soporte

| Nombre del evento | Descripción | Propiedades |
|---|---|---|
| error_occurred | Ocurrió un error | error_type, error_message, page |
| help_opened | Abrió la ayuda | help_type, page |
| support_contacted | Pidió soporte | contact_method, issue_type |
| feedback_submitted | Dejó una opinión | feedback_type, rating |

## Eventos de monetización

### Precios y pago

| Nombre del evento | Descripción | Propiedades |
|---|---|---|
| pricing_viewed | Vio la página de precios | source |
| plan_selected | Eligió un plan | plan_name, billing_cycle |
| checkout_started | Empezó el pago | plan, value |
| payment_info_entered | Envió los datos de pago | payment_method |
| purchase_completed | Compra exitosa | plan, value, currency, transaction_id |
| purchase_failed | Compra fallida | error_reason, plan |

### Gestión de suscripciones

| Nombre del evento | Descripción | Propiedades |
|---|---|---|
| trial_started | Empezó la prueba | plan, trial_length |
| trial_ended | Terminó la prueba | plan, converted (booleano) |
| subscription_upgraded | Subió de plan | from_plan, to_plan, value |
| subscription_downgraded | Bajó de plan | from_plan, to_plan |
| subscription_cancelled | Canceló | plan, reason, tenure |
| subscription_renewed | Renovó | plan, value |
| billing_updated | Cambió el medio de pago | - |

## Eventos de tienda en línea

### Exploración

| Nombre del evento | Descripción | Propiedades |
|---|---|---|
| product_viewed | Vio la página de un producto | product_id, product_name, category, price |
| product_list_viewed | Vio una categoría o lista | list_name, products[] |
| product_searched | Hizo una búsqueda | query, results_count |
| product_filtered | Aplicó filtros | filter_type, filter_value |
| product_sorted | Ordenó los resultados | sort_by, sort_order |

### Carrito

| Nombre del evento | Descripción | Propiedades |
|---|---|---|
| product_added_to_cart | Añadió un artículo | product_id, product_name, price, quantity |
| product_removed_from_cart | Quitó un artículo | product_id, product_name, price, quantity |
| cart_viewed | Vio el carrito | cart_value, items_count |

### Pago

| Nombre del evento | Descripción | Propiedades |
|---|---|---|
| checkout_started | Empezó el pago | cart_value, items_count |
| checkout_step_completed | Terminó un paso | step_number, step_name |
| shipping_info_entered | Puso la dirección | shipping_method |
| payment_info_entered | Puso el pago | payment_method |
| coupon_applied | Usó un cupón | coupon_code, discount_value |
| purchase_completed | Pedido hecho | transaction_id, value, currency, items[] |

### Posventa

| Nombre del evento | Descripción | Propiedades |
|---|---|---|
| order_confirmed | Vio la confirmación | transaction_id |
| refund_requested | Pidió un reembolso | transaction_id, reason |
| refund_completed | Reembolso procesado | transaction_id, value |
| review_submitted | Dejó una reseña del producto | product_id, rating |

**Imprescindibles de una tienda:** product_viewed, product_added_to_cart, checkout_started, purchase_completed (con `transaction_id`, `value`, `currency`, `items[]`). **Para después:** product_filtered, product_sorted, coupon_applied, reseñas y reembolsos.

## Eventos de negocios locales y de servicios

Complementan a los anteriores en clínicas, consultorios, restaurantes, talleres, constructoras, estudios y tiendas físicas.

| Nombre del evento | Descripción | Propiedades |
|---|---|---|
| phone_clicked | Clic en el número de teléfono | page, location |
| whatsapp_clicked | Clic en el botón de WhatsApp | page, location, message_template |
| directions_clicked | Clic en «cómo llegar» o en el mapa | page, location_name |
| appointment_requested | Se envió una solicitud de cita | service_type, source |
| quote_requested | Se pidió una cotización | service_type, budget_range |
| menu_viewed | Se vio el menú o el catálogo | page |
| reservation_requested | Reservación pedida | party_size, date |

Lo que sucede fuera del sitio (una llamada, una visita al mostrador) no se ve en GA4: pide al dueño que pregunte «¿cómo nos conoció?» y lo anote, o que use un número de teléfono o un código de descuento distinto por canal.

## Eventos B2B / SaaS

### Equipo y colaboración

| Nombre del evento | Descripción | Propiedades |
|---|---|---|
| team_created | Se creó un equipo u organización | team_size, plan |
| team_member_invited | Se envió una invitación | role, invite_method |
| team_member_joined | Un miembro aceptó | role |
| team_member_removed | Se quitó a un miembro | role |
| role_changed | Cambiaron los permisos | user_id, old_role, new_role |

### Integraciones

| Nombre del evento | Descripción | Propiedades |
|---|---|---|
| integration_viewed | Vio la página de una integración | integration_name |
| integration_started | Empezó la configuración | integration_name |
| integration_connected | Conectó con éxito | integration_name |
| integration_disconnected | Quitó la integración | integration_name, reason |

### Cuenta

| Nombre del evento | Descripción | Propiedades |
|---|---|---|
| account_created | Cuenta nueva | source, plan |
| account_upgraded | Subió de plan | from_plan, to_plan |
| account_churned | Cuenta cerrada | reason, tenure, mrr_lost |
| account_reactivated | Cliente que regresa | previous_tenure, new_plan |

## Propiedades de los eventos (parámetros)

### Propiedades estándar

**Contexto del usuario:**
```
user_id: "12345"
user_type: "free" | "trial" | "paid"
account_id: "acct_123"
plan_type: "starter" | "pro" | "enterprise"
```

**Contexto de la sesión:**
```
session_id: "sess_abc"
session_number: 5
page: "/pricing"
referrer: "https://google.com"
```

**Contexto de la campaña:**
```
source: "google"
medium: "cpc"
campaign: "venta_de_temporada"
content: "cta_principal"
```

**Contexto del producto (tienda):**
```
product_id: "SKU123"
product_name: "Nombre del producto"
category: "Categoría"
price: 99.99
quantity: 1
currency: "USD"   ← la moneda de la empresa (USD, MXN, COP, PEN, CLP, ARS, PAB…)
```

**Tiempos:**
```
timestamp: "2024-01-15T10:30:00Z"
time_on_page: 45
session_duration: 300
```

Nunca incluyas nombre, correo, teléfono ni documento de identidad como propiedad.

## Secuencias de embudo

### Embudo de registro
1. signup_started
2. signup_step_completed (correo)
3. signup_step_completed (contraseña)
4. signup_completed
5. onboarding_started

### Embudo de compra
1. pricing_viewed
2. plan_selected
3. checkout_started
4. payment_info_entered
5. purchase_completed

### Embudo de tienda en línea
1. product_viewed
2. product_added_to_cart
3. cart_viewed
4. checkout_started
5. shipping_info_entered
6. payment_info_entered
7. purchase_completed

### Embudo de un negocio local
1. page_view (inicio o servicio)
2. whatsapp_clicked, phone_clicked o appointment_requested
3. (fuera del sitio) la cita ocurre
4. (fuera del sitio) la venta se anota con «cómo nos conoció»
