// Fase 6 — Negocio en la nube: «Cómo va el negocio» (los indicadores del dueño), las cifras de la empresa, la voz de marca, subir un documento al Cerebro, las notas por
// revisar y «Preparar desde mi web». Las MISMAS rutas y formas que serve.mjs:
//   GET /api/business · POST /api/business/kpi · POST /api/business/value · POST /api/kpi/<id> (público, con AO_HOOK_TOKEN)
//   GET|POST /api/cifras · GET|POST /api/voice · POST /api/brain/upload · GET /api/brain/stale · POST /api/onboard/company
// El cron de cada minuto hace dos cosas: lee las líneas «KPI ventas_semana = 1.250» de lo que los agentes terminaron (y las apunta) y, cada hora, mira qué notas están viejas.
//
// REGLAS (los tests las muerden):
//  · Escribir (indicadores, cifras, voz, documentos, el arranque) es de un administrador. Leer, de cualquiera con sesión.
//  · El webhook de un indicador es PÚBLICO y por eso: el secreto AO_HOOK_TOKEN se comprueba ANTES de abrir nada (sin él, 401 y D1 intacta), el cuerpo tiene tope y hay un tope por minuto.
//  · Un valor solo se apunta a un indicador que el dueño YA definió (nada se inventa) y tiene que ser un número.
import { json, error, prohibido } from '../lib/respuesta.js';
import * as business from '../../../business.mjs';
import * as documents from '../../../documents-core.mjs';
import * as knowledge from '../../../knowledge.mjs';
import { leerCfg } from '../lib/ajustes.js';
import { leerKpis, registrarKpi, cambiarKpi, panelNegocio, leerCifras, guardarCifras, leerVoz, guardarVoz } from '../lib/negocio.js';
import { tokenValido, tokenDe, tasaPublica, leerConTope } from '../lib/publica.js';
import { guardarNotas } from '../lib/cerebro.js';
import { leerDoc, guardarDoc } from '../lib/almacen.js';
import { leerContexto } from '../lib/tareas/contexto.js';
import { prepararEmpresa } from '../lib/arranque.js';

export const nombre = 'negocio';
export const grupos = ['business', 'kpi', 'cifras', 'voice', 'onboard'];
export const rutasExtra = ['/api/brain/upload', '/api/brain/stale'];

const MAX_KPI_BYTES = 16 * 1024, MAX_KPI_POR_MINUTO = 60;
const MAX_DOC_BASE64 = 22 * 1024 * 1024; // lo que pesa en JSON un archivo de 15 MB

/* ---------- el webhook de un indicador (público, con su propio secreto) ---------- */
export async function publica({ req, env, db, url, ruta }) {
  const m = /^\/api\/kpi\/([a-z][a-z0-9_]{1,40})$/.exec(ruta);
  if (!m) return null;
  if (req.method !== 'POST') return json({ error: 'POST' }, 405);
  // 1) el secreto, antes de nada: sin él no se abre el cuerpo ni se toca D1
  if (!tokenValido(tokenDe(req, url), env.AO_HOOK_TOKEN)) return json({ error: 'token incorrecto o falta AO_HOOK_TOKEN' }, 401);
  // 2) un tope por minuto
  if (!(await tasaPublica(db, 'kpi', MAX_KPI_POR_MINUTO)).ok) return json({ error: `demasiadas peticiones por minuto (${MAX_KPI_POR_MINUTO})` }, 429);
  // 3) el cuerpo, con tope
  const txt = await leerConTope(req, MAX_KPI_BYTES);
  if (txt === null) return json({ error: 'el cuerpo pasa de 16 KB' }, 413);
  let b = {}; if (txt.trim()) { try { b = JSON.parse(txt); } catch { b = {}; } }
  const r = await registrarKpi(db, m[1], b?.value ?? url.searchParams.get('value'), 'webhook');
  return json(r, r.error ? 400 : 200);
}

export async function manejar(ctx) {
  const { req, env, db, ruta, usuario } = ctx, metodo = req.method;
  const escribe = metodo !== 'GET' && metodo !== 'HEAD';
  const g = ruta.match(/^\/api\/([a-zA-Z0-9_.-]+)/)?.[1];
  const mio = grupos.includes(g) || rutasExtra.includes(ruta);
  if (!mio) return null;
  if (escribe && usuario.rol !== 'admin') return prohibido('Solo un administrador cambia esto (indicadores, cifras, voz, documentos).');

  if (ruta === '/api/business' && metodo === 'GET') return json(await panelNegocio(db, await leerCfg(db), env));
  if (ruta === '/api/business/kpi' && metodo === 'POST') {
    const b = (await ctx.cuerpo(req)) || {};
    const r = await cambiarKpi(db, b);
    return json(r, r.error ? 400 : 200);
  }
  if (ruta === '/api/business/value' && metodo === 'POST') {
    const b = (await ctx.cuerpo(req)) || {};
    const r = await registrarKpi(db, String(b.id || ''), b.value, 'a mano');
    return json(r, r.error ? 400 : 200);
  }
  if (ruta === '/api/cifras') {
    if (metodo === 'GET') return json({ items: await leerCifras(db), path: 'cifras (en la nube)' });
    if (metodo === 'POST') { const b = (await ctx.cuerpo(req)) || {}; return json({ ok: true, items: await guardarCifras(db, b.items) }); }
  }
  if (ruta === '/api/voice') {
    if (metodo === 'GET') { const v = await leerVoz(db); return json({ text: v?.texto || '', path: 'nota «voice» del Cerebro' }); }
    if (metodo === 'POST') {
      const b = (await ctx.cuerpo(req)) || {}, t = String(b.text || '').trim();
      if (!t) return json({ error: 'la voz de marca quedó vacía' }, 400);
      await guardarVoz(db, t); return json({ ok: true });
    }
  }
  if (ruta === '/api/brain/stale' && metodo === 'GET') return json({ notes: await notasPorRevisar(db) });
  if (ruta === '/api/brain/upload' && metodo === 'POST') return subirDocumento(ctx);
  if (ruta === '/api/onboard/company' && metodo === 'POST') return arranque(ctx);
  return null;
}

/* ---------- un documento al Cerebro ---------- */
async function subirDocumento(ctx) {
  const { req, db } = ctx;
  const largo = Number(req.headers.get('content-length') || 0);
  if (largo > MAX_DOC_BASE64) return json({ error: 'el archivo pasa de 15 MB' }, 413);
  const b = (await ctx.cuerpo(req)) || {};
  const name = String(b.name || '').replace(/^.*[\\/]/, '').slice(0, 200), data = String(b.data || '');
  if (data.length > MAX_DOC_BASE64) return json({ error: 'el archivo pasa de 15 MB' }, 413);
  const k = documents.kindOf(name);
  if (!k) return json({ error: 'ese tipo de archivo no se puede leer: usa un PDF, un Word (.docx), un Excel (.xlsx), un CSV o un texto' }, 400);
  if (['pdf', 'docx', 'xlsx'].includes(k)) {
    return json({ error: `Un ${documents.KINDS[k]} no se puede convertir dentro de la nube (la librería que lo lee no cabe en un Worker). Conviértelo en tu computadora y sube la nota: node cloudflare/scripts/subir-documento.mjs <url de la nube> "${name}" (lee el archivo aquí y sube su texto).`, pendiente: true, necesita: 'conversion-local' }, 501);
  }
  let bytes; try { bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0)); } catch { return json({ error: 'el archivo no llegó bien (base64 inválido)' }, 400); }
  if (bytes.length > documents.MAX_BYTES) return json({ error: 'el archivo pasa de 15 MB' }, 400);
  let md; try { md = documents.basicToMarkdown(k, bytes); } catch (e) { return json({ error: String(e.message || e) }, 400); }
  if (md === null || !String(md).trim()) return json({ error: 'el archivo no tiene texto que guardar' }, 400);
  // el nombre: el del archivo; si ya existe, -2, -3… (salvo que se pida reemplazar)
  const base = documents.slug(name);
  let nombreNota = base, n = 2;
  while (!b.replace && await db.prepare('select 1 x from notas where nombre = ?').bind(nombreNota).first()) nombreNota = `${base}-${n++}`;
  await guardarNotas(db, [{ nombre: nombreNota, grupo: 'Documentos', oficina: 0, texto: documents.note(name, md), actualizado: Date.now(), tarea: null }]);
  return json({ ok: true, note: nombreNota, path: `Documentos/${nombreNota}.md`, chars: md.length });
}

/* ---------- las notas viejas (knowledge.staleness) ---------- */
export async function notasPorRevisar(db) {
  const c = (await leerDoc(db, 'notas.revisar', null)).valor;
  if (c && Date.now() - c.t < 3600e3) return c.lista;
  return recalcularRevisar(db);
}
async function recalcularRevisar(db) {
  const { results } = await db.prepare('select nombre, texto, actualizado, grupo from notas').all();
  const lista = [];
  for (const n of results) { const st = knowledge.staleness(n.nombre, n.texto, n.actualizado || 0, n.grupo || ''); if (st.stale) lista.push({ name: n.nombre, why: st.why }); }
  await guardarDoc(db, 'notas.revisar', { t: Date.now(), lista });
  return lista;
}

/* ---------- «Preparar desde mi web» ---------- */
async function arranque(ctx) {
  const { req, env, db } = ctx;
  const b = (await ctx.cuerpo(req)) || {};
  const u = String(b.url || '').trim(), about = String(b.about || '').trim().slice(0, 4000);
  if (u && !/^https?:\/\/[^\s]+\.[a-z]{2,}/i.test(u)) return json({ error: 'escribe la dirección completa de tu web (https://…)' }, 400);
  if (!u && !about) return json({ error: 'pon tu web o cuéntame de tu empresa' }, 400);
  if (u && !about) return json({ error: 'Leer una página web necesita la búsqueda web del modelo, que todavía no está en la nube. Cuéntame de tu empresa en el cuadro de texto (qué haces, para quién, tus precios) y la preparo con eso; o corre «Preparar desde mi web» en la oficina de tu computadora y sube el resultado con la migración.', pendiente: true }, 501);
  const C = await leerContexto(db), cfg = await leerCfg(db), fetchFn = env.__pruebas?.fetch || null;
  const trabajo = prepararEmpresa({ env, db, cfg, C, about, fetchFn }).catch(async (e) => { const { avisar } = await import('../lib/avisos.js'); await avisar(db, { kind: 'onboard', level: 'error', text: 'No pude preparar la oficina: ' + String(e?.message || e).slice(0, 200) }); });
  if (ctx.waitUntil?.(trabajo)) return json({ ok: true, started: true, ...(u ? { aviso: 'No leí la página (la lectura de webs todavía no está en la nube): usé lo que me contaste.' } : {}) });
  await trabajo; // sin ctx.waitUntil (pruebas): se espera
  return json({ ok: true, started: true });
}

/* ---------- el reloj: las líneas «KPI x = n» de lo que los agentes terminaron, y las notas viejas (cada hora) ---------- */
export async function cadaMinuto(env) {
  const db = env.DB, t = Date.now();
  const w = (await leerDoc(db, 'kpi.lineas', { hasta: 0 })).valor || { hasta: 0 };
  if (!w.hasta) { await guardarDoc(db, 'kpi.lineas', { hasta: t }); } // la primera vez, solo lo de ahora en adelante: lo viejo no se vuelve a contar
  else {
    const k = await leerKpis(db), ids = k.defs.map((d) => d.id);
    if (ids.length) {
      const { results } = await db.prepare("select json from filas where coleccion = 'tareas' and json_extract(json,'$.state') = 'done' and coalesce(json_extract(json,'$.doneAt'),0) > ? order by json_extract(json,'$.doneAt') limit 100").bind(w.hasta).all();
      let hasta = w.hasta;
      for (const r of results) {
        let tk; try { tk = JSON.parse(r.json); } catch { continue; }
        hasta = Math.max(hasta, tk.doneAt || 0);
        if (tk.error || !tk.result) continue;
        for (const x of business.fromText(tk.result, ids)) await registrarKpi(db, x.id, x.value, `${tk.agent || 'un agente'} · «${String(tk.title).slice(0, 40)}»`);
      }
      if (hasta !== w.hasta) await guardarDoc(db, 'kpi.lineas', { hasta });
    } else await guardarDoc(db, 'kpi.lineas', { hasta: t });
  }
  const c = (await leerDoc(db, 'notas.revisar', null)).valor;
  if (!c || t - c.t > 3600e3) await recalcularRevisar(db);
}

