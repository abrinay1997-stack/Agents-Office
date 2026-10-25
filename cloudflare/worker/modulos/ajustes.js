// Fase 6 — Ajustes en la nube: GET|POST /api/settings con la MISMA forma que serve.mjs (grupos, campos, valores; los cambios se validan con settings.mjs, el mismo código).
// Y la parte de «Estado» que le toca (los avisos de Telegram, los disparadores y las notas por revisar): `salud(ctx)` los aporta a /api/status.
// Dónde se guardan los ajustes y por qué: lib/ajustes.js. Reglas: SOLO un administrador escribe; ningún secreto pasa por aquí (las llaves son secretos del Worker); en la nube todo se aplica
// al instante (ningún campo pide reiniciar).
import { json, error, prohibido } from '../lib/respuesta.js';
import { GROUPS, FIELDS } from '../../../settings.mjs';
import { configured, owners } from '../../../telegram-core.mjs';
import { leerCfg, valoresDe, guardarCambios, guardarAprobadores } from '../lib/ajustes.js';
import { leerDoc } from '../lib/almacen.js';

export const nombre = 'ajustes';
export const grupos = ['settings'];

const tokenBueno = (env) => String(env.AO_HOOK_TOKEN || '').length >= 16;
const MAX_CUERPO = 64 * 1024;

export async function manejar(ctx) {
  const { req, env, db, ruta, usuario } = ctx;
  if (ruta === '/api/settings/telegram') { // quién aprueba por Telegram qué departamentos (no es un campo del formulario); nunca devuelve un secreto
    if (req.method === 'GET') { const cfg = await leerCfg(db); return json({ on: configured(env), owners: owners(env).length, webhookSecreto: String(env.TELEGRAM_WEBHOOK_SECRET || '').length >= 16, webhook: '/api/telegram/webhook', approvers: cfg.telegram?.approvers || {} }); }
    if (req.method === 'PUT') {
      if (usuario.rol !== 'admin') return prohibido('Solo un administrador cambia quién aprueba por Telegram.');
      const b = (await ctx.cuerpo(req)) || {}, r = await guardarAprobadores(db, b.approvers, { quien: usuario.email });
      return r.error ? error(r.error, 422) : json(r);
    }
    return null;
  }
  if (ruta !== '/api/settings') return null;
  if (req.method === 'GET') {
    const cfg = await leerCfg(db);
    return json({ groups: GROUPS, fields: FIELDS, values: valoresDe(cfg), telegram: { on: configured(env), owners: owners(env).length }, hookToken: tokenBueno(env), embeddings: null, localFile: 'Ajustes en la nube (D1)' });
  }
  if (req.method === 'POST') {
    if (usuario.rol !== 'admin') return prohibido('Solo un administrador cambia los ajustes de la oficina.');
    const txt = await req.text();
    if (txt.length > MAX_CUERPO) return error('Los ajustes son pocos: ese cuerpo es demasiado grande.', 413);
    let b; try { b = JSON.parse(txt || '{}'); } catch { return error('El cuerpo no es JSON.', 400); }
    const r = await guardarCambios(db, b?.changes, { quien: usuario.email });
    return json({ ok: true, errors: r.errors, restart: false });
  }
  return null;
}

/** Lo que Ajustes aporta al semáforo: Telegram, los disparadores y las notas por revisar (se calculan cada hora; aquí solo se lee). */
export async function salud({ env, db, cfg }) {
  const checks = [];
  if (!configured(env)) checks.push({ id: 'telegram', label: 'Telegram', state: 'info', detail: 'Telegram no está conectado: las aprobaciones y los avisos solo llegan a la página.', fix: 'Guarda TELEGRAM_BOT_TOKEN, TELEGRAM_OWNER_ID y TELEGRAM_WEBHOOK_SECRET como secretos y activa el webhook (docs/cloudflare.md → Fase 6).' });
  else {
    const e = (await leerDoc(db, 'telegram.estado', {})).valor || {};
    const visto = e.ultimoUpdate ? `Último mensaje ${Math.max(0, Math.round((Date.now() - e.ultimoUpdate) / 60000))} min atrás.` : 'Todavía no escribiste desde el teléfono.';
    checks.push({ id: 'telegram', label: 'Telegram', state: e.errorAviso ? 'warn' : 'ok', detail: `Conectado a ${owners(env).length} ${owners(env).length === 1 ? 'dueño' : 'dueños'}. ${visto}${e.errorAviso ? ' Último aviso que no salió: ' + String(e.errorAviso).slice(0, 120) : ''}`, fix: e.errorAviso ? 'Mira que el webhook esté activo (node cloudflare/scripts/telegram-webhook.mjs) y que el bot siga vivo.' : '' });
  }
  const trig = (await leerDoc(db, 'triggers', { lista: [] })).valor?.lista || [];
  checks.push({ id: 'disparadores', label: 'Disparadores', state: trig.length && !tokenBueno(env) ? 'warn' : 'info', detail: !tokenBueno(env) ? 'La oficina no acepta webhooks: falta el secreto AO_HOOK_TOKEN (16 caracteres o más).' : trig.length ? `${trig.length} disparador(es) listos en POST /api/hook/<id>.` : 'Sin disparadores definidos todavía.', fix: !tokenBueno(env) && trig.length ? 'Guarda AO_HOOK_TOKEN como secreto del repositorio y vuelve a desplegar.' : '' });
  const rev = (await leerDoc(db, 'notas.revisar', { lista: [] })).valor?.lista || [];
  checks.push({ id: 'notas', label: 'Notas de la empresa', state: rev.length > 5 ? 'warn' : rev.length ? 'info' : 'ok', detail: rev.length ? `${rev.length} por revisar: ${rev.slice(0, 4).map((n) => `${n.name} (${n.why})`).join(', ')}${rev.length > 4 ? '…' : ''}.` : 'Todas al día.', fix: rev.length ? 'Ábrelas en el Cerebro, confirma precios y fechas, y pon «actualizado: AAAA-MM-DD» en su cabecera.' : '' });
  return { checks };
}
