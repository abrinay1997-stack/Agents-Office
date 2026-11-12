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
import { definicionesEstudio, esquemaRemoto, nuevoEstudio, prepararGasto, ESTUDIO_LEE } from '../capa1/estudio.js';

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
async function conOficina(ctx) { const { crearOficinaMcp } = await import('../capa1/oficina.js'); return crearOficinaMcp({ env: ctx.env, db: ctx.db, usuario: ctx.usuario, ahoraMs: ctx.ahoraMs }); }
const idem = (ctx, herramienta, fn) => conIdempotencia(ctx.db, { conexionId: ctx.conexion.id, herramienta, clave: ctx.claveIdempotencia, ms: ctx.ahoraMs, fn });

/* ---------- la oficina ---------- */
const ordenes = Object.entries(ACCIONES).filter(([k]) => !/^anuncio_(activar|reanudar|subir_presupuesto|relanzar)$/.test(k)).map(([k, v]) => `${k}: ${v}`).join(' | ');
/** Los campos de `ACCIONES` (oficina/mapa.mjs) que el `inputSchema` de oficina-tools.mjs no trae: sin ellos, el esquema cerrado del remoto impediría delegar a una persona o escribir en el Cerebro. */
export const CAMPOS_EXTRA_HACER = Object.freeze({
  persona: { type: 'string', maxLength: 80, description: 'mia_delegar: el nombre de una persona del equipo (en vez de dept/agent).' },
  grupo: { type: 'string', maxLength: 80, description: 'nota_crear: la carpeta del Cerebro (opcional).' },
  seccion: { type: 'string', maxLength: 120, description: 'nota_agregar: la sección a la que se añade (opcional).' },
});
const EXTRA = { hacer: ` Campos de cada tipo → ${ordenes}. Las ops que gastan en anuncios no están aquí: las confirma el dueño en dos pasos.` };
for (const t of OFICINA) {
  const lee = OFICINA_LEE.includes(t.name), cambia = OFICINA_CAMBIA.includes(t.name);
  if (OFICINA_FUERA[t.name]) continue;
  if (!lee && !cambia) throw new Error(`oficina-tools tiene una herramienta nueva sin decidir (${t.name}): añádela a OFICINA_LEE, OFICINA_CAMBIA u OFICINA_FUERA.`);
  const descripcion = String(t.description).replace(/`como_funciona` dice los campos de cada tipo\.\s*/, '') + (EXTRA[t.name] || '');
  const esquema = esquemaRemoto(t.inputSchema);
  if (t.name === 'hacer') Object.assign(esquema.properties, CAMPOS_EXTRA_HACER); // lo que ACCIONES documenta y el esquema del stdio no declara
  registrarHerramienta({
    nombre: t.name, descripcion, esquema, alcance: lee ? 'lectura' : 'oficina', soloLectura: lee,
    destructiva: lee ? false : !!t.destructiva, ...(lee ? {} : { idempotente: !!t.idempotente }),
    ejecutar: async (ctx, args) => {
      try {
        const office = await conOficina(ctx), llamar = crearLlamador({ office });
        return lee ? { texto: await llamar(t.name, args) } : await idem(ctx, t.name, async () => ({ texto: await llamar(t.name, args) }));
      } catch (e) { return fallo(t.name, e); }
    },
  });
}

/* ---------- el Estudio ---------- */
for (const d of definicionesEstudio()) {
  const lee = ESTUDIO_LEE.includes(d.nombre);
  registrarHerramienta({
    ...d,
    ejecutar: async (ctx, args) => {
      try {
        const office = await conOficina(ctx);
        if (!lee) return { texto: await prepararGasto(office, d.nombre, args) }; // paso 1: costo y topes; no genera
        const r = await nuevoEstudio(office).call(d.nombre, args); // una instancia nueva por llamada
        return { texto: typeof r === 'string' ? r : String(r?.text ?? '') };
      } catch (e) { return fallo(d.nombre, e); }
    },
  });
}
