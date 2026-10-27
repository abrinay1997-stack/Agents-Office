// «Actualizar conexiones» del Cerebro (27 oct 2026): un botón que se pulsa a mano (nada corre en vivo) y limpia el mapa de lo que dejó una nota borrada y conecta las notas nuevas.
//   GET  /api/brain/actualizar                                     → qué hay que limpiar, qué notas se podrían conectar con IA, qué parejas usaron juntas los agentes (`porUso`), con qué modelo y cuánto costaría (no llama a la IA ni escribe)
//   POST /api/brain/actualizar { paso: 'proponer', notas: [nombre] }  → los enlaces que la IA propone para esas notas (como mucho 3 por llamada; no escribe)
//   POST /api/brain/actualizar { paso: 'aplicar', conexiones: [{ nota, rev, enlaces: [{ a, porque }] }], revisadas: [{ nota, rev }], origen?: 'uso' } → escribe lo aceptado («## Relacionadas» al final de la nota nueva),
//        limpia el mapa y la memoria. `rev` es la versión de la nota que se leyó: si alguien la editó, no se escribe. Con `origen: 'uso'` (parejas que los agentes usaron juntas) no se toca la cola de la IA.
//   POST /api/brain/actualizar { paso: 'deshacer', cambios: [...] } → quita lo que acaba de añadir «aplicar» (nota por nota, solo si nadie la editó después)
//   POST /api/brain/actualizar { paso: 'calidad' } → duplicados y contradicciones entre notas (gratis, sin escribir) · { paso: 'calidad-ia', claves } → la IA confirma hasta 3 contradicciones · { paso: 'calidad-ignorar', claves } → «ya lo revisé». Ver lib/cerebro-calidad.js.
//   POST /api/brain/actualizar { paso: 'mapa' } → recalcula el mapa ENTERO con graph-core.mjs (todas las neuronas pueden moverse; guarda el anterior) · { paso: 'mapa-deshacer' } → vuelve al anterior. Ver lib/cerebro-mapa.js.
// SOLO un administrador (gasta en la IA y escribe en las notas). Las notas de fábrica y las clave nunca se escriben. Todo en lib/conexiones.js.
import { json, error, prohibido } from '../lib/respuesta.js';
import { estadoConexiones, proponerConexiones, aplicarConexiones, deshacerConexiones, todasLasNotas, nombresDeFabrica, modeloDe, usdDe } from '../lib/conexiones.js';
import { revisarCalidad, confirmarConIA, ignorarAvisos, MAX_IA } from '../lib/cerebro-calidad.js';
import { leerCfg } from '../lib/ajustes.js';
import { leerGrafo } from '../lib/cerebro.js';
import { recalcularMapa, deshacerMapa, estadoMapaCompleto } from '../lib/cerebro-mapa.js';
import { tasa, relojDe } from '../lib/equipo.js';

export const nombre = 'conexiones';
export const grupos = [];
export const rutasExtra = ['/api/brain/actualizar'];

const quien = (u) => String(u?.nombre || u?.email || 'alguien').slice(0, 80);

export async function manejar(ctx) {
  const { req, env, db, ruta, usuario } = ctx;
  if (ruta !== '/api/brain/actualizar') return null;
  if (usuario.rol !== 'admin') return prohibido('Actualizar las conexiones del Cerebro es de un administrador.');
  if (req.method === 'GET') return json({ ...(await estadoConexiones({ env, db })), mapaCompleto: await estadoMapaCompleto(db) });
  if (req.method !== 'POST') return json({ error: 'GET o POST' }, 405);
  const b = (await ctx.cuerpo(req)) || {};
  if (b.paso === 'proponer') {
    if (!(await tasa(db, 'cx:ia:' + usuario.id, 12, relojDe(env))).ok) return error('Vas muy rápido: espera un minuto y sigue.', 429);
    const r = await proponerConexiones({ env, db, nombres: b.notas, fetchFn: env.__pruebas?.fetch });
    return r.error ? error(r.error, r.estado || 400) : json(r);
  }
  if (b.paso === 'aplicar') { const r = await aplicarConexiones({ env, db, conexiones: b.conexiones, revisadas: b.revisadas, por: quien(usuario), origen: b.origen === 'uso' ? 'uso' : 'ia' }); return json({ ...r, graph: await leerGrafo(db) }); }
  if (b.paso === 'deshacer') { const r = await deshacerConexiones({ db, cambios: b.cambios, por: quien(usuario) }); return json({ ...r, graph: await leerGrafo(db) }); }
  if (b.paso === 'mapa' || b.paso === 'mapa-deshacer') { // recalcular el mapa ENTERO (cerebro-mapa.js): mueve todas las neuronas; el anterior se guarda para volver
    if (!(await tasa(db, 'cx:mapa:' + usuario.id, 4, relojDe(env))).ok) return error('Vas muy rápido: espera un minuto y sigue.', 429);
    const r = b.paso === 'mapa' ? await recalcularMapa({ db, por: quien(usuario) }) : await deshacerMapa({ db, por: quien(usuario) });
    return r.error ? error(r.error, r.estado || 400) : json({ ...r, graph: await leerGrafo(db) });
  }
  if (b.paso === 'calidad' || b.paso === 'calidad-ia' || b.paso === 'calidad-ignorar') { // duplicados y contradicciones entre notas (cerebro-calidad.js): buscar es gratis; la IA confirma con tu clic; «ya lo revisé» lo apunta
    if (b.paso === 'calidad-ignorar') { const r = await ignorarAvisos({ db, claves: b.claves }); return r.error ? error(r.error, r.estado || 400) : json(r); }
    if (!(await tasa(db, (b.paso === 'calidad' ? 'cx:cal:' : 'cx:ia:') + usuario.id, b.paso === 'calidad' ? 6 : 12, relojDe(env))).ok) return error('Vas muy rápido: espera un minuto y sigue.', 429);
    const [filas, fabrica] = await Promise.all([todasLasNotas(db), nombresDeFabrica(env)]), esFabrica = (n) => fabrica.has(n);
    const modelo = await modeloDe(env, db);
    if (b.paso === 'calidad') {
      const r = await revisarCalidad({ db, filas, esFabrica }), n = Math.min(r.contradicciones.filter((c) => c.accionable).length, MAX_IA), cfg = await leerCfg(db);
      return json({ ok: true, ...r, ia: { modelo: modelo.nombre, conClave: modelo.conClave, secreto: modelo.conClave ? null : modelo.secreto, n, usd: n ? usdDe(modelo.id, n * 700, n * 80, cfg.costs?.prices) : 0 } });
    }
    if (!modelo.conClave) return error(`Falta el secreto ${modelo.secreto} en Cloudflare para usar ${modelo.nombre}. Elige otro modelo en Ajustes → Modelos (función «Conectar notas del Cerebro»).`, 409);
    const r = await confirmarConIA({ env, db, claves: b.claves, filas, esFabrica, fetchFn: env.__pruebas?.fetch, usdDe: (e, sa, precios) => usdDe(modelo.id, e, sa, precios) });
    return r.error ? error(r.error, r.estado || 400) : json({ ...r, modelo: modelo.nombre });
  }
  return error('Dime el paso: proponer, aplicar, deshacer, mapa, mapa-deshacer, calidad, calidad-ia o calidad-ignorar.', 400);
}
