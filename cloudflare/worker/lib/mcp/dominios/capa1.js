// CAPA 1 del conector remoto (P3b, plan MCP §2 y §14): las herramientas finas de la OFICINA (oficina-tools.mjs) y del ESTUDIO (estudio-tools.mjs), las mismas del stdio, adaptadas al registro.
// Qué se sirve y qué no (y por qué) está escrito aquí, en datos, y lo comprueba cloudflare/tests/mcp-capa1.test.mjs:
//   · SERVIDAS de la oficina: estado_oficina, ver_calendario (lectura) · crear_tarea, crear_mi_tarea, hacer, deshacer, hablar_con_dimitri (oficina).
//   · SERVIDAS del Estudio: 5 de lectura y 6 que gastan, que aquí solo PREPARAN (alcance «gasto», `soloPrepara`): ver capa1/estudio.js.
//   · FUERA de la oficina (§14.10, superficie remota ligera): las que duplican una herramienta de DOMINIO de la P5 — `OFICINA_FUERA` dice cuál la sustituye. `como_funciona` ya la sirve la P2.
//   · `hacer` nunca ejecuta las 4 ops de gasto de anuncios (sub.OPS_GASTO): ni están en su enum ni las deja pasar el atajo (capa1/oficina.js). Nada aprueba, envía, publica ni paga.
// Cada llamada arma SU `office` en proceso con la persona del token (capa1/oficina.js) y SU instancia del Estudio; nada se comparte entre llamadas. Un fallo esperado (la ruta contestó un error, una op vetada)
// vuelve como TEXTO claro («No se pudo: …») y no como el genérico «falló por dentro» del servidor; lo inesperado se registra con console.error.
import { TOOLS as OFICINA, crearLlamador } from '../../../../../oficina-tools.mjs';
import { ACCIONES } from '../../../../../oficina/mapa.mjs';
import { registrarHerramienta } from '../registro.js';
import { limpiarSecretos } from '../../secretos.js';
import { conIdempotencia } from '../capa1/idempotencia.js';
import { restringir } from '../capa1/restringir.js';
import { OPS_FUERA_HACER } from '../capa1/oficina.js';
import { definicionesEstudio, esquemaRemoto, nuevoEstudio, evaluarGasto, ESTUDIO_LEE } from '../capa1/estudio.js';
import { crearSolicitud, VENCE_MS } from '../gasto.js';

const OFICINA_LEE = ['estado_oficina', 'ver_calendario'];
const OFICINA_CAMBIA = ['crear_tarea', 'crear_mi_tarea', 'hacer', 'deshacer', 'hablar_con_dimitri'];
export const OFICINA_FUERA = Object.freeze({
  como_funciona: 'La P2 ya sirve «como_funciona» (mapa, guía y reglas de ESTE conector).',
  ver_tareas: 'Duplica la herramienta de dominio `tareas` (acción ver) de la P5.', ver_tarea: 'Duplica `tareas` (acción ver) de la P5.', ver_agenda: 'Duplica `tareas` (acción agenda) de la P5.',
  ver_mis_tareas: 'Duplica `tareas` (acción mias) de la P5.', ver_rutinas: 'Duplica `tareas` (acción rutinas) de la P5.',
  ver_contenido: 'Duplica la herramienta de dominio `contenido` de la P5.', ver_resultados: 'Duplica `contenido` (acción resultados) de la P5.', ver_huecos: 'Duplica `contenido` (acción huecos) de la P5.',
  ver_analiticas: 'Duplica `contenido` (acción analiticas) de la P5.', ver_anuncios: 'Duplica la herramienta de dominio `anuncios` de la P5.',
});
/** Las rutas /api/ que esta capa toca (las de la oficina las atiende capa1/oficina.js en proceso). Para el test de cobertura de la P7. */
export const RUTAS = Object.freeze([
  'GET /api/oficina/estado', 'GET /api/oficina/calendario', 'POST /api/oficina/accion', 'POST /api/oficina/deshacer', 'POST /api/tasks', 'POST /api/tareas/mias', 'POST /api/sub/chat',
  'GET /api/media', 'GET /api/media/presets', 'POST /api/media/presets/compile', 'GET /api/media/models', 'GET /api/media/jobs/:id', 'GET /api/media/lotes/:id',
]);

/** Un fallo esperado se vuelve texto claro; lo inesperado, además, se registra. Nunca lleva un secreto. */
function fallo(nombre, e) {
  console.error(`[mcp:capa1] ${nombre}:`, e?.message ?? e);
  return { texto: `No se pudo: ${limpiarSecretos(String(e?.message || e)).replace(/\s+/g, ' ').slice(0, 300)}`, esError: true };
}
/** `permitidas`: lo que ESA herramienta puede pedirle a la oficina (ver capa1/restringir.js). */
async function conOficina(ctx, permitidas) {
  const { crearOficinaMcp } = await import('../capa1/oficina.js');
  return restringir(await crearOficinaMcp({ env: ctx.env, db: ctx.db, usuario: ctx.usuario, ahoraMs: ctx.ahoraMs }), permitidas);
}
/** Qué puede pedir cada herramienta de la oficina: las lecturas, solo GET; las escrituras, solo el POST que usan. */
export const PERMITIDAS = Object.freeze({
  estado_oficina: ['GET'], ver_calendario: ['GET'], crear_tarea: ['POST /api/tasks'], crear_mi_tarea: ['POST /api/tareas/mias'],
  hacer: ['POST /api/oficina/accion'], deshacer: ['POST /api/oficina/deshacer'], hablar_con_dimitri: ['POST /api/sub/chat'],
});
/** La tarea que crea un asistente nace con la marca `by: 'mcp'` (el servidor de tareas no la admite en el cuerpo): se apunta después, sobre la fila. */
async function marcarOrigen(db, texto) {
  const id = /Tarea creada: (\S+)/.exec(texto)?.[1];
  if (id) { try { await db.prepare("update filas set json = json_set(json, '$.by', 'mcp') where coleccion = 'tareas' and id = ?").bind(id).run(); } catch (e) { console.warn('[mcp:capa1] no se pudo marcar el origen:', e?.message ?? e); } }
}
const idem = (ctx, herramienta, fn) => conIdempotencia(ctx.db, { conexionId: ctx.conexion.id, herramienta, clave: ctx.claveIdempotencia, ms: ctx.ahoraMs, fn });

/* ---------- la oficina ---------- */
const ordenes = Object.entries(ACCIONES).filter(([k]) => !/^anuncio_(activar|reanudar|subir_presupuesto|relanzar)$/.test(k) && !OPS_FUERA_HACER[k]).map(([k, v]) => `${k}: ${v}`).join(' | ');
/** Los campos de `ACCIONES` (oficina/mapa.mjs) que el `inputSchema` de oficina-tools.mjs no trae: sin `persona`, el esquema cerrado del remoto impediría delegar a una persona del equipo. */
export const CAMPOS_EXTRA_HACER = Object.freeze({
  persona: { type: 'string', maxLength: 80, description: 'mia_delegar: el nombre de una persona del equipo (en vez de dept/agent).' },
});
const EXTRA = { hacer: ` Campos de cada tipo → ${ordenes}. Las ops que gastan en anuncios no están aquí: las confirma el dueño en dos pasos. Tampoco ${Object.keys(OPS_FUERA_HACER).join(', ')}: se hacen en la oficina. rutina_editar solo cambia el horario o la pausa.` };
for (const t of OFICINA) {
  const lee = OFICINA_LEE.includes(t.name), cambia = OFICINA_CAMBIA.includes(t.name);
  if (OFICINA_FUERA[t.name]) continue;
  if (!lee && !cambia) throw new Error(`oficina-tools tiene una herramienta nueva sin decidir (${t.name}): añádela a OFICINA_LEE, OFICINA_CAMBIA u OFICINA_FUERA.`);
  const descripcion = String(t.description).replace(/`como_funciona` dice los campos de cada tipo\.\s*/, '') + (EXTRA[t.name] || '');
  const esquema = esquemaRemoto(t.inputSchema);
  if (t.name === 'hacer') { // lo que ACCIONES documenta y el stdio no declara; y fuera lo que se hace en la oficina (OPS_FUERA_HACER)
    Object.assign(esquema.properties, CAMPOS_EXTRA_HACER);
    esquema.properties.type = { ...esquema.properties.type, enum: esquema.properties.type.enum.filter((o) => !OPS_FUERA_HACER[o]) };
  }
  registrarHerramienta({
    nombre: t.name, descripcion, esquema, alcance: lee ? 'lectura' : 'oficina', soloLectura: lee,
    destructiva: lee ? false : !!t.destructiva, ...(lee ? {} : { idempotente: !!t.idempotente }),
    ejecutar: async (ctx, args) => {
      try {
        const office = await conOficina(ctx, PERMITIDAS[t.name]), llamar = crearLlamador({ office });
        // «[vía MCP]»: lo que un asistente le dice a Dimitri se distingue de lo que escribió la persona (el mensaje ya va firmado con su cuenta)
        const a = t.name === 'hablar_con_dimitri' ? { ...args, texto: `[vía MCP] ${args.texto}` } : args;
        const hacerla = async () => { const texto = await llamar(t.name, a); if (t.name === 'crear_tarea') await marcarOrigen(ctx.db, texto); return { texto }; };
        return lee ? { texto: await llamar(t.name, args) } : await idem(ctx, t.name, hacerla);
      } catch (e) { return fallo(t.name, e); }
    },
  });
}

/* ---------- el Estudio ---------- */
const dinero = (n) => `US$${(+n || 0).toFixed(2).replace('.', ',')}`;
// El paso 1 del dinero (P4, plan MCP §14.2): calcula la cifra EL SERVIDOR y deja una tarjeta para el dueño. No genera ni gasta: eso es del paso 2 de una persona (gasto.js).
async function abrirTarjeta(ctx, office, nombre, args0) {
  const { clave_idempotencia: _c, ...args } = args0 || {}; // la clave de idempotencia no es parte de lo pedido (ni de su huella)
  const ev = await evaluarGasto(office, nombre, args), cuerpo = ev.texto.split('\nSegundo paso:')[0];
  if (ev.error || !ev.cabe) return `${cuerpo}\nNo se abrió ninguna tarjeta: ${ev.error ? 'lo pedido no se puede hacer así.' : 'no cabe dentro de los topes de hoy.'} Este conector no genera ni gasta.`;
  const r = await crearSolicitud(ctx.db, { conexion: ctx.conexion, usuario: ctx.usuario, ms: ctx.ahoraMs, herramienta: nombre, args, ev });
  if (r.limite) return `${r.limite}\nNo se abrió ninguna tarjeta. Este conector no genera ni gasta.`;
  const t = r.tarjeta || r.repetida, horas = Math.round(VENCE_MS / 3600e3);
  return `${cuerpo}\n${r.repetida ? 'Esta misma petición ya tiene una tarjeta esperando (no abrí otra)' : 'Dejé una tarjeta «espera tu OK»'}: ${t.id}. El dueño la ve en la oficina (Ajustes → Conectar Claude) y en Telegram, `
    + `con la cifra exacta (${ev.usd ? dinero(ev.usd) : 'gratis'}) y los topes; vence en ${horas} h. `
    + 'Solo una persona la aprueba y la oficina vuelve a mirar los topes al ejecutar. Este conector no genera ni gasta: no esperes el resultado aquí.';
}
for (const d of definicionesEstudio()) {
  const lee = ESTUDIO_LEE.includes(d.nombre);
  registrarHerramienta({
    ...d,
    ejecutar: async (ctx, args) => {
      try {
        const office = await conOficina(ctx, lee ? ['GET'] : ['GET', 'POST /api/media/presets/compile']);
        if (!lee) return await idem(ctx, d.nombre, async () => ({ texto: await abrirTarjeta(ctx, office, d.nombre, args) })); // paso 1: costo, topes y una TARJETA «espera tu OK»; no genera
        const r = await nuevoEstudio(office).call(d.nombre, args); // una instancia nueva por llamada
        return { texto: typeof r === 'string' ? r : String(r?.text ?? '') };
      } catch (e) { return fallo(d.nombre, e); }
    },
  });
}
