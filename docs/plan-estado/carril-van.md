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

## VAN-06 · presupuesto por agente y por rutina, con corte duro (18 nov 2026) — HECHO

- **Lo puro, en `costs-core.mjs`** (lo comparten la oficina local y el Worker): `gastoPorDueno` (lo gastado hoy y este mes por
  cada agente y por cada rutina), `topesDe` (el tope propio de una ficha gana sobre el de la oficina), `frenosDePresupuesto`
  (→ `{ agentes: { id: motivo }, rutinas: { id: motivo } }`, el motivo en palabras con sus cifras) y `conRutinaDeTarea` (la
  rutina de cada línea: la local la guarda en la línea, la nube la saca de la tarea).
- **Los cuatro topes** son `costs.perAgentDay`, `perAgentMonth`, `perRoutineDay`, `perRoutineMonth` (Ajustes → Costos).
  **0 = sin tope**, así que una oficina que no los ponga se comporta EXACTAMENTE como antes y no lee el libro ni una vez.
- **El corte es en la COLA, antes de gastar:** `tareas/cola.mjs → planear(…, { frenados })` no arranca la tarea de un agente
  o de una rutina que se pasó (razón nueva `tope`, con su `motivo`), y `explicarCola` la cuenta aparte del tope del mes de
  toda la oficina y lo dice en palabras. El tope del mes sigue mandando sobre todo.
- **Local:** `serve.mjs` lo recalcula al apuntar cada costo (y, si nadie apunta nada, como mucho cada minuto: `/api/tasks` se
  pide cada 6 s) y avisa UNA vez por cada agente o rutina que se queda sin presupuesto (`notice`, con el motivo). La línea del
  libro lleva ahora `routine`. `GET /api/costs` devuelve `frenados` y la ventana de Costos lo enseña con el nombre del agente.
- **Nube:** `agentes/costos.js → frenos(db, cfgCosts, tareas, ahora)` y `tomarSiguiente(db, { frenados })`; el reloj lo calcula
  antes de tomar la cola (`resumen.frenados`) y `/api/costs` lo devuelve igual.
- **Tests:** `tests/costos-topes.test.mjs` (14 casos puros, incluido «sin `frenados` la cola es idéntica a la de antes») y
  `cloudflare/tests/van06-topes.test.mjs` (D1 de verdad y el reloj: una rutina que pasó su tope diario NO arranca y su motivo
  queda escrito; un agente que pasó el del mes tampoco, y el modelo no se llama; sin topes, nada cambia).
- **Lo que NO entra aquí:** el **costo por herramienta** además de por token (la otra mitad de VAN-06) y los topes propios por
  ficha de agente o de rutina en la pantalla: el núcleo ya los admite (`topesDe` con `budgetDay`/`budgetMonth`), pero ni el
  roster ni `routines.json` los piden todavía.

## VAN-03 · pendiente
- Correr el banco también en el despliegue (hoy corre dentro de `npm test` y de `check`, que ya corre en CI).
- Casos de imagen y PDF (el texto escrito dentro de una imagen no pasa por `injectionIn`: es un límite conocido de `ver_imagen`).

## `dominiosPermitidos` por conector (SEG-02) — CONSTRUIDO (30 oct 2026, rama `carril-van-dominios`, PR en borrador), APAGADO por defecto

Hecho: migración `0302_conectores_dominios.sql` (columna `dominios_permitidos` en `conectores_extra`, sin tabla nueva: no hay poda ni restablecer que añadir); `safety.mjs` (`urlAjenaEn(args, url, extra)`, `ocultaPorUrlLibre`, `normalize().dominiosPorConector`, solo el booleano `true`); `lib/conectores.js` (`validarDominios`, `dominiosDe`, `dominiosPorServidor`, `publico().dominios_permitidos`); guardián (`ctx.dominios`, gateado por el propio guardián con el interruptor); chat con agentes y consultas de Dimitri (con interruptor Y lista no vacía la herramienta con dirección se ofrece; si no, se oculta); POST `/api/conectores` (solo admin, sin el campo conserva la lista, `[]` la quita, auditado); ajuste `safety.dominiosPorConector` (Ajustes → Seguridad) y campo «Dominios que puede consultar» en escritorio (`public/nube-conectores.js`) y móvil. El interruptor se llama `safety.dominiosPorConector` (el bloque de ajustes de seguridad se llama `safety`, no `seguridad`). Tests: `tests/dominios-conector.test.mjs`, `cloudflare/tests/dominios-conector.test.mjs`. NO verificado: la pantalla en navegador (escritorio y móvil) ni un conector real que lea webs; el ejecutor de tareas (`ejecutor.js`) nunca tuvo `ctx.urls`, así que no aplica `url-ajena` (igual que antes). Los conectores de secreto (`MCP_…`) sí tienen fila en `conectores`/`conectores_extra` y pueden llevar lista. Abajo, el diseño original:

Por qué no se hizo en este PR: toca una migración de D1, `lib/conectores.js`, `modulos/conectores.js`, el guardián, el chat de agentes, las consultas de Dimitri y la pantalla de Ajustes (escritorio y móvil): es más grande que un PR de pruebas y comparte archivos con otros carriles.

Diseño propuesto:
1. **Datos:** migración nueva (el siguiente número libre) `alter table conectores_extra add column dominios_permitidos text` (JSON, lista de hosts o `*.dominio`; vacío = como hoy). Ver `cloudflare/migraciones/0090_conectores_extra.sql`. Los conectores de secreto (`MCP_…`) no están en esa tabla: se declaran en `ajustes` o quedan sin lista (documentar).
2. **Flag apagado por defecto:** `seguridad.dominiosPorConector` (ajuste del dueño). Apagado, nada cambia. Encendido, el guardián recibe `ctx.dominios = { servidor: [hosts] }`.
3. **Guardián:** en `crearGuardian.antes`, junto a `urlAjenaEn`. Hoy «propia» = host del conector o subdominio. Con lista: propia = host del conector, sus subdominios **o** un host de la lista (`hostMatch` ya existe en `safety.mjs`; exportar una variante `urlAjenaEn(args, urlConector, extra = [])`). El motivo sigue siendo fijo (no repite la dirección). `code: 'url-ajena'` igual.
4. **Qué habilita:** un conector que SÍ lee webs (p. ej. «busca https://ejemplo.com») podrá ofrecerse en el chat con agentes y en Dimitri aunque su esquema pida una URL, **solo** si su lista no está vacía: `esquemaConUrlLibre` deja de ocultar la herramienta y el guardián obliga a que cada dirección caiga en la lista. Sin lista, todo sigue igual (se oculta).
5. **UI mínima:** en Ajustes → Conectores, campo «Dominios que puede consultar» (uno por línea) en el editor de un conector, solo administradores; validar (sin esquema, sin rutas, sin `*` solo, ≤ 20, no IPs privadas ni `localhost`). `public/nube-conectores.js` y `src/movil/vistas/conectores.js`.
6. **Pruebas:** casos del banco (`tests/fixtures/banco-ataques.mjs`) con y sin lista: host de la lista pasa, `lista.com.evil.test` no, homoglifos y `@` siguen ajenos, lista vacía = comportamiento actual; test de que el token no sale y de que un administrador es el único que edita.
7. **Riesgo:** una lista amplia reabre la exfiltración por la dirección (un dominio que el atacante controla dentro de un dominio permitido, p. ej. un servicio de subidas). Documentarlo en la pantalla: lista corta, solo dominios propios de confianza.

## VAN-03 · carril 2 (30 oct 2026): cerrado el hueco de `\n`/`\t` escapados
- `safety.mjs → injectionIn` prueba UNA forma más (normalizada y sin tildes, una sola pasada extra) con `\n`, `\r` y `\t` literales cambiados por espacio (solo si el texto los trae; lo demás igual). Cierra `tool-07` y `tool-08`; se añadieron `tool-09..11` (ataques que SÍ fallan contra main: dependen de la frontera `\b` y de la forma escapada) y `ok-41..43` (rutas de Windows, código y JSON inocente).
- Antes/después: ataques 58/76 (76 %) → 63/79 (80 %); inocentes bloqueados 4/40 → 4/43 (los mismos 4, sin falsos positivos nuevos); falsos negativos 18 → 16.
- Rendimiento (200 KB, node, ms por llamada, main → rama): `\n` repetidos 2,1 → 5,0; JSON con muchos `\n`/`\t` 3,1 → 6,0; texto sin barras 4,9 → 5,0. Con una sola forma extra el costo es de pocos ms; con las tres formas del primer intento era 2,2→5,4 y 3,1→7,7.
