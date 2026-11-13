// El registro de herramientas del conector MCP. Hoy lleva UNA (`como_funciona`); las de dominio llegan en la P3+ y cada carril añade SU archivo en lib/mcp/dominios/ sin tocar el servidor.
//
// EL CONTRATO de una herramienta (`registrarHerramienta`):
//   { dominio, nombre, titulo?, descripcion, esquema, alcance, soloLectura, destructiva?, idempotente?, ejecutar }
//   · `esquema`: JSON Schema de los argumentos (type: 'object'). Una herramienta de dominio declara su `accion` como un `enum` cerrado.
//   · `alcance`: el MÍNIMO que hace falta — 'lectura' | 'oficina' | 'gasto'. `soloLectura: true` ⇔ alcance 'lectura' (y es la ÚNICA que un token de alcance «lectura» puede llamar).
//   · `destructiva` (borra o sobrescribe sin poder volver) e `idempotente` (repetirla da lo mismo): van como anotaciones MCP. Una solo-lectura es idempotente y no destructiva.
//   · `ejecutar(ctx, args)` → texto, o { texto, siguiente?, estructurado? }. ctx = { db, env, usuario, conexion, ahoraMs, claveIdempotencia }.
//       – Salida: el servidor corta en TOPE_SALIDA (20.000) caracteres. Una herramienta que pagina recibe `cursor` (texto opaco, ≤ 200) en `args` y devuelve `siguiente` (el cursor de la página
//         que sigue) cuando queda más: el servidor lo agrega al final del texto («siguiente: …») y en structuredContent.
//       – Todo lo que devuelve pasa por safety.injectionIn antes de llegar al modelo (texto de terceros: notas, comentarios, resultados de agentes…): con órdenes escondidas no se muestra.
//       – Escrituras futuras: al esquema de TODA herramienta que escribe se le añade `clave_idempotencia` (opcional, 8–64 de [A-Za-z0-9_-]); el servidor la valida y la pasa en ctx.claveIdempotencia
//         para que la herramienta la respete (repetir la misma clave no repite el efecto).
//
// LA REGLA DEL DINERO (no negociable, mcp-dinero.test.mjs): un token de MCP NUNCA canjea un testigo de gasto. El alcance `gasto` solo permitirá, en fases futuras, PREPARAR un gasto (el paso 1: la cifra y los
// topes, que deja una tarjeta «espera tu OK» en la oficina y en Telegram); el paso 2 lo da una persona en la oficina o en Telegram. Por eso el registro NO admite una herramienta que canjee un testigo,
// ni un argumento que lo lleve (`confirmacion`, `testigo`, `token`, `confirm`, `ok`…),
// ni un objeto raíz abierto (lista blanca: `additionalProperties: false`), ni una herramienta de alcance `gasto` que no declare `soloPrepara: true`, ni nombres que suenen a aprobar, enviar, publicar o pagar. Hoy no hay ninguna herramienta que gaste.
import { ALCANCES } from './constantes.js';

export const PROPIEDADES_PROHIBIDAS = Object.freeze(['confirmacion', 'confirmation', 'testigo', 'token_confirmacion', 'confirm_token', 'confirmar_gasto', 'canjear', 'token_de_gasto', 'spend_token', 'token', 'confirm', 'ok']);
const NOMBRE_PROHIBIDO = /(aprobar|aprueba|canjear|canjea|confirmar_gasto|enviar|publicar|pagar|restablecer|borrar_cuenta|gastar|activar|reanudar|relanzar|subir_presupuesto)/;
const NOMBRE_OK = /^[a-z][a-z0-9_]{2,47}$/;
const DOMINIO_OK = /^[a-z][a-z0-9_]{1,30}$/;
export const CLAVE_IDEMPOTENCIA = /^[A-Za-z0-9_-]{8,64}$/;

/** Todas las claves de un esquema, a cualquier profundidad (una propiedad prohibida escondida dentro de otra no pasa). */
function clavesDe(x, acc = new Set(), prof = 0) {
  if (!x || typeof x !== 'object' || prof > 12) return acc;
  for (const [k, v] of Object.entries(x)) { acc.add(String(k).toLowerCase()); clavesDe(v, acc, prof + 1); }
  return acc;
}

export function crearRegistro() {
  const mapa = new Map();
  function registrar(def) {
    const d = def || {};
    const falla = (m) => { throw new Error(`herramienta MCP «${d.nombre ?? '?'}»: ${m}`); };
    if (typeof d.nombre !== 'string' || !NOMBRE_OK.test(d.nombre)) falla('el nombre debe ser minúsculas, números y «_» (3 a 48).');
    if (NOMBRE_PROHIBIDO.test(d.nombre)) falla('el nombre suena a aprobar, enviar, publicar o pagar: eso se hace en la oficina, nunca por MCP.');
    if (typeof d.dominio !== 'string' || !DOMINIO_OK.test(d.dominio)) falla('falta `dominio` (el archivo de lib/mcp/dominios/ que la registra: capa1, tareas, cerebro…): las pruebas y los presupuestos agrupan por él, sin listas a mano.');
    if (mapa.has(d.nombre)) falla('ya hay una herramienta con ese nombre.');
    if (typeof d.descripcion !== 'string' || d.descripcion.length < 10 || d.descripcion.length > 4000) falla('la descripción debe tener entre 10 y 4.000 letras.');
    if (!d.esquema || d.esquema.type !== 'object' || typeof d.esquema.properties !== 'object' || d.esquema.properties === null) falla('el esquema debe ser un objeto con `properties`.');
    if (!ALCANCES.includes(d.alcance)) falla('el alcance debe ser lectura, oficina o gasto.');
    if (typeof d.soloLectura !== 'boolean') falla('falta `soloLectura` (verdadero o falso).');
    if (d.soloLectura !== (d.alcance === 'lectura')) falla('`soloLectura` y el alcance «lectura» van juntos: la única herramienta que un token de lectura puede llamar es la de solo lectura.');
    if (d.destructiva !== undefined && typeof d.destructiva !== 'boolean') falla('`destructiva` es verdadero o falso.');
    if (d.soloLectura && d.destructiva) falla('una herramienta de solo lectura no puede ser destructiva.');
    if (typeof d.ejecutar !== 'function') falla('falta `ejecutar`.');
    if (d.esquema.additionalProperties !== false) falla('el esquema debe llevar `additionalProperties: false` en el objeto raíz: sin eso entra un argumento que nadie revisó (lista blanca).');
    if (d.alcance === 'gasto' && d.soloPrepara !== true) falla('una herramienta de alcance «gasto» debe declarar `soloPrepara: true`: solo PREPARA el gasto; el paso 2 es de una persona.');
    if (d.canjeaGasto || d.canjeaTestigo) falla('ninguna herramienta MCP canjea un testigo de gasto: el segundo paso del dinero lo da una persona en la oficina o en Telegram.');
    const prohibidas = [...clavesDe(d.esquema)].filter((k) => PROPIEDADES_PROHIBIDAS.includes(k));
    if (prohibidas.length) falla(`el esquema lleva «${prohibidas[0]}»: un token de MCP no manda ni recibe el testigo de un gasto.`);
    const esquema = JSON.parse(JSON.stringify(d.esquema));
    const dice = 'Opcional: una clave única (8 a 64 letras, números, «-» o «_») para que repetir esta misma llamada no repita el efecto.';
    if (!d.soloLectura && !esquema.properties.clave_idempotencia) esquema.properties.clave_idempotencia = { type: 'string', pattern: CLAVE_IDEMPOTENCIA.source, description: dice };
    const h = Object.freeze({
      soloPrepara: d.soloPrepara === true, dominio: d.dominio, nombre: d.nombre, titulo: String(d.titulo || d.nombre), descripcion: d.descripcion,
      esquema, alcance: d.alcance, soloLectura: d.soloLectura, destructiva: d.destructiva === true, idempotente: d.idempotente ?? d.soloLectura, ejecutar: d.ejecutar ,
    });
    mapa.set(h.nombre, h);
    return h;
  }
  return { registrar, lista: () => [...mapa.values()], buscar: (n) => mapa.get(n) || null, deDominio: (...ds) => [...mapa.values()].filter((h) => ds.includes(h.dominio)) };
}

/** El registro del Worker: lo llenan los módulos de lib/mcp/base/ y lib/mcp/dominios/ al importarse. */
export const REGISTRO = crearRegistro();
export const registrarHerramienta = (def) => REGISTRO.registrar(def);
export const herramientas = () => REGISTRO.lista();
export const herramienta = (n) => REGISTRO.buscar(n);
/** Las herramientas de uno o más dominios (p. ej. `herramientasDe('capa1', 'base')`): lo que usan las pruebas en vez de listas de nombres. */
export const herramientasDe = (...dominios) => REGISTRO.deDominio(...dominios);
