// El recorrido de la auditoría de CSP: la oficina real en un navegador real, con datos de ejemplo en cada vista (cuentas con foto, publicaciones con miniatura, anuncios, galería del Estudio…),
// escuchando `securitypolicyviolation`, la consola y las peticiones fallidas, y mirando después de cada paso qué <img> quedó rota. Lo usan el test y `cloudflare/scripts/auditoria-csp.mjs`.
import { nube } from './ayuda-meta.mjs';
import { crearR2 } from './r2-memoria.mjs';
import { abrir, assets, imagenesRotas, PNG_1x1 } from './csp-ayudas.mjs';
import { TOKEN_STAND } from '../../tests/meta-stand.mjs';
import { guardarDoc } from '../worker/lib/almacen.js';
import { PERMISOS_LECTURA, PERMISOS_PUBLICAR, PERMISOS_ANUNCIOS, PERMISOS_MENSAJES } from '../../contenido/meta-nucleo.mjs';

export const AVATAR_IG = (n) => `https://scontent-mia3-1.cdninstagram.com/v/t51/avatar${n}.jpg?stp=dst-jpg_s150x150&oh=AAA${n}&oe=111`;
export const AVATAR_FB = (n) => `https://scontent.xx.fbcdn.net/v/t39/pagina${n}.jpg?stp=dst-jpg_s100x100&oh=BBB${n}&oe=222`;
export const MINI = (n) => `https://scontent-mia3-1.cdninstagram.com/v/t51/pub${n}.jpg?stp=dst-jpg_e35&oh=CCC${n}&oe=333`;
const hace = (h) => new Date(Date.now() - h * 3600e3).toISOString();

/** El mundo de la auditoría: la nube con 2 páginas de Facebook y 2 Instagram (con foto), publicaciones con miniatura, anuncios con creativo, comentarios y mensajes. */
export async function montarMundo() {
  const paginas = [1, 2].map((n) => ({ id: n === 1 ? 'P1' : 'P' + n, name: 'Página ' + n, picture: { data: { url: AVATAR_FB(n) } }, access_token: 'EAAG-TOKEN-DE-PAGINA-NUBE-9876543210', instagram_business_account: { id: n === 1 ? 'IG1' : 'IG' + n, username: 'cuenta' + n, name: 'Cuenta ' + n, profile_picture_url: AVATAR_IG(n) } })); // secrets-ok: de mentira
  const o = await nube({ permisos: [...PERMISOS_LECTURA, ...PERMISOS_PUBLICAR, ...PERMISOS_ANUNCIOS, ...PERMISOS_MENSAJES], stand: { paginas }, config: { anuncios: { cuenta: 'act_1001', whatsapp: '50760001111', topeDiario: 30, topeMensual: 300, topeCampana: 150 }, contenido: { modo: 'simulacro', conductor: 'meta', redes: ['instagram', 'facebook', 'linkedin', 'x'] } } });
  // Meta de mentira, pero lo que baja de sus CDN es una imagen que el navegador puede dibujar
  o.env.AO_FETCH = async (u, i) => (/(fbcdn\.net|cdninstagram\.com)$/.test(new URL(String(u)).hostname) ? new Response(PNG_1x1, { status: 200, headers: { 'content-type': 'image/png' } }) : o.g.fetchFn(u, i));
  // el archivo de cada foto: un PNG que el navegador SÍ puede dibujar
  o.env.FETCH_IMAGEN_META = async () => new Response(PNG_1x1, { status: 200, headers: { 'content-type': 'image/png' } });
  o.env.MEDIA = crearR2(); // la galería del Estudio: una foto subida de verdad por la API (queda en su índice de D1 y en R2)
  o.env.ASSETS = assets();
  // publicaciones con miniatura, comentarios y mensajes
  o.g.st.media = [1, 2, 3].map((i) => ({ id: 'M' + i, caption: 'Lentes nuevos ' + i, permalink: `https://www.instagram.com/p/M${i}/`, timestamp: hace(5 * i), comments_count: 1, media_type: 'IMAGE', thumbnail_url: MINI(i), media_url: MINI(i), like_count: 10 * i }));
  o.g.st.comentarios.M1 = [{ id: 'c1', text: '¿Precio?', username: 'eva', from: { id: 'U1', username: 'eva' }, timestamp: hace(4) }];
  const ANA = { id: 'IGSID1', username: 'ana' }, CIG = { id: 'IG1', username: 'cuenta1' };
  o.g.st.conversaciones = [{ id: 't1', platform: 'instagram', messages: { data: [{ id: 'm1', message: 'Hola, ¿tienen el modelo rojo?', from: ANA, created_time: hace(3), to: { data: [CIG] } }] } }];
  for (const c of Object.values(o.g.st.creativos)) c.thumbnail_url = MINI(9);
  // dejar a Meta con las cuentas, la foto del día, los anuncios y la Bandeja ya leídos
  await o.api('admin', 'POST', '/api/contenido/meta/sincronizar', {});
  await o.api('admin', 'POST', '/api/contenido/analiticas/actualizar?todas=1', {});
  await o.api('admin', 'POST', '/api/anuncios/sincronizar', {});
  await o.api('admin', 'POST', '/api/contenido/bandeja/sincronizar', {});
  const sub = await o.api('admin', 'POST', '/api/media/upload', { name: 'Foto de ejemplo.png', data: 'data:image/png;base64,' + PNG_1x1.toString('base64') });
  o.foto = sub.j?.item?.file || '';
  const bor = await o.api('admin', 'POST', '/api/anuncios/borradores', { nombre: 'Borrador de ejemplo', presupuesto: { usd: 10 }, creativos: [{ id: 'k1', media: o.foto, formato: '1:1', texto: 'Escríbenos por WhatsApp', titular: 'Borrador de ejemplo' }] });
  o.borrador = bor.j?.borrador?.id || bor.j?.id || '';
  const fecha = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
  await o.api('admin', 'POST', '/api/contenido/piezas', { titulo: 'Pieza con imagen', fecha, hora: '18:00', texto: 'Texto de ejemplo para la vista previa.', redes: ['instagram', 'facebook'], medios: o.foto ? [o.foto] : [] });
  return o;
}

const esperar = (p, ms = 700) => p.waitForTimeout(ms);
/** Un clic que no tumba el recorrido si ese botón no está (se anota en `faltaron`). */
export const FALTAS = [];
const clic = async (p, que, { rol = 'button', exacto = false } = {}) => {
  let ultimo = '';
  const probar = async (loc) => { try { await loc.click({ timeout: 6000 }); await esperar(p, 700); return true; } catch (e) { ultimo = String(e.message).split('\n').slice(0, 3).join(' ').slice(0, 160); throw e; } };
  try { return await probar(typeof que === 'string' ? p.getByRole(rol, { name: exacto ? que : new RegExp(que, 'i') }).first() : que); } catch { /* otro papel */ }
  if (typeof que === 'string') { for (const r of ['tab', 'radio', 'menuitem', 'link']) { try { return await probar(p.getByRole(r, { name: new RegExp(que, 'i') }).first()); } catch { /* siguiente */ } } try { return await probar(p.getByText(new RegExp(que, 'i')).first()); } catch { /* nada */ } }
  FALTAS.push(String(que) + ' [' + ultimo + ']'); return false;
};
const tecla = async (p, k) => { await p.locator('body').click({ position: { x: 5, y: 5 }, force: true }).catch(() => {}); await p.keyboard.press(k); await esperar(p, 1500); };
/** Los pasos: cada uno parte de la oficina recién abierta y la deja en una vista o un estado; el recorrido mira después qué se rompió ahí. */
export const PASOS = [
  ['Oficina (inicio)', async () => {}],
  ['Analíticas', async (p) => { await tecla(p, 'r'); await p.waitForSelector('.an-ava', { timeout: 8000 }).catch(() => {}); }],
  ['Contenido · calendario', async (p) => { await tecla(p, 'k'); await p.waitForSelector('#ctOv', { state: 'visible', timeout: 8000 }).catch(() => {}); }],
  ['Contenido · editor de una pieza nueva (Publicar en, vistas previas)', async (p) => {
    await tecla(p, 'k'); await clic(p, 'crear'); await clic(p, p.getByRole('menuitem', { name: /^post/i }).first()) || await clic(p, p.getByText('Post', { exact: true }).first()); await esperar(p, 1200);
    for (const t of ['Perfil', 'Computadora', 'Teléfono']) await clic(p, t, { exacto: false });
    await clic(p, p.locator('.pv-tabs [role=tab]').filter({ hasText: 'Feed' }).last());
    await clic(p, p.getByText(/Cambiar/).first());
  }],
  ['Contenido · una pieza con imagen', async (p) => { await tecla(p, 'k'); await clic(p, p.getByText('Pieza con imagen').first()); await esperar(p, 1200); }],
  ['Contenido · Programación', async (p) => { await tecla(p, 'k'); await clic(p, 'programaci'); }],
  ['Contenido · Bandeja', async (p) => { await tecla(p, 'k'); await clic(p, 'bandeja'); for (const h of await p.locator('.bj-h').all()) await clic(p, h); await esperar(p, 800); }],
  ['Contenido · Perfil', async (p) => { await tecla(p, 'k'); await clic(p, 'perfil', { exacto: false }); }],
  ['Anuncios · resumen y campañas', async (p) => { await tecla(p, 'j'); await clic(p, 'campa', { rol: 'tab' }) || await clic(p, 'campa'); await esperar(p, 800); }],
  ['Anuncios · detalle y borradores', async (p) => { await tecla(p, 'j'); await clic(p, 'campa', { rol: 'tab' }) || await clic(p, 'campa'); await clic(p, p.locator('.anu-fila button, [data-abrir]').first()); await clic(p, 'borradores', { rol: 'tab' }) || await clic(p, 'borradores'); await clic(p, p.locator('[data-babrir]').first()); await esperar(p, 1500); await clic(p, p.locator('[data-bpaso="4"], [data-paso="4"], .anu-pasos button').last()); await esperar(p, 800); await clic(p, p.locator('[data-bmetaver]').first()); await esperar(p, 1500); }],
  ['Anuncios · creativos y sugerencias', async (p) => { await tecla(p, 'j'); await clic(p, 'creativos', { rol: 'tab' }) || await clic(p, 'creativos'); await esperar(p, 800); await clic(p, 'sugerencias', { rol: 'tab' }) || await clic(p, 'sugerencias'); }],
  ['Estudio · galería y visor', async (p) => { await tecla(p, 'e'); await clic(p, p.locator('.st-thumb').first()); await esperar(p, 1000); }],
  ['Cerebro', async (p) => { await tecla(p, 'g'); await esperar(p, 800); }],
  ['Tareas', async (p) => { await tecla(p, 'h'); }],
  ['Calendario de tareas', async (p) => { await tecla(p, 'p'); }],
  ['Dimitri', async (p) => { await tecla(p, 's'); }],
  ['Ajustes (Mi perfil, Cuentas y roles, Contenido, Anuncios)', async (p) => { await tecla(p, ','); await p.waitForSelector('.sg-tabs', { timeout: 8000 }).catch(() => {}); // (las pestañas de Ajustes se repintan sin parar y Playwright no logra pulsarlas: se pulsan desde la página)
    for (const t of ['Mi perfil', 'Cuentas y roles', 'Contenido', 'Anuncios', 'Conectores']) { const hecho = await p.evaluate((t) => { const b = [...document.querySelectorAll('.sg-tabs [role=tab]')].find((x) => x.textContent.trim() === t); b?.click(); return !!b; }, t); if (!hecho) FALTAS.push('Ajustes: ' + t); await esperar(p, 900); } }],
  ['Estado, Negocio y Costos', async (p) => { await tecla(p, 'o'); await tecla(p, 'n'); await tecla(p, 'u'); }],
];

/** Recorre y devuelve { hallazgos, resumen }. `nubeJs`: el texto de nube.js que se sirve (para medir «antes» con el de la rama anterior). */
export async function recorrer(nav, mundo, { nubeJs = null, cabeceras = null, ancho = 1512, pasos = PASOS, captura = null } = {}) {
  // `nubeJs` y `cabeceras` (el texto de un _headers): para medir cómo estaba ANTES, con los de la rama anterior
  const base = cabeceras ? assets(cabeceras) : mundo.env.ASSETS;
  const env = nubeJs || cabeceras ? { ...mundo.env, ASSETS: { fetch: async (req) => (nubeJs && new URL(req.url).pathname === '/nube.js' ? new Response(nubeJs, { status: 200, headers: { 'content-type': 'text/javascript' } }) : base.fetch(req)) } } : mundo.env;
  // el único tercero que la oficina enmarca: la vista previa de anuncios de Meta (el de mentira devuelve una página mínima)
  const respuestaExterna = (u) => (u.origin === 'https://www.facebook.com' && u.pathname === '/ads/api/preview_iframe.php' ? { status: 200, contentType: 'text/html', body: '<!doctype html><p>Vista previa de Meta (de mentira)</p>' } : null);
  const s = await abrir(nav, { env, cookie: mundo.ck.admin, ancho, respuestaExterna });
  const hallazgos = [];
  s.p.setDefaultTimeout(5000);
  for (const [nombre, paso] of pasos) {
    await s.p.goto('https://oficina.test/', { waitUntil: 'domcontentloaded', timeout: 30000 }); await s.p.waitForSelector('#topdock', { timeout: 15000 }).catch(() => {}); await esperar(s.p, 1200);
    FALTAS.length = 0;
    try { await paso(s.p, mundo); } catch (e) { hallazgos.push({ vista: nombre, tipo: 'paso', detalle: 'el paso falló: ' + String(e.message).split('\n')[0] }); }
    for (const f of FALTAS) hallazgos.push({ vista: nombre, tipo: 'cobertura', detalle: 'no se pudo pulsar: ' + f.slice(0, 80) });
    await esperar(s.p, 900);
    for (const v of await s.recoger()) hallazgos.push({ vista: nombre, tipo: 'csp', detalle: `${v.dir} bloqueó ${v.bloqueado.replace(/\?.*/, '')}`, regla: v.dir });
    for (const r of await imagenesRotas(s.p)) hallazgos.push({ vista: nombre, tipo: 'imagen-rota', detalle: r.src.replace(/\?.*/, '') });
    if (captura) await captura(s.p, nombre);
  }
  const ruido = /WebGL|GPU stall|WebSocket connection|tunnel via proxy|Failed to load resource: net::ERR_(TUNNEL|PROXY)/i;
  for (const c of s.consola) if (!ruido.test(c)) hallazgos.push({ vista: '(consola)', tipo: 'consola', detalle: c });
  for (const h of [...new Set(s.http)]) hallazgos.push({ vista: '(red)', tipo: 'http', detalle: h });
  for (const f of s.fallidas) if (!ruido.test(f)) hallazgos.push({ vista: '(red)', tipo: 'peticion-fallida', detalle: f });
  const unicos = [...new Map(hallazgos.map((h) => [`${h.vista}|${h.tipo}|${h.detalle}`, h])).values()];
  await s.cerrar();
  return { hallazgos: unicos, externas: [...new Set(s.externas)] };
}

/** Lo que se ve SIN sesión (el acceso y el enlace de una invitación, con su CSP estricta): ninguna violación ni petición fallida. */
export async function recorrerPublicas(nav, mundo, { ancho = 1280 } = {}) {
  const s = await abrir(nav, { env: mundo.env, cookie: null, ancho }), hallazgos = [];
  for (const [nombre, ruta] of [['Acceso (login)', '/'], ['Invitación', '/invitacion/' + 'ab12'.repeat(12)]]) {
    await s.p.goto('https://oficina.test' + ruta, { waitUntil: 'domcontentloaded', timeout: 30000 }); await esperar(s.p, 1200);
    for (const v of await s.recoger()) hallazgos.push({ vista: nombre, tipo: 'csp', detalle: `${v.dir} bloqueó ${v.bloqueado.replace(/\?.*/, '')}` });
    for (const r of await imagenesRotas(s.p)) hallazgos.push({ vista: nombre, tipo: 'imagen-rota', detalle: r.src });
  }
  for (const c of s.consola) if (!/Failed to load resource: the server responded with a status of 40[134]/.test(c)) hallazgos.push({ vista: '(consola)', tipo: 'consola', detalle: c });
  for (const f of s.fallidas) hallazgos.push({ vista: '(red)', tipo: 'peticion-fallida', detalle: f });
  await s.cerrar();
  return { hallazgos };
}
