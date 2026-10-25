// Fase 7 del puerto: Anuncios de Meta en el Worker (/api/anuncios/*). Las MISMAS rutas y respuestas que la oficina local: el enrutador es el de
// anuncios/rutas.mjs (no se reescribe), el cableado está en lib/anuncios-nube.js y el estado de los archivos de data/anuncios/ viaja a D1 por el
// espejo (lib/espejo.js). Ver la sección «Anuncios de Meta y la Bandeja en la nube» de docs/cloudflare.md.
//
// LA REGLA DEL DINERO (docs/plan-meta-anuncios-y-bandeja-2026-10-09.md §3), tal como la deja anuncios/acciones.mjs y la sostiene este módulo:
//  · gastar = dos peticiones del dueño (rol admin): la primera no cambia nada y devuelve la cifra y un token de 2 min, de un solo uso (D1,
//    atómico) atado a tipo + id + valor; la segunda lo consume, vuelve a mirar los topes y recién entonces cambia Meta;
//  · todo se crea PAUSADO (meta-ads.crearEn se niega a otra cosa) y nunca dos veces (se busca por la etiqueta `· AO:<id>` antes de crear);
//  · un agente, Dimitri o el asistente jamás confirman un gasto: la sesión de una persona solo puede declararse «agente» (menos permisos),
//    nunca más; las otras identidades las usa el código del Worker (fase de Dimitri) llamando a las funciones, no por HTTP;
//  · una creación larga NO corre en la petición: queda «creando» y la sigue el cron, paso a paso (cada paso apuntado en D1 antes de llamar a Meta).
import { conAnuncios, asegurarCuentas, leerPreload, pareceDeAgente, DIR_INFORMES } from '../lib/anuncios-nube.js';
import { candados } from '../lib/tokens.js';
import { guardarNotas } from '../lib/cerebro.js';
import { leerDoc, guardarDoc } from '../lib/almacen.js';
import { uuid } from '../lib/ids.js';
import fs from 'node:fs';

export const nombre = 'anuncios';
export const grupos = ['anuncios'];

const SINC_AGENTE_MIN = 10;
const creativosDe = (b) => (b?.creativos || []).map((c) => c.media).filter(Boolean);

/** Quién puede qué: lectura solo lee; el editor prepara borradores; solo un administrador (el dueño) cambia algo en Meta. */
export function permitido(rol, metodo, ruta) {
  if (metodo === 'GET' || metodo === 'HEAD') return true;
  if (rol === 'admin') return true;
  if (rol !== 'editor') return false;
  // el editor prepara borradores (crear, cambiar, validar con Meta); no los crea en Meta, no los quita, no toca nada más
  return /^\/api\/anuncios\/borradores(\/[A-Za-z0-9_-]{1,60}(\/validar)?)?$/.test(ruta) && (metodo === 'POST' || metodo === 'PATCH');
}

/** Adaptador: el enrutador de la oficina local habla con (req, res, url) de Node; aquí la «respuesta» solo recoge estado y cuerpo. */
async function correr(handle, req, url, cuerpoJson) {
  const res = { status: 200, cuerpo: null };
  const headers = Object.fromEntries([...req.headers].map(([k, v]) => [k.toLowerCase(), v]));
  const hecho = await handle({ method: req.method, headers, url: req.url }, res, url);
  return hecho ? res : null;
}

export async function manejar(ctx) {
  const { req, env, db, usuario, url, ruta, json } = ctx;
  if (ruta !== '/api/anuncios' && !ruta.startsWith('/api/anuncios/')) return null;
  const metodo = req.method;
  if (!permitido(usuario.rol, metodo, ruta)) return ctx.prohibido(usuario.rol === 'lectura' ? 'Tu usuario solo puede mirar los anuncios.' : 'Cambiar algo en Meta es del dueño (administrador).');
  const b = metodo === 'GET' || metodo === 'HEAD' ? {} : (await ctx.cuerpo(req)) || {};
  // La sesión de una persona solo puede pedir MENOS permisos (agente). Dueño, Dimitri, asistente y piloto no se eligen desde fuera.
  const comoAgente = pareceDeAgente(b?.por) || pareceDeAgente(url.searchParams.get('por'));
  if (b && typeof b === 'object') { delete b.por; if (comoAgente) b.por = 'agente'; }
  const u2 = new URL(url); u2.searchParams.delete('por'); if (comoAgente) u2.searchParams.set('por', 'agente');
  const fetchFn = typeof env.FETCH_META === 'function' ? env.FETCH_META : undefined; // solo pruebas: un Meta de mentira
  const cand = candados(db);
  const quienLock = 'anuncios-' + uuid().slice(0, 8);

  // ---- POST /sincronizar: leer de Meta ahora (en la petición; son unas 10 llamadas) y, si hubo cifras, el diagnóstico
  if (ruta === '/api/anuncios/sincronizar' && metodo === 'POST') {
    if (comoAgente) {
      const t = Date.now(), previo = Number((await leerDoc(db, 'anuncios.agente-sync', { at: 0 })).valor.at) || 0;
      if (t - previo < SINC_AGENTE_MIN * 60e3) return json({ error: `un agente puede pedir leer de Meta una vez cada ${SINC_AGENTE_MIN} minutos (la cuota es del negocio entero): usa lo ya leído` }, 429);
    }
    return conAnuncios({ db, env, fetchFn }, async (a) => {
      const l = a.sync.listo(); if (!l.ok) return json({ error: l.motivo }, 409);
      if (comoAgente) await guardarDoc(db, 'anuncios.agente-sync', { at: Date.now() });
      await asegurarCuentas(a.meta);
      const r = await a.sync.sincronizar({ cifras: true });
      if (r?.ok) {
        if (await cand.tomar('anuncios:accion', 2 * 60e3, quienLock)) { try { await a.tras(); } finally { await cand.soltar('anuncios:accion', quienLock); } }
        try { a.ind.llevar(); } catch { /* los indicadores no son lo importante */ }
      }
      return json({ ok: true }, 202);
    });
  }

  const preload = ruta === '/api/anuncios/impulsar' ? await leerPreload(db, { pieza: String(b?.pieza || '') }) : {};
  // lo que cambia dinero (acciones, deshacer, aplicar una sugerencia que gasta) va de una en una: un candado de la cuenta
  const cambiaMeta = metodo === 'POST' && (ruta === '/api/anuncios/accion' || ruta === '/api/anuncios/deshacer' || /^\/api\/anuncios\/sugerencias\/[^/]+\/aplicar$/.test(ruta));
  if (cambiaMeta && !(await cand.tomar('anuncios:accion', 2 * 60e3, quienLock))) return json({ error: 'estado', motivo: 'Otra acción sobre los anuncios está en marcha: espera unos segundos y vuelve a intentarlo.' }, 409);
  try {
    return await conAnuncios({ db, env, fetchFn, preload }, async (a, { esp }) => {
      const handle = a.rutas(a.sync, (res, code, cuerpo) => { res.status = code; res.cuerpo = cuerpo; }, async () => b);
      // lo que Meta necesita saber de los medios del Estudio (R2): que existan para validar o crear; los bytes, para la vista previa
      const mb = /^\/api\/anuncios\/borradores\/([A-Za-z0-9_-]{1,60})\/(validar|crear|vista-previa)$/.exec(ruta);
      if (mb) {
        await asegurarCuentas(a.meta);
        const bor = a.borr.leer(mb[1]);
        if (bor) await a.galeria.cargar(creativosDe(bor), { bytes: mb[2] === 'vista-previa' });
      } else if (ruta === '/api/anuncios/impulsar' || /^\/api\/anuncios\/sugerencias\/[^/]+\/aplicar$/.test(ruta)) await asegurarCuentas(a.meta);
      const res = await correr(handle, req, u2, b);
      if (!res) return json({ error: 'no existe' }, 404);
      // el informe guardado es una nota del Cerebro (en D1), no un archivo
      if (ruta === '/api/anuncios/informe' && metodo === 'POST' && res.status === 200 && res.cuerpo?.nota) await informeAlCerebro(db, esp, res.cuerpo);
      return json(res.cuerpo, res.status);
    });
  } finally { if (cambiaMeta) await cand.soltar('anuncios:accion', quienLock); }
}

/** El informe del mes escrito por informe.guardar (un archivo del espejo) pasa a ser una nota del Cerebro y el archivo se quita. */
async function informeAlCerebro(db, esp, r) {
  const m = /([\d]{4}-[\d]{2}) anuncios\.md$/.exec(r.nota), rel = `${DIR_INFORMES}/${m ? m[1] : ''} anuncios.md`;
  if (!m || !fs.existsSync(esp.ruta(rel))) return;
  await guardarNotas(db, [{ nombre: `${m[1]} anuncios`, grupo: 'Agents Office', oficina: 0, texto: fs.readFileSync(esp.ruta(rel), 'utf8'), actualizado: Date.now(), tarea: null }]);
  fs.rmSync(esp.ruta(rel), { force: true });
}

/**
 * El reloj (en serve.mjs eran setInterval): leer de Meta cuando toca (anuncios/sincronizar.mjs decide por su ritmo y el freno), el diagnóstico
 * y el piloto tras cada lectura de cifras, los eventos de conversión que esperan, y seguir las creaciones que quedaron «creando».
 * Un candado impide que dos relojes (un minuto lento y el siguiente) corran a la vez.
 */
export async function cadaMinuto(env) {
  const db = env.DB, cand = candados(db), yo = 'cron-' + uuid().slice(0, 8);
  if (!(await cand.tomar('anuncios:cron', 14 * 60e3, yo))) return;
  const fetchFn = typeof env.FETCH_META === 'function' ? env.FETCH_META : undefined;
  try {
    await conAnuncios({ db, env, fetchFn, preload: await leerPreload(db) }, async (a) => {
      if (!a.meta.configurado()) return;
      try { await asegurarCuentas(a.meta); } catch (e) { console.warn('[anuncios] cuentas:', e?.message ?? e); }
      try { await a.conv.tick(); } catch (e) { console.warn('[anuncios] conversiones:', e?.message ?? e); }
      const antes = a.sync.conexion().cifrasAt;
      const r = await a.sync.tick();
      if (r?.ok && a.sync.conexion().cifrasAt !== antes) {
        if (await cand.tomar('anuncios:accion', 2 * 60e3, yo)) { try { await a.tras(); } catch (e) { console.warn('[anuncios] diagnóstico:', e?.message ?? e); } finally { await cand.soltar('anuncios:accion', yo); } }
        try { a.ind.llevar(); } catch { /* idem */ }
      }
      // las creaciones que el dueño pidió: una por una, con su candado (la que ya corre en otro reloj no se repite)
      for (const bor of a.borr.lista().filter((x) => x.estado === 'creando')) {
        const clave = `anuncios:crear:${bor.id}`;
        if (!(await cand.tomar(clave, 12 * 60e3, yo))) continue;
        try {
          await a.galeria.cargar(creativosDe(bor), { bytes: true });
          a.creador.alArrancar([bor.id]);
          await a.creador.esperar(bor.id);
        } catch (e) { console.warn('[anuncios] crear', bor.id, e?.message ?? e); }
        finally { await cand.soltar(clave, yo); }
      }
    });
  } finally { await cand.soltar('anuncios:cron', yo); }
}

/**
 * El webhook de conversiones SIN sesión (Zapier, tu tienda, n8n con AO_HOOK_TOKEN): lo que `rutas.js` debe llamar antes de pedir sesión para
 * esta ruta exacta. Hoy `rutas.js` pide sesión a todo /api/ salvo /api/health y /api/acceso, así que desde fuera aún no llega (ver el informe de
 * la fase 7: cambio necesario en lib/rutas.js). Con una sesión de administrador sí funciona por `manejar`.
 */
export async function webhookConversiones(req, env) {
  const url = new URL(req.url);
  if (req.method !== 'POST' || url.pathname !== '/api/anuncios/conversiones/webhook') return null;
  const fetchFn = typeof env.FETCH_META === 'function' ? env.FETCH_META : undefined;
  const b = await req.json().catch(() => ({}));
  return conAnuncios({ db: env.DB, env, fetchFn }, async (a) => {
    const handle = a.rutas(a.sync, (res, code, cuerpo) => { res.status = code; res.cuerpo = cuerpo; }, async () => b);
    const res = await correr(handle, req, url, b);
    return new Response(JSON.stringify(res?.cuerpo ?? { error: 'no existe' }), { status: res?.status ?? 404, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  });
}
