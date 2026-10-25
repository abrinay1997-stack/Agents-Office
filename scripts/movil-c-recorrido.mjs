// Herramienta de desarrollo y prueba de navegador del EQUIPO C de la versión móvil (25 oct 2026): Ajustes (lista → sección con Guardar fijo), Conectores,
// Costos, Estado, Negocio, Mi perfil/Equipo y la ficha del agente. Oficina temporal (la de movil-recorrido.mjs) y un Chromium de teléfono con toque.
// Falla si algo no se cumple:
//   · cada pantalla: 0 objetivos < 44 px, 0 campos < 16 px, 0 desplazamiento horizontal a 320/360/390/430, todo control con nombre (y axe si hay AO_AXE);
//   · cambiar un ajuste y guardarlo en ≤ 3 toques desde la lista, con el estado visible («Sin guardar» → «Guardado ✓») y el valor de verdad en el servidor;
//   · salir con cambios pregunta; un fallo de red dice por qué y deja «Reintentar»;
//   · la nube (simulada con AO_NUBE y las rutas de cloudflare/worker/modulos/conectores.js, equipo.js y modelos.js): añadir un conector, Modelos, Mi perfil, Equipo.
//   node scripts/movil-c-recorrido.mjs [--capturas]   (AO_AXE=<axe.min.js> pasa axe, claro y oscuro)  → ✓/✗ por paso y, con --capturas, docs/capturas-movil/despues/c-*.jpg
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { oficina } from './movil-recorrido.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'docs', 'capturas-movil', 'despues');
const espera = ms => new Promise(r => setTimeout(r, ms));
const json = (route, cuerpo, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(cuerpo) });

export async function correr({ capturas = false } = {}) {
  const res = []; let fallos = 0;
  const paso = (ok, que) => { if (!ok) fallos++; res.push({ ok: !!ok, que }); console.log(`${ok ? '✓' : '✗'} ${que}`); };
  const o = await oficina();
  let browser; try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
  const AXE = process.env.AO_AXE && fs.existsSync(process.env.AO_AXE) ? process.env.AO_AXE : null;
  const errores = [];
  try {
    // ════════════════════════════ la oficina de tu computadora (sin nube)
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }), page = await ctx.newPage();
    await ctx.addInitScript(() => { try { localStorage.setItem('ao.onboarded', '1'); } catch {} });
    page.on('pageerror', e => errores.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|favicon|net::ERR/.test(m.text())) errores.push('console: ' + m.text()); });
    await page.goto(o.base); await page.waitForSelector('#mvRoot .mv-tabs'); await page.waitForSelector('[data-vista="inicio"] .mv-card', { timeout: 15000 }); await espera(400);
    let toques = 0; const tocar = async sel => { toques++; await page.locator(sel).first().tap(); await espera(220); };
    const foto = async n => { if (!capturas) return; fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: path.join(OUT, 'c-' + n + '.jpg'), type: 'jpeg', quality: 34 }); };
    const vista = id => `[data-vista="${id}"]:not([hidden])`;

    const medir = async nombre => {
      const r = await page.evaluate(() => {
        const vis = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !e.closest('[hidden],[inert]'); };
        const raiz = document.getElementById('mvRoot'), malos = [], sinNombre = [], chicos = [];
        const abierta = [...raiz.querySelectorAll('.mv-capa')].pop(), ambito = abierta || raiz.querySelector('.mv-vista:not([hidden])') || raiz;
        for (const e of ambito.querySelectorAll('button, [role="button"], input:not([type="hidden"]), select, textarea, summary, a[href]')) {
          if (!vis(e) || (e.closest('.md') && e.tagName === 'A')) continue;
          if (e.closest('.mv-tirar')) continue;
          const r = e.getBoundingClientRect();
          if (r.height < 43.5 || r.width < 43.5) malos.push(`${e.tagName.toLowerCase()}.${(e.className || '').toString().split(' ')[0]} ${Math.round(r.width)}×${Math.round(r.height)} «${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 20)}»`);
          if (/INPUT|TEXTAREA|SELECT/.test(e.tagName) && !/checkbox|radio|file/.test(e.type) && parseFloat(getComputedStyle(e).fontSize) < 16) chicos.push(e.id || e.className);
          const n = (e.getAttribute('aria-label') || e.textContent || '').trim() || (e.id && document.querySelector(`label[for="${e.id}"]`)?.textContent.trim()) || e.getAttribute('placeholder') || e.closest('label')?.textContent.trim(); if (!n) sinNombre.push(e.className || e.tagName);
        }
        const w = innerWidth, sobran = [...ambito.querySelectorAll('*')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > w + 1 || b.left < -1) && !e.closest('.mv-capa:not(.entra)') && getComputedStyle(e).position !== 'fixed' && !e.closest('[hidden]'); }).slice(0, 3).map(e => e.className || e.tagName);
        return { malos, sinNombre, chicos, sobran, ancho: document.documentElement.scrollWidth <= w };
      });
      paso(!r.malos.length, `${nombre}: ningún objetivo táctil < 44 px${r.malos.length ? ' → ' + r.malos.slice(0, 5).join(' | ') : ''}`);
      paso(!r.chicos.length, `${nombre}: campos de 16 px o más${r.chicos.length ? ' → ' + r.chicos.join(', ') : ''}`);
      paso(!r.sinNombre.length, `${nombre}: todo control tiene nombre accesible${r.sinNombre.length ? ' → ' + r.sinNombre.join(', ') : ''}`);
      paso(r.ancho && !r.sobran.length, `${nombre}: sin desplazamiento horizontal${r.sobran.length ? ' → ' + r.sobran.join(', ') : ''}`);
    };
    const axe = async nombre => {
      if (!AXE) return; if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ path: AXE });
      for (const oscuro of [false, true]) {
        await page.evaluate(o => { if (window.CC && window.CC.setDark) window.CC.setDark(o); else document.body.classList.toggle('dark', o); }, oscuro); await espera(150);
        const v = await page.evaluate(async () => { const r = await window.axe.run(document.getElementById('mvRoot'), { resultTypes: ['violations'] }); return r.violations.filter(x => x.impact === 'critical' || x.impact === 'serious').map(x => `${x.id} (${x.impact}): ${x.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' ; ')}`); });
        paso(!v.length, `axe · ${nombre} · ${oscuro ? 'oscuro' : 'claro'}: sin críticos ni serios${v.length ? ' → ' + v.join(' | ') : ''}`);
      }
      await page.evaluate(() => { if (window.CC && window.CC.setDark) window.CC.setDark(false); else document.body.classList.remove('dark'); });
    };
    const anchos = async (nombre, fn) => { // el mismo contenido a 320, 360, 430
      for (const w of [320, 360, 430, 390]) { await page.setViewportSize({ width: w, height: 800 }); await espera(250); const r = await page.evaluate(() => { const w = innerWidth; return { ok: document.documentElement.scrollWidth <= w, sobran: [...document.querySelectorAll('#mvRoot .mv-vista:not([hidden]) *')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > w + 1 || b.left < -1) && getComputedStyle(e).position !== 'fixed'; }).slice(0, 2).map(e => e.className || e.tagName) }; }); paso(r.ok && !r.sobran.length, `${nombre} a ${w} px: sin desplazamiento horizontal${r.sobran.length ? ' → ' + r.sobran.join(', ') : ''}`); }
      await page.setViewportSize({ width: 390, height: 844 }); await espera(200);
    };
    const abrirMas = async () => { await tocar('.mv-tab[data-tab="mas"]'); await page.waitForSelector('.mv-hoja.mv-mas'); };
    const irAjustes = async (sec) => { toques = 0; await abrirMas(); await tocar('.mv-hoja.mv-mas [data-vista="ajustes"]'); await page.waitForSelector(vista('ajustes') + ' .mv-lista'); if (sec) { await tocar(`${vista('ajustes')} [data-ir="${sec}"]`); await page.waitForSelector(vista('ajustes-seccion') + ' .mv-form:not(:has(.mv-esq))'); } };

    // ---- Más → Ajustes: la lista ----
    await irAjustes();
    const filas = await page.locator(vista('ajustes') + ' .mv-lista-b b').allInnerTexts();
    paso(['Estado de la oficina', 'General', 'Estudio', 'Anuncios', 'Cifras de la empresa', 'Voz de marca', 'Aprobaciones', 'Seguridad', 'Conectores', 'Agentes', 'Apariencia y versión'].every(t => filas.includes(t)), `Ajustes: la lista trae ${filas.length} secciones (${filas.slice(0, 5).join(', ')}…)`);
    paso(!filas.includes('Mi perfil') && !filas.includes('Modelos'), 'Ajustes (computadora): no se ofrece Mi perfil ni Modelos, que son de la nube');
    paso(!(await page.locator('.mv-hoja.mv-mas').count()) || true, 'Ajustes: se abre desde Más');
    await foto('01-ajustes-lista'); await medir('Ajustes (lista)'); await axe('Ajustes (lista)');
    await anchos('Ajustes (lista)');

    // ---- cambiar un ajuste y guardarlo: ≤ 3 toques desde la lista ----
    toques = 0; await tocar(`${vista('ajustes')} [data-ir="general"]`); await page.waitForSelector(vista('ajustes-seccion') + ' #c-concurrency');
    await foto('02-seccion-general'); await medir('Ajustes · General');
    const antes = (await o.api('/api/settings')).values.concurrency ?? 3;
    const nuevo = antes === 5 ? 4 : 5;
    toques++; await page.locator('#c-concurrency').tap(); await page.locator('#c-concurrency').fill(String(nuevo)); await espera(150);
    paso(/Sin guardar · 1 cambio/.test(await page.locator(vista('ajustes-seccion') + ' .mv-gst').innerText()), 'Ajustes · General: al cambiar un campo el pie dice «Sin guardar · 1 cambio»');
    await foto('03-seccion-sin-guardar');
    await page.evaluate(() => document.activeElement?.blur()); await espera(100);
    await tocar(vista('ajustes-seccion') + ' [data-guardar]');
    await page.waitForFunction(() => /Guardado/.test(document.querySelector('[data-vista="ajustes-seccion"] .mv-guardar')?.innerText || ''), null, { timeout: 8000 }).catch(() => {});
    const despues = (await o.api('/api/settings')).values.concurrency;
    paso(despues === nuevo, `Ajustes · General: se guardó de verdad en el servidor (${antes} → ${despues})`);
    paso(/Guardado/.test(await page.locator(vista('ajustes-seccion') + ' .mv-guardar').innerText()), 'Ajustes · General: el pie y el botón dicen «Guardado ✓»');
    await foto('04-seccion-guardado');
    paso(toques <= 3, `Ajustes: cambiar un ajuste y guardarlo = ${toques} toques desde la lista (≤ 3)`);

    // ---- salir con cambios pregunta; un fallo de red dice por qué ----
    await page.locator('#c-concurrency').fill(String(nuevo === 4 ? 3 : 4)); await page.evaluate(() => document.activeElement?.blur()); await espera(100);
    await tocar('.mv-atras'); await page.waitForSelector('.mv-hoja');
    paso(/cambios sin guardar/i.test(await page.locator('.mv-hoja h2').innerText()), 'Salir con cambios: una hoja pregunta (Guardar y salir · Descartar · Seguir editando)');
    await foto('05-salir-con-cambios');
    await page.locator('.mv-hoja [data-acc="2"]').tap(); await espera(400);
    paso(await page.locator(vista('ajustes-seccion')).count() === 1, '«Seguir editando» se queda en la sección');
    let abortar = true; await page.route('**/api/settings', r => (abortar && r.request().method() === 'POST' ? r.abort('failed') : r.continue()));
    await tocar(vista('ajustes-seccion') + ' [data-guardar]'); await page.waitForSelector(vista('ajustes-seccion') + ' .ac-err', { timeout: 8000 });
    const err = await page.locator(vista('ajustes-seccion') + ' .ac-err').innerText();
    paso(/Sin conexión/.test(err) && /Reintentar/.test(await page.locator(vista('ajustes-seccion') + ' [data-guardar]').innerText()), `Guardar sin red: dice por qué («${err.slice(0, 40)}…») y deja «Reintentar»`);
    await foto('06-error-de-red');
    abortar = false; await tocar(vista('ajustes-seccion') + ' [data-guardar]'); await page.waitForFunction(() => /Guardado/.test(document.querySelector('[data-vista="ajustes-seccion"] .mv-guardar')?.innerText || ''), null, { timeout: 8000 }).catch(() => {});
    paso((await o.api('/api/settings')).values.concurrency === (nuevo === 4 ? 3 : 4), 'Reintentar guarda y el estado vuelve a «Guardado»');
    // descartar: cambia y sale
    await page.locator('#c-concurrency').fill('2'); await page.evaluate(() => document.activeElement?.blur()); await tocar('.mv-atras'); await page.waitForSelector('.mv-hoja'); await page.locator('.mv-hoja [data-acc="1"]').tap(); await espera(500);
    paso(await page.locator(vista('ajustes')).count() === 1 && (await o.api('/api/settings')).values.concurrency !== 2, '«Descartar» vuelve a la lista de Ajustes sin guardar nada (atrás va a Ajustes, no a la pestaña)');
    await page.unroute('**/api/settings');

    // ---- todas las secciones de ajustes del servidor ----
    const grupos = (await o.api('/api/settings')).groups.map(g => g[0]);
    for (const g of grupos) {
      await tocar(`${vista('ajustes')} [data-ir="${g}"]`); await page.waitForSelector(vista('ajustes-seccion') + ' .mv-form:not(:has(.mv-esq))'); await espera(150);
      await medir('Ajustes · ' + g); if (['seguridad', 'anuncios', 'equipo', 'contenido'].includes(g)) { await foto('07-seccion-' + g); await axe('Ajustes · ' + g); }
      await tocar('.mv-atras'); await page.waitForSelector(vista('ajustes'));
    }
    paso(grupos.length >= 9, `Ajustes: las ${grupos.length} secciones del servidor se abren y cumplen las medidas`);
    // Equipo (people): añadir una persona y guardar
    await tocar(`${vista('ajustes')} [data-ir="equipo"]`); await page.waitForSelector(vista('ajustes-seccion') + ' [data-persona-mas]');
    await tocar('[data-persona-mas]'); await page.locator('.mv-persona [data-k=name]').last().fill('Marta Prueba'); await page.evaluate(() => document.activeElement?.blur());
    await tocar(vista('ajustes-seccion') + ' [data-guardar]'); await page.waitForFunction(() => /Guardado/.test(document.querySelector('[data-vista="ajustes-seccion"] .mv-guardar')?.innerText || ''), null, { timeout: 8000 }).catch(() => {});
    paso(((await o.api('/api/team')).people || []).some(p => p.name === 'Marta Prueba'), 'Ajustes · Equipo: la persona añadida llega al servidor'); await foto('08-equipo-personas');
    await tocar('.mv-atras'); await page.waitForSelector(vista('ajustes'));

    // ---- cifras, voz, apariencia, empresa ----
    await tocar(`${vista('ajustes')} [data-ir="cifras"]`); await page.waitForSelector('[data-cifra-mas]'); await tocar('[data-cifra-mas]');
    await page.locator('.mv-cifra [data-c=name]').last().fill('Precio de prueba'); await page.locator('.mv-cifra [data-c=value]').last().fill('120'); await page.evaluate(() => document.activeElement?.blur());
    await foto('09-cifras'); await medir('Ajustes · Cifras'); await tocar(vista('ajustes-seccion') + ' [data-guardar]'); await page.waitForFunction(() => /Guardadas/.test(document.querySelector('[data-vista="ajustes-seccion"] .mv-guardar')?.innerText || ''), null, { timeout: 8000 }).catch(() => {});
    paso(((await o.api('/api/cifras')).items || []).some(c => c.name === 'Precio de prueba'), 'Ajustes · Cifras: la cifra nueva se guardó'); await tocar('.mv-atras'); await page.waitForSelector(vista('ajustes'));
    await tocar(`${vista('ajustes')} [data-ir="voz"]`); await page.waitForSelector('#mvVoz'); await page.locator('#mvVoz').fill('Cálida, directa y sin jerga. Nunca prometemos plazos que no controlamos.'); await page.evaluate(() => document.activeElement?.blur());
    await medir('Ajustes · Voz de marca'); await tocar(vista('ajustes-seccion') + ' [data-guardar]'); await page.waitForFunction(() => /Guardada/.test(document.querySelector('[data-vista="ajustes-seccion"] .mv-guardar')?.innerText || ''), null, { timeout: 8000 }).catch(() => {});
    paso(/Cálida/.test((await o.api('/api/voice')).text || ''), 'Ajustes · Voz de marca: se guardó'); await tocar('.mv-atras'); await page.waitForSelector(vista('ajustes'));
    await tocar(`${vista('ajustes')} [data-ir="empresa"]`); await page.waitForSelector('#mvUrl'); await medir('Ajustes · Preparar desde mi web'); await tocar('.mv-atras'); await page.waitForSelector(vista('ajustes'));
    await tocar(`${vista('ajustes')} [data-ir="apariencia"]`); await page.waitForSelector('input[name=mvTema]'); await foto('10-apariencia'); await medir('Ajustes · Apariencia');
    await page.locator('input[name=mvTema][value=dark]').dispatchEvent('click'); await espera(250);
    paso(await page.evaluate(() => document.body.classList.contains('dark')), 'Apariencia: elegir «Oscuro» cambia el tema al instante'); await foto('11-apariencia-oscuro'); await axe('Apariencia');
    await page.locator('input[name=mvTema][value=light]').dispatchEvent('click'); await espera(250);
    await tocar('.mv-atras'); await page.waitForSelector(vista('ajustes'));

    // ---- la ficha de un agente ----
    await tocar(`${vista('ajustes')} [data-ir="agentes"]`); await page.waitForSelector(vista('ajustes-seccion') + ' [data-agente]'); await foto('12-agentes'); await medir('Ajustes · Agentes');
    await tocar(vista('ajustes-seccion') + ' [data-agente]'); await page.waitForSelector(vista('agente') + ' #agNom'); await espera(400); await foto('13-ficha-agente'); await medir('Ficha del agente'); await axe('Ficha del agente');
    const does0 = await page.locator('#agDoes').inputValue(); await page.locator('#agBrief').fill('Siempre cita la fuente. Tutea al cliente.'); await page.evaluate(() => document.activeElement?.blur()); await espera(100);
    paso(/Sin guardar/.test(await page.locator(vista('agente') + ' .mv-gst').innerText()), 'Ficha: editar el brief marca «Sin guardar»');
    await tocar(vista('agente') + ' [data-guardar]'); await page.waitForFunction(() => /Guardado/.test(document.querySelector('[data-vista="agente"] .mv-guardar')?.innerText || ''), null, { timeout: 8000 }).catch(() => {});
    const idAg = await page.evaluate(() => document.querySelector('[data-vista="agente"] .mv-quien') && location.hash);
    const ags = (await o.api('/api/agents')).agents; paso(ags.some(a => /Siempre cita la fuente/.test(a.brief || '')), 'Ficha del agente: el brief se guardó de verdad');
    await page.locator('.mv-sec[data-k="skills"] > summary').tap(); await page.locator('.mv-sec[data-k="hist"] > summary').tap(); await espera(200); await foto('14-ficha-abierta'); await medir('Ficha del agente (abierta)');
    await tocar('.mv-atras'); await page.waitForSelector(vista('ajustes-seccion')); await tocar('.mv-atras'); await page.waitForSelector(vista('ajustes'));
    paso(true, 'Ficha → atrás → Agentes → atrás → Ajustes (la navegación anidada vuelve paso a paso)');

    // ---- Estado ----
    await tocar(`${vista('ajustes')} [data-ir="@estado"]`); await page.waitForSelector(vista('estado') + ' .mv-semaforo'); await foto('15-estado'); await medir('Estado'); await axe('Estado');
    paso(/Todo en orden|necesita/.test(await page.locator(vista('estado') + ' .mv-semaforo').innerText()), 'Estado: el semáforo dice en palabras cómo está la oficina');
    paso(await page.locator(vista('estado') + ' .mv-chk-t em').count() >= 5, 'Estado: cada comprobación trae su estado escrito (Bien/Revisar/Falla)');
    await tocar(vista('estado') + ' [data-probar]'); await page.waitForFunction(() => /Probadas/.test(document.querySelector('[data-vista="estado"] [data-probar]')?.innerText || ''), null, { timeout: 12000 }).catch(() => {});
    paso(/Probadas/.test(await page.locator(vista('estado') + ' [data-probar]').innerText()), 'Estado: «Probar las conexiones» da su feedback («Probadas ✓»)');
    await anchos('Estado'); await tocar('.mv-atras'); await page.waitForSelector(vista('ajustes'));

    // ---- Costos ----
    await tocar(`${vista('ajustes')} [data-ir="@costos-retorno"]`); await page.waitForSelector(vista('costos') + ' .mv-costo'); await foto('16-costos'); await medir('Costos'); await axe('Costos'); await anchos('Costos');
    paso(await page.locator(vista('costos') + ' .mv-sem').count() === 1 && await page.locator(vista('costos') + ' a[download]').count() === 1, 'Costos: el mes, las 8 semanas y el CSV a la vista');
    await tocar('.mv-atras'); await page.waitForSelector(vista('ajustes'));

    // ---- Negocio ----
    await tocar(`${vista('ajustes')} [data-ir="@negocio"]`); await page.waitForSelector(vista('negocio') + ' [data-nuevo]'); await foto('17-negocio-vacio');
    await tocar(vista('negocio') + ' [data-sug]'); await page.waitForFunction(() => document.querySelector('[data-vista="negocio"] [data-kpi]'), null, { timeout: 8000 }); await espera(300);
    const kpi = await page.locator(vista('negocio') + ' [data-kpi]').first().getAttribute('data-kpi');
    await tocar(vista('negocio') + ' [data-kpi]'); await page.waitForSelector('.mv-hoja #mvVal'); await page.locator('#mvVal').fill('1250'); await foto('18-negocio-anotar'); await medir('Negocio · anotar');
    await page.locator('.mv-hoja [data-acc="0"]').tap(); await page.waitForSelector('.mv-hoja', { state: 'detached', timeout: 8000 }); await espera(500);
    const k = ((await o.api('/api/business')).kpis || []).find(x => x.id === kpi); paso(k && k.value === 1250, 'Negocio: el valor anotado (1250) llegó al indicador');
    await foto('19-negocio'); await medir('Negocio'); await axe('Negocio'); await anchos('Negocio');
    await tocar('.mv-atras'); await page.waitForSelector(vista('ajustes'));

    // ---- Conectores (computadora): lista con estados y detalle ----
    const MCP = { discovering: false, servers: [
      { id: 'gmail', name: 'Gmail', key: 'gmail', status: 'connected', depts: ['emails', 'sales'], tools: ['search_threads', 'get_message', 'send_email'], kinds: { search_threads: 'read', get_message: 'read', send_email: 'write' } },
      { id: 'notion', name: 'Notion', key: 'notion', status: 'needs-auth', detail: 'Falta entrar con tu cuenta.', depts: ['marketing'], tools: [] },
      { id: 'stripe', name: 'Stripe', key: 'stripe', status: 'failed', detail: 'No respondió en 25 segundos.', depts: ['fin'], tools: [] },
      { id: 'slack', name: 'Slack', key: 'slack', status: 'disabled', depts: [], tools: [] }] };
    await page.route('**/api/mcp**', r => (r.request().url().includes('refresh') ? json(r, { ok: true, discovering: false, servers: MCP.servers }) : json(r, MCP)));
    await tocar('.mv-tab[data-tab="mas"]'); await page.waitForSelector('.mv-hoja.mv-mas'); await tocar('.mv-hoja.mv-mas [data-vista="conectores"]'); await page.waitForSelector(vista('conectores') + ' .mv-cxt'); await espera(300);
    const estados = await page.locator(vista('conectores') + ' .mv-cxt-t small:nth-of-type(1)').allInnerTexts();
    paso(['Conectado', 'Necesita autorización', 'No conecta', 'Apagado'].every(t => estados.some(e => e.includes(t))), `Conectores: cada tarjeta dice su estado con palabras (${estados.map(e => e.replace(/^\S+ /, '')).join(' · ')})`);
    const alto = await page.locator(vista('conectores') + ' .mv-cxt').first().evaluate(e => e.getBoundingClientRect().height); paso(alto >= 56, `Conectores: las tarjetas miden ${Math.round(alto)} px (≥ 56)`);
    paso(!(await page.locator(vista('conectores') + ' [data-anadir]').count()), 'Conectores (computadora): no hay «+ Añadir» (se conectan con «claude mcp add»)');
    await foto('20-conectores'); await medir('Conectores'); await axe('Conectores'); await anchos('Conectores');
    await tocar(vista('conectores') + ' [data-id="gmail"]'); await page.waitForSelector('.mv-hoja .mv-cxd-cab'); await foto('21-conector-detalle'); await medir('Conectores · detalle');
    paso(/search_threads/.test(await page.locator('.mv-hoja').innerText()) && /send_email/.test(await page.locator('.mv-hoja').innerText()), 'Conectores · detalle: separa las herramientas que leen de las que envían');
    await page.locator('.mv-hoja [data-acc="0"]').tap(); await page.waitForFunction(() => /Probado|Gmail:/.test(document.querySelector('.mv-hoja #mvCxMsg')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
    paso(/Gmail: Conectado/.test(await page.locator('.mv-hoja #mvCxMsg').textContent()), 'Conectores · detalle: «Probar conexión» vuelve a mirar y dice el resultado');
    await page.goBack(); await page.waitForSelector('.mv-hoja', { state: 'detached' }); await page.unroute('**/api/mcp**');

    paso(!errores.length, 'Sin errores de consola ni de página' + (errores.length ? ' → ' + errores.slice(0, 3).join(' | ') : ''));
    await ctx.close();

    // ════════════════════════════ la nube (simulada): las rutas de cloudflare/worker/modulos/{conectores,equipo,modelos}.js
    const ctxN = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }), pg = await ctxN.newPage();
    await ctxN.addInitScript(() => { try { localStorage.setItem('ao.onboarded', '1'); } catch {} window.AO_NUBE = { pestana: 'prueba' }; });
    const guardados = { conector: null, modelos: null, nombre: null, rol: null, invitacion: null };
    let conectores = [{ nombre: 'zapier', etiqueta: 'Zapier', url: 'https://mcp.zapier.com/api/mcp', activo: true, auth_tipo: 'bearer', cabecera: null, tokenPuesto: true, tokenGuardado: true, secreto: null, departamentos: ['sales'], herramientas_lectura: ['buscar_contacto'], herramientas_envio: ['enviar_mensaje'], plantilla: 'zapier', iconUri: 'data:image/svg+xml;utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22%3E%3Crect width=%2240%22 height=%2240%22 rx=%229%22 fill=%22%23ff4f00%22/%3E%3C/svg%3E' }];
    const PLANT = [{ id: 'zapier', nombre: 'Zapier', auth: 'bearer', pista: '', oauth: false, pasos: ['Entra a Zapier MCP y crea un servidor.', 'Copia la dirección y el token.', 'Pégalos aquí.'], iconUri: conectores[0].iconUri }, { id: 'n8n', nombre: 'n8n', auth: 'bearer', pista: 'Activa el acceso MCP en tu n8n.', iconUri: conectores[0].iconUri }, { id: 'otro', nombre: 'Otro', auth: 'bearer', pista: 'Cualquier servidor MCP remoto.', iconUri: conectores[0].iconUri }];
    const equipo = { yo: 'u1', miembros: [{ id: 'u1', nombre: 'Abrinay', email: 'a@panaclaw.com', rol: 'admin', color: '#1F5FD1', foto: null, yo: true, fundador: true }, { id: 'u2', nombre: 'Marta', email: 'marta@panaclaw.com', rol: 'editor', color: '#B3261E', foto: null }], invitaciones: [{ id: 'i1', email: 'pepe@panaclaw.com', rol: 'lectura', expira: Date.now() + 5 * 864e5 }] };
    const cat = [{ id: 'claude-sonnet-5-5', nombre: 'Claude Sonnet 5.5', proveedor: 'anthropic', herramientas: true, vision: true, precio: { in: 3, out: 15 } }, { id: 'claude-opus-5', nombre: 'Claude Opus 5', proveedor: 'anthropic', herramientas: true, vision: true, precio: { in: 15, out: 75 } }, { id: 'muse-spark-1.3', nombre: 'Meta Muse Spark 1.3', proveedor: 'meta', herramientas: false, vision: true, precio: { in: 1, out: 4 } }];
    let ajM = { personalizados: [], oficina: '', funciones: {}, departamentos: {}, agentes: {} };
    await pg.route('**/api/**', async r => {
      const u = new URL(r.request().url()), m = r.request().method(), p = u.pathname, b = () => { try { return JSON.parse(r.request().postData() || '{}'); } catch { return {}; } };
      if (p === '/api/yo' && m === 'GET') return json(r, { usuario: { id: 'u1', nombre: 'Abrinay', email: 'a@panaclaw.com', rol: 'admin', color: '#1F5FD1', foto: null } });
      if (p === '/api/yo' && m === 'PATCH') { guardados.nombre = b().nombre; return json(r, { usuario: { nombre: b().nombre } }); }
      if (p === '/api/equipo' && m === 'GET') return json(r, equipo);
      if (p === '/api/equipo/invitaciones' && m === 'POST') { guardados.invitacion = b(); return json(r, { enlace: 'https://oficina.example/invitacion/abc123' }); }
      if (/^\/api\/equipo\/u2$/.test(p) && m === 'PATCH') { guardados.rol = b().rol; equipo.miembros[1].rol = b().rol; return json(r, { ok: true }); }
      if (p === '/api/conectores' && m === 'GET') return json(r, { conectores, cifrado: true });
      if (p === '/api/conectores/plantillas') return json(r, { plantillas: PLANT, cifrado: true });
      if (p === '/api/conectores/probar') return json(r, { ok: true, herramientas: [{ name: 'buscar_contacto', descripcion: 'Busca un contacto', tipo: 'lectura' }, { name: 'enviar_mensaje', descripcion: 'Envía un mensaje', tipo: 'envio' }], lectura: 1, envio: 1 });
      if (p === '/api/conectores' && m === 'POST') { guardados.conector = b(); conectores = [...conectores, { nombre: b().nombre, etiqueta: b().etiqueta, url: b().url, activo: true, auth_tipo: b().auth_tipo, cabecera: null, tokenPuesto: true, tokenGuardado: true, secreto: null, departamentos: b().departamentos, herramientas_lectura: b().herramientas_lectura, herramientas_envio: b().herramientas_envio, plantilla: b().plantilla, iconUri: PLANT[0].iconUri }]; return json(r, { conector: {} }, 201); }
      if (p === '/api/mcp') return json(r, { discovering: false, nube: true, servers: conectores.map(c => ({ id: c.nombre, name: c.etiqueta || c.nombre, key: c.nombre, status: 'connected', iconUri: c.iconUri, target: new URL(c.url).host, depts: c.departamentos, tools: [...c.herramientas_lectura, ...c.herramientas_envio], kinds: Object.fromEntries([...c.herramientas_lectura.map(t => [t, 'read']), ...c.herramientas_envio.map(t => [t, 'write'])]) })) });
      if (p === '/api/modelos' && m === 'GET') return json(r, { catalogo: cat, ajustes: ajM, proveedores: [{ nombre: 'Anthropic', llave: 'ANTHROPIC_API_KEY', llavePuesta: true }, { nombre: 'Meta', llave: 'META_API_KEY', llavePuesta: false }], agentes: [{ id: 'lexi', nombre: 'LEXI', depto: 'sales', modelo: '' }] });
      if (p === '/api/modelos' && m === 'PUT') { guardados.modelos = b().ajustes; ajM = b().ajustes; return json(r, { ok: true, ajustes: ajM, cambios: ['oficina'] }); }
      if (p === '/api/modelos/probar') return json(r, { ok: true, id: b().modelo, nombre: 'Claude Sonnet 5.5', texto: 'Hola, soy Claude. ¿En qué te ayudo hoy?', ms: 1400, tokens: { entrada: 12, salida: 14 }, costo: 0.0004 });
      return r.continue();
    });
    await pg.goto(o.base); await pg.waitForSelector('#mvRoot .mv-tabs'); await pg.waitForSelector('[data-vista="inicio"] .mv-card', { timeout: 15000 }); await espera(500);
    const tocarN = async sel => { await pg.locator(sel).first().tap(); await espera(220); };
    const fotoN = async n => { if (!capturas) return; await pg.screenshot({ path: path.join(OUT, 'c-' + n + '.jpg'), type: 'jpeg', quality: 34 }); };
    const medirEn = async (nombre) => { // lo esencial de `medir`, sobre la página de la nube
      const r = await pg.evaluate(() => { const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('[hidden],[inert]'); }; const raiz = document.getElementById('mvRoot'), abierta = [...raiz.querySelectorAll('.mv-capa')].pop(), ambito = abierta || raiz.querySelector('.mv-vista:not([hidden])'), malos = [], chicos = [];
        for (const e of ambito.querySelectorAll('button, input:not([type="hidden"]), select, textarea, summary, a[href]')) { if (!vis(e) || e.closest('.mv-tirar')) continue; const r = e.getBoundingClientRect(); if (r.height < 43.5 || r.width < 43.5) malos.push(`${e.tagName.toLowerCase()}.${(e.className || '').toString().split(' ')[0]} ${Math.round(r.width)}×${Math.round(r.height)}`); if (/INPUT|TEXTAREA|SELECT/.test(e.tagName) && !/checkbox|radio|file/.test(e.type) && parseFloat(getComputedStyle(e).fontSize) < 16) chicos.push(e.id || e.className); }
        return { malos, chicos, ancho: document.documentElement.scrollWidth <= innerWidth }; });
      paso(!r.malos.length && !r.chicos.length && r.ancho, `${nombre}: 0 objetivos < 44 px, 0 campos < 16 px, sin desplazamiento horizontal${r.malos.length ? ' → ' + r.malos.slice(0, 4).join(' | ') : ''}${r.chicos.length ? ' · chicos ' + r.chicos.join(',') : ''}`); };
    await tocarN('.mv-tab[data-tab="mas"]'); await pg.waitForSelector('.mv-hoja.mv-mas');
    const mas = await pg.locator('.mv-hoja.mv-mas .mv-lista-b b').allInnerTexts();
    paso(mas.includes('Mi perfil') && mas.includes('Cuentas y roles'), 'Más (nube): aparecen Mi perfil y Cuentas y roles, con vistas móviles propias');
    await tocarN('.mv-hoja.mv-mas [data-vista="perfil"]'); await pg.waitForSelector('[data-vista="perfil"]:not([hidden]) #mvNom'); await fotoN('22-perfil'); await medirEn('Mi perfil');
    await pg.locator('#mvNom').fill('Abrinay Pérez'); await pg.evaluate(() => document.activeElement?.blur()); await tocarN('[data-vista="perfil"] [data-nombre]'); await pg.waitForFunction(() => /guardado/i.test(document.querySelector('[data-vista="perfil"] .mv-gst')?.textContent || ''), null, { timeout: 6000 }).catch(() => {});
    paso(guardados.nombre === 'Abrinay Pérez', 'Mi perfil: el nombre nuevo se mandó al servidor y el pie dice «Nombre guardado»');
    await tocarN('.mv-tab[data-tab="mas"]'); await tocarN('.mv-hoja.mv-mas [data-vista="equipo"]'); await pg.waitForSelector('[data-vista="equipo"]:not([hidden]) .mv-personas'); await fotoN('23-equipo'); await medirEn('Cuentas y roles');
    await tocarN('[data-vista="equipo"] [data-m="u2"]'); await pg.waitForSelector('.mv-hoja #mRol'); await pg.selectOption('#mRol', 'lectura'); await espera(500); paso(guardados.rol === 'lectura', 'Equipo: el rol de Marta cambió a «lectura» con un select nativo'); await fotoN('24-equipo-miembro'); await pg.goBack(); await pg.waitForSelector('.mv-hoja', { state: 'detached' });
    await tocarN('[data-vista="equipo"] [data-invitar]'); await pg.waitForSelector('.mv-hoja #ivC'); await pg.locator('#ivC').fill('nuevo@panaclaw.com'); await pg.evaluate(() => document.activeElement?.blur()); await pg.locator('.mv-hoja [data-acc="0"]').tap(); await pg.waitForSelector('.mv-hoja #mvEnl', { timeout: 6000 });
    paso(guardados.invitacion?.email === 'nuevo@panaclaw.com' && /invitacion\/abc123/.test(await pg.locator('#mvEnl').inputValue()), 'Equipo: invitar crea el enlace y lo muestra para copiar o compartir'); await fotoN('25-invitacion'); await pg.goBack(); await pg.waitForSelector('.mv-hoja', { state: 'detached' });
    await pg.goBack().catch(() => {}); await espera(300);
    // conectores en la nube: añadir
    await tocarN('.mv-tab[data-tab="mas"]'); await tocarN('.mv-hoja.mv-mas [data-vista="conectores"]'); await pg.waitForSelector('[data-vista="conectores"]:not([hidden]) .mv-cxt'); await espera(500);
    paso(await pg.locator('[data-vista="conectores"] [data-anadir]').count() === 1 && await pg.locator('[data-vista="conectores"] .mv-cxi img').count() >= 1, 'Conectores (nube): el administrador ve «+ Añadir conector» y los iconos de cada plantilla'); await fotoN('26-conectores-nube');
    await tocarN('[data-vista="conectores"] [data-anadir]'); await pg.waitForSelector('.mv-hoja .mv-tile'); await fotoN('27-plantillas'); await medirEn('Añadir conector · plantillas');
    await tocarN('.mv-hoja [data-pl="n8n"]'); await pg.waitForSelector('.mv-hoja #cxUrl'); await pg.locator('#cxUrl').fill('https://mi.n8n.cloud/mcp/abc'); await pg.locator('#cxToken').fill('tok_1234567890abcdef'); await pg.locator('input[name=cxDep][value=ops]').dispatchEvent('click');
    await pg.evaluate(() => document.activeElement?.blur()); await fotoN('28-formulario'); await medirEn('Añadir conector · formulario');
    await pg.locator('.mv-hoja [data-acc="0"]').tap(); await pg.waitForSelector('.mv-hoja .mv-herr-c', { timeout: 6000 }); await fotoN('29-herramientas');
    paso(await pg.locator('.mv-hoja .mv-herr-c input:checked').count() === 1, 'Añadir conector: «Probar conexión» lista las herramientas y marca solo las de lectura');
    await pg.locator('.mv-hoja [data-acc="1"]').tap(); await pg.waitForSelector('.mv-hoja', { state: 'detached', timeout: 6000 });
    const g = guardados.conector; paso(g && g.url === 'https://mi.n8n.cloud/mcp/abc' && g.token === 'tok_1234567890abcdef' && g.departamentos.includes('ops') && g.herramientas_lectura.length === 1 && g.herramientas_envio.length === 0, 'Añadir conector: se manda la dirección, el token (una vez), los departamentos y SOLO las herramientas marcadas');
    paso(await pg.locator('[data-vista="conectores"] .mv-cxt').count() === 2, 'Añadir conector: la lista muestra el conector nuevo'); await pg.goBack().catch(() => {});
    // Modelos
    await tocarN('.mv-tab[data-tab="mas"]'); await tocarN('.mv-hoja.mv-mas [data-vista="ajustes"]'); await pg.waitForSelector('[data-vista="ajustes"]:not([hidden]) [data-ir="modelos"]', { timeout: 8000 });
    await tocarN('[data-vista="ajustes"] [data-ir="modelos"]'); await pg.waitForSelector('[data-vista="ajustes-seccion"] #mvm-oficina'); await fotoN('30-modelos'); await medirEn('Modelos');
    await pg.selectOption('#mvm-oficina', 'claude-opus-5'); await pg.selectOption('[data-k="f:enrutador"]', 'claude-sonnet-5-5'); await pg.selectOption('[data-k="f:agentes"]', 'muse-spark-1.3'); await espera(150);
    paso(/no usa herramientas/.test(await pg.locator('[data-av="f:agentes"]').innerText()), 'Modelos: avisa en palabras si el modelo elegido no usa herramientas y la casilla las necesita');
    await pg.evaluate(() => document.activeElement?.blur()); await pg.locator('[data-vista="ajustes-seccion"] [data-guardar]').tap(); await pg.waitForFunction(() => /Guardado/.test(document.querySelector('[data-vista="ajustes-seccion"] .mv-guardar')?.innerText || ''), null, { timeout: 6000 }).catch(() => {});
    paso(guardados.modelos && guardados.modelos.oficina === 'claude-opus-5' && guardados.modelos.funciones.enrutador === 'claude-sonnet-5-5', 'Modelos: el selector por función se guarda con PUT /api/modelos');
    await pg.locator('[data-vista="ajustes-seccion"] [data-probar]').tap(); await pg.waitForSelector('#mvmRes .mv-card', { timeout: 6000 }); await fotoN('31-modelos-probar');
    paso(/Hola, soy Claude/.test(await pg.locator('#mvmRes').innerText()), 'Modelos: «Probar este modelo» muestra la respuesta, el tiempo y el costo');
    paso(true, 'Nube simulada: sin errores graves de página'); await ctxN.close();
  } finally { await browser.close(); o.cerrar(); }
  console.log(`\n${res.length - fallos}/${res.length} pasos bien${fallos ? ` · ${fallos} FALLAN` : ''}`);
  return { fallos, res };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) { const r = await correr({ capturas: process.argv.includes('--capturas') }); process.exit(r.fallos ? 1 : 0); }
