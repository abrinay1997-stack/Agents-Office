// Lo común de los tests de la fase 7 (Anuncios y Bandeja en el Worker): el Meta de mentira de la oficina (tests/meta-stand.mjs, nunca Meta de
// verdad), un R2 de mentira, usuarios con cada rol y una D1 de memoria con las migraciones reales.
import assert from 'node:assert/strict';
import { manejar } from '../worker/lib/rutas.js';
import { guardarDoc } from '../worker/lib/almacen.js';
import { crearMetaStand, TOKEN_STAND, CUENTA_STAND } from '../../tests/meta-stand.mjs';
import { PERMISOS_LECTURA, PERMISOS_ANUNCIOS } from '../../contenido/meta.mjs';
import { crearD1, sembrar, envDePrueba, pedir } from './d1-memoria.mjs';

export const SEG = { geo_locations: { countries: ['PA'] }, age_min: 18, targeting_automation: { advantage_audience: 1 } };
export const JPEG = (n) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, n)]);

/** Las mismas cuatro campañas que tests/anuncios-control.test.mjs (la oficina local): una activa, dos en pausa y una terminada. */
export async function prepararMeta(g) {
  const pedirG = async (ruta, campos) => (await g.fetchFn(`https://graph.test/v26.0${ruta}`, { method: 'POST', headers: { authorization: `Bearer ${TOKEN_STAND}` }, body: new URLSearchParams(Object.entries(campos).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)])) })).json();
  const campana = async (nombre, { activa = false, diario, cap, anuncios = 1, fin } = {}) => {
    const c = await pedirG(`/${CUENTA_STAND}/campaigns`, { name: `${nombre} · AO:b1`, objective: 'OUTCOME_ENGAGEMENT', special_ad_categories: [], status: 'PAUSED', daily_budget: diario, spend_cap: cap, ...(fin ? { start_time: '2026-01-01T00:00:00+0000', stop_time: fin } : {}) });
    const s = await pedirG(`/${CUENTA_STAND}/adsets`, { campaign_id: c.id, name: `${nombre} PA`, optimization_goal: 'CONVERSATIONS', billing_event: 'IMPRESSIONS', destination_type: 'WHATSAPP', targeting: SEG, status: 'PAUSED', ...(fin ? { end_time: fin } : {}) });
    const cr = await pedirG(`/${CUENTA_STAND}/adcreatives`, { name: 'k', object_story_spec: { page_id: 'P1' } });
    for (let i = 0; i < anuncios; i++) { const a = await pedirG(`/${CUENTA_STAND}/ads`, { adset_id: s.id, name: `${nombre} ${i}`, creative: { creative_id: cr.id }, status: 'PAUSED' }); await pedirG(`/${a.id}`, { status: 'ACTIVE' }); }
    await pedirG(`/${s.id}`, { status: 'ACTIVE' }); if (activa) await pedirG(`/${c.id}`, { status: 'ACTIVE' });
    return c.id;
  };
  return { activa: await campana('Mensajes', { activa: true, diario: 1000, cap: 10000 }), combo: await campana('Combo', { diario: 1500, cap: 15000 }), grande: await campana('Grande', { diario: 2500, cap: 20000 }), vieja: await campana('Vieja', { diario: 500, cap: 10000, fin: '2026-01-11T00:00:00+0000' }) };
}

/** Un R2 de mentira con la clave de la galería (la ruta relativa 2026-10/<archivo>). */
export function r2(archivos) {
  return { head: async (k) => (archivos[k] ? { key: k } : null), get: async (k) => (archivos[k] ? { arrayBuffer: async () => archivos[k].buffer.slice(archivos[k].byteOffset, archivos[k].byteOffset + archivos[k].byteLength) } : null) };
}

export async function entrar(env, c) {
  const x = await pedir(manejar, env, '/api/acceso', { metodo: 'POST', cuerpo: { email: c.email, contrasena: c.clave } });
  assert.equal(x.status, 200); return x.headers.get('set-cookie').split(';')[0];
}

/** Una nube de pruebas: D1 con un administrador, un editor y alguien de solo lectura; el Meta de mentira; la configuración del dueño. */
export async function nube({ permisos = [...PERMISOS_LECTURA, ...PERMISOS_ANUNCIOS], config = null, stand = {}, preparar = true, extraEnv = {} } = {}) {
  const d1 = crearD1(), g = crearMetaStand({ permisos, ...stand });
  const ids = preparar ? await prepararMeta(g) : {};
  const inicio = g.llamadas.length; // lo anterior es el decorado (crear las campañas de prueba en el Meta de mentira)
  const admin = await sembrar(d1), editor = await sembrar(d1, { email: 'editor@panaclaw.test', rol: 'editor' }), lectura = await sembrar(d1, { email: 'lectura@panaclaw.test', rol: 'lectura' });
  await guardarDoc(d1, 'config-local', config || { anuncios: { cuenta: CUENTA_STAND, whatsapp: '50760001111', topeDiario: 30, topeMensual: 300, topeCampana: 150 }, contenido: { modo: 'simulacro' } });
  const media = { '2026-10/uno.jpg': JPEG(1), '2026-10/dos.jpg': JPEG(2) };
  const env = envDePrueba(d1, { META_ACCESS_TOKEN: TOKEN_STAND, META_GRAPH_HOST: 'https://graph.test', FETCH_META: g.fetchFn, MEDIA: r2(media), AO_HOOK_TOKEN: 'hook-de-prueba-123', ...extraEnv }); // secrets-ok: de mentira
  const ck = { admin: await entrar(env, admin), editor: await entrar(env, editor), lectura: await entrar(env, lectura) };
  const api = async (quien, metodo, ruta, cuerpo) => { const r = await pedir(manejar, env, ruta, { metodo, cuerpo, cookie: ck[quien] }); let j = {}; try { j = await r.json(); } catch { /* sin cuerpo */ } return { status: r.status, j }; };
  return { d1, g, ids, env, api, ck, inicio };
}
