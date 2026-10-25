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
import { conAnuncios, asegurarCuentas, leerPreload, pareceDeAgente, DIR_INFORMES, ESPEJO_WEBHOOK } from '../lib/anuncios-nube.js';
import { candados, tasaPorMinuto } from '../lib/tokens.js';
import { guardarNotas } from '../lib/cerebro.js';
import { leerDoc, guardarDoc } from '../lib/almacen.js';
import { uuid, igualSeguro } from '../lib/ids.js';
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
  const cand = candados(db);
  const quienLock = 'anuncios-' + uuid().slice(0, 8);

  // ---- POST /sincronizar: leer de Meta ahora (en la petición; son unas 10 llamadas) y, si hubo cifras, el diagnóstico
  if (ruta === '/api/anuncios/sincronizar' && metodo === 'POST') {
    if (comoAgente) {
      const t = Date.now(), previo = Number((await leerDoc(db, 'anuncios.agente-sync', { at: 0 })).valor.at) || 0;
      if (t - previo < SINC_AGENTE_MIN * 60e3) return json({ error: `un agente puede pedir leer de Meta una vez cada ${SINC_AGENTE_MIN} minutos (la cuota es del negocio entero): usa lo ya leído` }, 429);
    }
    // dos lecturas a la vez gastan la cuota de Meta el doble y se pisan al guardar: la segunda se dice en palabras
    if (!(await cand.tomar('anuncios:sync', 2 * 60e3, quienLock))) return json({ error: 'estado', motivo: 'Ya se está leyendo de Meta: espera a que termine.' }, 409);
    try { return await sincronizarAhora(); } finally { await cand.soltar('anuncios:sync', quienLock); }
  }
  return resto();

  async function sincronizarAhora() {
    return conAnuncios({ db, env }, async (a) => {
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

  async function resto() {
  const preload = ruta === '/api/anuncios/impulsar' ? await leerPreload(db, { pieza: String(b?.pieza || '') }) : {};
  // lo que cambia dinero (acciones, deshacer, aplicar una sugerencia que gasta) va de una en una: un candado de la cuenta
  const cambiaMeta = metodo === 'POST' && (ruta === '/api/anuncios/accion' || ruta === '/api/anuncios/deshacer' || /^\/api\/anuncios\/sugerencias\/[^/]+\/aplicar$/.test(ruta));
  if (cambiaMeta && !(await cand.tomar('anuncios:accion', 2 * 60e3, quienLock))) return json({ error: 'estado', motivo: 'Otra acción sobre los anuncios está en marcha: espera unos segundos y vuelve a intentarlo.' }, 409);
  try {
    return await conAnuncios({ db, env, preload }, async (a, { esp }) => {
      const handle = a.rutas(a.sync, (res, code, cuerpo) => { res.status = code; res.cuerpo = cuerpo; }, async () => b);
      // lo que Meta necesita saber de los medios del Estudio (R2): que existan para validar o crear; los bytes, para la vista previa
      const mb = /^\/api\/anuncios\/borradores\/([A-Za-z0-9_-]{1,60})\/(validar|crear|vista-previa)$/.exec(ruta);
      if (mb) {
        await asegurarCuentas(a.meta);
        const bor = a.borr.leer(mb[1]);
        if (bor) { const { rechazados } = await a.galeria.cargar(creativosDe(bor), { bytes: mb[2] === 'vista-previa' }); if (rechazados.length) return json({ error: 'medio', motivo: rechazados[0].motivo, rechazados: rechazados.map((r) => ({ id: r.id, motivo: r.motivo })) }, 422); }
      } else if (ruta === '/api/anuncios/impulsar' || /^\/api\/anuncios\/sugerencias\/[^/]+\/aplicar$/.test(ruta)) await asegurarCuentas(a.meta);
      const res = await correr(handle, req, u2, b);
      if (!res) return json({ error: 'no existe' }, 404);
      // el informe guardado es una nota del Cerebro (en D1), no un archivo
      if (ruta === '/api/anuncios/informe' && metodo === 'POST' && res.status === 200 && res.cuerpo?.nota) await informeAlCerebro(db, esp, res.cuerpo);
      return json(res.cuerpo, res.status);
    });
  } finally { if (cambiaMeta) await cand.soltar('anuncios:accion', quienLock); }
  }
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
export const TTL_RELOJ_MS = 4 * 60e3; // el candado del reloj es CORTO y se renueva con el latido: si el Worker muere, el siguiente minuto sigue sin esperar 14 min
export async function cadaMinuto(env, { ahora = () => Date.now() } = {}) {
  const db = env.DB, cand = candados(db, { ahora }), yo = 'cron-' + uuid().slice(0, 8);
  if (!(await cand.tomar('anuncios:cron', TTL_RELOJ_MS, yo))) return;
  let claveCrear = null;
  const latido = async () => { await cand.renovar('anuncios:cron', TTL_RELOJ_MS, yo); if (claveCrear) await cand.renovar(claveCrear, TTL_RELOJ_MS, yo); };
  try {
    await conAnuncios({ db, env, ahora, latido, preload: await leerPreload(db) }, async (a) => {
      if (!a.meta.configurado()) return;
      try { await asegurarCuentas(a.meta); } catch (e) { console.warn('[anuncios] cuentas:', e?.message ?? e); }
      await latido();
      try { await a.conv.tick(); } catch (e) { console.warn('[anuncios] conversiones:', e?.message ?? e); }
      await latido();
      const antes = a.sync.conexion().cifrasAt;
      const r = await a.sync.tick();
      if (r?.ok && a.sync.conexion().cifrasAt !== antes) {
        if (await cand.tomar('anuncios:accion', 2 * 60e3, yo)) { try { await a.tras(); } catch (e) { console.warn('[anuncios] diagnóstico:', e?.message ?? e); } finally { await cand.soltar('anuncios:accion', yo); } }
        try { a.ind.llevar(); } catch { /* idem */ }
      }
      await latido();
      // las creaciones que el dueño pidió: MÁXIMO UNA por invocación (una creación son ~30 llamadas a Meta; el límite de subrequests es por invocación),
      // con su candado por borrador (la que ya corre en otro reloj no se repite). Las demás esperan al minuto siguiente.
      for (const bor of a.borr.lista().filter((x) => x.estado === 'creando')) {
        const clave = `anuncios:crear:${bor.id}`;
        if (!(await cand.tomar(clave, TTL_RELOJ_MS, yo))) continue;
        claveCrear = clave;
        try {
          const { rechazados } = await a.galeria.cargar(creativosDe(bor), { bytes: true });
          if (rechazados.length) { a.borr.poner(bor.id, { estado: 'fallo', error: 'No se pudo crear en Meta: ' + rechazados[0].motivo, progreso: null }); continue; } // un medio demasiado grande no se arregla reintentando
          a.creador.alArrancar([bor.id]);
          await a.creador.esperar(bor.id);
        } catch (e) { console.warn('[anuncios] crear', bor.id, e?.message ?? e); }
        finally { claveCrear = null; await cand.soltar(clave, yo); }
        break;
      }
    });
  } finally { await cand.soltar('anuncios:cron', yo); }
}

export const MAX_WEBHOOK_BYTES = 16 * 1024;
export const MAX_WEBHOOK_POR_MINUTO = 60;
const jsonResp = (cuerpo, estado) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
/** Lee el cuerpo SIN pasarse del tope (un cuerpo enorme sin Content-Length no se carga entero). → texto, o null si pasa el tope. */
async function leerConTope(req, max) {
  const decl = Number(req.headers.get('content-length') || 0);
  if (decl > max) return null;
  if (!req.body) return '';
  const lector = req.body.getReader(), trozos = []; let n = 0;
  for (;;) { const { done, value } = await lector.read(); if (done) break; n += value.length; if (n > max) { try { await lector.cancel(); } catch { /* ya está */ } return null; } trozos.push(value); }
  const todo = new Uint8Array(n); let o = 0; for (const t of trozos) { todo.set(t, o); o += t.length; }
  return new TextDecoder().decode(todo);
}
const hexSha256 = async (txt) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)))].map((b) => b.toString(16).padStart(2, '0')).join('');

/**
 * El webhook de conversiones SIN sesión (Zapier, tu tienda, n8n): lo llama lib/rutas.js ANTES de pedir sesión, solo para esta ruta exacta.
 *  1. el token (AO_HOOK_TOKEN) se comprueba PRIMERO, antes de leer nada ni abrir el espejo, con comparación de tiempo constante; solo por cabecera
 *     (`X-Office-Token` o `Authorization: Bearer`; nunca en la dirección, que queda en los registros); el mismo 401 si falta la variable o si el token no vale;
 *  2. cuerpo de hasta 16 KB (413); 60 por minuto (429, contado en D1);
 *  3. un evento sin `event_id` toma el hash de su cuerpo: reenviar lo mismo cuenta una sola vez;
 *  4. espejo MÍNIMO (solo conversiones.json y la cuenta), se REGISTRA y no se espera a Meta: lo envía el reloj del minuto siguiente.
 * Nunca habla con Meta ni gasta; solo apunta el evento.
 */
export async function webhookConversiones(req, env) {
  const url = new URL(req.url);
  if (req.method !== 'POST' || url.pathname !== '/api/anuncios/conversiones/webhook') return null;
  const esperado = String(env.AO_HOOK_TOKEN || '');
  const dado = req.headers.get('x-office-token') || String(req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!esperado || !igualSeguro(String(dado), esperado)) return jsonResp({ error: 'token incorrecto', motivo: 'token incorrecto' }, 401);
  const txt = await leerConTope(req, MAX_WEBHOOK_BYTES);
  if (txt === null) return jsonResp({ error: 'el cuerpo pasa de 16 KB', motivo: 'el cuerpo pasa de 16 KB' }, 413);
  let b; try { b = JSON.parse(txt || '{}'); } catch { return jsonResp({ error: 'el cuerpo no es JSON', motivo: 'el cuerpo no es JSON' }, 400); }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return jsonResp({ error: 'el cuerpo es un objeto JSON', motivo: 'el cuerpo es un objeto JSON' }, 400);
  const db = env.DB;
  if (!(await tasaPorMinuto(db, 'webhook-conversiones', MAX_WEBHOOK_POR_MINUTO)).ok) return jsonResp({ error: 'demasiados eventos por minuto (60)', motivo: 'demasiados eventos por minuto (60)' }, 429);
  if (!String(b.event_id || '').trim()) b.event_id = 'wh_' + (await hexSha256(txt)).slice(0, 40);
  const nombre = ({ purchase: 'Purchase', compra: 'Purchase', venta: 'Purchase', lead: 'Lead', contacto: 'Lead' })[String(b.evento || b.event_name || '').toLowerCase()];
  if (!nombre) return jsonResp({ error: 'el evento es «Purchase» (una compra) o «Lead» (un contacto)', motivo: 'el evento es «Purchase» (una compra) o «Lead» (un contacto)' }, 400);
  return conAnuncios({ db, env, espejo: ESPEJO_WEBHOOK }, async (a) => {
    const canal = String(b.canal || b.messaging_channel || '');
    const entrada = { nombre, via: canal === 'whatsapp' ? 'mensajes' : (b.url || b.event_source_url) ? 'web' : 'sistema', canal, valor: b.valor ?? b.value, moneda: b.moneda ?? b.currency, email: b.email, telefono: b.telefono ?? b.phone, externoId: b.cliente ?? b.external_id, url: b.url ?? b.event_source_url, wabaId: b.whatsapp_business_account_id, ctwaClid: b.ctwa_clid, eventId: b.event_id, at: b.at ? (Number.isFinite(Number(b.at)) ? Number(b.at) * (Number(b.at) < 1e12 ? 1000 : 1) : Date.parse(b.at)) : undefined, origen: 'webhook', ref: String(b.id ?? b.pedido ?? '') };
    try { return jsonResp(a.conv.registrar(entrada, { quien: 'webhook' }), 200); }
    catch (e) { const m = String(e?.message || 'no se pudo registrar'); return jsonResp({ error: m, motivo: m }, Number(e?.status) || 500); }
  });
}
