# Conectar Meta: estadísticas y publicar directo

**8 oct 2026.** Con un solo token, la oficina hace dos cosas con Meta:

1. **Leer** cómo rinden Instagram y Facebook: Analíticas (tecla R) y el informe del mes.
2. **Publicar directo** lo que apruebas en Contenido (tecla K), sin Metricool. Es opcional y se elige en Ajustes → Contenido.

Nada de esto se ha probado todavía contra tu cuenta de Meta. Por eso está el paso 6, que lo comprueba **sin publicar nada**.

---

## Lo que tienes que saber antes (sin letra pequeña)

- **Facebook se programa en Meta.** Cuando apruebas una pieza, la oficina la deja programada en tu página. Sale sola a su hora, **aunque tu computadora esté apagada**.
- **Instagram NO se puede programar por la API de Meta.** Meta no lo permite: su ruta de publicar no tiene «hora de salida». Por eso, en Instagram **la publica la oficina a su hora, desde tu computadora**.
  - 15 minutos antes prepara la publicación y sube el video si lo hay.
  - A la hora exacta, la publica.
  - Esa hora **la computadora tiene que estar encendida y con la oficina abierta**. Una hora antes te llega un aviso (también por Telegram, si lo tienes) para que no la apagues.
  - Si estaba apagada, sale al encenderla, como mucho 30 minutos tarde. Pasada la media hora ya no sale: queda en Contenido → Programación como **FALLÓ**, con el porqué, para que le cambies el día.
  - Si quieres que Instagram salga con la computadora apagada, la opción es Metricool (Ajustes → Contenido → «Metricool»).
- **Nunca publica dos veces.** Si Meta no contesta en el momento de publicar, la oficina mira primero si ya salió antes de hacer nada. En Facebook, si Meta no contesta al programar, no lo repite (podría duplicarla): te pide que mires tu página.
- **Redes:** Meta directo publica solo en **Instagram y Facebook**. Si una pieza lleva también LinkedIn, X u otra, esas salen como «no publicada» con el motivo.
- **Qué publica:**
  - **Instagram:** imagen, carrusel (de 2 a 10, con fotos y videos), reel e historia.
  - **Facebook:** foto, varias fotos en una publicación, video, solo texto, e historia con foto.
  - Las imágenes PNG y WebP se pasan a JPEG para Instagram. Los videos tienen que ser **MP4 o MOV**.
- **El primer comentario** se pone justo después de publicar, si la pieza lo lleva.
- **El token nunca se guarda en un archivo.** Vive en una variable de Windows y la oficina lo quita de cualquier mensaje.

---

## Paso a paso

### 1. Tu Instagram, listo

Tu Instagram tiene que ser una **cuenta profesional de Empresa** (Configuración → Tipo de cuenta) y estar **vinculada a la página de Facebook** de PanaClaw.

Según quien ya lo usa, las cuentas de Creador no pueden publicar historias por la API.

### 2. Una app de Meta

1. Entra a **developers.facebook.com → Mis apps → Crear app**.
2. Elige el caso de uso para **administrar contenido de Instagram con inicio de sesión de Facebook** y el tipo **Negocio**.
3. Conéctala al **portfolio de negocio de PanaClaw**.

Los nombres de los menús de Meta cambian a menudo. La idea siempre es esta: una app de tipo Negocio, del portfolio de PanaClaw.

### 3. Un usuario del sistema

En **Meta Business Suite → Configuración del negocio → Usuarios → Usuarios del sistema**:

1. Crea uno (rol Administrador o Empleado).
2. **Asígnale estos activos:**
   - la **página de Facebook**, con control total o, como mínimo, contenido y estadísticas;
   - la **cuenta de Instagram**;
   - la **app** del paso 2;
   - *(para Anuncios)* la **cuenta publicitaria**, con permiso para administrar campañas, y el **píxel** si tienes uno;
   - *(para anuncios que abren WhatsApp)* la **cuenta de WhatsApp Business**.

### 4. El token

En ese usuario del sistema, pulsa **Generar token**, elige la app y marca:

- **Caducidad: Nunca.**
- **Para leer:** `pages_show_list`, `pages_read_engagement`, `pages_read_user_content`, `read_insights`, `business_management`, `instagram_basic`, `instagram_manage_insights`.
- **Para publicar:**
  - `pages_manage_posts` e `instagram_content_publish` (sin estos dos no se publica);
  - `pages_manage_engagement` e `instagram_manage_comments` (sin estos dos, todo sale igual, pero sin el primer comentario).
- **Para Anuncios** (desde el 8 oct 2026): `ads_management` y `ads_read`.
- **Para los mensajes privados de la Bandeja:** `pages_messaging`, `pages_manage_metadata` e `instagram_manage_messages`. Para leer los mensajes de tus clientes, Meta exige además el **acceso avanzado**, que se pide en la Revisión de la app (`docs/plan-meta-anuncios-y-bandeja-2026-10-09.md`, §2.6).

Márcalos **todos de una vez** aunque todavía no uses Anuncios ni los mensajes: así no tienes que generar el token otra vez. «Comprobar conexión» dice lo que falta **por función** (Analíticas, Publicar, Anuncios, Mensajes).

**No compartas el token con nadie**, tampoco con Claude: no hace falta.

### 5. Ponerlo en Windows y reiniciar

1. Abre **PowerShell** y escribe:

   ```
   setx META_ACCESS_TOKEN "aquí-el-token"
   ```

2. Si tu app pide la «prueba del secreto», haz lo mismo con `META_APP_SECRET`. Está en la app → Configuración → Básica → Clave secreta.
3. **Cierra la ventana de la oficina y ábrela otra vez** con `Agents-Office-Abrinay.bat`. Las variables nuevas solo las ven los programas que se abren después.
4. *(Para Anuncios)* En **Ajustes → Anuncios**, pon el id de tu cuenta publicitaria (`act_…`). No es un secreto: el token, sí, y ese nunca va en Ajustes.

### 6. Comprobar, sin publicar nada

1. **Analíticas (R) → «Comprobar conexión».** Dice cuántas cuentas ve y si al token le falta algún permiso.
2. **La prueba de publicar.** Abre una terminal en la carpeta de la oficina y escribe:

   ```
   node scripts/check-meta-publicar.mjs
   ```

   - Comprueba el token, los permisos, la página, tu Instagram y la cuota de 24 horas.
   - Comprueba **lo único que no se pudo verificar desde aquí**: Instagram baja las imágenes de una dirección pública, y la oficina no tiene una. Así que la imagen se sube a tu página como foto temporal sin publicar, y a Instagram se le da su dirección de Meta. El script prueba que Instagram la acepte, **sin publicarla**.
   - Con `--video C:\ruta\video.mp4` también prueba un reel, sin publicarlo.
   - Con `--facebook` programa una foto para dentro de 2 días y la borra enseguida. Se ve unos segundos en tus publicaciones programadas, pero no sale.
   - Lo que encuentra queda en `data/salida-meta/`. Si algo sale con ✗, cópialo y pásaselo a Claude Code: con eso se arregla.

### 7. Elegir «Meta directo»

En **Ajustes → Contenido**:

- **«Quién publica en modo real» → «Meta directo».**
- **«Qué pasa con lo que apruebas» → «Real».** Empieza con «Simulacro» si quieres probar todo el circuito sin tocar tus redes.
- Si tienes varias páginas, la oficina usa la primera que tiene Instagram. Para fijar otra, pon su id en `office.config.local.json → "contenido": { "metaPagina": "<id>" }`.

En **Contenido → Programación** verás:

- arriba, **«Publica Meta directo»** con lo que hace cada red y el botón «Comprobar conexión»;
- en cada pieza aprobada:
  - **PROGRAMADA:** Facebook ya está en Meta;
  - **SALE A SU HORA:** Instagram, desde esta computadora;
  - **PUBLICADA:** con sus enlaces;
  - **FALLÓ:** con el porqué.

---

## Si algo falla

| Lo que dice | Qué hacer |
|---|---|
| «Falta META_ACCESS_TOKEN» | Paso 5. Recuerda reiniciar la oficina. |
| «Todavía no sé con qué página publicar» | Analíticas → «Comprobar conexión». |
| «Al token le faltan permisos para publicar» | Genera el token otra vez (paso 4) con los que dice. |
| «la página … no tiene un Instagram de empresa vinculado» | Paso 1, y asigna el Instagram al usuario del sistema (paso 3). |
| «No salió: a su hora la oficina estaba cerrada…» | La computadora estaba apagada a esa hora. Cámbiale el día y vuelve a aprobarla. |
| «Meta no contestó… no sé si la recibió / si salió» | Mira tu página o tu Instagram. Si no está, vuelve a aprobarla. |
| «Instagram ya usó sus N publicaciones por API» | Meta limita las publicaciones por API cada 24 h (suele ser 100). Se reintenta sola. |
| «Instagram bloqueó la acción porque le pareció spam» | Espera unas horas antes de publicar más por API. |
| «Instagram no acepta ese video» | Tiene que ser MP4 o MOV (H.264 y AAC), de 3 segundos a 15 minutos. |

---

## De dónde sale cada dato

La documentación de Meta no se pudo abrir desde donde se escribió esto (la red lo bloqueaba). Los nombres de rutas y parámetros salen de dos fuentes:

- el **SDK oficial de Meta** (`facebook_business` 26.0.2, que se genera de la especificación de la Graph API);
- las notas de **ig-publish** (deegitech, licencia MIT, octubre de 2026), que ya publica en Instagram con la API oficial: la subida reanudable a `rupload.facebook.com`, los códigos de error y «un error no quiere decir que no se publicó».

El código está en `contenido/meta-publicar.mjs` y `contenido/meta.mjs`; las pruebas, en `tests/meta-publicar.test.mjs`.
