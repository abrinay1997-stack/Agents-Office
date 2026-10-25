// Agents Office — LEER UNA WEB para «Preparar desde mi web» (25 oct 2026). Puro (sin fs, sin DNS): corre igual en el Worker de Cloudflare y en la oficina local; el `fetch` se inyecta.
// Lo que lee es DATO, nunca una orden: el texto pasa por safety.injectionIn y, si trae órdenes escondidas, esa página no se le da al modelo (y se avisa).
//
// PROTECCIÓN SSRF (el servidor hace la petición, así que no puede ir a donde quiera quien escribe la dirección):
//  · solo https, solo el puerto 443, sin usuario ni contraseña en la dirección;
//  · ninguna dirección IP escrita a mano (v4 ni v6: se pide el nombre del dominio), ningún nombre sin punto, ni .local/.internal/.lan/.home…, ni «localhost», ni los servicios de «DNS comodín» (nip.io…);
//  · cada redirección se vuelve a validar y solo se sigue si queda en el MISMO sitio (el mismo nombre, con o sin «www.»); un salto a otro dominio se avisa y se para;
//  · tope de tamaño (1,5 MB por página, leído en flujo) y de tiempo (10 s por petición, 30 s en total), solo texto/HTML;
//  · hasta 5 páginas del mismo dominio, elegidas por sus enlaces de navegación (inicio, nosotros, servicios, precios, contacto, preguntas).
// LÍMITE QUE NO SE PUEDE CERRAR AQUÍ: un Worker no resuelve nombres (DNS), así que un dominio normal cuyo registro apunte a una IP privada no se detecta por su nombre. Se cierra por dos lados:
// Cloudflare no deja a un Worker llegar a redes privadas, y lo leído nunca se devuelve crudo: solo el texto extraído, que pasa por el filtro de órdenes y por el modelo, y se enseña al dueño para revisar.
import { injectionIn } from './safety.mjs';

export const UA = 'AgentsOffice-LectorWeb/1.0 (+lee solo la web que el dueño de la oficina indicó)';
export const LIMITES = { bytesPagina: 1_500_000, bytesRobots: 100_000, msPeticion: 10_000, msTotal: 30_000, maxPaginas: 5, maxRedirecciones: 4, textoPagina: 12_000, textoTotal: 40_000, htmlAnalizado: 600_000 };

const SUFIJOS_PRIVADOS = ['.local', '.localhost', '.internal', '.lan', '.home', '.corp', '.intranet', '.private', '.localdomain', '.home.arpa', '.in-addr.arpa'];
const COMODIN_DNS = ['nip.io', 'sslip.io', 'xip.io', 'localtest.me', 'lvh.me', 'vcap.me', '1u.ms', 'traefik.me', 'local.gd'];

/** ¿El texto es una IP de red privada, loopback, de enlace local o reservada? (para decir POR QUÉ se rechaza) */
export function ipv4Privada(h) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h); if (!m) return false;
  const [a, b] = [+m[1], +m[2]];
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}

/** La dirección que el dueño escribió (o la que sale de un enlace/redirección), ¿se puede leer? → { ok:true, url: 'https://…' } o { ok:false, motivo } */
export function urlSegura(texto) {
  let u; try { u = new URL(String(texto ?? '').trim()); } catch { return { ok: false, motivo: 'La dirección no es válida: escribe la web completa, como https://tuempresa.com' }; }
  if (u.protocol !== 'https:') return { ok: false, motivo: 'Solo se leen webs seguras (https://). Si tu web es http://, pégame el texto en «Lo que la web no dice».' };
  if (u.username || u.password) return { ok: false, motivo: 'La dirección lleva usuario o contraseña: no se lee.' };
  if (u.port && u.port !== '443') return { ok: false, motivo: 'Solo se leen webs en el puerto normal (443).' };
  const h = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!h) return { ok: false, motivo: 'La dirección no tiene nombre de sitio.' };
  if (h.startsWith('[') || h.includes(':')) return { ok: false, motivo: 'Una dirección IPv6 escrita a mano no se lee: usa el nombre del dominio.' };
  if (/^[\d.]+$/.test(h) || /^0x[0-9a-f]+$/i.test(h)) return { ok: false, motivo: ipv4Privada(h) ? 'Esa dirección es de una red privada o del propio servidor: no se lee.' : 'Una dirección IP escrita a mano no se lee: usa el nombre del dominio (tuempresa.com).' };
  if (!h.includes('.')) return { ok: false, motivo: 'Ese nombre no es un dominio de internet (no tiene punto): no se lee.' };
  if (SUFIJOS_PRIVADOS.some((s) => h.endsWith(s)) || h === 'metadata' || h.startsWith('metadata.')) return { ok: false, motivo: 'Ese nombre es de una red interna: no se lee.' };
  if (COMODIN_DNS.some((s) => h === s || h.endsWith('.' + s))) return { ok: false, motivo: 'Los servicios de «DNS comodín» (nip.io y parecidos) se usan para llegar a redes privadas: no se leen.' };
  if (h.length > 253 || h.split('.').some((p) => !p || p.length > 63)) return { ok: false, motivo: 'El nombre del sitio no es válido.' };
  u.hash = '';
  return { ok: true, url: u.toString() };
}

/** El sitio sin «www.»: dos direcciones del mismo sitio tienen el mismo. */
export const sitioDe = (url) => { try { return new URL(url).hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, ''); } catch { return ''; } };

/* ---------- robots.txt (lo básico) ---------- */
/** ¿robots.txt deja leer esta ruta al lector? Grupo del lector si lo hay, si no el «*»; gana la regla más larga; a igual largo, la que permite. */
export function robotsPermite(robots, ruta) {
  const grupos = []; let actual = null, seguido = false;
  for (const crudo of String(robots || '').split(/\r?\n/)) {
    const l = crudo.replace(/#.*$/, '').trim(); if (!l) continue;
    const i = l.indexOf(':'); if (i < 0) continue;
    const k = l.slice(0, i).trim().toLowerCase(), v = l.slice(i + 1).trim();
    if (k === 'user-agent') { if (!actual || !seguido) { actual = { agentes: [], reglas: [] }; grupos.push(actual); } actual.agentes.push(v.toLowerCase()); seguido = true; }
    else if ((k === 'allow' || k === 'disallow') && actual) { actual.reglas.push({ permite: k === 'allow', patron: v }); seguido = false; }
  }
  const mio = grupos.filter((g) => g.agentes.some((a) => a && a !== '*' && UA.toLowerCase().includes(a)));
  const reglas = (mio.length ? mio : grupos.filter((g) => g.agentes.includes('*'))).flatMap((g) => g.reglas).filter((r) => r.patron);
  const casa = (patron) => { const fin = patron.endsWith('$'); const p = (fin ? patron.slice(0, -1) : patron).split('*').map((x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*'); return new RegExp('^' + p + (fin ? '$' : '')).test(ruta); };
  let mejor = null;
  for (const r of reglas) if (casa(r.patron) && (!mejor || r.patron.length > mejor.patron.length || (r.patron.length === mejor.patron.length && r.permite))) mejor = r;
  return mejor ? mejor.permite : true;
}

/* ---------- HTML → texto ---------- */
const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»', iexcl: '¡', iquest: '¿', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', uuml: 'ü', euro: '€', copy: '©', reg: '®' };
const decodificar = (t) => t.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => { if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ' '; } return ENTIDADES[e] ?? m; });

/** Quita scripts, estilos y marcas y deja el texto legible, con su título, su descripción y sus enlaces. Solo mira los primeros LIMITES.htmlAnalizado caracteres. */
export function htmlATexto(html) {
  let h = String(html || '').slice(0, LIMITES.htmlAnalizado);
  const titulo = decodificar((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(h)?.[1] || '').replace(/\s+/g, ' ').trim()).slice(0, 200);
  const descripcion = decodificar(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i.exec(h)?.[1] || /<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i.exec(h)?.[1] || '').slice(0, 400);
  h = h.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript|svg|template|iframe|object|embed|head)\b[\s\S]*?<\/\1\s*>/gi, ' ');
  const enlaces = [];
  for (const m of h.matchAll(/<a\b[^>]*?href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a\s*>/gi)) {
    if (enlaces.length >= 200) break;
    enlaces.push({ href: decodificar((m[1] ?? m[2] ?? m[3] ?? '').trim()), texto: decodificar(m[4].replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim().slice(0, 80) });
  }
  h = h.replace(/<(br|hr)\s*\/?>/gi, '\n').replace(/<\/(p|div|li|tr|h[1-6]|section|article|header|footer|nav|ul|ol|table|blockquote|dd|dt|form)\s*>/gi, '\n').replace(/<(td|th)\b[^>]*>/gi, ' | ').replace(/<h([1-6])\b[^>]*>/gi, (m, n) => '\n' + '#'.repeat(Math.min(3, +n)) + ' ').replace(/<li\b[^>]*>/gi, '\n- ');
  const texto = decodificar(h.replace(/<[^>]*>/g, ' ')).replace(/[ \t\f\v]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { titulo, descripcion, texto, enlaces };
}

/** Las páginas que más prometen para conocer una empresa: por las palabras de su enlace o de su dirección. Mismo sitio, sin repetir, sin archivos ni anclas. */
const CLAVES = [
  [/(nosotros|quienes[-\s]*somos|acerca|sobre[-\s]*(nosotros|mi)|about|historia|equipo|empresa)/i, 5],
  [/(servicios?|productos?|soluciones|ofertas?|planes?|catalogo|catálogo|tienda|shop|services|products)/i, 5],
  [/(precios?|tarifas?|costos?|pricing|cotiza|planes)/i, 5],
  [/(contacto|contact|ubicacion|ubicación|donde[-\s]*estamos|sucursales|horarios?)/i, 4],
  [/(preguntas|faq|ayuda|dudas|help)/i, 3],
  [/(clientes|casos|portafolio|portfolio|testimonios|resenas|reseñas|reviews)/i, 2],
];
export function elegirEnlaces(enlaces, base, max = LIMITES.maxPaginas - 1) {
  const sitio = sitioDe(base), vistos = new Set([quitarRastro(base)]), cand = [];
  for (const e of enlaces) {
    if (!e.href || /^(#|mailto:|tel:|javascript:|data:|whatsapp:|sms:)/i.test(e.href)) continue;
    let u; try { u = new URL(e.href, base); } catch { continue; }
    if (u.protocol !== 'https:' || sitioDe(u.href) !== sitio || /\.(pdf|jpe?g|png|gif|webp|svg|zip|rar|mp4|mp3|docx?|xlsx?|pptx?|css|js|ico|xml|json)(\?|$)/i.test(u.pathname)) continue;
    u.hash = ''; const k = quitarRastro(u.href); if (vistos.has(k)) continue;
    const campo = `${u.pathname} ${e.texto}`; let puntos = 0; for (const [re, p] of CLAVES) if (re.test(campo)) puntos = Math.max(puntos, p);
    if (!puntos) continue;
    vistos.add(k); cand.push({ url: u.href, puntos, largo: u.pathname.length });
  }
  return cand.sort((a, b) => b.puntos - a.puntos || a.largo - b.largo).slice(0, max).map((c) => c.url);
}
const quitarRastro = (u) => { try { const x = new URL(u); x.hash = ''; return (x.origin + x.pathname.replace(/\/+$/, '') + x.search).toLowerCase(); } catch { return String(u); } };

/* ---------- la petición ---------- */
/** Lee un cuerpo en flujo hasta `tope` bytes. → { texto, truncado } */
async function leerCuerpo(resp, tope) {
  const cuerpo = resp.body;
  if (!cuerpo || typeof cuerpo.getReader !== 'function') { const t = await resp.text(); return { texto: t.slice(0, tope), truncado: t.length > tope }; }
  const lector = cuerpo.getReader(), trozos = []; let n = 0, truncado = false;
  for (;;) {
    const { done, value } = await lector.read(); if (done) break;
    if (n + value.length > tope) { trozos.push(value.slice(0, tope - n)); n = tope; truncado = true; try { await lector.cancel(); } catch { /* ya cerró */ } break; }
    trozos.push(value); n += value.length;
  }
  const todo = new Uint8Array(n); let o = 0; for (const t of trozos) { todo.set(t, o); o += t.length; }
  return { texto: new TextDecoder('utf-8', { fatal: false }).decode(todo), truncado };
}

/** Una petición con las reglas de arriba: redirecciones a mano y validadas, tiempo, tamaño y tipo. → { ok, url, status, texto, truncado } o { ok:false, motivo } */
export async function traer(url, { fetchFn, tope = LIMITES.bytesPagina, ms = LIMITES.msPeticion, sitio, aceptar = /^(text\/html|application\/xhtml\+xml|text\/plain)/i, hasta = Infinity, ahora = Date.now }) {
  let actual = url;
  for (let salto = 0; salto <= LIMITES.maxRedirecciones; salto++) {
    const v = urlSegura(actual); if (!v.ok) return { ok: false, motivo: v.motivo, bloqueada: true };
    if (sitio && sitioDe(v.url) !== sitio) return { ok: false, motivo: `te manda a otro sitio (${sitioDe(v.url)}): si ese es el tuyo, pega esa dirección`, otroSitio: true };
    const falta = hasta - ahora(); if (falta <= 0) return { ok: false, motivo: 'se acabó el tiempo total de lectura' };
    let r;
    try { r = await fetchFn(v.url, { method: 'GET', redirect: 'manual', headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1', 'accept-language': 'es,en;q=0.5' }, signal: AbortSignal.timeout(Math.min(ms, falta)) }); }
    catch (e) { return { ok: false, motivo: e?.name === 'TimeoutError' || e?.name === 'AbortError' ? 'tardó más de 10 segundos en contestar' : 'no se pudo conectar' }; }
    if ([301, 302, 303, 307, 308].includes(r.status)) {
      const l = r.headers.get('location'); try { await r.body?.cancel(); } catch { /* ya */ }
      if (!l) return { ok: false, motivo: 'una redirección sin destino' };
      try { actual = new URL(l, v.url).href; } catch { return { ok: false, motivo: 'una redirección con destino inválido' }; }
      continue;
    }
    if (!r.ok) { try { await r.body?.cancel(); } catch { /* ya */ } return { ok: false, motivo: `contestó ${r.status}`, status: r.status }; }
    const tipo = r.headers.get('content-type') || '';
    if (aceptar && tipo && !aceptar.test(tipo)) { try { await r.body?.cancel(); } catch { /* ya */ } return { ok: false, motivo: `no es una página de texto (${tipo.split(';')[0]})` }; }
    const largo = Number(r.headers.get('content-length') || 0);
    const c = await leerCuerpo(r, tope);
    return { ok: true, url: v.url, status: r.status, texto: c.texto, truncado: c.truncado || largo > tope };
  }
  return { ok: false, motivo: 'demasiadas redirecciones' };
}

/**
 * Lee la web de la empresa: la página que se pidió y hasta 4 más del mismo sitio (nosotros, servicios, precios, contacto, preguntas).
 * → { ok, sitio, paginas: [{ url, titulo, descripcion, texto, truncada }], avisos: [{ nivel, texto }], saltadas: [{ url, motivo }] }
 * `paginas` solo trae las que se pueden dar al modelo; una con órdenes escondidas va a `saltadas` (con `inyeccion: true`). `ok:false` + `motivo` si ni la primera se pudo leer.
 */
export async function leerWeb(direccion, { fetchFn, maxPaginas = LIMITES.maxPaginas, ahora = Date.now } = {}) {
  const v = urlSegura(direccion); if (!v.ok) return { ok: false, motivo: v.motivo, paginas: [], avisos: [], saltadas: [] };
  const sitio = sitioDe(v.url), hasta = ahora() + LIMITES.msTotal, avisos = [], saltadas = [], paginas = [];
  // robots.txt: si no hay o no contesta, se puede leer
  let robots = '';
  try { const o = new URL(v.url); const r = await traer(o.origin + '/robots.txt', { fetchFn, tope: LIMITES.bytesRobots, ms: 5000, sitio, aceptar: null, hasta, ahora }); if (r.ok) robots = r.texto; } catch { /* sin robots */ }
  const permite = (u) => { try { const x = new URL(u); return robotsPermite(robots, x.pathname + x.search); } catch { return true; } };
  if (!permite(v.url)) return { ok: false, motivo: 'El robots.txt de tu web pide que no la lean programas automáticos. Pégame el texto de tu web en «Lo que la web no dice» (o cambia ese archivo si quieres que la oficina la lea).', robots: true, paginas: [], avisos: [], saltadas: [] };
  const cola = [v.url], hechas = new Set();
  while (cola.length && paginas.length + saltadas.length < maxPaginas) {
    const u = cola.shift(), k = quitarRastro(u); if (hechas.has(k)) continue; hechas.add(k);
    if (paginas.length + saltadas.length > 0 && !permite(u)) { saltadas.push({ url: u, motivo: 'el robots.txt de tu web no deja leerla' }); continue; }
    const r = await traer(u, { fetchFn, sitio, hasta, ahora });
    if (!r.ok) { if (!paginas.length && !saltadas.length && cola.length === 0 && u === v.url) return { ok: false, motivo: `No pude leer ${u}: ${r.motivo}.`, paginas, avisos, saltadas: [{ url: u, motivo: r.motivo }] }; saltadas.push({ url: u, motivo: r.motivo }); continue; }
    const p = htmlATexto(r.texto);
    if (r.truncado) avisos.push({ nivel: 'info', texto: `${r.url}: pesa más de 1,5 MB; leí solo el principio.` });
    if (p.texto.length < 40) { saltadas.push({ url: r.url, motivo: 'casi no tiene texto (¿se arma con JavaScript?)' }); continue; }
    const orden = injectionIn(`${p.titulo}\n${p.descripcion}\n${p.texto}`);
    if (orden) { saltadas.push({ url: r.url, motivo: `trae órdenes escondidas para un asistente («${orden}»): no la usé`, inyeccion: true }); avisos.push({ nivel: 'alto', texto: `La página ${r.url} trae órdenes escondidas para un asistente (${orden}). No la usé y no seguí ninguna.` }); continue; }
    paginas.push({ url: r.url, titulo: p.titulo, descripcion: p.descripcion, texto: p.texto.slice(0, LIMITES.textoPagina), truncada: p.texto.length > LIMITES.textoPagina });
    if (paginas.length + saltadas.length === 1) for (const e of elegirEnlaces(p.enlaces, r.url, maxPaginas - 1)) cola.push(e);
  }
  if (!paginas.length) return { ok: false, motivo: saltadas.some((s) => s.inyeccion) ? 'La página de inicio trae órdenes escondidas para un asistente: no la usé. Pégame el texto de tu web en «Lo que la web no dice».' : `No pude sacar texto de ${v.url}${saltadas[0] ? ' (' + saltadas[0].motivo + ')' : ''}. Pégame el texto de tu web en «Lo que la web no dice».`, paginas, avisos, saltadas };
  return { ok: true, sitio, paginas, avisos, saltadas };
}

/** Las páginas leídas como DATOS para el modelo (cada una entre etiquetas, con tope total). */
export function textoParaModelo(paginas) {
  let resto = LIMITES.textoTotal, out = '';
  for (const p of paginas) { if (resto <= 0) break; const t = p.texto.slice(0, resto); resto -= t.length; out += `<web url="${p.url.replace(/"/g, '')}">\n${p.titulo ? `Título: ${p.titulo}\n` : ''}${p.descripcion ? `Descripción: ${p.descripcion}\n` : ''}${t}\n</web>\n`; }
  return out;
}
