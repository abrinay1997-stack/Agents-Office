// Ayudas para auditar la CSP en un NAVEGADOR de verdad (no es un test: el glob es *.test.mjs).
// La oficina real (dist/…) con las cabeceras REALES de cloudflare/public/_headers, el Worker real (`manejar`, con D1 y R2 en memoria) y el Meta de mentira, todo detrás de https://oficina.test.
// Escucha `securitypolicyviolation`, la consola y las peticiones fallidas; no deja salir NADA a la red real.
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { manejar } from '../worker/lib/rutas.js';
import { ARCHIVOS } from '../scripts/copiar-oficina.mjs';

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PUBLIC = join(RAIZ, 'cloudflare', 'public');
let chromiumCache;
export function chromium() {
  if (chromiumCache !== undefined) return chromiumCache;
  for (const base of [import.meta.url, 'file:///opt/node22/lib/node_modules/']) { try { return (chromiumCache = createRequire(base)('playwright').chromium); } catch { /* siguiente */ } }
  return (chromiumCache = null);
}
export const hayDist = () => Object.keys(ARCHIVOS).every((d) => existsSync(join(RAIZ, 'dist', d)));

/** Las reglas de public/_headers como las aplica Cloudflare: cada bloque cuyo patrón casa suma sus cabeceras (la última gana). */
export function cabecerasDe(ruta, texto) {
  texto ??= readFileSync(join(PUBLIC, '_headers'), 'utf8');
  const h = {}; let activo = false;
  for (const l of texto.split('\n')) {
    if (!l.trim() || l.trim().startsWith('#')) continue;
    if (!/^\s/.test(l)) { const re = new RegExp('^' + l.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'); activo = re.test(ruta); continue; }
    if (activo) { const i = l.indexOf(':'); h[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim(); }
  }
  return h;
}
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };
/** El binding ASSETS: public/ + la oficina (dist/ → /oficina/…), con sus cabeceras. */
export function assets(cabecerasTexto) {
  return { fetch: async (req) => {
    const ruta = new URL(req.url).pathname;
    let archivo = join(PUBLIC, ruta);
    if (ruta.startsWith('/oficina/')) { const nombre = ruta.slice(9), de = Object.entries(ARCHIVOS).find(([, a]) => a === nombre)?.[0]; archivo = de ? join(RAIZ, 'dist', de) : ''; }
    if (!archivo || !existsSync(archivo) || ruta.endsWith('/')) return new Response('no', { status: 404 });
    return new Response(readFileSync(archivo), { status: 200, headers: { 'content-type': TIPOS[extname(archivo)] || 'application/octet-stream', ...cabecerasDe(ruta, cabecerasTexto) } });
  } };
}
/** Un PNG de 1×1 que un navegador SÍ decodifica (el Meta de mentira sirve bytes que no son una imagen). */
export const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

/** Abre una página del navegador conectada al Worker real. → { p, ctx, violaciones, consola, fallidas, externas, cerrar } */
export async function abrir(nav, { env, cookie, ancho = 1512, alto = 900, respuestaExterna } = {}) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: alto }, serviceWorkers: 'block' });
  if (cookie) { const [nombre, valor] = cookie.split('='); await ctx.addCookies([{ name: nombre, value: valor, domain: 'oficina.test', path: '/', secure: true, httpOnly: true, sameSite: 'Lax' }]); }
  const p = await ctx.newPage(), violaciones = [], consola = [], fallidas = [], externas = [], http = [];
  await ctx.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push({ dir: e.effectiveDirective, bloqueado: e.blockedURI, doc: e.documentURI.replace(/\?.*/, ''), muestra: (e.sample || '').slice(0, 80) })); });
  await ctx.route('**/*', async (r) => {
    const req = r.request(), u = new URL(req.url());
    if (u.origin !== 'https://oficina.test') { externas.push(req.url().replace(/\?.*/, '')); const x = respuestaExterna?.(u, req); return r.fulfill(x || { status: 204, body: '' }); }
    const cab = new Headers(req.headers()); cab.delete('content-length');
    const init = { method: req.method(), headers: cab }; const cuerpo = req.postDataBuffer(); if (cuerpo && !['GET', 'HEAD'].includes(req.method())) init.body = cuerpo;
    const res = await manejar(new Request(req.url(), init), env, { waitUntil: () => false });
    const h = {}; res.headers.forEach((v, k) => { if (k !== 'set-cookie' && k !== 'content-length') h[k] = v; });
    return r.fulfill({ status: res.status, headers: h, body: Buffer.from(await res.arrayBuffer()) });
  });
  p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) consola.push(`${m.type()}: ${m.text()}`.slice(0, 300)); });
  p.on('pageerror', (e) => consola.push('pageerror: ' + String(e.message).slice(0, 300)));
  p.on('response', (r) => { if (r.status() >= 400 && !/\/api\/live/.test(r.url())) http.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });
  p.on('requestfailed', (q) => fallidas.push(`${q.url().replace(/\?.*/, '').slice(0, 200)} — ${q.failure()?.errorText}`));
  const recoger = async () => { const v = await p.evaluate(() => window.__csp.splice(0)).catch(() => []); violaciones.push(...v); return v; };
  return { p, ctx, violaciones, consola, fallidas, externas, http, recoger, cerrar: () => ctx.close() };
}
/** Las <img> VISIBLES de la página que están rotas (terminaron de cargar sin ancho), con su src. */
export const imagenesRotas = (p) => p.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute('src') && i.getClientRects().length > 0 && getComputedStyle(i).visibility !== 'hidden' && (() => { const r = i.getBoundingClientRect(); if (r.width < 1 || r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) return false; const t = document.elementFromPoint(Math.min(innerWidth - 1, r.left + r.width / 2), Math.min(innerHeight - 1, r.top + r.height / 2)); return !!t && (i.contains(t) || t.contains(i) || i.parentElement?.contains(t)); })()).map((i) => ({ src: (i.getAttribute('src') || '').slice(0, 160), alt: i.alt, vista: i.closest('[data-view],.overlay,#setOv')?.id || '' })));
