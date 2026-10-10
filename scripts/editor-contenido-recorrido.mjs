// Herramienta de desarrollo (no entra en `npm run check`): el EDITOR NUEVO de una pieza de Contenido (C1, 8 oct 2026) en el navegador, con la
// oficina de verdad (temporal: cerebro copiado, datos aparte, Claude simulado, sin keys). Recorre lo que se le pidió tras compararlo con
// Metricool: el formato de cada red, el cuadro de escribir con emoji, hashtags y textos guardados, «Editar por red», «✨ Mejorar con
// Marketing», los archivos dentro del cuadro, «N problemas» con su arreglo, cuándo sale, la vista previa en teléfono o computadora y
// «Publicar ya» desde «Aprobar ▾». Mide objetivos (24 px), letra (10,5 px), que nada se salga a lo ancho y, con AO_AXE=<axe.min.js>, axe.
//   node scripts/editor-contenido-recorrido.mjs   → ✓/✗ por paso y capturas en data/capturas/editor-contenido/ (1512, 1024 y 390, claro y oscuro)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'data', 'capturas', 'editor-contenido'); fs.mkdirSync(OUT, { recursive: true });
const listen = srv => new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
const pedidos = [];
const claude = http.createServer((rq, rs) => { let b = ''; rq.on('data', d => { b += d; }); rq.on('end', () => {
  const body = JSON.parse(b || '{}'); pedidos.push(body);
  const sys = JSON.stringify(body.system || ''), text = /mejores el TEXTO/.test(sys) ? JSON.stringify({ texto: 'Tu examen visual, gratis todo octubre. Agenda hoy y sal con tus lentes en 40 minutos.', porque: 'Más corto y con el gancho primero.' }) : '{}';
  rs.writeHead(200, { 'content-type': 'application/json' });
  rs.end(JSON.stringify({ id: 'msg', type: 'message', role: 'assistant', model: 'claude-sonnet-4-5', stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 10 } }));
}); });
const cport = await listen(claude);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-editor-')), data = path.join(dir, 'data'), brain = path.join(dir, 'brain');
fs.mkdirSync(data, { recursive: true }); fs.cpSync(path.join(ROOT, 'brain'), brain, { recursive: true });
fs.mkdirSync(path.join(brain, '20-Brand'), { recursive: true }); fs.writeFileSync(path.join(brain, '20-Brand', 'voice.md'), '# Voz\nCercana, clara y sin tecnicismos.\n');
const mes = new Date().toISOString().slice(0, 7), mdir = path.join(brain, 'Agents Office', 'media', mes); fs.mkdirSync(mdir, { recursive: true });
for (const [n, bg, w, h] of [['lentes', '#e66a2f', 1080, 1350], ['tienda', '#2f7be6', 1080, 1080]]) {
  fs.writeFileSync(path.join(mdir, `${n}.jpg`), await sharp({ create: { width: w, height: h, channels: 3, background: bg } }).jpeg().toBuffer());
  fs.writeFileSync(path.join(mdir, `${n}.json`), JSON.stringify({ file: `${mes}/${n}.jpg`, kind: 'image', model: 'upload', prompt: `Foto de ${n}`, w, h, at: Date.now(), by: 'dueno' }));
}
const local = path.join(dir, 'local.json'); fs.writeFileSync(local, JSON.stringify({ contenido: { modo: 'simulacro', redes: ['instagram', 'facebook'] } }));
const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
const env = { ...process.env, PORT: String(port), AO_DATA: data, AO_BRAIN: brain, AO_LOCAL_CONFIG: local, CLAUDE_BIN: path.join(dir, 'no-claude.exe'), ANTHROPIC_API_KEY: 'no-real', ANTHROPIC_BASE_URL: `http://127.0.0.1:${cport}`, TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', METRICOOL_USER_TOKEN: '', METRICOOL_USER_ID: '', METRICOOL_BLOG_ID: '', GEMINI_API_KEY: '', HF_KEY: '', FAL_KEY: '' };
const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 120; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }
const api = async (m, p, b) => (await fetch(base + p, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined })).json();
for (const t of ['#optica #lentes', '#optica #panama']) await api('POST', '/api/contenido/piezas', { titulo: 'Vieja', texto: 'Una de antes', hashtags: t, redes: ['instagram'] });

let fails = 0; const step = (ok, what) => { if (!ok) fails++; console.log(`${ok ? '✓' : '✗'} ${what}`); };
const medir = page => page.evaluate(() => {
  const panel = document.querySelector('.ct-panel:not([hidden])'); if (!panel) return { small: -1 };
  const vis = e => e.offsetParent && e.getBoundingClientRect().width > 0;
  const small = [...panel.querySelectorAll('button, summary, select, input:not([type="checkbox"]):not([type="radio"]), [role="tab"]')] /* una casilla o un radio: su objetivo es la etiqueta entera */.filter(vis).map(b => ({ b, r: b.getBoundingClientRect() })).filter(({ r }) => r.height < 24 || r.width < 24).map(({ b }) => b.className + ':' + (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 20));
  const tiny = [...panel.querySelectorAll('*')].filter(e => vis(e) && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 10.5).map(e => e.className);
  return { small, tiny, hscroll: document.documentElement.scrollWidth > innerWidth + 1 };
});
let browser;
try {
  try { browser = await chromium.launch(); } catch { try { browser = await chromium.launch({ channel: 'chrome' }); } catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); } }
  for (const [w, h] of [[1512, 900], [1024, 768], [390, 844]]) for (const tema of ['light', 'dark']) {
    const tag = `${w}-${tema}`, full = tag === '1512-light';
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: tema, reducedMotion: 'reduce' }); const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.addInitScript(t => { try { localStorage.setItem('ao.theme', t); localStorage.setItem('ao.onboarded', '1'); } catch {} }, tema === 'dark' ? 'dark' : 'light');
    await page.goto(base + '/'); await page.waitForTimeout(1500);
    await page.keyboard.press('Escape'); await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('k'); await page.waitForSelector('#ctOv .ct-mode', { state: 'visible' }); await page.waitForTimeout(500);
    await page.click('#ctNew'); await page.waitForTimeout(300);
    const menu0 = await page.$('.ct-newmenu:not([hidden]) button'); if (menu0) { await menu0.click(); await page.waitForTimeout(300); }
    await page.waitForSelector('.ct-panel:not([hidden]) .pz-comp', { timeout: 5000 });
    const P = '.ct-panel:not([hidden]) ';
    // 0. (9 oct 2026) sin Meta conectada, «Publicar en» lo dice y nada más
    step(/Sin Meta conectada: saldrá por la cuenta de Ajustes/.test(await page.textContent(P + '.pz-ctas')) && !(await page.$(P + '.pz-ctbtn')), `${tag}: sin Meta, «Sin Meta conectada: saldrá por la cuenta de Ajustes»`);
    // 1. las redes con su formato
    const fichas = await page.evaluate(() => [...document.querySelectorAll('.pz-rc')].map(c => c.querySelector('[data-red]').dataset.red + ':' + (c.querySelector('select')?.value || c.querySelector('.pz-fstat')?.textContent)).join(','));
    step(/instagram:post/.test(fichas) && /facebook:post/.test(fichas), `${tag}: cada red con su formato (${fichas})`);
    if (full) {
      await page.selectOption(P + '[data-fmt-red="instagram"]', 'reel'); await page.waitForTimeout(300);
      const tras = await page.evaluate(() => ({ ig: document.querySelector('[data-fmt-red="instagram"]').value, fb: document.querySelector('[data-fmt-red="facebook"]').value, chip: document.querySelector('.pz-avchip').textContent }));
      step(tras.ig === 'reel' && tras.fb === 'post', `${tag}: reel en Instagram y post en Facebook, cada uno el suyo (${tras.ig}/${tras.fb})`);
      step(/problema/.test(tras.chip), `${tag}: el aviso de arriba dice que algo falta («${tras.chip.trim()}»)`);
      // 2. escribir: el texto, un emoji, hashtags de los que más usas, un texto guardado
      await page.fill(P + '.pz-ta[data-f="texto"]', 'Examen visual gratis en octubre.'); await page.waitForTimeout(200);
      await page.click(P + '[data-pop="emoji"]'); await page.click(P + '.pz-emo button >> nth=0'); await page.waitForTimeout(200);
      const conEmoji = await page.inputValue(P + '.pz-ta[data-f="texto"]');
      step(/octubre\.😊$/.test(conEmoji), `${tag}: el emoji entra donde estaba el cursor («${conEmoji}»)`);
      await page.click(P + '[data-pop="hash"]'); await page.waitForSelector(P + '[data-tag]', { timeout: 4000 });
      const usados = await page.evaluate(() => [...document.querySelectorAll('[data-tag]')].map(b => b.dataset.tag).join(' '));
      step(/#optica/.test(usados), `${tag}: «Los que más usas» trae tus hashtags (${usados})`);
      await page.click(P + '[data-tag="#optica"]'); await page.waitForTimeout(300);
      step((await page.inputValue(P + '[data-f="hashtags"]')).includes('#optica'), `${tag}: un clic lo pone en «Hashtags»`);
      await page.click(P + '[data-pop="guardados"]'); await page.waitForSelector(P + '[data-gnombre]');
      await page.fill(P + '[data-gnombre]', 'Gancho de octubre'); await page.click(P + '[data-a="guardar-texto"]'); await page.waitForTimeout(500);
      const nota = path.join(brain, 'Contenido', 'Textos guardados.md');
      step(fs.existsSync(nota) && /## Gancho de octubre\nExamen visual gratis/.test(fs.readFileSync(nota, 'utf8')), `${tag}: «Guardar» lo deja en la nota «Contenido/Textos guardados» del Cerebro`);
      await page.click(P + '.pz-gi >> nth=0'); await page.waitForTimeout(300);
      const conGuardado = await page.inputValue(P + '.pz-ta[data-f="texto"]');
      step(/😊\n\nExamen visual gratis/.test(conGuardado), `${tag}: un texto guardado entra en su propio párrafo`);
      // 3. editar por red
      await page.click(P + '[data-a="por-red"]'); await page.waitForTimeout(200);
      await page.click(P + '[data-ttab="facebook"]'); await page.waitForTimeout(200);
      await page.fill(P + '.pz-ta[data-f="textoFacebook"]', 'En Facebook: agenda tu examen gratis.'); await page.waitForTimeout(300);
      const fbTab = await page.evaluate(() => document.querySelector('[data-ttab="facebook"]').getAttribute('aria-label'));
      step(/texto propio/.test(fbTab), `${tag}: la pestaña de Facebook dice que lleva su texto («${fbTab}»)`);
      await page.click(P + '[data-ttab=""]'); await page.waitForTimeout(200);
      // 4. ✨ Mejorar con Marketing
      await page.click(P + '[data-pop="mejorar"]'); await page.click(P + '[data-pide="Más corto"]');
      await page.waitForSelector(P + '.pz-prop', { timeout: 8000 });
      const pedido = pedidos.find(b => /mejores el TEXTO/.test(JSON.stringify(b.system || '')));
      step(!!pedido && /Cercana, clara/.test(JSON.stringify(pedido.system)) && /Más corto/.test(JSON.stringify(pedido.messages)), `${tag}: Marketing recibe la voz de la marca y lo que pides`);
      await page.click(P + '[data-a="usar-prop"]'); await page.waitForTimeout(300);
      step((await page.inputValue(P + '.pz-ta[data-f="texto"]')).startsWith('Tu examen visual, gratis todo octubre'), `${tag}: «Usar este texto» lo pone en el principal`);
      // 5. los archivos, dentro del cuadro
      await page.click(P + '[data-a="pick"]'); await page.waitForSelector('.ct-pick .ct-pk', { timeout: 5000 });
      await page.click('.ct-pick .ct-pk >> nth=0'); await page.click('.ct-pick .ct-pk >> nth=1'); await page.click('.ct-pick [data-a="ok"]'); await page.waitForTimeout(500);
      const n = await page.locator(P + '.pz-m').count(); step(n === 2, `${tag}: dos archivos en el cuadro (${n})`);
      const orden0 = await page.evaluate(() => [...document.querySelectorAll('.pz-m')].map(m => m.title.split(' ')[1]).join(','));
      await page.dragAndDrop(P + '.pz-m >> nth=1', P + '.pz-m >> nth=0'); await page.waitForTimeout(400);
      const orden1 = await page.evaluate(() => [...document.querySelectorAll('.pz-m')].map(m => m.title.split(' ')[1]).join(','));
      step(orden0 !== orden1 && orden0.split(',').reverse().join(',') === orden1, `${tag}: arrastrar cambia el orden (${orden0} → ${orden1})`);
      // 6. «N problemas»: un reel sin video; su arreglo lo pasa a post SOLO en Instagram
      await page.click(P + '[data-a="avisos"]'); await page.waitForTimeout(200);
      const fixSel = P + '.pz-fix[data-fix^="formato:carrusel:instagram"]', fix = await page.$(fixSel); // la lista se repinta al guardarse sola: se busca otra vez al hacer clic
      step(!!fix, `${tag}: el problema del reel ofrece arreglarlo solo en Instagram`);
      if (fix) { await page.click(fixSel); await page.waitForTimeout(600); }
      const igF = await page.inputValue(P + '[data-fmt-red="instagram"]'); step(igF === 'carrusel', `${tag}: Instagram pasa a carrusel con un clic (${igF})`);
      // 7. cuándo sale
      await page.click(P + '[data-a="cuando"]'); await page.waitForSelector(P + '.pz-cuando .pz-qd');
      await page.click(P + '.pz-cuando .pz-qd >> nth=1'); await page.click(P + '.pz-cuando [data-qh="18:00"]'); await page.waitForTimeout(400);
      step(/18:00/.test(await page.textContent(P + '[data-a="cuando"]')), `${tag}: el botón del pie dice cuándo sale («${(await page.textContent(P + '[data-a="cuando"]')).trim()}»)`);
      // 8. vista previa: teléfono o computadora
      if (w >= 1024) {
        await page.click(P + '[data-dev="pc"]'); await page.waitForTimeout(300);
        const pc = await page.evaluate(() => ({ cls: document.querySelector('.pz-preview').classList.contains('pv-pc'), ancho: document.querySelector('.pz-preview .pv-card')?.getBoundingClientRect().width || 0 }));
        step(pc.cls && pc.ancho > 380, `${tag}: «Computadora» enseña la publicación más ancha (${Math.round(pc.ancho)} px)`);
        await page.screenshot({ path: path.join(OUT, `${tag}-computadora.png`) });
        await page.click(P + '[data-dev="tel"]'); await page.waitForTimeout(200);
      }
      await page.click(P + '[data-pop="mejorar"]'); await page.waitForTimeout(150); await page.click(P + '[data-pop="mejorar"]').catch(() => {}); await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(OUT, `${tag}-editor.png`) });
      // 9. Aprobar ▾ → Publicar ya (dos clics)
      await page.click(P + '[data-a="menu"]'); await page.waitForSelector(P + '.pz-menu:not([hidden])');
      await page.screenshot({ path: path.join(OUT, `${tag}-menu.png`) });
      await page.click(P + '[data-a="ya"]'); await page.waitForTimeout(150);
      step(/Pulsa otra vez/.test(await page.textContent(P + '[data-a="ya"]')), `${tag}: «Publicar ya» pide un segundo clic`);
      await page.click(P + '[data-a="ya"]'); await page.waitForTimeout(1200);
      const ap = await page.evaluate(() => ({ chip: document.querySelector('.pz-chip').textContent, st: document.querySelector('.pz-state').textContent }));
      step(/APROBADA/.test(ap.chip) && /sale en unos 5 minutos/.test(ap.st), `${tag}: queda aprobada para dentro de unos minutos («${ap.st}»)`);
      const { piezas } = await api('GET', '/api/contenido?sin_fecha=1'); const pz = piezas.find(x => x.estado === 'aprobada');
      const falta = pz ? new Date(`${pz.fecha}T${pz.hora}:00`).getTime() - Date.now() : 0;
      step(pz && falta > 3 * 60e3 && falta < 7 * 60e3 && JSON.stringify(pz.formatos) === '{}' && pz.formato === 'carrusel' && pz.textoFacebook && pz.medios.length === 2, `${tag}: lo guardado vuelve igual (${pz ? `${pz.formato}, ${pz.medios.length} archivos, sale en ${Math.round(falta / 1000)} s` : 'no está'})`);
    } else {
      await page.fill(P + '.pz-ta[data-f="texto"]', 'Examen visual gratis en octubre.'); await page.waitForTimeout(200);
      await page.click(P + '[data-pop="emoji"]'); await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(OUT, `${tag}-editor.png`) });
      await page.click(P + '[data-pop="emoji"]'); await page.click(P + '[data-a="cuando"]'); await page.waitForTimeout(200); await page.click(P + '[data-a="menu"]'); await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(OUT, `${tag}-menu.png`) });
      await page.click(P + '[data-a="menu"]');
    }
    const r = await medir(page);
    step(r.small?.length === 0, `${tag}: los controles miden 24 px o más${r.small?.length ? ': ' + r.small.slice(0, 4).join(' | ') : ''}`);
    step(r.tiny?.length === 0, `${tag}: ningún texto baja de 10,5 px${r.tiny?.length ? ': ' + r.tiny.slice(0, 4).join(' | ') : ''}`);
    step(!r.hscroll, `${tag}: la página no se desplaza a lo ancho`);
    if (process.env.AO_AXE && full) {
      await page.addScriptTag({ path: process.env.AO_AXE });
      const v = await page.evaluate(async () => (await window.axe.run(document.querySelector('.ct-panel'), { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map(x => `${x.id} (${x.nodes.length})`));
      step(!v.length, `${tag}: axe sin fallos en el panel${v.length ? ': ' + v.join(', ') : ''}`);
    }
    await page.keyboard.press('Escape'); await page.waitForTimeout(800);
    step(!errs.length, `${tag}: sin errores de la página${errs.length ? ': ' + errs[0] : ''}`);
    await ctx.close();
  }
  // (9 oct 2026) «Publicar en»: la cuenta de cada red, en la demo (file://), que trae dos marcas y un Instagram sin página
  for (const [w, h, tema] of [[1512, 900, 'light'], [1512, 900, 'dark'], [390, 844, 'light']]) {
    const tag = `demo-${w}-${tema}`;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: tema, reducedMotion: 'reduce' }); const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.addInitScript(t => { try { localStorage.setItem('ao.theme', t); localStorage.setItem('ao.onboarded', '1'); } catch {} }, tema);
    await page.goto(pathToFileURL(path.join(ROOT, 'dist', 'command-centre-v2.html')).href); await page.waitForTimeout(1500);
    await page.keyboard.press('Escape'); await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('k'); await page.waitForSelector('#ctOv .ct-mode', { state: 'visible' }); await page.waitForTimeout(500);
    await page.click('#ctNew'); await page.waitForTimeout(300);
    const m0 = await page.$('.ct-newmenu:not([hidden]) button'); if (m0) { await m0.click(); await page.waitForTimeout(300); }
    const P = '.ct-panel:not([hidden]) ';
    await page.waitForSelector(P + '.pz-ctbtn', { timeout: 8000 });
    const linea = async red => (await page.textContent(`${P}[data-ctred="${red}"]`)).replace(/\s+/g, ' ').trim();
    step(/Sale en @pana\.claw/.test(await linea('instagram')) && /Sale en PanaClaw/.test(await linea('facebook')), `${tag}: a la vista, dónde sale cada red («${await linea('instagram')}» · «${await linea('facebook')}»)`);
    await page.click(P + '[data-ctred="instagram"]');
    await page.waitForFunction(() => document.querySelectorAll('.ct-panel:not([hidden]) [data-cta="instagram"]').length === 3, null, { timeout: 4000 });
    step(await page.evaluate(() => document.activeElement?.dataset?.ctred === 'instagram'), `${tag}: al desplegar, el foco se queda en su botón`);
    const ops = await page.evaluate(() => [...document.querySelectorAll('.ct-panel:not([hidden]) [data-cta="instagram"]')].map(i => ({ v: i.value, dis: i.disabled, ok: i.checked, mot: i.getAttribute('aria-describedby') ? document.getElementById(i.getAttribute('aria-describedby'))?.textContent : '' })));
    step(ops.find(o => o.v === 'instagram:demo_ig1')?.ok && ops.find(o => o.v === 'instagram:demo_ig3')?.dis && /no tiene página de Facebook vinculada/.test(ops.find(o => o.v === 'instagram:demo_ig3')?.mot), `${tag}: las tres cuentas; @livesyncpro no se puede elegir y dice por qué`);
    await page.focus(P + '[data-cta="instagram"]:checked'); await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => /@bukoflow/.test(document.querySelector('.ct-panel:not([hidden]) [data-ctred="instagram"]')?.textContent || ''), null, { timeout: 4000 });
    step(await page.evaluate(() => document.activeElement?.value === 'instagram:demo_ig2' && !!document.querySelector('.ct-panel:not([hidden]) .pz-ctl')), `${tag}: con la flecha se elige @bukoflow y la lista sigue abierta (el foco en su radio)`);
    await page.waitForFunction(() => /bukoflow/.test(document.querySelector('.ct-panel:not([hidden]) .pz-preview')?.textContent || ''), null, { timeout: 4000 }).then(() => step(true, `${tag}: la vista previa sale con @bukoflow`), () => step(false, `${tag}: la vista previa sale con @bukoflow`));
    await page.screenshot({ path: path.join(OUT, `${tag}-publicar-en.png`) });
    const r = await medir(page);
    step(r.small?.length === 0, `${tag}: los controles miden 24 px o más${r.small?.length ? ': ' + r.small.slice(0, 4).join(' | ') : ''}`);
    step(r.tiny?.length === 0, `${tag}: ningún texto baja de 10,5 px${r.tiny?.length ? ': ' + r.tiny.slice(0, 4).join(' | ') : ''}`);
    step(!r.hscroll, `${tag}: la página no se desplaza a lo ancho`);
    if (process.env.AO_AXE) {
      await page.addScriptTag({ path: process.env.AO_AXE });
      const v = await page.evaluate(async () => (await window.axe.run(document.querySelector('.ct-panel'), { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map(x => `${x.id} (${x.nodes.length}: ${x.nodes[0]?.target})`));
      step(!v.length, `${tag}: axe sin fallos en el panel con la lista abierta${v.length ? ': ' + v.join(', ') : ''}`);
    }
    await page.click(P + '[data-ctred="instagram"]'); await page.waitForFunction(() => !document.querySelector('.ct-panel:not([hidden]) .pz-ctl'), null, { timeout: 4000 });
    step(true, `${tag}: el mismo botón la pliega`);
    step(!errs.length, `${tag}: sin errores de la página${errs.length ? ': ' + errs[0] : ''}`);
    await ctx.close();
  }
} catch (e) { fails++; console.log('✗ ' + e.message.split('\n')[0]); }
finally { await browser?.close(); srv.kill(); claude.close(); fs.rmSync(dir, { recursive: true, force: true }); }
console.log(fails ? `✗ ${fails} paso(s) fallaron · capturas en ${path.relative(ROOT, OUT)}` : `✓ todo bien · capturas en ${path.relative(ROOT, OUT)}`);
if (fails && process.env.AO_LOG) console.log(log.slice(-3000));
process.exit(fails ? 1 : 0);
