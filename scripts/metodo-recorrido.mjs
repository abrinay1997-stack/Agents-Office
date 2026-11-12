// Herramienta de desarrollo (no entra en `npm run check`): las pestañas MÉTODO y COMPETENCIA de Anuncios en el navegador (11 nov 2026).
// Levanta una oficina temporal contra el Meta de mentira (tests/meta-stand.mjs) con dos campañas encendidas y 20 días de cifras; Scrape
// Creators se simula en el navegador (page.route): nunca se llama al servicio real ni se usa una llave. Recorre: Método → sin número mágico
// → «Números del negocio» → escribirlos y guardar → la revisión 3Q con su veredicto por campaña → cambiar la etapa → el ciclo de ventas;
// Competencia → buscar una empresa → «Seguir» → ver sus anuncios → la lectura. Mide 24 px, letra ≥ 10,5 y que nada se salga, a 1512, 1024 y 390.
//   node build.mjs && node scripts/metodo-recorrido.mjs [--capturas]   → ✓/✗ por paso (capturas en data/capturas/metodo/)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearMetaStand, TOKEN_STAND, CUENTA_STAND } from '../tests/meta-stand.mjs';
import { PERMISOS_LECTURA, PERMISOS_ANUNCIOS } from '../contenido/meta.mjs';
import { fechaEn, sumarDias } from '../anuncios/modelo.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CAPTURAS = process.argv.includes('--capturas'), OUT = path.join(ROOT, 'data', 'capturas', 'metodo');
if (CAPTURAS) fs.mkdirSync(OUT, { recursive: true });
let fails = 0; const step = (ok, what) => { if (!ok) fails++; console.log(`${ok ? '✓' : '✗'} ${what}`); };
const listen = srv => new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
const MENSAJE = 'onsite_conversion.messaging_conversation_started_7d';

async function prepararMeta(g) {
  const pedir = async (ruta, campos) => (await g.fetchFn(`https://graph.test/v26.0${ruta}`, { method: 'POST', headers: { authorization: `Bearer ${TOKEN_STAND}` },
    body: new URLSearchParams(Object.entries(campos).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)])) })).json();
  const campana = async nombre => {
    const c = await pedir(`/${CUENTA_STAND}/campaigns`, { name: nombre, objective: 'OUTCOME_ENGAGEMENT', special_ad_categories: [], status: 'PAUSED' });
    const s = await pedir(`/${CUENTA_STAND}/adsets`, { campaign_id: c.id, name: `${nombre} · conjunto`, optimization_goal: 'CONVERSATIONS', billing_event: 'IMPRESSIONS', destination_type: 'WHATSAPP',
      targeting: { geo_locations: { countries: ['PA'] }, age_min: 18, targeting_automation: { advantage_audience: 1 } }, status: 'PAUSED', daily_budget: 1000 });
    const cr = await pedir(`/${CUENTA_STAND}/adcreatives`, { name: 'k', object_story_spec: { page_id: 'P1' } });
    const a = (await pedir(`/${CUENTA_STAND}/ads`, { adset_id: s.id, name: `${nombre} · anuncio`, creative: { creative_id: cr.id }, status: 'PAUSED' })).id;
    for (const id of [c.id, s.id, a]) await pedir(`/${id}`, { status: 'ACTIVE' });
    return { c: c.id, s: s.id, a };
  };
  const sana = await campana('PanaClaw · Evaluación · Combo'), cara = await campana('PanaClaw · Presentación · Frío');
  const hoy = fechaEn('America/Panama');
  const fila = (x, dias, spend, conv) => ({ ad_id: x.a, adset_id: x.s, campaign_id: x.c, date_start: sumarDias(hoy, -dias), date_stop: sumarDias(hoy, -dias), spend: String(spend),
    impressions: '2000', reach: '1500', clicks: '60', inline_link_clicks: '40', unicos_rango: 300, actions: [{ action_type: MENSAJE, value: String(conv) }] });
  g.st.cifras = [];
  for (let d = 1; d <= 20; d++) { g.st.cifras.push(fila(sana, d, 5, 5)); g.st.cifras.push(fila(cara, d, 8, 1)); }
  const hace40 = new Date(Date.now() - 40 * 864e5).toISOString();
  for (const k of ['campanas', 'conjuntos', 'anuncios']) for (const x of Object.values(g.st[k])) { x.created_time = hace40; x.updated_time = hace40; if (x.learning_stage_info) x.learning_stage_info = { status: 'SUCCESS' }; }
}

const EMPRESAS = { empresas: [{ pageId: '123456789', nombre: 'Muebles El Roble', categoria: 'Mueblería', pais: 'PA', seguidores: 18400, verificada: true }], cache: false };
const ficha = (i, extra = {}) => ({ id: 'A' + i, pagina: 'Muebles El Roble', pageId: '123456789', activo: true, inicio: '2026-08-0' + i, fin: '', plataformas: ['FACEBOOK', 'INSTAGRAM'], formato: 'imagen',
  texto: `¿Tu sala ya no te gusta? Cámbiala este mes con 20 % de descuento.\nEscríbenos y te mandamos el catálogo (${i}).`, titulo: 'Sala nueva en 48 horas', cta: 'Enviar mensaje', destino: 'WhatsApp', destinoTipo: 'whatsapp',
  versiones: i, relacionados: 0, enlace: 'https://www.facebook.com/ads/library/?id=' + i, dias: 100 - i * 20, senal: 200 - i * 30, miniatura: '', video: false, ...extra });
const ANUNCIOS = { consulta: {}, anuncios: [ficha(1), ficha(2, { formato: 'video' }), ficha(3, { activo: false, destinoTipo: 'web', cta: 'Comprar' })], cache: false, at: new Date().toISOString(), vieja: false, de: 'Muebles El Roble · PA', semana: { usados: 2, tope: 10 },
  lectura: { total: 3, activos: 2, formatos: [['imagen', 2], ['video', 1]], destinos: [['whatsapp', 2], ['web', 1]], 
    llamados: [['Enviar mensaje', 2]], plataformas: [['FACEBOOK', 3]], diasMediana: 60, anunciantes: [['Muebles El Roble', 3]], ganadores: [], ganchos: ['¿Tu sala ya no te gusta?', 'Sala nueva en 48 horas'] } };

const medir = page => page.evaluate(() => {
  const ov = document.getElementById('anuOv'), vis = b => b.offsetParent && b.getClientRects().length;
  const peq = [...ov.querySelectorAll('.anu-main button, .anu-main select, .anu-main input, .anu-main a.anu-btn, .anu-main summary')]
    .filter(vis).map(b => [b, b.getBoundingClientRect()]).filter(([, r]) => r.height < 24 || r.width < 24).map(([b]) => (b.textContent || b.name || b.tagName).trim().slice(0, 30));
  const letra = [...ov.querySelectorAll('.anu-main *')].filter(n => n.offsetParent && [...n.childNodes].some(c => c.nodeType === 3 && c.textContent.trim())).filter(n => parseFloat(getComputedStyle(n).fontSize) < 10.5).map(n => n.className || n.tagName);
  const main = ov.querySelector('.anu-main');
  return { peq, letra: letra.slice(0, 5), hs: document.documentElement.scrollWidth > innerWidth + 1 || main.scrollWidth > main.clientWidth + 1 };
});
const sano = (m, tag) => step(!m.peq.length && !m.letra.length && !m.hs, `${tag}: objetivos de 24 px, letra ≥ 10,5 y nada se sale${m.peq.length ? ' · pequeños: ' + m.peq.join(' | ') : ''}${m.letra.length ? ' · letra: ' + m.letra.join(' ') : ''}${m.hs ? ' · se sale a lo ancho' : ''}`);
const foto = async (page, nombre) => { if (CAPTURAS) await page.screenshot({ path: path.join(OUT, nombre + '.png'), fullPage: false }); };

const g = crearMetaStand({ permisos: [...PERMISOS_LECTURA, ...PERMISOS_ANUNCIOS] }); await prepararMeta(g);
const graph = await g.escuchar();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-metodo-rec-')), brain = path.join(dir, 'brain'), local = path.join(dir, 'office.config.local.json');
fs.mkdirSync(path.join(brain, '20-Brand'), { recursive: true }); fs.writeFileSync(path.join(brain, '20-Brand', 'voice.md'), '# Voz\nCercana.\n');
fs.writeFileSync(local, JSON.stringify({ anuncios: { cuenta: CUENTA_STAND } }));
const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
const vacias = Object.fromEntries(['TELEGRAM_BOT_TOKEN', 'METRICOOL_USER_TOKEN', 'GEMINI_API_KEY', 'HF_KEY', 'HF_API_KEY', 'FAL_KEY', 'OPENAI_API_KEY', 'XAI_API_KEY', 'META_API_KEY', 'MODEL_API_KEY', 'MINIMAX_API_KEY', 'VOYAGE_API_KEY', 'META_APP_SECRET', 'META_GRAPH_VERSION'].map(k => [k, '']));
const env = { ...process.env, ...vacias, PORT: String(port), AO_DATA: path.join(dir, 'data'), AO_BRAIN: brain, AO_LOCAL_CONFIG: local, ANTHROPIC_API_KEY: 'test-key-not-real', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9',
  CLAUDE_BIN: path.join(dir, 'no-claude.exe'), META_ACCESS_TOKEN: TOKEN_STAND, META_GRAPH_HOST: graph.url, SCRAPECREATORS_API_KEY: 'llave-de-mentira-no-se-usa' }; // secrets-ok
const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
const base = `http://127.0.0.1:${port}`;
const cerrar = async () => { srv.kill(); await graph.cerrar(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ya no está */ } };
try {
  for (let i = 0; i < 150; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch { /* aún no */ } await new Promise(r => setTimeout(r, 200)); if (i === 149) throw new Error('la oficina no arrancó: ' + log.slice(-400)); }
  await fetch(base + '/api/anuncios/sincronizar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  for (let i = 0; i < 100; i++) { const v = await (await fetch(base + '/api/anuncios?rango=7d')).json(); if ((v.campanas || []).length >= 2 && v.resumen?.gasto > 0) break; await new Promise(r => setTimeout(r, 300)); }

  const nav = await chromium.launch();
  for (const [ancho, alto, tema] of [[1512, 900, 'claro'], [1024, 768, 'oscuro'], [390, 844, 'claro']]) {
    const tag = `${ancho} ${tema}`, ctxN = await nav.newContext({ viewport: { width: ancho, height: alto } }), page = await ctxN.newPage();
    const errores = []; page.on('pageerror', e => errores.push(e.message));
    await page.addInitScript(([t]) => { localStorage.setItem('ao.theme', t === 'oscuro' ? 'dark' : 'light'); localStorage.setItem('ao.movil', 'escritorio'); }, [tema]);
    await page.route('**/api/anuncios/competencia/empresas*', r => r.fulfill({ json: EMPRESAS }));
    await page.route('**/api/anuncios/competencia/anuncios*', r => r.fulfill({ json: ANUNCIOS }));
    await page.goto(base + '/', { waitUntil: 'domcontentloaded' }); await page.waitForSelector('#topdock', { state: 'attached', timeout: 30000 }); await page.waitForTimeout(800);
    await page.keyboard.press('j'); await page.waitForSelector('#anuOv [data-tab="metodo"]', { timeout: 20000 });
    await page.click('#anuOv [data-tab="metodo"]');
    await page.waitForSelector('#anuOv .anu-met [data-mlectura], #anuOv .anu-met .anu-met-lista, #anuOv .anu-met .anu-vacio', { timeout: 20000 });
    if (ancho === 1512) {
      step(await page.locator('#anuOv .anu-met').getByText('Todavía no hay número mágico').count() === 1, `${tag}: sin números, la revisión lo dice y ofrece escribirlos`);
      await page.click('#anuOv [data-mparte="numeros"]'); await page.waitForSelector('#anuOv [data-mform="negocio"]');
      await page.selectOption('#anuOv select[name="tipo"]', 'servicios'); await page.selectOption('#anuOv select[name="destino"]', 'whatsapp'); await page.selectOption('#anuOv select[name="cuenta"]', 'historial');
      await page.fill('#anuOv input[name="c:ticket"]', '120'); await page.fill('#anuOv input[name="c:invertir"]', '20'); await page.fill('#anuOv input[name="c:metaVentas"]', '6000');
      await page.fill('#anuOv input[name="cn:0"]', 'Producción'); await page.fill('#anuOv input[name="cp:0"]', '40');
      await page.click('#anuOv [data-mform="negocio"] [type=submit]');
      await page.waitForFunction(() => /Guardados/.test(document.querySelector('#anuOv .anu-met')?.textContent || ''), null, { timeout: 15000 });
      const guardado = await (await fetch(base + '/api/anuncios/metodo')).json();
      step(guardado.negocio.negocio.ticket?.valor === 120 && guardado.negocio.negocio.costos[0]?.pct === 40 && Math.abs(guardado.negocio.magico.objetivo - 1.2) < 0.001, `${tag}: los números llegan al servidor y dan el número mágico (1,20 por conversación)`);
      step(/1,20/.test(await page.textContent('#anuOv .anu-met .anu-kpis')), `${tag}: la pantalla enseña el objetivo por conversación`);
      await foto(page, 'numeros-' + ancho);
    } else await page.click('#anuOv [data-mparte="numeros"]');
    sano(await medir(page), `${tag} · Números del negocio`);

    await page.click('#anuOv [data-mparte="revision"]'); await page.waitForSelector('#anuOv .anu-met-lista .anu-met-camp', { timeout: 20000 });
    const txt = (await page.textContent('#anuOv .anu-met')).replace(/\s+/g, ' ');
    step(await page.locator('#anuOv .anu-met-camp').count() === 2 && /Pierde dinero|Apagar|pasa del equilibrio/i.test(txt) && /Evaluación · Combo/.test(txt), `${tag}: la revisión 3Q trae las dos campañas con su veredicto en palabras`);
    step(await page.locator('#anuOv .anu-met-q2 li').count() >= 2, `${tag}: Q2 enseña las métricas con «bien» o «revisar» escrito (no solo color)`);
    sano(await medir(page), `${tag} · Revisión 3Q`); await foto(page, 'revision-' + ancho + '-' + tema);
    if (ancho === 1512) {
      // el selector de etapa solo sale con ids numéricos (los de Meta de verdad; el de mentira usa «CMP6»): aquí se comprueba que la etapa se lee del nombre
      step(await page.locator('#anuOv .anu-met-camp .anu-met-cab').filter({ hasText: 'Presentación' }).count() >= 1, `${tag}: la etapa de cada campaña sale de su nombre`);
      const antes = g.llamadas.length; await page.click('#anuOv [data-ma="fresco"]'); await page.waitForTimeout(2500);
      step(g.llamadas.slice(antes).every(l => l.metodo === 'GET' || (l.metodo === 'POST' && l.ruta === '/')), `${tag}: «Leer de Meta ahora» solo lee (GET o el lote de lecturas): nada cambia en Meta`);
    }
    await page.click('#anuOv [data-mparte="ciclo"]'); await page.waitForSelector('#anuOv .anu-met-ciclo li');
    step(await page.locator('#anuOv .anu-met-ciclo li').count() === 4, `${tag}: el ciclo de ventas con sus cuatro etapas y su reparto`);
    sano(await medir(page), `${tag} · Ciclo de ventas`); await foto(page, 'ciclo-' + ancho);

    await page.click('#anuOv [data-tab="competencia"]'); await page.waitForSelector('#anuOv [data-mform="buscar"]', { timeout: 15000 });
    step(/Créditos de esta semana/.test(await page.textContent('#anuOv .anu-met')), `${tag}: Competencia dice los créditos de la semana y que cada búsqueda gasta uno`);
    await page.fill('#anuOv [data-mform="buscar"] input[name="q"]', 'Muebles El Roble'); await page.click('#anuOv [data-mform="buscar"] [type=submit]');
    await page.waitForSelector('#anuOv .anu-comp-emp li', { timeout: 10000 });
    if (ancho === 1512) {
      await page.click('#anuOv [data-cguardar]'); await page.waitForSelector('#anuOv .anu-comp-guard [data-cver]', { timeout: 10000 });
      const c = await (await fetch(base + '/api/anuncios/competencia')).json();
      step(c.competidores.length === 1 && c.competidores[0].pageId === '123456789', `${tag}: «Seguir» guarda al competidor`);
      await page.fill('#anuOv [data-mform="buscar"] input[name="q"]', 'Muebles El Roble'); await page.click('#anuOv [data-mform="buscar"] [type=submit]'); await page.waitForSelector('#anuOv .anu-comp-emp li');
    }
    await page.click('#anuOv .anu-comp-emp [data-cver]'); await page.waitForSelector('#anuOv .anu-comp-anuncio', { timeout: 10000 });
    const orden = await page.$$eval('#anuOv .anu-comp-anuncio .anu-met-cifra', l => l.map(n => n.textContent));
    step(await page.locator('#anuOv .anu-comp-anuncio').count() === 3 && /imagen/.test(orden[0]) && /Ya no corre/.test(await page.textContent('#anuOv .anu-comp-anuncio:last-child')), `${tag}: los anuncios salen por señal (el que más lleva, primero) con su estado escrito`);
    step(await page.locator('#anuOv .anu-comp-anuncio img').count() === 0, `${tag}: ninguna imagen de un servidor ajeno (la CSP no cambia)`);
    sano(await medir(page), `${tag} · Competencia`); await foto(page, 'competencia-' + ancho);
    step(!errores.length, `${tag}: sin errores de JavaScript${errores.length ? ' · ' + errores.slice(0, 2).join(' | ') : ''}`);
    await ctxN.close();
  }
  await nav.close();
} catch (e) { step(false, 'el recorrido se cortó: ' + e.message); } finally { await cerrar(); }
console.log(fails ? `\n✗ ${fails} fallo(s)` : '\n✓ todo bien');
process.exit(fails ? 1 : 0);
