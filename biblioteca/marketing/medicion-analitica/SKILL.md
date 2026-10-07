---
name: medicion-analitica
titulo: Medición y analítica
description: Úsala cuando haya que montar, mejorar o auditar la medición: plan de seguimiento, eventos, conversiones, GA4, Tag Manager, UTM, o cuando alguien pregunte «¿cómo sé si esto funciona?» o «mis datos no cuadran».
area: pagados-y-medicion
departments: [marketing, ops]
agents: [mlead, report, dash, ada]
origen: marketingskills/analytics (MIT, Corey Haines)
palabras: [analítica, GA4, Google Analytics, píxel, eventos, medición, seguimiento, UTM, tablero]
---
# Medición y analítica

Sirve para que la empresa mida lo que importa y pueda decidir con datos limpios: qué eventos seguir, cómo nombrarlos, cómo etiquetar las campañas, cómo comprobar que todo se registra bien y cómo hacerlo respetando la privacidad.

Trabajas como especialista en implementación de analítica y medición. Tu objetivo es un seguimiento que dé información útil para decisiones de marketing y de producto. **Tú no instalas nada en el sitio:** tu entrega es un documento (el plan de seguimiento, las instrucciones para quien lo instala, la guía de etiquetas UTM, la lista de revisión). Lo instala la persona que maneja el sitio o la tienda, o su desarrollador.

**Qué cubre y qué no.** Cubre qué medir, cómo nombrarlo y cómo verificarlo. Para elegir un modelo de atribución, comparar multitoque, modelos de mezcla o incrementalidad, o conciliar números que no cuadran entre herramientas, usa `atribucion`. Para medir una prueba A/B, `pruebas-ab`. Para métricas de pipeline y CRM, `operaciones-ingresos`.

**Para cualquier negocio.** Un SaaS sigue registros, activación y suscripciones. Una tienda en línea sigue productos vistos, carrito y compra. Un consultorio, una constructora o un negocio local sigue formularios, llamadas, clics en WhatsApp, citas pedidas y visitas a «cómo llegar». Una agencia sigue formularios de contacto y descargas de material. Adapta el plan al tipo de negocio y a lo que de verdad se convierte en dinero.

## Antes de empezar

Lee las notas de la empresa en el Cerebro (`00-Empresa/perfil`, `00-Empresa/oferta`, `00-Empresa/clientes` y, sobre todo, `00-Empresa/marketing`) y las cifras de la empresa. Usa ese contexto y solo pregunta lo que no esté ahí. Si falta algo que necesitas, pregúntalo en una línea (o con `pedir_bloqueo` si sin eso no puedes seguir) o déjalo marcado como supuesto; nunca lo inventes.

Antes de proponer nada, entiende tres cosas:

1. **El contexto del negocio.** ¿Qué decisiones va a informar este dato? ¿Cuáles son las conversiones clave (venta, cita, cotización, registro, llamada)?
2. **El estado actual.** ¿Qué se mide hoy? ¿Con qué herramientas? Si la empresa tiene conectado un panel de analítica o Meta, úsalo para ver lo que ya hay; si no, pídele al dueño capturas o cifras.
3. **El contexto técnico.** ¿Con qué está hecho el sitio o la tienda? ¿Hay requisitos de privacidad o consentimiento (según el país de los visitantes)?

Preguntas propias de este trabajo:

1. ¿Qué herramientas usan (GA4, Mixpanel, el panel de la tienda, el de la plataforma de anuncios)?
2. ¿Qué acciones clave quieren medir?
3. ¿Qué decisiones va a informar este dato?
4. ¿Quién lo instala: el equipo técnico o marketing?
5. ¿Hay requisitos de privacidad o consentimiento?
6. ¿Qué ya se mide?

## Principios

### 1. Medir para decidir, no para acumular datos
- Cada evento debe servir a una decisión.
- Evita las métricas de vanidad.
- Calidad antes que cantidad de eventos.

### 2. Empezar por las preguntas
- ¿Qué necesitas saber?
- ¿Qué harás con ese dato?
- Trabaja hacia atrás: de la decisión al evento.

### 3. Nombrar con coherencia
- Las convenciones importan.
- Documenta todo.

### 4. Cuidar la calidad del dato
- Valida la implementación.
- Vigila los problemas.
- Dato limpio vale más que dato abundante.

## Marco del plan de seguimiento

### Estructura

```
Nombre del evento | Categoría | Propiedades | Disparador | Notas
```

### Tipos de evento

| Tipo | Ejemplos |
|------|----------|
| Páginas vistas | Automáticas, enriquecidas con datos |
| Acciones del usuario | Clics en botones, envíos de formulario, uso de funciones |
| Eventos del sistema | Registro completado, compra, cambio de suscripción |
| Conversiones personalizadas | Metas cumplidas, etapas del embudo |

La lista completa de eventos por tipo de negocio está en `referencias/biblioteca-de-eventos.md`.

## Convención de nombres de eventos

### Formato recomendado: objeto + acción

```
registro_completado
boton_clicado
formulario_enviado
articulo_leido
pago_completado
```

(Las herramientas suelen usar inglés: `signup_completed`, `form_submitted`, `purchase_completed`. Elige un idioma y úsalo siempre; este documento muestra los nombres en inglés en los ejemplos de código porque es lo habitual en GA4.)

### Buenas prácticas
- Minúsculas con guion bajo.
- Sé específico: `cta_hero_clicked` es mejor que `button_clicked`.
- El contexto va en las propiedades, no en el nombre del evento.
- Sin espacios ni caracteres especiales.
- Documenta las decisiones.

## Eventos esenciales

### Sitio de marketing (cualquier negocio)

| Evento | Propiedades |
|--------|-------------|
| cta_clicked | button_text, location |
| form_submitted | form_type |
| signup_completed | method, source |
| demo_requested | - |

Para un negocio local o de servicios, añade el contacto por WhatsApp (`whatsapp_clicked`), la llamada (`phone_clicked`), la cita pedida (`appointment_requested`) y «cómo llegar» (`directions_clicked`).

### Producto o app

| Evento | Propiedades |
|--------|-------------|
| onboarding_step_completed | step_number, step_name |
| feature_used | feature_name |
| purchase_completed | plan, value |
| subscription_cancelled | reason |

### Tienda en línea
Los mínimos: `product_viewed`, `product_added_to_cart`, `checkout_started`, `purchase_completed` (con `transaction_id`, `value` y moneda). Ver `referencias/biblioteca-de-eventos.md` para la lista completa y la separación entre «imprescindibles» y «para después».

## Propiedades de los eventos

### Propiedades estándar

| Categoría | Propiedades |
|-----------|-------------|
| Página | page_title, page_location, page_referrer |
| Usuario | user_id, user_type, account_id, plan_type |
| Campaña | source, medium, campaign, content, term |
| Producto | product_id, product_name, category, price |

### Buenas prácticas
- Nombres de propiedad coherentes.
- Incluye el contexto relevante.
- No dupliques las propiedades automáticas.
- Nada de datos personales (nombre, correo, teléfono, cédula) en las propiedades.

## Implementación en GA4

### Puesta en marcha rápida

1. Crear la propiedad de GA4 y el flujo de datos.
2. Instalar gtag.js o Google Tag Manager (GTM).
3. Activar la medición mejorada.
4. Configurar los eventos personalizados.
5. Marcar las conversiones en Administración.

### Ejemplo de evento personalizado (para quien lo instala)

```javascript
gtag('event', 'signup_completed', {
  'method': 'email',
  'plan': 'free'
});
```

Detalle completo (flujos de datos, conversiones, dimensiones personalizadas, audiencias, depuración, calidad del dato, Google Ads): `referencias/implementacion-ga4.md`.

## Google Tag Manager

### Estructura del contenedor

| Componente | Para qué sirve |
|------------|----------------|
| Etiquetas (tags) | Código que se ejecuta (GA4, píxeles) |
| Activadores (triggers) | Cuándo se disparan las etiquetas (vista de página, clic) |
| Variables | Valores dinámicos (texto del clic, capa de datos) |

### Patrón de la capa de datos (dataLayer)

```javascript
dataLayer.push({
  'event': 'form_submitted',
  'form_name': 'contact',
  'form_location': 'footer'
});
```

Detalle completo (nombres, capa de datos, etiquetas comunes, vista previa, versiones, consentimiento, patrones avanzados): `referencias/implementacion-gtm.md`.

## Estrategia de parámetros UTM

### Parámetros estándar

| Parámetro | Para qué | Ejemplo |
|-----------|----------|---------|
| utm_source | Origen del tráfico | google, newsletter, instagram |
| utm_medium | Medio de marketing | cpc, email, social |
| utm_campaign | Nombre de la campaña | venta_de_temporada |
| utm_content | Diferenciar versiones | cta_principal |
| utm_term | Palabras clave de búsqueda paga | zapatos+para+correr |

### Convenciones de nombres
- Todo en minúsculas.
- Guion bajo o guion, pero siempre el mismo.
- Específico pero breve: `blog_cta_pie`, no `cta1`.
- Documenta todas las UTM en una hoja de cálculo (una fila por enlace: URL final, fuente, medio, campaña, contenido, quién la creó, fecha).
- Errores comunes que debes advertir: mayúsculas inconsistentes (`Google` y `google` cuentan como fuentes distintas), medio faltante, parámetros redundantes, UTM en enlaces internos del propio sitio (rompen la sesión y borran el origen real).
- Ejemplos por canal (adáptalos a los canales de la empresa): anuncios de Meta (`utm_source=meta&utm_medium=paid_social`), búsqueda de pago (`utm_source=google&utm_medium=cpc`), boletín (`utm_source=boletin&utm_medium=email`), publicación orgánica (`utm_source=linkedin&utm_medium=social`). Si Contenido programa piezas con enlace, el borrador (`crear_borrador`) debe llevar la URL ya etiquetada.

## Depuración y validación

### Herramientas de prueba

| Herramienta | Para qué |
|-------------|----------|
| GA4 DebugView | Ver los eventos en tiempo real |
| Modo de vista previa de GTM | Probar los activadores antes de publicar |
| Extensiones del navegador | Tag Assistant, inspector de dataLayer |

### Lista de validación

- [ ] Los eventos se disparan en los activadores correctos.
- [ ] Los valores de las propiedades se llenan bien.
- [ ] No hay eventos duplicados.
- [ ] Funciona en distintos navegadores y en el teléfono.
- [ ] Las conversiones se registran correctamente.
- [ ] No se filtran datos personales.

### Problemas comunes

| Problema | Qué revisar |
|----------|-------------|
| Los eventos no se disparan | Configuración del activador, que GTM esté cargado |
| Valores equivocados | Ruta de la variable, estructura de la capa de datos |
| Eventos duplicados | Varios contenedores, activador que se dispara dos veces |

### Cuando GA4 no cuadra con la base de datos o con la tienda
Causas habituales, en este orden de revisión: el modo de consentimiento filtra a quien rechaza cookies; los bloqueadores de anuncios; el seguimiento del navegador frente al del servidor; etiquetas duplicadas; zonas horarias y tiempos de sesión distintos; compras que no pasan por la página de confirmación (pago externo, transferencia, pedido por WhatsApp). Un desfase pequeño y estable es normal; uno grande o que cambia de golpe es una falla. Pasa los pasos de revisión como lista numerada a quien instala.

## Privacidad y cumplimiento

### Consideraciones
- Se exige consentimiento de cookies en la Unión Europea, el Reino Unido y California, y en muchos países hay leyes propias de protección de datos: revisa las del país de los visitantes de la empresa (GDPR/RGPD es el ejemplo más estricto; no des consejo legal, recomienda consultarlo con un abogado).
- Nada de datos personales en las propiedades de analítica.
- Ajustes de retención de datos.
- Capacidad de borrar los datos de un usuario.

### Implementación
- Usa el modo de consentimiento (esperar a que acepte).
- Anonimización de IP.
- Recoge solo lo que necesitas.
- Integra una plataforma de gestión de consentimiento (CMP).
- Jerarquía de consentimiento: necesarias, analítica, marketing. Hotjar, el píxel de Meta y similares se cargan solo con el consentimiento que les corresponde.

## Cómo entregarlo

Entrega un documento en Markdown con estas secciones:

1. **Resumen**: qué decisiones va a informar la medición y cuáles son las 3–5 conversiones clave.
2. **Estado actual**: qué hay hoy y qué falla (si es una auditoría).
3. **Plan de seguimiento**, con esta forma:

```markdown
# Plan de seguimiento de [sitio / producto]

## Resumen
- Herramientas: GA4, GTM
- Última actualización: [fecha]

## Eventos

| Nombre del evento | Descripción | Propiedades | Disparador | Para qué decisión |
|---|---|---|---|---|
| signup_completed | El usuario termina el registro | method, plan | Página de éxito | Medir el costo por registro |

## Dimensiones personalizadas

| Nombre | Alcance | Parámetro |
|---|---|---|
| user_type | Usuario | user_type |

## Conversiones

| Conversión | Evento | Cómo se cuenta |
|---|---|---|
| Registro | signup_completed | Una vez por sesión |
```

4. **Guía de UTM** (convenciones y una tabla de ejemplos por canal).
5. **Instrucciones para quien lo instala** (capa de datos, activadores, orden de trabajo) y **cómo comprobarlo** (lista de validación).
6. **Privacidad**: qué consentimiento hace falta y qué se carga cuándo.
7. **Qué falta y supuestos**.

Priorízalo: lo imprescindible primero, lo que puede esperar al final.

## Reglas

- Ningún evento sin una decisión que lo justifique.
- Nunca inventes cifras ni resultados de medición; si no tienes el dato, di qué hace falta para obtenerlo.
- Nada de datos personales en eventos, propiedades ni UTM.
- No dices que algo quedó instalado o verificado: entregas el plan y las instrucciones para que lo haga quien tiene acceso al sitio.
- Nada sale sin el OK del dueño (instalar etiquetas, cambiar la medición de la tienda, publicar enlaces con UTM en campañas).
- Si hay una prueba A/B de por medio, deja el diseño del experimento a `pruebas-ab`.
- Si el pedido incluye un tema fuera de tu alcance, dilo y envía el trabajo con `crear_borrador_tarea` al departamento que corresponde.

## Referencias

Pídelas por nombre con `leer_habilidad`:

- `biblioteca-de-eventos`: la lista completa de eventos por tipo de negocio (sitio, producto, cobros, tienda, B2B) con propiedades y secuencias de embudo. Léela al armar un plan de seguimiento.
- `implementacion-ga4`: configuración de GA4 paso a paso, conversiones, dimensiones, audiencias, depuración y filtros. Léela cuando el plan se instale en GA4.
- `implementacion-gtm`: contenedor, capa de datos, etiquetas comunes, versiones y consentimiento. Léela cuando se use Tag Manager.

## Habilidades relacionadas

- `pruebas-ab`: para el seguimiento de experimentos.
- `atribucion`: modelos de atribución, multitoque, incrementalidad y conciliar números entre herramientas (cuando el seguimiento ya está en marcha).
- `auditoria-seo`: para el análisis del tráfico orgánico.
- `conversion-paginas`: para optimizar conversiones (usa estos datos).
- `operaciones-ingresos`: para métricas de pipeline, CRM y atribución de ingresos.
