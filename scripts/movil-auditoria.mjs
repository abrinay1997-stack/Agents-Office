// Herramienta de desarrollo (no entra en `npm run check`): auditoría móvil «con lupa» (25 oct 2026).
// Oficina temporal (cerebro copiado, sin keys), teléfono emulado con toque; por pantalla mide objetivos <44 px, campos <16 px,
// desbordes, y guarda la captura. node scripts/movil-auditoria.mjs [salida] → docs/capturas-movil/antes/ + medidas.json
import { chromium, devices } from 'playwright-core';
import { spawn } from 'node:child_process';
import http from 'node:http'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = process.argv[2] || path.join(ROOT, 'docs', 'capturas-movil', 'antes'); fs.mkdirSync(OUT, { recursive: true });
const espera = ms => new Promise(r => setTimeout(r, ms));
const listen = s => new Promise(r => s.listen(0, '127.0.0.1', () => r(s.address().port)));
async function oficina() {
  const claude = http.createServer((q, s) => { q.resume(); q.on('end', () => { s.writeHead(500); s.end('{}'); }); }); const cport = await listen(claude);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-movil-')), data = path.join(dir, 'data'), brain = path.join(dir, 'brain');
  fs.mkdirSync(data, { recursive: true }); fs.cpSync(path.join(ROOT, 'brain'), brain, { recursive: true });
  const pr = http.createServer(), port = await listen(pr); await new Promise(r => pr.close(r));
  const env = { ...process.env, PORT: String(port), AO_DATA: data, AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(dir, 'local.json'), CLAUDE_BIN: path.join(dir, 'no-claude.exe'), ANTHROPIC_BASE_URL: `http://127.0.0.1:${cport}`, ANTHROPIC_API_KEY: 'test-key-not-real', TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', METRICOOL_USER_TOKEN: '', METRICOOL_USER_ID: '', GEMINI_API_KEY: '', HF_KEY: '', FAL_KEY: '' }; // secrets-ok
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: 'ignore' }); const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await espera(250); }
  const api = async (r, m = 'GET', b) => { try { return await (await fetch(base + r, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined })).json(); } catch { return null; } };
  return { base, api, cerrar: () => { srv.kill(); claude.close(); fs.rmSync(dir, { recursive: true, force: true }); } };
}
const MEDIR = () => {
  const vw = innerWidth, vh = innerHeight, vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw && !e.closest('[hidden],[inert]'); };
  const nombre = e => (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '') || e.tagName.toLowerCase();
  const etiqueta = e => (e.getAttribute('aria-label') || e.title || e.textContent || e.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 30);
  const tg = [...document.querySelectorAll('button,a[href],[role=button],[role=tab],select,input:not([type=hidden]),textarea,summary,[tabindex="0"]')].filter(vis);
  const peq = tg.filter(e => { const r = e.getBoundingClientRect(); return r.width < 44 || r.height < 44; });
  const campos = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea,select')].filter(vis);
  const chicos = campos.filter(e => parseFloat(getComputedStyle(e).fontSize) < 16);
  const fuera = [...document.querySelectorAll('body *')].filter(e => { if (!vis(e)) return false; const r = e.getBoundingClientRect(); return r.right > vw + 1 || r.left < -1; }).filter(e => !e.closest('[style*="overflow-x"],.sg-tabs,.cv-grid') ).slice(0, 8);
  const txt = [...document.querySelectorAll('body *')].filter(e => vis(e) && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1)); const menores = txt.filter(e => parseFloat(getComputedStyle(e).fontSize) < 12);
  const sc = [...document.querySelectorAll('body *')].filter(e => { const s = getComputedStyle(e); return vis(e) && /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 4 && e.clientHeight > 40; }).length;
  return { tactiles: tg.length, peq: peq.length, peqEj: peq.slice(0, 6).map(e => { const r = e.getBoundingClientRect(); return `${nombre(e)} «${etiqueta(e)}» ${Math.round(r.width)}x${Math.round(r.height)}`; }),
    campos: campos.length, camposChicos: chicos.length, camposEj: chicos.slice(0, 4).map(e => `${nombre(e)} ${getComputedStyle(e).fontSize}`),
    scrollH: document.documentElement.scrollWidth - vw, fueraN: fuera.length, fueraEj: fuera.map(e => `${nombre(e)} r=${Math.round(e.getBoundingClientRect().right)}`),
    textoMenor12: menores.length, textoEj: menores.slice(0, 4).map(e => `${nombre(e)} ${getComputedStyle(e).fontSize} «${(e.textContent || '').trim().slice(0, 20)}»`), scrollsAnidados: sc };
};
const PERFILES = [{ id: '390', ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }, { id: '360', ...devices['Pixel 5'], viewport: { width: 360, height: 800 } }, { id: '320', ...devices['iPhone SE'], viewport: { width: 320, height: 568 } }];
const o = await oficina(); const res = {};
try {
  // datos de ejemplo
  const d = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  for (const [t, dept] of [['Responder a los clientes del sábado', 'emails'], ['Preparar la propuesta de Dcasa', 'sales'], ['Plan de contenido de noviembre', 'marketing'], ['Conciliar las facturas de octubre', 'fin']]) await o.api('/api/tasks', 'POST', { dept, text: t });
  for (const [t, n] of [['Llamar al banco', 0], ['Pagar el alquiler', 0], ['Revisar la caja', 1], ['Renovar el dominio', 3], ['Enviar las fotos al fotógrafo', -1]]) await o.api('/api/tareas/mias', 'POST', { title: t, limite: d(n) });
  await o.api('/api/contenido/piezas', 'POST', { titulo: 'Reel del lanzamiento', dia: d(1), hora: '18:00', formato: 'reel', redes: ['instagram'], texto: 'Ya llegó la nueva colección.' });
  await o.api('/api/contenido/piezas', 'POST', { titulo: 'Post de la semana', dia: d(2), hora: '12:00', formato: 'post', redes: ['instagram', 'facebook'], texto: 'Tres ideas para tu casa.' });
  await espera(1500);
  const br = await chromium.launch();
  for (const P of PERFILES.filter(x => !process.env.PERFIL || x.id === process.env.PERFIL)) {
    const { id, ...opts } = P; const ctx = await br.newContext({ ...opts, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }); const page = await ctx.newPage();
    await page.addInitScript(() => { try { localStorage.setItem('ao.onboarded', '1'); } catch {} });
    const med = res[id] = {};
    const foto = async (nom, extra = {}) => { await page.waitForTimeout(extra.espera ?? 600); let m = {}; try { m = await page.evaluate(MEDIR); } catch (e) { m = { error: String(e) }; }
      if (extra.toques != null) m.toques = extra.toques; med[nom] = m; try { fs.writeFileSync(path.join(OUT, `medidas-${process.env.PERFIL || 'todos'}${process.env.PARTE3 ? '-p3' : process.env.PARTE2 ? '-p2' : ''}.json`), JSON.stringify(res, null, 1)); } catch {}
      await page.screenshot({ path: path.join(OUT, `${nom}-${id}.jpg`), type: 'jpeg', quality: 60 }); };
    // toque real por coordenadas (page.tap espera a la animación de la escena 3D, que en headless no termina)
    const tocar = async (sel) => { try { const r = await page.$eval(sel, e => { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width }; }); if (!r.w) return 0; await page.touchscreen.tap(r.x, r.y); return 1; } catch { return 0; } };
    const visible = sel => page.$eval(sel, e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return s.display !== 'none' && r.width > 0; }).catch(() => false);
    const ir = async () => { await page.goto(o.base, { waitUntil: 'load' }); await page.waitForTimeout(1200); };
    // abrir una herramienta del dock contando toques: directo, o «⋯» + opción
    const abrir = async (idb) => { if (await visible('#' + idb)) return (await tocar('#' + idb)) ? 1 : -1; if (!(await tocar('#topMore'))) return -1; await page.waitForTimeout(250); return (await tocar(`#topMoreMenu [data-for="${idb}"]`)) ? 2 : -1; };
    await ir(); await foto('01-oficina', { espera: 300 });
    const pantallas = [['02-panel-tareas', 'topPanel'], ['03-tareas-vista', 'topTareas'], ['04-calendario', 'topCal'], ['05-contenido', 'topContenido'], ['06-analiticas', 'topAnaliticas'], ['07-anuncios', 'topAnuncios'], ['08-cerebro', 'topBrain'], ['09-estudio', 'topStudio'], ['10-negocio', 'topBiz'], ['11-ajustes', 'topSettings'], ['12-dimitri', 'topDimitri']];
    if (process.env.PARTE3) {
      await ir(); await abrir('topTareas'); await page.waitForTimeout(900);
      for (const [k, nom] of [['mias', '03g-tareas-mias'], ['inicio', '03b-tareas-inicio'], ['lista', '03c-tareas-lista'], ['tablero', '03d-tareas-tablero'], ['proyectos', '03e-tareas-proyectos'], ['medidas', '03f-tareas-medidas']]) { await tocar(`[data-tab="${k}"]`); await foto(nom, { espera: 700 }); }
      await tocar('[data-tab="lista"]'); await page.waitForTimeout(500); await page.evaluate(() => document.querySelector('.tv-row [data-open], .tv-row .tv-t, .tv-fila button')?.click()); await foto('03h-tarea-detalle', { espera: 700 });
      await ir(); await page.evaluate(() => { const l = [...document.querySelectorAll('.brainTag, [data-dept], .dlabel, #labels *')].find(e => /MARKETING/i.test(e.textContent)); l?.click(); }); await foto('18-departamento-chat', { espera: 900 });
      await ir(); await page.evaluate(() => document.getElementById('topconn').style.cssText = 'display:flex !important;position:fixed;top:60px;left:8px;z-index:90;background:#fff'); await foto('17b-conectores-forzado-visible', { espera: 400 });
      await ir(); await abrir('topSettings'); await page.waitForTimeout(600); await page.evaluate(() => [...document.querySelectorAll('.sg-tabs button')].find(b => /Conectores/.test(b.textContent))?.click()); await foto('11-ajustes-conectores', { espera: 700 });
      await ir(); await abrir('topTareas'); await page.waitForTimeout(700); await tocar('[data-tab="mias"]'); await page.waitForTimeout(400); await page.evaluate(() => document.querySelector('.tv-quick input, input[type=text], textarea')?.focus()); await foto('03i-anadir-tarea-foco', { espera: 400 });
      med.mapa = await page.evaluate(() => { const h = innerHeight; const r = e => { const b = e?.getBoundingClientRect(); return b ? [Math.round(b.top), Math.round(b.bottom)] : null; }; return { vh: h, dvh: document.documentElement.clientHeight, cerrarX: r(document.querySelector('#tvOv .tv-close, #tareasOv [aria-label*="errar"]')) }; });
      await ctx.close(); continue;
    }
    const P2 = !!process.env.PARTE2;
    for (const [nom, idb] of (P2 ? [] : pantallas)) { await ir(); const t = await abrir(idb); await foto(nom, { espera: 900, toques: t }); }
    await ir(); med.dockVisible = await page.evaluate(() => ['topStudio','topCal','topTareas','topContenido','topAnaliticas','topAnuncios','topBrain','topBiz','topSettings','topDimitri','topPanel','topMore','topAppr','topconn','topmodels','usageDock','topSearch'].map(i => { const e = document.getElementById(i); if (!e) return [i, 'no existe']; const r = e.getBoundingClientRect(), s = getComputedStyle(e); return [i, s.display === 'none' ? 'oculto' : `${Math.round(r.width)}x${Math.round(r.height)} @${Math.round(r.left)},${Math.round(r.top)}`]; }));
    med.meta = await page.evaluate(() => ({ viewport: document.querySelector('meta[name=viewport]')?.content, bodyOverflow: getComputedStyle(document.body).overflow, fontBase: getComputedStyle(document.body).fontSize }));
    if (id !== '390') { await ctx.close(); continue; }
    // sub-pantallas
    if (!P2) {
    await ir(); await abrir('topTareas'); await page.waitForTimeout(1000);
    for (const [k, nom] of [['inicio', '03b-tareas-inicio'], ['lista', '03c-tareas-lista'], ['tablero', '03d-tareas-tablero'], ['proyectos', '03e-tareas-proyectos'], ['medidas', '03f-tareas-medidas'], ['mias', '03g-tareas-mias']]) { await page.evaluate(k => { location.hash = '#tareas=' + k; }, k); await foto(nom, { espera: 700 }); }
    await ir(); await abrir('topCal'); await page.waitForTimeout(700); for (const [v, nom] of [['week', '04b-calendario-semana'], ['day', '04c-calendario-dia'], ['agenda', '04d-calendario-agenda']]) { await tocar(`#calOv [data-v="${v}"]`); await foto(nom, { espera: 500 }); }
    await ir(); await abrir('topContenido'); await page.waitForTimeout(800);
    const modos = await page.$$eval('#ctOv button[data-m], #ctOv [data-mode]', b => b.map(x => x.dataset.m || x.dataset.mode)); med.contenidoModos = modos;
    for (const m of modos.slice(0, 4)) { await tocar(`#ctOv [data-m="${m}"], #ctOv [data-mode="${m}"]`); await foto(`05b-contenido-${m}`, { espera: 500 }); }
    }
    await ir(); await abrir('topSettings'); await page.waitForTimeout(700);
    const tabs = await page.$$eval('.sg-tabs button', b => b.map(x => x.textContent.trim().slice(0, 20))); med.ajustesTabs = tabs;
    for (let i = 0; i < Math.min(tabs.length, 14); i++) { await page.evaluate(i => document.querySelectorAll('.sg-tabs button')[i]?.click(), i); await foto(`11-ajustes-${String(i).padStart(2, '0')}`, { espera: 300 }); }
    await ir(); await page.keyboard.press('Control+k'); await foto('14-buscar', { espera: 500 });
    await ir(); await page.evaluate(() => document.getElementById('costsOv') && document.dispatchEvent(new KeyboardEvent('keydown', { key: 'u' }))); await foto('15-costos', { espera: 700 });
    await ir(); await tocar('#scene'); await foto('16-escena-toque', { espera: 500 });
    await ir(); await abrir('topDimitri'); await page.waitForTimeout(900); await page.evaluate(() => [...document.querySelectorAll('button')].find(b => /🕘|istorial/.test((b.getAttribute('aria-label') || '') + b.title + b.textContent))?.click()); await foto('12b-dimitri-historial', { espera: 600 });
    await ir(); await page.evaluate(() => document.getElementById('topconn')?.scrollIntoView()); await foto('17-conectores-barra', { espera: 300 });
    await ctx.close();
  }
  await br.close();
} finally { o.cerrar(); }
fs.writeFileSync(path.join(OUT, `medidas-${process.env.PERFIL || 'todos'}${process.env.PARTE3 ? '-p3' : process.env.PARTE2 ? '-p2' : ''}.json`), JSON.stringify(res, null, 1)); console.log('listo', Object.keys(res));
