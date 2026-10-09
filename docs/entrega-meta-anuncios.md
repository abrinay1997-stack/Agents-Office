# Entrega: Anuncios de Meta y la Bandeja con Meta (9 oct 2026)

Este documento cierra el plan `docs/plan-meta-anuncios-y-bandeja-2026-10-09.md`.
Explica cuatro cosas:
- **Qué se construyó.**
- **Dónde está cada cosa.**
- **Qué queda por comprobar contra Meta de verdad.**
- **Qué tienes que hacer tú, paso a paso, con tu token.**

Todo se probó contra un **Meta de mentira** (`tests/meta-stand.mjs`), nunca con tus keys. Por eso, lo marcado «POR VERIFICAR» solo se confirma cuando corras los scripts de la sección 4.

---

## 1. Qué se construyó

| Fase | Qué hace | PR |
|---|---|---|
| **0 · La base** | Graph v26.0 con su fecha de caducidad vigilada, el **freno por uso** (si Meta dice «para», la oficina para), un solo Meta de mentira para todo, **Ajustes → Anuncios** con tus topes y los permisos del token por función. | #18 |
| **A1 · Ver** | El panel **Anuncios** (el megáfono de la barra, tecla **J**): Resumen, Campañas e Historial. Solo lee de Meta. Dimitri, los agentes y tu asistente lo pueden leer. | #19 |
| **A2 · Controlar** | **Bajar el gasto** (pausar, bajar presupuesto, archivar) va con un clic y DESHACER. **Gastar** (activar, reanudar, subir presupuesto, alargar, relanzar) pide **dos clics y el segundo dice la cifra**. Nunca pasa tus topes, y lo garantiza el servidor, no solo la pantalla. Telegram: `/anuncios`. | #20 |
| **A3 · Crear** | La pestaña **Borradores** con un asistente de 5 pasos. Los creativos salen de la galería o del Estudio. **«Crear en Meta (en pausa)»**: todo nace pausado y nunca se crea dos veces, aunque la oficina se apague a mitad. | #21 |
| **A5 · La IA que mejora** | La pestaña **Sugerencias**: cada propuesta trae el dato, el porqué, el cambio exacto, el efecto y el riesgo. La pestaña **Creativos**. El **piloto automático** (apagado) solo sabe pausar. Una sugerencia de escalar al día en Telegram. Los umbrales viven en la Biblioteca, no en el código. | #22 |
| **B1 · Comentarios** | Los comentarios de Instagram y Facebook, también los de tus anuncios, llegan a la **Bandeja** directamente de Meta. Respondes tú, una vez. Puedes ocultar, nunca borrar, y hay DESHACER. | #23 |
| **A4 · Impulsar** | **«Impulsar»** en una pieza ya publicada o en Analíticas crea una campaña en pausa con esa misma publicación. | #24 |
| **B2 · Mensajes** | Los **mensajes privados** de Instagram y Messenger. Respondes solo dentro de la **ventana de 24 h**, y el servidor lo vigila. | #25 |
| **A6 · Medir** y **A7 · Informe** | Indicadores de anuncios en «Cómo va el negocio» y el **informe de anuncios del mes**. La API de conversiones **no se hizo**: espera a que confirmes que vendes en una web y qué eventos te importan. | #26 |

**Arreglos que salieron por el camino** (ya en `main`):
- **En Windows se perdían guardados.** Al pisar un archivo que otro programa tenía abierto, la escritura fallaba en silencio. Ahora se reintenta: `fs-seguro.mjs`.
- **Dos tests se colgaban en Windows** y bloqueaban `npm run check`.
- **Varios tests fallaban solo con la máquina cargada.**
- **El check revisa también los archivos nuevos en busca de secretos.**
- **Tu configuración local de `odoo-timesheet` queda fuera del repositorio.**

## 2. La regla del dinero (no cambia nunca)

- **Nada que gaste ocurre sin tus dos clics** (en la oficina o en Telegram). El segundo clic dice la cifra.
- **Nada pasa tus topes:** US$20 al día, US$300 al mes y US$150 por campaña, que puedes cambiar en Ajustes → Anuncios. Cada campaña lleva además su tope en Meta (`spend_cap`), si es de US$100 o más, porque ese es el mínimo de Meta.
- **Todo se crea en pausa.**
- **Ni los agentes ni tu asistente por MCP pueden gastar** (403). Dimitri puede proponer un gasto, pero el segundo clic es tuyo.
- **El piloto automático solo pausa**, y viene apagado.
- **Una campaña de presupuesto diario sin fecha de fin no se puede activar.** Sin fecha de fin no hay forma de asegurar que no pase tu tope por campaña. Ponle fecha de fin.

## 3. Dónde está cada cosa

| Qué | Dónde |
|---|---|
| El cliente de Meta, la versión, el freno y los permisos | `contenido/meta.mjs` |
| Anuncios (servidor) | `anuncios/`: `modelo`, `meta-ads`, `sincronizar`, `topes`, `acciones`, `construir`, `crear`, `borradores`, `mejorar`, `diagnostico`, `sugerencias`, `piloto`, `impulsar`, `informe`, `rutas` |
| El panel de Anuncios | `src/anuncios/` (va en su propio paquete, `dist/anuncios-vista.js`) y `src/anuncios-carga.js` |
| La Bandeja con Meta | `contenido/bandeja-meta.mjs` y `contenido/bandeja.mjs`; en la página, `src/contenido-bandeja.js`, y la conversación en `src/contenido-conversacion.js` (paquete del editor) |
| Los umbrales de la IA | `biblioteca/marketing/campanas-pagadas/umbrales.json`. Para cambiarlos, copia el archivo a `<tu cerebro>/Agents Office/biblioteca/campanas-pagadas/umbrales.json` y cambia solo lo que quieras |
| Lo que la oficina guarda de tu cuenta (no viaja por GitHub) | `data/anuncios/` y `data/contenido/bandeja*.json` |
| El Meta de mentira | `tests/meta-stand.mjs` |
| Lo verificado contra la documentación de Meta | El §13 del plan, con la fecha de cada punto |

## 4. Lo que tienes que hacer tú, paso a paso

### 4.1 Antes (en Meta; lo lento primero)

Sigue el §2 del plan. En resumen:
1. **Verifica tu negocio** en Meta Business Suite. Tarda días: empieza ya.
2. **Cuenta publicitaria** en USD y con zona horaria America/Panama, con método de pago y **límite de gasto de la cuenta**.
3. **La app**:
   - productos: Marketing API, Instagram y Messenger;
   - URL de privacidad y de borrado de datos;
   - activar **«Requerir secreto de la app»**;
   - pasarla a modo **En vivo**.
4. **Usuario del sistema** con la página, el Instagram, la cuenta publicitaria, la app y, si tienes, el píxel y el WhatsApp.
5. **Token** con caducidad «Nunca» y **todos** los permisos de `docs/conectar-meta.md`, incluidos `ads_management`, `ads_read`, `pages_messaging`, `pages_manage_metadata` e `instagram_manage_messages`.
6. En Instagram, activa **«Permitir el acceso a los mensajes»**.
7. En Windows, abre PowerShell y escribe:
   ```
   setx META_ACCESS_TOKEN "…"
   setx META_APP_SECRET "…"
   ```
   Cierra la oficina y ábrela otra vez.
8. En **Ajustes → Anuncios**, pon tu cuenta publicitaria (`act_…`) y revisa los topes.

### 4.2 Las comprobaciones (en este orden)

Abre una terminal en la carpeta de la oficina. **Ninguna de estas comprobaciones publica, envía ni gasta**, salvo la 3, que crea una campaña de prueba en pausa y la archiva enseguida.

| # | Comando | Qué comprueba |
|---|---|---|
| 1 | `node scripts/check-meta-publicar.mjs` | El token, los permisos por función, tu página e Instagram, y que Instagram acepte una imagen. No publica nada. |
| 2 | `node scripts/check-meta-anuncios.mjs` | Tu cuenta publicitaria (moneda, zona, estado), 3 campañas con su aprendizaje y cifras, y dos campos por verificar. Solo lee. |
| 3 | `node scripts/check-meta-anuncios.mjs --crear-pausada` | Crea una campaña de prueba **en pausa**, prueba las combinaciones con `validate_only` y la **archiva**. No gasta: nunca se activa. |
| 4 | `node scripts/check-meta-bandeja.mjs` | Si llegan los comentarios y los mensajes de tus clientes (con nombre y texto), y si ya tienes el acceso avanzado. No responde nada. |

Cada uno escribe ✓ (bien), ! (aviso) o ✗ (falló), y guarda lo confirmado en `data/salida-meta/` (sin textos ni nombres de clientes).

### 4.3 Si algo sale con ✗

| Lo que dice | Qué hacer |
|---|---|
| «El token de Meta caducó…» (código 190) | Genera otro token (paso 4.1.5) y vuelve a hacer `setx`. |
| «Faltan permisos: …» | Genera el token otra vez con esos permisos marcados. «Comprobar conexión» te dice cuáles faltan, por función. |
| «Meta no dio permiso…» (código 10 o 200–299) | Revisa que el usuario del sistema tenga asignados la página, el Instagram y la cuenta publicitaria. |
| «Meta pidió esperar por el límite de uso…» | Espera los minutos que diga y vuelve a correrlo. La oficina ya frena sola. |
| Mensajes: «falta el acceso avanzado» | Pídelo en la Revisión de la app (§2.6 del plan). Para el video que te pide Meta, graba la Bandeja con una conversación abierta, en simulacro. Mientras tanto, los comentarios siguen funcionando. |
| Moneda o zona distintas de USD y America/Panama | No se pueden cambiar en esa cuenta: decide si creas otra (§2.2 del plan). |
| Cualquier otro ✗ | Abre Claude Code en esta carpeta y pásale la salida del script y la carpeta `data/salida-meta/`: con eso se quitan los «POR VERIFICAR» del código. |

## 5. Lo que quedó por verificar contra Meta

**Actualización del 9 oct 2026, con tu token:**
- **Funcionan con tu cuenta:** publicar, Anuncios y los comentarios.
- **Se arregló un fallo** en las cifras de Anuncios que solo salía con Meta de verdad.
- **Quedan verificados:** la imagen de Instagram desde Facebook, `effective_instagram_media_id` y `attachments`.
- **Los mensajes privados llegan sin texto** hasta que Meta te dé el acceso avanzado.
- **Una cuenta de Instagram tiene desactivado** «Permitir el acceso a los mensajes».

El detalle está en el §13.bis del plan. Esto es lo que sigue pendiente:

Está marcado `// POR VERIFICAR` en el código y anotado en el §13 del plan. Lo principal:
- **Anuncios:**
  - los botones de mensajes (`WHATSAPP_MESSAGE`, `INSTAGRAM_MESSAGE`, `MESSAGE_PAGE`);
  - las combinaciones de web, ventas, contactos y alcance;
  - los nombres de las mejoras automáticas de Meta (`creative_features_spec`);
  - `validate_only` en conjuntos y anuncios;
  - la subida de imágenes y videos;
  - `advantage_state_info`;
  - `boost_eligibility_info`.

  Los comprueban las pruebas 2 y 3.
- **Comentarios:**
  - en Facebook, `is_hidden` y `from` al leer;
  - `effective_instagram_media_id`;
  - si leer comentarios de clientes pide el acceso avanzado.

  Los comprueba la prueba 4.
- **Mensajes:**
  - `attachments` y el dominio de los adjuntos de Messenger;
  - el `from` de lo que manda tu cuenta;
  - el código de error sin acceso avanzado;
  - si `HUMAN_AGENT` vale en Instagram (la oficina **no usa etiquetas** hasta saberlo).
- **Los umbrales de la IA** salen de la Biblioteca y del plan, no de tu cuenta: ajústalos cuando tengas datos de verdad.

## 6. Decisiones que tomé con los valores por defecto (§12 del plan)

| Decisión | Lo que quedó | Cómo cambiarlo |
|---|---|---|
| Topes | US$20 al día, US$300 al mes y US$150 por campaña | Ajustes → Anuncios |
| Objetivo por defecto | «Que me escriban» (WhatsApp si lo configuras; si no, Instagram) | En el paso 1 del asistente |
| Público | Advantage+ en Panamá, 18+ | En el paso 2 |
| Mejoras automáticas de Meta | Retoques y recorte, sí; cambiar el texto y la plantilla, no | En el paso 4 |
| Piloto automático | Apagado | Ajustes → Anuncios |
| Avisos de Telegram | Solo el dueño (un aprobador delegado no toca anuncios) | — |
| La Bandeja | Meta si hay token; si no, Metricool | Ajustes → Contenido → «La Bandeja trae de» |
| API de conversiones (A6) | **No se hizo** | Dime si vendes en una web y qué eventos te importan |

## 7. Avisos para quien siga el trabajo

- **La página principal está cerca de su tope** (unos 2.217 KB de 2.252, y 677 KB comprimida de 700). Lo nuevo va en paquetes aparte (`dist/anuncios-vista.js`, `dist/pieza-editor.js`).
- **El prompt de Dimitri** está cerca de su límite de 16.000 caracteres (`tests/sub-conversacion.test.mjs`). Una acción nueva se describe en una línea corta.
- **Para guardar en el servidor**, usa `renombrar` de `fs-seguro.mjs`, nunca `fs.renameSync` directo. En los tests, espera a que pase lo que compruebas, nunca un tiempo fijo corto.
