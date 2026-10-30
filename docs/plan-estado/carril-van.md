# Carril VAN (Fase 9, Ola 4) — estado

## VAN-03 · banco de ataques (rama `carril-van-1`, 30 oct 2026) — hecho, solo pruebas y datos

- **Dónde:** `tests/fixtures/banco-ataques.mjs` (datos, cada caso con su `porque`), `tests/banco-ataques.test.mjs` (detector, direcciones, `decide`) y `cloudflare/tests/banco-ataques-guardian.test.mjs` (`crearGuardian`: auditoría, url-ajena, campos opacos, marca de la corrida, falla cerrado). Sin reloj: no depende de la hora.
- **Tamaño:** 76 ataques (correo, web, resultados de herramientas, nombres de archivo/metadatos, Unicode, codificados, parafraseo/otros idiomas, markdown/HTML, exfiltración, campos repartidos, mezcla), 40 inocentes, 22 direcciones, 18 envíos (destinatario no aprobado, cc, teléfono local, importe, taint, gasto, borrado, redes, conector ajeno, cabecera con salto de línea).
- **Resultado real (sin esconder nada):** 58/76 ataques detectados (76 %); 18 falsos negativos = límites conocidos; 4/40 inocentes bloqueados = falsos positivos conocidos.
- **Falsos negativos documentados (`limite`):** base64, `%20`, entidades HTML, leetspeak, texto invertido, letras separadas por espacios, francés/alemán/portugués, parafraseos sin las palabras de la lista (falsa autoridad, «override your guidelines», «forget what you have been asked»), orden pasada la posición 200.000, fuga por imagen markdown, y **un hallazgo nuevo: JSON devuelto como TEXTO con `\n` o `\t` escapado pegado a la orden** (`"…\nIgnore all previous instructions"`: la «n» del escape se junta con «Ignore» y `\b` no casa). Es realista (muchos conectores devuelven JSON como texto) y está en `tool-07`/`tool-08`. Arreglo sugerido (NO hecho, esta tarea no cambia comportamiento): en `normalizarParaDeteccion`, además de la forma actual probar otra con `\\[nrt]` reemplazados por espacio.
- **Falsos positivos documentados (`fp`):** «Ignore the typos in my previous message, instructions…» (la primera regla admite 30+20 letras de relleno), «No le digas a mi jefe…», «Claude, envía la cotización…» (una persona llamada Claude), «do not tell the user's manual…».
- **Direcciones fuera de alcance (`limite`):** `mailto:`/`javascript:`/`data:`, `%3A%2F%2F`, y una segunda dirección dentro de la query de una dirección propia (`url=https://good.com/a?next=https://evil.test`).
- **El candado real se prueba aparte:** con cada ataque que el detector NO atrapa, un envío sin OK o a un destinatario no aprobado igual se bloquea (`no-writes`, `recipient`).
- **Regla:** una regla o un ataque nuevo se añade al banco en el mismo cambio; si el detector mejora, los tests fallan a propósito para quitar la marca.

## VAN-03 · pendiente
- Correr el banco también en el despliegue (hoy corre dentro de `npm test` y de `check`, que ya corre en CI).
- Casos de imagen y PDF (el texto escrito dentro de una imagen no pasa por `injectionIn`: es un límite conocido de `ver_imagen`).

## `dominiosPermitidos` por conector (SEG-02, pendiente) — solo DISEÑO, no construido

Por qué no se hizo en este PR: toca una migración de D1, `lib/conectores.js`, `modulos/conectores.js`, el guardián, el chat de agentes, las consultas de Dimitri y la pantalla de Ajustes (escritorio y móvil): es más grande que un PR de pruebas y comparte archivos con otros carriles.

Diseño propuesto:
1. **Datos:** migración nueva (el siguiente número libre) `alter table conectores_extra add column dominios_permitidos text` (JSON, lista de hosts o `*.dominio`; vacío = como hoy). Ver `cloudflare/migraciones/0090_conectores_extra.sql`. Los conectores de secreto (`MCP_…`) no están en esa tabla: se declaran en `ajustes` o quedan sin lista (documentar).
2. **Flag apagado por defecto:** `seguridad.dominiosPorConector` (ajuste del dueño). Apagado, nada cambia. Encendido, el guardián recibe `ctx.dominios = { servidor: [hosts] }`.
3. **Guardián:** en `crearGuardian.antes`, junto a `urlAjenaEn`. Hoy «propia» = host del conector o subdominio. Con lista: propia = host del conector, sus subdominios **o** un host de la lista (`hostMatch` ya existe en `safety.mjs`; exportar una variante `urlAjenaEn(args, urlConector, extra = [])`). El motivo sigue siendo fijo (no repite la dirección). `code: 'url-ajena'` igual.
4. **Qué habilita:** un conector que SÍ lee webs (p. ej. «busca https://ejemplo.com») podrá ofrecerse en el chat con agentes y en Dimitri aunque su esquema pida una URL, **solo** si su lista no está vacía: `esquemaConUrlLibre` deja de ocultar la herramienta y el guardián obliga a que cada dirección caiga en la lista. Sin lista, todo sigue igual (se oculta).
5. **UI mínima:** en Ajustes → Conectores, campo «Dominios que puede consultar» (uno por línea) en el editor de un conector, solo administradores; validar (sin esquema, sin rutas, sin `*` solo, ≤ 20, no IPs privadas ni `localhost`). `public/nube-conectores.js` y `src/movil/vistas/conectores.js`.
6. **Pruebas:** casos del banco (`tests/fixtures/banco-ataques.mjs`) con y sin lista: host de la lista pasa, `lista.com.evil.test` no, homoglifos y `@` siguen ajenos, lista vacía = comportamiento actual; test de que el token no sale y de que un administrador es el único que edita.
7. **Riesgo:** una lista amplia reabre la exfiltración por la dirección (un dominio que el atacante controla dentro de un dominio permitido, p. ej. un servicio de subidas). Documentarlo en la pantalla: lista corta, solo dominios propios de confianza.
