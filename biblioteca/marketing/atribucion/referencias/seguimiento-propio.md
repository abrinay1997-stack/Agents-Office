# Atribución propia: la guía para construirla

Cómo instrumentar y unir la atribución por cuenta propia cuando la empresa controla su sitio o su app. Es el camino de construcción (Pilar B). **Tú no programas ni instalas nada:** entrega esto como especificación para quien lo implemente (el dueño, su desarrollador o el proveedor de su analítica), con los pasos que correspondan a su caso y sin adornos de lo que no aplique.

La guía está destilada de construcciones reales en producción y no depende de la herramienta: **PostHog + SavvyCal son el ejemplo trabajado**, pero el patrón sirve para cualquier herramienta de analítica de producto con `identify()` y fusión (Segment, Amplitude, el ID de usuario de GA4) y para cualquier dominio de terceros donde ocurre la conversión y que ofrezca paso de metadatos + webhook (Calendly, Cal.com, el pago alojado de Stripe, Typeform).

El método central, cerrar el hueco de `identify()` para que las conversiones se unan al historial de navegación anónima, está **adaptado del enfoque de Tessa Kriesel con PostHog**. Varios refinamientos de producción que lo hacen funcionar a escala también son suyos, con crédito en el texto: la captura del recorrido completo que alimenta el camino de modelos (paso 4), el último tramo hacia el CRM con origen, confianza y base y una lectura de Pagado frente a Orgánico (paso 5), el resumen por cuenta y la ventana de «esperar casi cero hasta verificar la unión», con respaldo por campaña y relleno hacia atrás (unión entre subdominios).

## La idea

La atribución propia une la **navegación anónima** con la **conversión final**:

```
visitante anónimo              identify() al convertir           desglose
─────────────────              ───────────────────────           ────────
id = anon_uuid                 identify(correo)                  evento de conversión
$initial_utm_source=...   →    fusiona el historial anónimo  →   por $initial_utm_source
$initial_referrer=...          con la persona(correo)            = «de dónde vienen los clientes»
```

Todo lo que sigue sirve a esa unión. Si `identify()` nunca se dispara, cada cliente parece salir de la nada: ese es *el hueco*.

## Paso 0: audita antes de construir

El error más caro es reconstruir una atribución que ya funciona. Muchas apps ya hacen `identify()` al registrarse y ya llevan el primer contacto en los perfiles. **Revisa primero los datos vivos:**

- ¿Los perfiles de persona llevan `$initial_utm_source` y `$initial_referring_domain`?
- ¿Un evento de conversión («Se registró», «Pasó a pago») se desglosa *limpiamente* por canal, o todo es «Directo»?
- ¿La identidad se guarda por **correo** o por un **UUID** interno? (Esto cambia todas las salvaguardas de abajo.)
- ¿La unión entre subdominios funciona (sitio de marketing → app.tudominio.com)?

Instrumenta solo las **conversiones realmente sin unir**. En una auditoría real, el embudo de autoservicio ya estaba resuelto de punta a punta; el *único* hueco era una cita agendada en un dominio de terceros. No toques lo que funciona.

## Paso 1: identifica en cada conversión real

En cada momento de conversión, llama a `identify()` con un identificador estable y fija propiedades de la persona:

```js
// Normaliza antes de usarlo como identificador: las herramientas de analítica
// comparan cadenas exactas, así que "Ana@x.com" y "ana@x.com" se partirían en dos personas.
export function identifyUser(email) {
  const normalized = email.trim().toLowerCase();
  window.posthog?.identify(normalized, { email: normalized });
}
```

Con `person_profiles: 'identified_only'`, este es el momento en que se crea la persona y se estampan sus propiedades de primer contacto. Dispáralo al enviar un formulario, al registrarse, en la primera compra: en cualquier momento en que sepas quién es en realidad el visitante anónimo.

## Paso 2: une conversiones en un dominio que no es tuyo

Cuando la conversión termina en un dominio de terceros (una herramienta de citas, un pago alojado fuera), no puedes correr tu analítica allí. Pasa el identificador anónimo por el **paso de metadatos** de la herramienta y fusiónalo de vuelta en el **webhook**.

### 2a. Decorador de enlaces en fase de captura

Un solo detector de eventos a nivel de documento reescribe cada enlace de reserva al hacer clic: sin editar botón por botón, y cubre el clic normal, la activación con teclado y el clic del medio (`auxclick`):

```js
// Agrega el distinct_id anónimo a cualquier enlace de SavvyCal al hacer clic.
function decorate(e) {
  const anchor = e.target?.closest?.("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return;

  let url;
  try { url = new URL(anchor.href); } catch { return; }
  const host = url.hostname;
  if (host !== "savvycal.com" && !host.endsWith(".savvycal.com")) return;

  const distinctId = getPostHogDistinctId();   // solo anónimo: ver la guardia
  if (!distinctId) return;                       // cierra ante la duda

  url.searchParams.set("metadata[ph_distinct_id]", distinctId);
  anchor.href = url.toString();
}
document.addEventListener("click", decorate, true);    // fase de captura
document.addEventListener("auxclick", decorate, true);
```

Para un **calendario incrustado** (p. ej. una página `/demo` con el calendario dentro), pasa el mismo identificador en la configuración de metadatos de la incrustación; espera brevemente (~2 s) el identificador en visitas nuevas, pero nunca bloquees la carga del calendario.

### 2b. Lee el identificador anónimo con seguridad

El SDK en espera encola las llamadas antes de cargar, así que `get_distinct_id()` devuelve `undefined` al principio: recurre a la cookie de la propia herramienta:

```js
export function getPostHogDistinctId() {
  if (typeof window === "undefined") return null;

  // Prefiere el SDK ya cargado.
  try {
    if (window.posthog?.__loaded) {
      const id = window.posthog.get_distinct_id();
      if (id) return isAnonymousDistinctId(id) ? id : null;
    }
  } catch {}

  // Recurre a la cookie de PostHog antes de que el SDK termine de cargar.
  try {
    const prefix = `ph_${POSTHOG_API_KEY}_posthog=`;
    const cookie = document.cookie.split(/;\s*/).find(c => c.startsWith(prefix));
    if (!cookie) return null;
    const parsed = JSON.parse(decodeURIComponent(cookie.slice(prefix.length)));
    return typeof parsed.distinct_id === "string" && isAnonymousDistinctId(parsed.distinct_id)
      ? parsed.distinct_id : null;
  } catch { return null; }
}
```

### 2c. Fusiona en el webhook

La herramienta de terceros devuelve tus metadatos en su webhook `booking.created` (o `checkout.completed`). Dispara una fusión de identidad y un evento de conversión al punto de ingesta de tu analítica:

```js
// Normaliza el correo de la cita igual que la app (paso 1), o la persona de la
// cita se separará de la identidad de la app para el mismo usuario.
const userId = email.trim().toLowerCase();

const events = [];
if (anonId) {
  events.push({
    event: "$identify",
    distinct_id: userId,                                  // la persona conocida
    properties: { $anon_distinct_id: anonId, $set: { email: userId, name } },  // fusiona el recorrido
  });
}
events.push({
  event: "discovery_call_booked",
  distinct_id: userId,
  properties: { booking_id, journey_linked: Boolean(anonId) },  // mide la tasa de respaldo
});

await fetch(`${POSTHOG_HOST}/batch/`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ api_key: POSTHOG_API_KEY, batch: events }),
  signal: AbortSignal.timeout(3000),   // con límite: nunca dejes colgado el webhook
});
```

Cuando no sobrevive ningún identificador (el enlace esquivó el decorador, p. ej. un enlace de reserva dentro de un correo o PDF generado), recurre a la **captura solo por correo** con `journey_linked: false`. Sigues obteniendo la conversión; solo pierdes el recorrido de esa.

**Advertencia sobre la supervivencia del primer contacto (detalles de PostHog):** la fusión con `$anon_distinct_id` trae el historial de *eventos* de la persona anónima, pero con `person_profiles: 'identified_only'` el visitante anónimo puede no haber tenido nunca un perfil de persona, así que sus propiedades de primer contacto `$initial_*` no tienen garantizado aterrizar en la persona fusionada. Dos arreglos robustos: llamar a `posthog.createPersonProfile()` en el cliente *antes* de que el visitante navegue al dominio de terceros (para que exista el perfil y sus `$initial_*` a los que fusionar), **o** capturar del lado del cliente los valores de primer contacto y pasarlos por el mismo paso de metadatos, y reafirmarlos en el webhook con `$set_once` (`$set_once` nunca sobrescribe un valor existente, así que es seguro). Sin uno de los dos, puedes lograr que la cita se una a los *eventos* del recorrido pero con un `$initial_utm_source` vacío en la persona: verifícalo con una reserva real. ([posthog-js#1524](https://github.com/PostHog/posthog-js/issues/1524).)

## Paso 3: las salvaguardas (no te las saltes)

### Guardia de anonimato: cierra ante la duda

Manda solo el identificador *anónimo*. Después de `identify()`, el `distinct_id` actual pasa a ser el correo o el UUID del usuario: filtrarlo a la dirección de un tercero, o fusionar con él en el webhook, junta personas distintas y filtra datos personales.

**Elige la guardia que corresponda a tu modelo de identidad: no son intercambiables.** La comprobación de `@` solo es segura cuando tu app identifica por **correo**; no la copies a una app que identifica por UUID.

```js
// SOLO apps que identifican por CORREO. Verdadero solo para identificadores seguros de mandar:
// rechaza valores con forma de correo (un correo ya identificado) y limita la longitud.
export function isAnonymousDistinctId(id) {
  return id.length > 0 && id.length <= 100 && !id.includes("@");
}
```

**Si la app identifica por UUID, no por correo**, la comprobación de `@` no sirve: un UUID ya identificado pasaría y se filtraría. En su lugar, comprueba que el `distinct_id` actual todavía sea igual al `device_id` (llamar a `identify()` cambia `distinct_id` pero deja `device_id`), y **cierra** cuando `device_id` no se pueda leer:

```js
// Variante para identidad por UUID: es anónimo solo si distinct_id sigue siendo igual a device_id.
function isAnonymous(posthog) {
  const did = posthog.get_distinct_id?.();
  const dev = posthog.get_property?.("$device_id");
  if (!did || !dev) return false;   // ambiguo → trátalo como identificado, no mandes nada
  return did === dev;
}
```

La regla en una línea: **cuando la identidad es ambigua, no mandes nada.** Un recorrido que falta es un hueco de datos; una fusión equivocada es corrupción.

**Privacidad:** esto trata datos personales. Pídele al dueño que verifique la ley de protección de datos de su país (y el RGPD si hay clientes europeos), el aviso de privacidad del sitio y el consentimiento para cookies y rastreo antes de activarlo.

### Calidad del primer contacto: la ganancia grande más barata

Las redirecciones sobrescriben el primer contacto verdadero, inflan «Directo» y «Referencia» y esconden la adquisición real. Exclúyelas de la clasificación de origen o canal (normalmente es un *ajuste de configuración* en la herramienta de analítica, no código):

- **Redirecciones de inicio de sesión y de pago:** `accounts.google.com`, `login.microsoftonline.com`, `login.live.com`, `checkout.stripe.com` y los de tu pasarela de pago.
- **Autorreferencias y subdominios:** `tudominio.com`, `app.tudominio.com`, `auth.tudominio.com`.
- **Tráfico de desarrollo o interno:** `localhost`, `127.0.0.1`, cuentas de prueba.

Es el arreglo de **mayor confianza por esfuerzo** de toda la guía: no hay que desplegar nada y la precisión mejora de inmediato. Hazlo primero.

### Unión entre subdominios

El sitio de marketing → la app en un subdominio deben compartir **un solo proyecto de analítica** y una **cookie entre subdominios** (el valor por defecto `cross_subdomain_cookie` de PostHog cubre `tudominio.com` → `app.tudominio.com`). Verifica que el recorrido sobreviva al traspaso, o cada registro parecerá haber empezado en la app.

**Espera cifras casi en cero hasta verificar la unión en producción: no entres en pánico.** (Nota de producción de Tessa Kriesel.) Antes de confirmar que la unión entre subdominios está activa, la atribución propia lee *básicamente nada*: los recorridos se rompen en el traspaso y todo parece directo. Pasa de ~0 a cifras reales la semana en que la unión de verdad sale. Dos cosas te ayudan a pasar esa ventana:

- **Un respaldo heurístico por ventana de campaña.** Cuando un registro no tiene recorrido unido, atribúyelo a la campaña o canal que estaba vigente en su ventana de registro, pero **solo cuando fecha + página de aterrizaje + UTM activos lo reduzcan de forma única a un origen**. Con campañas solapadas, anuncios permanentes, envíos de correo, demanda de marca o directa, o una página de aterrizaje compartida, la ventana no puede aislar la causa: márcalos `desconocido` o de baja confianza en vez de acreditar falsamente lo que estuviera vigente. Usado con cuidado es una señal real mientras la unión se estabiliza y supera a un hueco; usado a lo bruto fabrica atribución falsa.
- **Rellena hacia atrás solo los registros previos a la unión que de verdad no tengan origen.** Muchos registros previos ya tienen una atribución verificada o declarada por el cliente: **nunca sobrescribas un origen de mayor confianza con la heurística.** Rellena solo los vacíos (ventana de campaña o declarada), márcalos como tales y mantén el historial relleno por heurística visualmente separado de las tendencias verificadas, para no leer un salto el día del lanzamiento como un cambio real.

Marca estas conversiones atribuidas por respaldo con una `base` de menor confianza (ver paso 5) para no confundir nunca una suposición heurística con un recorrido verificado.

### Endurece el webhook

- Verifica la **firma** del proveedor (`SAVVYCAL_WEBHOOK_SECRET` y similares).
- **Valida** el identificador recibido (cadena, ≤100 caracteres, sin `@`) antes de fusionar.
- Ejecuta la llamada a la analítica **después** del trabajo crítico del negocio, con límite de tiempo y **sin que su fallo detenga nada**.
- **Registra el ID de la reserva, nunca el correo.**

## Paso 4: reporta

- **Revisa la configuración:** muchas herramientas vienen por defecto en *último contacto* (la escena de Marketing Analytics de PostHog lo hace). La atribución propia quiere primer contacto: construye los análisis sobre `$initial_*` explícitamente o cambia el valor por defecto.
- **El hallazgo que paga:** el evento de conversión desglosado por `$initial_utm_source` / `$initial_referring_domain`: «de dónde viene cada registro o cita».
- **Canal → ingresos:** el evento de conversión por canal, unido a propiedades de ingresos de la persona. Nota: algunas herramientas calculan las propiedades de ingresos *al ingresar* el evento (persona en eventos), así que los eventos históricos pueden leer 0: usa la tabla de personas para el ingreso actual, o segmenta por plan.
- **Mide tu propia cobertura:** la tasa de `journey_linked: false` dice cuántas conversiones esquivaron la unión. Vigílala después del lanzamiento.
- **Guarda el recorrido completo, no solo `$initial_*`.** (Refinamiento de Tessa Kriesel.) El primer contacto solo permite desglosar las conversiones por *primer* canal, pero no corre los modelos multicontacto del camino de interpretación (SKILL.md §2: posición, lineal, decaimiento). Si además guardas la **secuencia ordenada de contactos** de cada persona (canal + fecha de cada uno, p. ej. una consulta a la tabla de eventos o un arreglo `touch_path` en la persona), el camino de construcción *alimenta* el de interpretación: ya puedes puntuar el mismo recorrido de seis maneras con tus propios datos en vez de solo leer sobre los modelos. Así se dan la mano el Pilar A y el Pilar B: captura el primer contacto para lanzar; captura el recorrido completo para modelar.

## Paso 5: el último tramo, llevar la atribución al CRM

(Todo este paso es un refinamiento de producción de Tessa Kriesel: lo que convirtió la atribución propia de un panel en una señal operativa.)

Un desglose por canal en la herramienta de analítica es un *reporte*. Lo que ventas y el ciclo de vida de verdad usan es la **atribución escrita en el registro del CRM**, por cuenta. Sincronízala:

- **Un campo `origen`, más `confianza` y `base`.** No escribas un canal a secas: escribe el canal *y cómo lo sabes*. La `base` es el **tipo de evidencia**: `journey_linked` (unión verificada), `self_reported` (declarada por el cliente) o `campaign_window` (el respaldo heurístico de arriba). La `confianza` se calcula a partir de la **calidad de la evidencia, no solo de la base**: un contacto unido al recorrido con UTM limpios es alta; el mismo con UTM sucios o ausentes, más baja; y una respuesta *específica* del cliente puede ser alta mientras una vaga es baja. Ventas trata muy distinto un origen de alta confianza que una suposición: dales los dos campos o desconfiarán de todo.
- **Una lectura de Pagado frente a Orgánico según el medio.** El corte más usado en la práctica: marca un contacto como **`paid`** solo a partir de medios explícitamente de pago (`cpc`, `ppc`, `paid-social`, `display`, `paid`), y clasifica el resto en una taxonomía pequeña y configurable en vez de un «orgánico» burdo: `owned` (propio: correo, notificaciones, SMS, aunque un boletín patrocinado es *pago*), `earned` (ganado: búsqueda y redes orgánicas, referencia, aunque una referencia de socio o afiliado se parece más a pago), `direct` (sin medio: desconocido, no orgánico) y `unknown`. La pregunta operativa rápida de un vendedor o de un flujo de seguimiento es en realidad **pago o no pago** (¿esta cuenta costó dinero de adquisición?): acierta ese límite y deja configurables los grupos más finos.
- **Resume a nivel de cuenta, no solo del contacto** (B2B): ver la nota de resumen por cuenta más abajo y `por-tipo-de-negocio`.
- **Pásale el registro a `operaciones-ingresos`.** Cuando el origen, la confianza, la base y lo pagado/orgánico viven en la cuenta, cómo el embudo y el ciclo de vida los *usan* (enrutamiento, puntaje de prospectos, ramas de seguimiento, reportes de ingresos atribuidos) es trabajo de esa habilidad. El trabajo de esta guía es dejar un origen confiable y etiquetado en el registro.

**Resumen por cuenta (B2B).** Una organización son varias personas que se registran con correos mixtos de trabajo y personales, así que la atribución por persona dispersa la historia entre registros. Resume el origen de cada persona a la **cuenta** y atribuye a nivel de cuenta: ahí tiene que aterrizar la señal para servirle a quien trabaja todo el comité de compra. Une por dominio del correo, **pero excluye los dominios gratuitos** (`gmail.com`, `yahoo.com`, `outlook.com`, …): no identifican a una empresa, así que una coincidencia por dominio juntaría a personas sin relación en una cuenta falsa. Para registros con correo personal, recurre al enriquecimiento, al vínculo contacto→cuenta del CRM o a la unión manual.

## Lista de verificación

- Haz clic en un botón de reserva → la dirección muestra `metadata[<parámetro_id>]=<anon-uuid>`.
- En la consola: `posthog.identify('prueba@x.com')` → vuelve a hacer clic → el parámetro **NO** debe aparecer (la guardia funciona). Luego `posthog.reset()`.
- Manda a mano un `/batch/` de webhook → debe responder `{"status":"Ok"}` y la persona aparecer fusionada.
- Después del lanzamiento: el primer webhook real registra `journey_linked: true`.
- Confirma que el primer contacto sobrevive entre subdominios: empieza en el sitio de marketing, regístrate en la app y revisa que la persona conserve el `$initial_utm_source` original.

## Adaptarlo a otras herramientas

| Pieza | PostHog (ejemplo trabajado) | Se generaliza a |
|---|---|---|
| Identificador anónimo | `distinct_id` / `$device_id` | `anonymousId` de Segment, `deviceId` de Amplitude, `client_id` de GA4 |
| Llamada de fusión | `$identify` + `$anon_distinct_id` | `identify` de Segment (`userId` conocido, mismo `anonymousId`) + `alias` cuando haga falta; `setUserId` de Amplitude en la sesión que todavía tiene el `deviceId` anónimo (la unión es deviceId↔userId: la API Identify de Amplitude solo fija propiedades del usuario, no fusiona); `user_id` de GA4 sobre el mismo `client_id` |
| Ingesta | `/batch/` | API HTTP de Segment, HTTP v2 de Amplitude, Measurement Protocol de GA4 |
| Paso de metadatos de terceros | `metadata[...]` de SavvyCal | **Calendly:** solo UTM estándar (`utm_source`/`medium`/`campaign`/`content`/`term`) más `salesforce_uuid`: mapea el identificador anónimo a un UTM admitido (p. ej. `utm_term`), no a un parámetro libre `metadata[]`. Metadatos de Cal.com; `client_reference_id` o metadatos de Stripe |
| Propiedades de primer contacto | `$initial_*` | Primer contacto de Segment o Amplitude, dimensiones `first_user_*` de GA4 |

La forma nunca cambia: **toma el identificador anónimo → llévalo al otro lado de la frontera → fusiona al llegar → desglosa la conversión por primer contacto.**
