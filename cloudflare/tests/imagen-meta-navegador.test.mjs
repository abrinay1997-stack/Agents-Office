// nube.js reescribe, en un NAVEGADOR de verdad, toda imagen de la red de Meta a /api/imagen-meta (la CSP solo deja el mismo origen), sin una sola violación de CSP,
// por cualquiera de los caminos con que la página pone una imagen (HTML escrito, innerHTML, insertAdjacentHTML, .src, setAttribute, srcset, estilo con url()).
// Y lo que NO es de Meta no se toca. Con Playwright (se salta sin él).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium as cr, PNG_1x1, cabecerasDe } from './csp-ayudas.mjs';

const SALTAR = cr() ? false : 'Playwright no está instalado';
const nubeJs = readFileSync(new URL('../public/nube.js', import.meta.url), 'utf8');
let nav;
before(async () => { if (!SALTAR) nav = await cr().launch().catch(() => null); });
after(async () => { await nav?.close(); });

const AV = 'https://scontent-mia3-1.cdninstagram.com/v/t51/ava.jpg?stp=dst-jpg_s150x150&oh=A&oe=1';
const PAGINA = `<!doctype html><body><div id="topdock"></div>
<img id="estatica" src="${AV.replace(/&/g, '&amp;')}" alt="">
<div id="a"></div><div id="b"></div><div id="c"></div><div id="d"></div><div id="e"></div><div id="f"></div><div id="g"></div>
<img id="ajena" src="https://evil.example/x.png" alt=""><img id="parecida" src="https://evilfbcdn.net/x.png" alt=""><img id="http" src="http://scontent.fbcdn.net/x.png" alt="">
<script src="/nube.js" defer></script></body>`;

test('nube.js: las imágenes de Meta cargan por /api/imagen-meta sin violar la CSP; las de otros hosts no se tocan', { skip: SALTAR }, async (t0) => {
  if (!nav) return t0.skip('sin Chromium');
  const ctx = await nav.newContext(), p = await ctx.newPage(), pedidas = [], violaciones = [], externas = [];
  await ctx.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.blockedURI.replace(/\?.*/, ''))); });
  await ctx.route('**/*', async (r) => {
    const u = new URL(r.request().url());
    if (u.origin !== 'https://oficina.test') { externas.push(u.href); return r.fulfill({ status: 200, contentType: 'image/png', body: PNG_1x1 }); } // si una petición llega aquí, la CSP no la frenó
    const csp = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'";
    if (u.pathname === '/') return r.fulfill({ status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': csp }, body: PAGINA });
    if (u.pathname === '/nube.js') return r.fulfill({ status: 200, contentType: 'text/javascript', body: nubeJs });
    if (u.pathname === '/api/imagen-meta') { pedidas.push(u.searchParams.get('u')); return r.fulfill({ status: 200, contentType: 'image/png', body: PNG_1x1 }); }
    if (u.pathname === '/api/yo') return r.fulfill({ status: 500, contentType: 'application/json', body: '{}' }); // sin yo, nube.js no pinta la barra: solo queda lo de las imágenes
    return r.fulfill({ status: 404, body: 'no' });
  });
  p.on('dialog', (d) => d.dismiss());
  await p.goto('https://oficina.test/', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__nube === true);
  await p.evaluate(({ AV }) => {
    const M = (n) => `https://scontent.xx.fbcdn.net/v/t39/${n}.jpg?oh=1&oe=2&_nc_sid=3`;
    document.getElementById('a').innerHTML = `<img id="i-html" src="${M('a').replace(/&/g, '&amp;')}" alt="">`;
    document.getElementById('b').insertAdjacentHTML('beforeend', `<img id="i-iah" src='${M('b')}' alt="">`);
    const i = new Image(); i.id = 'i-src'; i.src = M('c'); document.getElementById('c').append(i);
    const j = document.createElement('img'); j.id = 'i-attr'; j.setAttribute('src', M('d')); document.getElementById('d').append(j);
    document.getElementById('e').innerHTML = `<img id="i-set" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" srcset="${M('e')} 1x, ${M('e2')} 2x" alt="">`;
    document.getElementById('f').innerHTML = `<span id="i-bg" style="display:block;width:20px;height:20px;background-image:url('${M('f')}')"></span>`;
    document.getElementById('g').innerHTML = `<img id="i-ig" src="${AV}" alt="">`;
  }, { AV });
  await p.waitForTimeout(800);
  const r = await p.evaluate(() => ({
    violaciones: window.__csp.slice(),
    rotas: [...document.images].filter((i) => /^i-|estatica/.test(i.id) && (!i.complete || i.naturalWidth === 0)).map((i) => i.id),
    srcs: Object.fromEntries([...document.images].map((i) => [i.id, i.getAttribute('src')])), srcset: document.getElementById('i-set').getAttribute('srcset'), bg: document.getElementById('i-bg').getAttribute('style'),
  }));
  assert.deepEqual(r.rotas, [], 'ninguna imagen de Meta quedó rota: ' + JSON.stringify(r.srcs));
  for (const id of ['estatica', 'i-html', 'i-iah', 'i-src', 'i-attr', 'i-ig']) assert.match(r.srcs[id], /^\/api\/imagen-meta\?u=https%3A%2F%2F/, `${id}: ${r.srcs[id]}`);
  assert.match(r.srcset, /^\/api\/imagen-meta\?u=\S+ 1x, \/api\/imagen-meta\?u=\S+ 2x$/); assert.match(r.bg, /url\('\/api\/imagen-meta\?u=/);
  assert.ok(pedidas.some((u) => u === AV), 'la URL completa viaja codificada y se decodifica igual (con su & y su firma)'); assert.ok(pedidas.length >= 7, pedidas.join('\n'));
  // lo que no es de Meta: igual que estaba (y la CSP lo bloquea: es lo correcto)
  assert.equal(r.srcs.ajena, 'https://evil.example/x.png'); assert.equal(r.srcs.parecida, 'https://evilfbcdn.net/x.png'); assert.equal(r.srcs.http, 'http://scontent.fbcdn.net/x.png');
  // la única violación «de Meta» es la <img> escrita en el HTML ANTES de que nube.js (defer) corra: la página real no escribe ninguna (las pinta con JS, más tarde) y aun así el aviso de error la rescata (`estatica`, arriba)
  assert.deepEqual(r.violaciones.map((x) => new URL(x).host).sort(), ['evil.example', 'evilfbcdn.net', 'scontent-mia3-1.cdninstagram.com', 'scontent.fbcdn.net'], 'fuera de la estática, solo los hosts que NO son de Meta (incluidos http y el parecido) llegan a la CSP');
  assert.deepEqual(externas, [], 'ninguna petición salió a un tercero');
  await ctx.close();
});
