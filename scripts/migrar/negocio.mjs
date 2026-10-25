// Exportador de la fase 6 (Negocio, disparadores y Telegram). Solo LEE. NUNCA lleva una llave: ni el token del bot, ni TELEGRAM_OWNER_ID, ni AO_HOOK_TOKEN (son secretos del Worker).
//   docs.kpis        data/kpis.json                              los indicadores y sus valores
//   docs.cifras      <cerebro>/Agents Office/cifras.json         las cifras de la empresa
//   docs.triggers    <cerebro>/Agents Office/triggers.json       los disparadores (sin secretos: el archivo no los lleva)
//   docs.ajustes     office.config(.equipo/.local).json          SOLO los campos de Ajustes (settings.FIELDS) y telegram.{approvers,quiet,notify}
// La voz de marca es una nota del Cerebro: viaja con las notas.
import fs from 'node:fs';
import path from 'node:path';
import { FIELDS, get, set } from '../../settings.mjs';

const leer = (f, defecto = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return defecto; } };
const fusion = (a, b) => { const o = { ...(a || {}) }; for (const [k, v] of Object.entries(b || {})) o[k] = v && typeof v === 'object' && !Array.isArray(v) ? fusion(o[k], v) : v; return o; };
const PINTA_DE_SECRETO = /(token|secret|secreto|api[-_]?key|apikey|passw|contrase|clave|credential|bearer|authorization)/i;
export const nombre = 'negocio', modulo = 'negocio';

export function exportar({ raiz, vault } = {}) {
  const docs = {}, resumen = {}, ao = path.join(vault || '', 'Agents Office');
  const k = leer(path.join(raiz, 'data', 'kpis.json'), null);
  if (k && Array.isArray(k.defs)) { docs.kpis = { defs: k.defs, values: k.values && typeof k.values === 'object' ? k.values : {} }; resumen.indicadores = k.defs.length; }
  const c = leer(path.join(ao, 'cifras.json'), null);
  const items = Array.isArray(c) ? c : Array.isArray(c?.items) ? c.items : null;
  if (items) { docs.cifras = { items }; resumen.cifras = items.length; }
  const t = leer(path.join(ao, 'triggers.json'), null);
  const lista = Array.isArray(t) ? t : Array.isArray(t?.triggers) ? t.triggers : null;
  if (lista) { docs.triggers = { lista: lista.map((x) => Object.fromEntries(Object.entries(x).filter(([n]) => !PINTA_DE_SECRETO.test(n)))) }; resumen.disparadores = lista.length; }
  // ajustes: solo lo que Ajustes sabe cambiar; el equipo primero, lo de esta máquina gana
  const cfg = fusion(fusion(leer(path.join(raiz, 'office.config.json'), {}), leer(path.join(raiz, 'office.config.equipo.json'), {})), leer(path.join(raiz, 'office.config.local.json'), {}));
  const aj = {};
  for (const f of FIELDS) { if (PINTA_DE_SECRETO.test(f.path)) continue; const v = get(cfg, f.path); if (v !== undefined && !/^(contenido|media)\./.test(f.path)) set(aj, f.path, v); }
  const tg = cfg.telegram || {};
  const telegram = {};
  if (tg.approvers && typeof tg.approvers === 'object') telegram.approvers = tg.approvers;
  if (tg.quiet && typeof tg.quiet === 'object') telegram.quiet = tg.quiet;
  if (tg.notify && typeof tg.notify === 'object') telegram.notify = tg.notify;
  if (Object.keys(telegram).length) aj.telegram = fusion(aj.telegram, telegram);
  if (Object.keys(aj).length) { docs.ajustes = aj; resumen.ajustes = Object.keys(aj).length; }
  return { filas: {}, docs, resumen };
}
