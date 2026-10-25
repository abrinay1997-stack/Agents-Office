// GET /api/mcp en la nube: lo que la barra de conectores y su panel esperan (la misma forma que mcp.summary() de la oficina local), pero
// leído de la tabla `conectores` del Worker; no hay `claude mcp list` que correr. Nunca sale un token ni el nombre de un secreto (el
// panel solo necesita saber si el token está puesto), y el servidor que se ve es solo el host de la URL.
import { secretoPermitido } from './conectores.js';
const DEPT_KEYS = ['emails', 'sales', 'marketing', 'ops', 'fin', 'delivery'];
const norm = (s) => String(s || '').toLowerCase().replace(/^plugin:[^:]+:/, '').replace(/^claude\.ai\s+/, '').replace(/\s+mcp$/, '').replace(/[^a-z0-9]/g, '');
const nombreBonito = (n) => String(n).replace(/[-_]+/g, ' ').trim().replace(/\b[a-z]/g, (c) => c.toUpperCase());
const coincide = (c, x) => { const n = norm(x); return !!n && (norm(c.nombre) === n || String(c.nombre) === String(x)); };
/** El MCP de la propia oficina (oficina-mcp.mjs) nunca llega a un agente, ni nombrándolo en allow o departments (como mcp.isOffice). */
export const esDeLaOficina = (c) => /oficina-mcp\.mjs/i.test(String(c.url || '')) || norm(c.nombre) === 'agentsoffice';
const host = (u) => { try { return new URL(u).host; } catch { return ''; } };
const lista = (v) => { try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };

/** `filas`: la tabla conectores; `cfg`: ajustes.mcp ({ allow, deny, departments }) tal como los guarda Ajustes. */
export function resumenMcp({ filas = [], env = {}, cfg = {}, ahora = Date.now() } = {}) {
  const allow = Array.isArray(cfg.allow) ? cfg.allow : [], deny = Array.isArray(cfg.deny) ? cfg.deny : [];
  const porDept = cfg.departments && typeof cfg.departments === 'object' ? cfg.departments : {};
  const servers = filas.map((f) => {
    const c = { ...f, nombre: String(f.nombre) };
    const oficina = esDeLaOficina(c);
    const denied = oficina || deny.some((x) => coincide(c, x));
    const permitido = !denied && (!allow.length || allow.some((x) => coincide(c, x)));
    const propio = Object.entries(porDept).find(([k]) => coincide(c, k));
    const depts = (propio ? (Array.isArray(propio[1]) ? propio[1] : []) : lista(f.departamentos)).filter((d) => DEPT_KEYS.includes(d));
    const conToken = !f.secreto || (secretoPermitido(f.secreto) && typeof env?.[f.secreto] === 'string' && env[f.secreto].length > 0);
    const lectura = lista(f.herramientas_lectura), envio = lista(f.herramientas_envio);
    const status = !f.activo ? 'disabled' : conToken ? 'connected' : 'needs-auth';
    return { id: c.nombre, raw: c.nombre, name: nombreBonito(c.nombre), key: norm(c.nombre), plugin: '', status,
      detail: status === 'needs-auth' ? 'Falta guardar su token como secreto del Worker y volver a desplegar.' : '', target: host(f.url), source: 'nube',
      tools: [...lectura, ...envio], depts: denied ? [] : depts, allowed: permitido, denied, defaultDenied: false, ...(oficina ? { office: true } : {}),
      kinds: Object.fromEntries([...lectura.map((t) => [t, 'read']), ...envio.map((t) => [t, 'write'])]) };
  });
  return { discoveredAt: ahora, discovering: false, web: true, browser: { on: false, installed: false, device: '', onboarded: false }, nube: true, tools: false, servers };
}
