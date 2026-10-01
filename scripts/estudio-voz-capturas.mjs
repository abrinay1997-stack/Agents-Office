// Herramienta de desarrollo (no entra en `npm run check`): la Voz y la Música del Estudio (MiniMax) en el navegador, con y sin
// key, en claro y oscuro, a 1512, 1024 y 390 px. Guarda capturas en data/capturas/estudio-voz/ y MIDE lo que se puede medir:
// que nada se salga de la pantalla, que los objetivos midan 24 px, que el panel «Voces» guarde el foco y que Esc lo cierre.
//   node scripts/estudio-voz-capturas.mjs
// Levanta su propia oficina en una carpeta temporal (como scripts/estudio-capturas.mjs) y SIMULA MiniMax en la página: /api/media
// recibe el catálogo de MiniMax y las voces, y /api/voces/* contesta como el contrato (nunca llama a MiniMax ni usa una key real).
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'data', 'capturas', 'estudio-voz');
const ANCHOS = [[1512, 900], [1024, 768], [390, 844]];

/** Un WAV de `secs` segundos (un tono suave): sirve de audio de la galería y de muestra de una voz. */
function wav(secs = 1.5, hz = 440) {
  const rate = 8000, n = Math.round(rate * secs), b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(2 * Math.PI * hz * i / rate) * 6000 * Math.min(1, (n - i) / 800)), 44 + i * 2);
  return b;
}

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-voz-'));
const brain = path.join(sandbox, 'brain'), media = path.join(brain, 'Agents Office', 'media', '2026-09');
fs.mkdirSync(media, { recursive: true });
fs.writeFileSync(path.join(brain, 'index.md'), '# Prueba\n');
const AUDIOS = [
  ['voz', { kind: 'audio', prompt: 'Hola, soy Panaclaw. Esta semana tenemos 20 % de descuento en todos los planes. Escríbenos por WhatsApp y te ayudamos hoy mismo.', model: 'mmx-voz-2.8-hd', modelName: 'Voz 2.8 HD · MiniMax', provider: 'minimax', settings: { voiceId: 'VozPanaclaw01', emotion: 'happy', speed: 1, format: 'mp3' }, by: 'you' }],
  ['musica', { kind: 'audio', wanted: 'music', prompt: '[Verse]\nOficina de agentes, trabajo real\n[Chorus]\nTodo sucede, nada es igual', model: 'mmx-musica-3', modelName: 'Música 3.0 · MiniMax', provider: 'minimax', settings: { instrumental: false, format: 'mp3' }, by: 'agent', agent: 'mark' }],
  ['instrumental', { kind: 'audio', wanted: 'music', prompt: 'Lo-fi relajado con piano y lluvia suave, 80 bpm', model: 'mmx-musica-3', modelName: 'Música 3.0 · MiniMax', provider: 'minimax', settings: { instrumental: true, format: 'mp3' }, by: 'you' }],
  ['subida', { kind: 'audio', prompt: 'Reunión con el cliente', upload: true, by: 'you' }],
];
AUDIOS.forEach(([id, rec], i) => {
  const file = `2026-09/2026-09-30 ${id} 20000${i}.wav`;
  fs.writeFileSync(path.join(brain, 'Agents Office', 'media', file), wav(1.5, 330 + i * 110));
  fs.writeFileSync(path.join(brain, 'Agents Office', 'media', file.replace(/\.wav$/, '.json')), JSON.stringify({ id: file, file, ext: 'wav', at: Date.now() - i * 60000, ...rec }));
});

// el catálogo de MiniMax como lo describe el contrato entre equipos (media.mjs lo traerá de verdad)
const VOZ_SETS = { voiceId: { type: 'text', default: 'Spanish_Narrator', max: 256, placeholder: 'Spanish_Narrator' }, emotion: { type: 'enum', values: ['', 'neutral', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'calm'], default: '' }, speed: { type: 'range', min: 0.5, max: 2, step: 0.1, default: 1 }, vol: { type: 'range', min: 0.1, max: 10, step: 0.1, default: 1 }, pitch: { type: 'range', min: -12, max: 12, step: 1, default: 0 }, format: { type: 'enum', values: ['mp3', 'wav', 'flac'], default: 'mp3' }, languageBoost: { type: 'enum', values: ['auto', 'Spanish', 'English'], default: 'auto' } };
const mm = (id, name, kind, cost, extra = {}) => ({ id, engine: 'minimax', engineName: 'MiniMax', kind, name, note: extra.note || '', cost, per: extra.per || 'item', seconds: null, roles: extra.roles || {}, needs: [], settings: extra.settings || {}, maker: 'MiniMax', tier: extra.tier || 3, speed: extra.speed || 'rápido', uses: extra.uses || [] });
const CATALOG = [
  mm('mmx-image-01', 'Image-01 · directo', 'image', 0.0035, { roles: { reference: 1 }, settings: { aspectRatio: { type: 'enum', values: ['1:1', '16:9', '9:16'], default: '1:1' } } }),
  mm('mmx-h3', 'MiniMax H3 · directo', 'video', 0.05, { per: 's', roles: { start: 1, end: 1, reference: 3 }, settings: { duration: { type: 'range', min: 4, max: 15, default: 6 } } }),
  mm('mmx-voz-2.8-hd', 'Voz 2.8 HD', 'audio', 0.02, { settings: VOZ_SETS, note: 'La voz más natural de MiniMax. Precio aproximado.', uses: ['anuncios', 'narración'], tier: 4, speed: 'rápido' }),
  mm('mmx-voz-2.8-turbo', 'Voz 2.8 Turbo', 'audio', 0.01, { settings: VOZ_SETS, note: 'Rápida y barata. Precio aproximado.', uses: ['borradores', 'mensajes'], tier: 3, speed: 'muy rápido' }),
  mm('mmx-musica-3', 'Música 3.0', 'music', 0.1, { settings: { instrumental: { type: 'boolean', default: false }, format: { type: 'enum', values: ['mp3', 'wav'], default: 'mp3' } }, note: 'Canciones con letra o instrumentales. Precio aproximado.', uses: ['jingles', 'fondos de reels'], tier: 3, speed: 'normal' }),
];
const SYSTEM = [{ voiceId: 'Spanish_Narrator', name: 'Narrador', lang: 'Español' }, { voiceId: 'Spanish_SereneWoman', name: 'Mujer serena', lang: 'Español' }, { voiceId: 'English_Graceful_Lady', name: 'Graceful Lady', lang: 'Inglés' }];
const MINE0 = [{ voiceId: 'VozPanaclaw01', name: 'Voz de Panaclaw', kind: 'design', at: Date.now() - 864e5, pinned: true }, { voiceId: 'MiVozAbrinay', name: 'Mi voz', kind: 'clone', at: Date.now() - 2 * 864e5, pinned: false }];

const port = 4900 + Math.floor(Math.random() * 90);
const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(port), AO_DATA: path.join(sandbox, 'data'), AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(sandbox, 'local.json'), TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', MINIMAX_API_KEY: '', MINIMAX_API_BASE: 'http://127.0.0.1:9' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
const base = `http://localhost:${port}`;
let up = false; for (let i = 0; i < 60 && !up; i++) { try { up = (await fetch(base + '/api/health')).ok; } catch {} if (!up) await new Promise(r => setTimeout(r, 250)); }
if (!up) { srv.kill(); throw new Error('la oficina de prueba no arrancó: ' + log.slice(-400)); }

/** MiniMax simulado en la página: con key (on) o sin ella. */
async function simulate(page, on) {
  let mine = MINE0.map(v => ({ ...v }));
  const SAMPLE = wav(1, 520).toString('base64');
  await page.route(u => u.pathname === '/api/media', async route => {
    if (route.request().method() !== 'GET') return route.continue();
    const r = await route.fetch(), j = await r.json();
    j.engines = [...(j.engines || []).filter(e => e.id !== 'minimax'), { id: 'minimax', name: 'MiniMax', on, env: 'MINIMAX_API_KEY', site: 'platform.minimax.io', how: 'setx MINIMAX_API_KEY "tu-key"', models: CATALOG.length }];
    j.models = [...(j.models || []).filter(m => m.engine !== 'minimax'), ...CATALOG.map(m => ({ ...m, on }))];
    if (on) j.voices = { voices: mine, system: SYSTEM }; else delete j.voices;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) });
  });
  await page.route(u => u.pathname.startsWith('/api/voces'), async route => {
    const q = route.request(), p = new URL(q.url()).pathname, m = q.method();
    const send = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (!on) return send(409, { error: 'MiniMax no está activado.', how: 'setx MINIMAX_API_KEY "tu-key"' });
    if (p === '/api/voces' && m === 'GET') return send(200, { voices: mine, system: SYSTEM });
    if (p === '/api/voces/design' && m === 'POST') { const b = q.postDataJSON(); const v = { voiceId: 'ttv-voice-' + Date.now(), name: b.name, kind: 'design', at: Date.now(), pinned: true }; mine = [v, ...mine]; return send(200, { voice: v, preview: SAMPLE }); }
    if (p === '/api/voces/clone' && m === 'POST') { const b = q.postDataJSON(); if (/Fallo/.test(b.voiceId)) return send(400, { error: 'MiniMax clonar voz: 2038 no tienes permiso para clonar voces' }); const v = { voiceId: b.voiceId, name: b.name, kind: 'clone', at: Date.now(), pinned: true }; mine = [v, ...mine]; return send(200, { voice: v }); }
    if (m === 'DELETE') { const id = decodeURIComponent(p.split('/').pop()); mine = mine.filter(v => v.voiceId !== id); return send(200, { ok: true }); }
    return send(404, { error: 'no' });
  });
}

/** Lo que se mide en cada captura: nada se sale a lo ancho y ningún control visible del Estudio mide menos de 24 px. */
const medir = page => page.evaluate(() => {
  const over = document.documentElement.scrollWidth > innerWidth + 1;
  const scope = [...document.querySelectorAll('#studioOv .st-vocov:not([hidden]), #studioOv .st-gen, #studioOv .st-gal')];
  const small = [];
  for (const s of scope) for (const n of s.querySelectorAll('button, select, input:not([type=file]):not([type=checkbox]), summary')) {
    if (n.closest('[hidden]') || !n.getClientRects().length) continue;
    const r = n.getBoundingClientRect(); if (r.width && r.height && (r.width < 24 || r.height < 24) && r.bottom > 0 && r.top < innerHeight) small.push(`${n.tagName.toLowerCase()}.${[...n.classList].join('.')}「${(n.textContent || n.getAttribute('aria-label') || '').trim().slice(0, 20)}」 ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  return { sale: over, pequenos: [...new Set(small)].slice(0, 8) };
});

fs.mkdirSync(OUT, { recursive: true });
const informe = [];
const ARGS = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'];
let browser;
try { browser = await chromium.launch({ executablePath: process.env.AO_CHROME || undefined, args: ARGS }); }
catch { browser = await chromium.launch({ channel: 'chrome', args: ARGS }); }
const nota = (ok, txt, extra = {}) => { console.log(`${ok ? '✓' : '✗'} ${txt}`); informe.push({ ok, txt, ...extra }); };
try {
  for (const on of [true, false]) for (const tema of ['light', 'dark']) for (const [w, h] of ANCHOS) {
    const tag = `${on ? 'con-key' : 'sin-key'}-${tema}-${w}`, phone = w < 700;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: phone, isMobile: phone, reducedMotion: 'reduce' });
    await ctx.addInitScript(t => { try { localStorage.setItem('ao.theme', JSON.stringify(t)); localStorage.setItem('ao.theme.raw', t); localStorage.setItem('ao.st.kind', '"audio"'); } catch {} }, tema);
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await simulate(page, on);
    await page.goto(base + '/'); await page.waitForTimeout(1500);
    await page.evaluate(t => { document.body.classList.toggle('dark', t === 'dark'); document.documentElement.dataset.theme = t; }, tema);
    await page.keyboard.press('e'); await page.waitForTimeout(800);
    // 1 · Voz: el paso 3 «Texto que se lee» con su contador; el paso 5 con la voz
    await page.click('#studioOv [data-kind="audio"]').catch(() => {}); await page.waitForTimeout(200);
    await page.fill('#studioOv .st-prompt', 'Hola, soy Panaclaw. Esta semana tenemos 20 % en todos los planes.');
    const voz = await page.evaluate(() => { const q = s => document.querySelector('#studioOv ' + s); return { t3: q('.st-p3t').textContent, plen: q('.st-plen').textContent, enh: q('.st-enh').hidden, go: q('.st-go').textContent, vid: !!q('.st-vid'), grupos: [...document.querySelectorAll('#studioOv .st-vsel optgroup')].map(g => g.label), off: q('.st-mpick').classList.contains('st-mp-off') }; });
    nota(voz.t3 === 'Texto que se lee' && voz.enh && /\/9\.999$/.test(voz.plen), `${tag} · Voz: «${voz.t3}», contador ${voz.plen}, «Mejorar» oculto: ${voz.enh}, botón «${voz.go}»`, voz);
    if (on) nota(voz.vid && voz.grupos.join('|') === 'Tus voces|Voces de MiniMax', `${tag} · selector de voz con grupos: ${voz.grupos.join(', ')}`);
    else nota(voz.off, `${tag} · sin key: el modelo de voz se ve atenuado con cómo activarlo`);
    const scrollSets = async () => page.evaluate(() => document.querySelector('#studioOv .st-sets')?.scrollIntoView({ block: 'center' }));
    await scrollSets(); await page.waitForTimeout(150);
    nota(true, `${tag} · medida composer Voz`, await medir(page));
    await page.screenshot({ path: path.join(OUT, `voz-${tag}.png`) });
    if (!on) { await page.click('#studioOv .st-go'); await page.waitForTimeout(200); const kh = await page.evaluate(() => { const k = document.querySelector('#studioOv .st-keyhelp'); return !k.hidden && /MINIMAX_API_KEY/.test(k.textContent); }); nota(kh, `${tag} · GENERAR sin key explica cómo activarlo`); await page.screenshot({ path: path.join(OUT, `voz-generar-${tag}.png`) }); }
    if (on) { // elegir de la lista pone el id en el campo
      await page.selectOption('#studioOv .st-vsel', 'Spanish_SereneWoman'); await page.waitForTimeout(100);
      const v = await page.evaluate(() => [document.querySelector('#studioOv .st-vid').value, document.querySelector('#stVidH').textContent]);
      nota(v[0] === 'Spanish_SereneWoman', `${tag} · la lista pone la voz: ${v.join(' — ')}`);
    }
    // 2 · Música: el aviso, «Letra» con sus partes; Instrumental → «Descripción»
    await page.click('#studioOv [data-kind="music"]'); await page.waitForTimeout(200);
    const mus = await page.evaluate(() => { const q = s => document.querySelector('#studioOv ' + s); return { t3: q('.st-p3t').textContent, aviso: !q('.st-mnote').hidden, tags: !q('.st-ltags').hidden, enh: !q('.st-enh').hidden, plen: q('.st-plen').textContent }; });
    nota(mus.t3 === 'Letra' && mus.aviso && mus.tags && mus.enh, `${tag} · Música: «${mus.t3}», aviso del 20-ago ${mus.aviso}, partes ${mus.tags}, «Mejorar» visible ${mus.enh}`, mus);
    if (on) {
      await page.click('#studioOv .st-prompt'); await page.click('#studioOv [data-ltag="[Verse]"]'); await page.keyboard.type('Oficina de agentes'); await page.click('#studioOv [data-ltag="[Chorus]"]');
      const txt = await page.inputValue('#studioOv .st-prompt'); nota(/\[Verse\]\nOficina de agentes\n\[Chorus\]\n$/.test(txt), `${tag} · las partes entran en su línea: ${JSON.stringify(txt.slice(-40))}`);
      await page.evaluate(() => document.querySelector('#studioOv [data-set="instrumental"]')?.click()); await page.waitForTimeout(100);
      const t3 = await page.evaluate(() => [document.querySelector('#studioOv .st-p3t').textContent, document.querySelector('#studioOv .st-ltags').hidden]);
      nota(t3[0] === 'Descripción' && t3[1], `${tag} · Instrumental: el paso 3 pasa a «${t3[0]}» y las partes se ocultan`);
      await page.evaluate(() => document.querySelector('#studioOv [data-set="instrumental"]')?.click());
    }
    await page.evaluate(() => document.querySelector('#studioOv .st-mnote').scrollIntoView({ block: 'center' })); await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(OUT, `musica-${tag}.png`) });
    // 3 · Galería: filtros Voz y Música, tarjetas de sonido con su reproductor
    if (phone) { await page.click('#studioOv [data-pt="gal"]'); await page.waitForTimeout(300); }
    await page.click('#studioOv .st-tabs [data-f="voice"]'); await page.waitForTimeout(250);
    const gv = await page.evaluate(() => ({ n: document.querySelectorAll('#studioOv .st-grid .st-card[data-f]').length, play: document.querySelectorAll('#studioOv .st-grid .st-cplay').length, lab: [...document.querySelectorAll('#studioOv .st-tabs [data-f="voice"], #studioOv .st-tabs [data-f="music"]')].map(b => b.textContent.trim()) }));
    nota(gv.n === 2 && gv.play === 2, `${tag} · filtro Voz: ${gv.n} tarjetas con reproductor (${gv.lab.join(' · ')})`, gv);
    await page.screenshot({ path: path.join(OUT, `galeria-voz-${tag}.png`) });
    await page.click('#studioOv .st-tabs [data-f="music"]'); await page.waitForTimeout(250);
    const gm = await page.evaluate(() => [...document.querySelectorAll('#studioOv .st-grid .st-slab')].map(x => x.textContent));
    nota(gm.length === 2, `${tag} · filtro Música: ${gm.join(' | ')}`);
    nota(true, `${tag} · medida galería`, await medir(page));
    await page.screenshot({ path: path.join(OUT, `galeria-musica-${tag}.png`) });
    // 4 · el visor de una voz: reproductor grande y «Repetir con otra voz»
    await page.click('#studioOv .st-tabs [data-f="voice"]'); await page.waitForTimeout(200);
    await page.evaluate(() => [...document.querySelectorAll('#studioOv .st-card[data-f]')].find(c => c.dataset.f.includes(' voz '))?.querySelector('.st-thumb').click());
    await page.waitForSelector('#studioOv .st-light:not([hidden]) .st-laud audio');
    const vis = await page.evaluate(() => ({ voz: document.querySelector('#studioOv .st-lvoz')?.textContent, otra: !!document.querySelector('#studioOv .st-light [data-l="othervoice"]'), lab: document.querySelector('#studioOv .st-lslab')?.textContent }));
    nota(vis.otra && /Voz/.test(vis.voz || ''), `${tag} · visor: «${vis.lab}», ${vis.voz}, «Repetir con otra voz» ${vis.otra}`);
    await page.screenshot({ path: path.join(OUT, `visor-voz-${tag}.png`) });
    await page.click('#studioOv .st-light [data-l="othervoice"]'); await page.waitForTimeout(300);
    const ov = await page.evaluate(() => ({ kind: document.querySelector('#studioOv [data-kind="audio"]').getAttribute('aria-pressed'), foco: document.activeElement && document.activeElement.className, txt: document.querySelector('#studioOv .st-prompt').value.slice(0, 20) }));
    nota(ov.kind === 'true' && (on ? /st-vid/.test(ov.foco) : true), `${tag} · «Repetir con otra voz»: Voz, mismo texto «${ov.txt}…», foco en ${ov.foco || '—'}`);
    // 5 · el panel «Voces»
    if (phone) { await page.click('#studioOv [data-pt="gal"]'); await page.waitForTimeout(200); }
    await page.click('#studioOv .st-vocbtn'); await page.waitForSelector('#studioOv .st-vocov:not([hidden])'); await page.waitForTimeout(300);
    const pv = await page.evaluate(() => { const V = document.querySelector('#studioOv .st-vocov'); return { foco: V.contains(document.activeElement), filas: V.querySelectorAll('.st-vlist > li[data-vid]').length, off: !!V.querySelector('.st-voff'), botones: [...V.querySelectorAll('button')].map(b => b.textContent.trim()).filter(Boolean) }; });
    nota(pv.foco && (on ? pv.filas === 2 && !pv.off : pv.off && !pv.botones.some(b => /Clonar|Crear|Usar/.test(b))), `${tag} · panel Voces: foco dentro ${pv.foco}, ${on ? pv.filas + ' voces' : 'sin key: explica cómo activarlo y no ofrece botones que fallen'}`, pv);
    nota(true, `${tag} · medida panel`, await medir(page));
    await page.screenshot({ path: path.join(OUT, `voces-${tag}.png`) });
    if (on) {
      // Tab da la vuelta dentro del panel
      for (let i = 0; i < 40; i++) await page.keyboard.press('Tab');
      nota(await page.evaluate(() => document.querySelector('#studioOv .st-vocov').contains(document.activeElement)), `${tag} · Tab se queda dentro del panel`);
      // diseñar: la muestra suena y se anuncia
      await page.evaluate(() => { const d = document.querySelector('#studioOv .st-vsec'); d.open = true; });
      await page.fill('#studioOv .st-vdn', 'Voz cálida'); await page.fill('#studioOv .st-vdp', 'Mujer de 30 años, cálida, acento panameño suave');
      await page.click('#studioOv [data-vo="design"]'); await page.waitForSelector('#studioOv .st-vdres audio');
      const ds = await page.evaluate(() => ({ live: document.querySelector('#studioOv .st-vdres').getAttribute('aria-live'), filas: document.querySelectorAll('#studioOv .st-vlist > li[data-vid]').length, foco: document.activeElement.tagName }));
      nota(ds.live === 'polite' && ds.filas === 3, `${tag} · Diseñar: muestra con reproductor (aria-live ${ds.live}), ${ds.filas} voces, foco en ${ds.foco}`);
      await page.evaluate(() => document.querySelector('#studioOv .st-vdres').scrollIntoView({ block: 'center' }));
      await page.screenshot({ path: path.join(OUT, `voces-disenar-${tag}.png`) });
      await page.click('#studioOv [data-vo="keep"]'); await page.waitForTimeout(100);
      // clonar: el id se valida en vivo
      await page.evaluate(() => { const d = document.querySelectorAll('#studioOv .st-vsec')[1]; d.open = true; d.scrollIntoView({ block: 'start' }); });
      await page.fill('#studioOv .st-vcn', 'Mi voz nueva');
      const sug = await page.inputValue('#studioOv .st-vci');
      await page.fill('#studioOv .st-vci', '1 voz');
      const bad = await page.evaluate(() => [document.querySelector('#stVcH').textContent, document.querySelector('#studioOv .st-vci').getAttribute('aria-invalid'), document.querySelector('#studioOv [data-vo="clone"]').disabled]);
      nota(bad[1] === 'true' && bad[2], `${tag} · Clonar: id sugerido «${sug}»; «1 voz» → «${bad[0]}», botón apagado ${bad[2]}`);
      await page.screenshot({ path: path.join(OUT, `voces-clonar-${tag}.png`) });
      await page.fill('#studioOv .st-vci', 'MiVozNueva01');
      await page.selectOption('#studioOv .st-vca', { index: 1 });
      const okc = await page.evaluate(() => !document.querySelector('#studioOv [data-vo="clone"]').disabled);
      await page.click('#studioOv [data-vo="clone"]'); await page.waitForTimeout(300);
      const cl = await page.evaluate(() => [document.querySelector('#studioOv .st-vcres').textContent, document.querySelectorAll('#studioOv .st-vlist > li[data-vid]').length]);
      nota(okc && cl[1] === 4, `${tag} · Clonar con un audio de la galería: «${cl[0]}» (${cl[1]} voces)`);
      // borrar pregunta en su fila; Esc dice que no
      await page.click('#studioOv .st-vlist > li[data-vid] [data-vo="del"]'); await page.waitForTimeout(100);
      const conf = await page.evaluate(() => !!document.querySelector('#studioOv .st-vconf') && document.activeElement.dataset.vo);
      await page.keyboard.press('Escape'); await page.waitForTimeout(100);
      const still = await page.evaluate(() => !document.querySelector('#studioOv .st-vocov').hidden && !document.querySelector('#studioOv .st-vconf'));
      nota(conf === 'del-no' && still, `${tag} · Borrar pregunta en la fila (foco en «No»); Esc la cancela sin cerrar el panel`);
      await page.click('#studioOv .st-vlist > li[data-vid] [data-vo="del"]'); await page.click('#studioOv [data-vo="del-yes"]'); await page.waitForTimeout(200);
      nota(await page.evaluate(() => document.querySelectorAll('#studioOv .st-vlist > li[data-vid]').length === 3), `${tag} · Sí, borrar: la voz sale de la lista`);
      // «Usar esta voz» la pone en el selector
      await page.click('#studioOv .st-vlist > li[data-vid] [data-vo="use"]'); await page.waitForTimeout(300);
      const use = await page.evaluate(() => ({ cerrado: document.querySelector('#studioOv .st-vocov').hidden, vid: document.querySelector('#studioOv .st-vid')?.value }));
      nota(use.cerrado && !!use.vid, `${tag} · «Usar esta voz» cierra el panel y pone «${use.vid}» en el paso 5`);
      await page.evaluate(() => document.querySelector('#studioOv .st-sets')?.scrollIntoView({ block: 'center' })); await page.waitForTimeout(100);
      await page.screenshot({ path: path.join(OUT, `voz-usada-${tag}.png`) });
    } else {
      await page.keyboard.press('Escape'); await page.waitForTimeout(150);
      nota(await page.evaluate(() => document.querySelector('#studioOv .st-vocov').hidden && !document.querySelector('#studioOv').hidden), `${tag} · Esc cierra el panel y deja el Estudio abierto`);
    }
    nota(!errs.length, `${tag} · sin errores en la página${errs.length ? ': ' + errs.join(' | ') : ''}`);
    await ctx.close();
  }
} finally {
  await browser.close(); srv.kill(); fs.rmSync(sandbox, { recursive: true, force: true });
}
fs.writeFileSync(path.join(OUT, 'informe.json'), JSON.stringify(informe, null, 1));
const malas = informe.filter(x => !x.ok), med = informe.filter(x => x.sale || (x.pequenos && x.pequenos.length));
for (const m of med) console.log(`  ! ${m.txt}: ${m.sale ? 'se sale a lo ancho ' : ''}${(m.pequenos || []).join(' · ')}`);
console.log(`\n${informe.length - malas.length} de ${informe.length} bien · ${med.length} medidas con avisos · capturas en ${path.relative(ROOT, OUT)}`);
process.exitCode = malas.length ? 1 : 0;
