// /api/health. Dos caras:
//  · PÚBLICA (sin sesión): lo mínimo — que el Worker vive, su versión y si hay con qué pensar. Nada del negocio (ni el nombre de la empresa).
//  · RICA (con sesión): lo que la página necesita para dibujarse con los datos de ESTA oficina — el nombre de la empresa (la marca de la barra), Dimitri, el roster, los
//    departamentos, el modelo y el esfuerzo, los equipos, qué hay en las rutinas y en las skills… la forma de serve.mjs → /api/health.
// Cada módulo puede aportar su parte con `salud(ctx)` → { health?: {…campos que se suman…}, checks?: [{ id, label, state, detail, fix }] }; los `health` se mezclan aquí y los
// `checks` los usa /api/status. Un módulo que falle no tumba el health (se ignora y se registra).
import { normModel, normEffort, MODEL_KEYS, EFFORT_KEYS, modelName, DEFAULT_MODEL } from '../../../src/models.js';
import { DEPT_KEYS } from '../../../src/data.js';
import * as teams from '../../../teams.mjs';
import * as safety from '../../../safety.mjs';
import { ALLOWED as DEPTS_RUTINAS } from '../../../routines-core.mjs';
import { nameOf } from '../../../sub-core.mjs';
import pkg from '../../../package.json' with { type: 'json' };
import { leerCfg } from './ajustes.js';
import { cargarRoster, agentesSalida } from './tareas/roster.js';
import { leerDoc, listarFilas, mutarDoc } from './almacen.js';
import { json } from './respuesta.js';

export const VERSION_OFICINA = pkg.version || '?';
const hayModelo = (env) => !!env.ANTHROPIC_API_KEY || !!(env.META_API_KEY || env.MODEL_API_KEY);

/** Lo que cualquiera puede ver (también sin sesión). */
export const saludPublica = (env, version) => ({ ok: true, version, ia: hayModelo(env) });

/** El proveedor del modelo de los agentes: el del `AI_MODELO` de la nube (Muse = Meta; si no, Anthropic). */
export function proveedorDe(env) {
  const meta = /^muse-/i.test(String(env.AI_MODELO || ''));
  return meta ? { id: 'meta', name: 'Meta Muse Spark', host: 'api.meta.ai', backend: 'meta-api' } : { id: 'anthropic', name: 'Claude', host: 'api.anthropic.com', backend: 'anthropic-api' };
}

/** La salud rica. `modulos`: los módulos que pueden aportar `salud(ctx)`. */
export async function saludRica(ctx, modulos = []) {
  const { env, db } = ctx;
  const cfg = await leerCfg(db);
  const [roster, notas, rutinas, skills] = await Promise.all([
    cargarRoster(db),
    db.prepare('select count(*) n from notas').first().then((r) => r?.n ?? 0).catch(() => 0),
    listarFilas(db, 'rutinas', { limite: 500 }).catch(() => []),
    listarFilas(db, 'skills', { limite: 300 }).catch(() => []),
  ]);
  const model = normModel(cfg.model) || DEFAULT_MODEL, effort = normEffort(cfg.effort) || '';
  const prov = proveedorDe(env);
  const agents = agentesSalida(roster.agents).map((a) => ({ ...a, skills: skills.filter((s) => s && s.text && (s.everyone || (s.agents || []).includes(a.id) || (s.departments || []).includes(a.department))).map((s) => s.name) }));
  const setup = Object.fromEntries(DEPT_KEYS.map((k) => [k, agents.some((a) => a.department === k && a.brief)]));
  const n = safety.normalize(cfg.safety);
  const base = {
    ok: true, version: VERSION_OFICINA, backend: prov.backend, provider: { id: prov.id, name: prov.name, host: prov.host }, model, modelName: modelName(model), models: MODEL_KEYS, effort, efforts: EFFORT_KEYS,
    name: String(cfg.name || 'PanaClaw'), deputy: nameOf(cfg), brain: 'la nube (D1)', notes: notas, depts: DEPT_KEYS, agents, setup,
    routines: { count: rutinas.length, paused: rutinas.filter((r) => r?.paused).length, depts: DEPTS_RUTINAS },
    roster: { customised: roster.customised, briefed: roster.briefed, files: roster.files, problems: roster.problems },
    skills: { count: skills.length, shipped: 0, brain: skills.length, problems: [] },
    safety: { writes: n.writes, departments: n.departments, browserSites: n.browserSites.length, browserBlock: n.browserBlock.length, limits: n.limits },
    tools: true, teams: teams.settings(cfg), browser: false, mcp: { nube: true },
    nube: true,
  };
  let h = base;
  for (const m of modulos) {
    if (typeof m.salud !== 'function') continue;
    try { const s = await m.salud({ ...ctx, cfg, base: h }); if (s?.health && typeof s.health === 'object') h = { ...h, ...s.health }; }
    catch (e) { console.warn(`[health] ${m.nombre || 'módulo'}:`, e?.message ?? e); }
  }
  return h;
}

/** Los `checks` que aportan los módulos para /api/status (ver lib/rutas.js). */
export async function checksDeModulos(ctx, modulos = []) {
  const out = [];
  for (const m of modulos) {
    if (typeof m.salud !== 'function') continue;
    try { const s = await m.salud({ ...ctx, cfg: await leerCfg(ctx.db), base: null }); if (Array.isArray(s?.checks)) out.push(...s.checks); }
    catch (e) { console.warn(`[status] ${m.nombre || 'módulo'}:`, e?.message ?? e); }
  }
  return out;
}

/** Avisos de la oficina, de las DOS tablas donde se guardan (filas 'avisos' —tareas y agentes— y el doc `notices` —Contenido y Anuncios—), del más nuevo al más viejo. */
export async function avisosTodos(db, limite = 30) {
  const { results } = await db.prepare("select json from filas where coleccion = 'avisos' order by orden desc limit ?").bind(limite).all();
  const a = results.map((r) => { try { return JSON.parse(r.json); } catch { return null; } }).filter(Boolean);
  const b = (await leerDoc(db, 'notices', [])).valor;
  const juntos = [...a, ...(Array.isArray(b) ? b : [])].filter((n) => n && n.id);
  const vistos = new Set();
  return juntos.sort((x, y) => (y.t || 0) - (x.t || 0)).filter((n) => (vistos.has(n.id) ? false : (vistos.add(n.id), true))).slice(0, limite);
}

/** /api/status con lo de todos los módulos: sus `checks` (sin repetir un id) y los avisos de las dos tablas. El semáforo se vuelve a calcular. */
export async function completarEstado(respuesta, extra, db) {
  const base = await respuesta.json().catch(() => null);
  if (!base || !Array.isArray(base.checks)) return respuesta;
  const ids = new Set(base.checks.map((c) => c.id));
  const checks = [...base.checks, ...extra.filter((c) => c && c.id && !ids.has(c.id))];
  const overall = checks.some((c) => c.state === 'bad') ? 'bad' : checks.some((c) => c.state === 'warn') ? 'warn' : 'ok';
  const notices = await avisosTodos(db, 30);
  return json({ ...base, overall, checks, notices, unread: notices.filter((n) => !n.read).length });
}

/** «Marcar todo como leído»: lo de la tabla `avisos` ya lo hace el módulo de agentes; aquí lo del doc `notices` (Contenido y Anuncios). */
export async function marcarAvisosLeidos(db) {
  await mutarDoc(db, 'notices', [], (lista) => (Array.isArray(lista) ? lista : []).map((n) => (n && !n.read ? { ...n, read: true } : n)));
}
