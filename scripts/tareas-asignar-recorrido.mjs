// Recorrido de navegador (26 oct 2026): ASIGNAR una tarea a otra persona del equipo (cuenta de la plataforma o Ajustes → Equipo), en el teléfono y en la
// computadora, y «Mías» por cuenta. Oficina temporal con dos personas en Ajustes → Equipo (Ana y Beto) y, para simular una cuenta de la nube, un
// window.AO_NUBE que dice quién eres (lo que pone cloudflare/public/nube.js). Con las cuentas de verdad: cloudflare/tests/tareas-asignar.test.mjs.
//   node scripts/tareas-asignar-recorrido.mjs [--capturas]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { oficina } from './movil-recorrido.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'docs', 'capturas-movil', 'despues');
const espera = ms => new Promise(r => setTimeout(r, ms));

export async function correr({ capturas = false } = {}) {
  const res = []; let fallos = 0;
  const paso = (ok, que) => { if (!ok) fallos++; res.push({ ok: !!ok, que }); console.log(`${ok ? '✓' : '✗'} ${que}`); };
  const o = await oficina();
  let browser; try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
  try {
    await o.api('/api/settings', 'POST', { changes: { 'team.people': [{ name: 'Ana', depts: [], telegram: '' }, { name: 'Beto', depts: [], telegram: '' }] } });
    const tareas = async () => (await o.api('/api/tasks')).filter?.(t => !t.archived) || [];
    const esperarTarea = async re => { for (let i = 0; i < 40; i++) { const t = (await tareas()).find(x => re.test(x.title)); if (t) return t; await espera(150); } return null; }; // el servidor la tiene en menos de 6 s

    // ================= TELÉFONO =================
    const errores = [];
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }), m = await mctx.newPage();
    m.on('pageerror', e => errores.push('pageerror: ' + e.message)); m.on('console', x => { if (x.type() === 'error' && !/Failed to load resource|favicon/i.test(x.text())) errores.push(x.text()); });
    await m.goto(o.base); await m.waitForSelector('#mvRoot .mv-tabs'); await m.waitForSelector('[data-vista="inicio"] .mv-card', { timeout: 15000 }); await espera(400);
    const foto = async (pg, n) => { if (!capturas) return; fs.mkdirSync(OUT, { recursive: true }); await pg.screenshot({ path: path.join(OUT, 'asignar-' + n + '.jpg'), type: 'jpeg', quality: 50 }); };
    await m.locator('.mv-tab[data-tab="tareas"]').tap(); await m.waitForSelector('[data-vista="tareas"] [data-para]'); await espera(500);
    const para = m.locator('[data-vista="tareas"] [data-para]');
    paso(/Para mí/.test(await para.innerText()), 'Teléfono: el campo de añadir dice «Para mí» y deja cambiarlo');
    const caja = await para.boundingBox(); paso(caja.height >= 44 && caja.width >= 44, `Teléfono: el botón «Para…» mide ${Math.round(caja.width)}×${Math.round(caja.height)} (≥ 44 px)`); await foto(m, 'movil-campo');
    await para.tap(); await m.waitForSelector('.mv-hoja [data-v]'); await espera(300); await foto(m, 'movil-hoja');
    const opciones = await m.locator('.mv-hoja [data-v]').allInnerTexts();
    paso(opciones.some(t => /Ana/.test(t)) && opciones.some(t => /Beto/.test(t)) && opciones.some(t => /Para mí/.test(t)) && opciones.some(t => /Marketing/.test(t)), `Teléfono: la hoja ofrece Para mí, las personas del equipo (Ana, Beto) y un agente de cada departamento (${opciones.length} opciones)`);
    for (const t of await m.locator('.mv-hoja [data-v]').all()) { const b = await t.boundingBox(); if (b.height < 43.5) { paso(false, 'Teléfono: una opción de la hoja mide ' + b.height); break; } }
    await m.locator('.mv-hoja [data-v="p:Ana"]').tap(); await m.waitForSelector('.mv-hoja', { state: 'detached', timeout: 4000 }).catch(() => {}); await espera(400);
    paso(/Ana/.test(await para.innerText()), 'Teléfono: el botón pasa a decir «Ana»'); await foto(m, 'movil-ana');
    await m.fill('#mvNueva', 'Revisar las fotos del catálogo para el viernes'); await m.locator('.mv-enviar').tap(); await espera(1200);
    const alt = await esperarTarea(/Revisar las fotos/);
    paso(alt && alt.person === 'Ana' && alt.delegada?.a === 'persona:Ana', `Teléfono: la tarea quedó asignada a Ana (person=${alt?.person}, delegada=${alt?.delegada?.a})`);
    paso(/Asignada a Ana/.test(await m.locator('.mv-toast').innerText().catch(() => '')), 'Teléfono: el aviso dice «Asignada a Ana»');
    // un agente desde el mismo campo
    await para.tap(); await m.waitForSelector('.mv-hoja [data-v="sales"]'); await m.locator('.mv-hoja [data-v="sales"]').tap(); await espera(500);
    paso(/Ventas/.test(await para.innerText()), 'Teléfono: también se puede elegir un departamento (un agente)');
    await m.fill('#mvNueva', 'Preparar la propuesta de Acme'); await m.locator('.mv-enviar').tap(); await espera(1500);
    const t2 = await esperarTarea(/propuesta de Acme/); paso(t2 && t2.dept === 'sales' && t2.agent && !t2.person, `Teléfono: a un departamento nace una tarea de un agente (${t2?.agent})`);
    await para.tap(); await m.waitForSelector('.mv-hoja [data-v="yo"]'); await m.locator('.mv-hoja [data-v="yo"]').tap(); await espera(500);
    await m.fill('#mvNueva', 'Llamar al contador'); await m.locator('.mv-enviar').tap(); await espera(1200);
    const t3 = await esperarTarea(/^Llamar al contador$/); paso(t3 && t3.person === 'Tú' && !t3.delegada, 'Teléfono: «Para mí» sigue siendo una tarea mía');
    for (const w of [320, 360, 390, 430]) { await m.setViewportSize({ width: w, height: 800 }); await espera(250); const r = await m.evaluate(() => { const b = document.querySelector('[data-vista="tareas"] .mv-anadir-fila'); const bb = [...b.children].filter(e => e.offsetWidth).map(e => e.getBoundingClientRect()); return { ancho: document.documentElement.scrollWidth <= innerWidth + 1, dentro: bb.every(x => x.right <= innerWidth + 1 && x.left >= -1), campo: b.querySelector('input').getBoundingClientRect().width }; }); paso(r.ancho && r.dentro && r.campo >= 120, `${w} px · el campo de añadir con «Para…» cabe (el texto tiene ${Math.round(r.campo)} px)`); }
    await m.setViewportSize({ width: 390, height: 844 });
    paso(!errores.length, `Teléfono: sin errores de JavaScript${errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''}`);
    await mctx.close();

    // ================= COMPUTADORA =================
    const dctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }), d = await dctx.newPage(); const erroresD = [];
    d.on('pageerror', e => erroresD.push('pageerror: ' + e.message)); d.on('console', x => { if (x.type() === 'error' && !/Failed to load resource|favicon/i.test(x.text())) erroresD.push(x.text()); });
    await d.goto(o.base); await d.waitForSelector('canvas, #hud, .tb-ic', { timeout: 20000 }); await espera(1500);
    await d.keyboard.press('h'); await d.waitForSelector('.tv .tv-rapida', { state: 'visible', timeout: 10000 }); await espera(800);
    const sel = d.locator('[data-rdept]');
    const grupos = await sel.evaluate(s => [...s.querySelectorAll('optgroup')].map(g => g.label + ':' + [...g.querySelectorAll('option')].map(o => o.textContent).join(',')));
    paso(grupos.some(g => /^Personas del equipo:.*Ana.*Beto/.test(g)) && grupos.some(g => /^Un agente de…/.test(g)), `Escritorio: «Quién la hace» ofrece Para mí, Personas del equipo y Un agente de… (${grupos.join(' | ').slice(0, 120)})`);
    await sel.selectOption('p:Beto'); await d.fill('[data-rin]', 'Cuadrar la caja de octubre !alta'); await d.keyboard.press('Enter'); await espera(1500);
    const b1 = await esperarTarea(/Cuadrar la caja/); paso(b1 && b1.person === 'Beto' && b1.prioridad === 'alta', `Escritorio: asignada a Beto con su prioridad (person=${b1?.person}, prioridad=${b1?.prioridad})`);
    await d.locator('[data-tab="mias"]').click(); await espera(600); await d.locator('[data-mlista="delegadas"]').click(); await espera(500);
    paso(/Cuadrar la caja/.test(await d.locator('.tv-mmain').innerText()), 'Escritorio: la sigo en Mías → Delegadas'); await foto(d, 'escritorio-delegadas');
    // el detalle de una tarea mía: delegar a una persona
    await d.locator('[data-mlista="todas"]').click(); await espera(400); await d.locator('.tv-mmain [data-abrir]').first().click(); await d.waitForSelector('.tv-det [data-acc="delegar"]'); await d.locator('.tv-det [data-acc="delegar"]').click();
    const personas = await d.locator('.tv-det [data-dg="a"][value="persona"]').count(); paso(personas === 1, 'Escritorio: «Delegar…» ofrece «Una persona del equipo»');
    await d.locator('.tv-det [data-dg="a"][value="persona"]').check(); const opts = await d.locator('.tv-det [data-dg="persona"] option').allInnerTexts(); paso(opts.includes('Ana') && opts.includes('Beto'), `Escritorio: y lista a ${opts.join(', ')}`);
    // simular una cuenta de la nube: soy Ana (editora) → mis Mías son las de Ana
    await d.keyboard.press('Escape');
    await d.evaluate(() => { window.AO_NUBE = { yo: () => ({ nombre: 'Ana', rol: 'editor' }) }; dispatchEvent(new Event('ao:yo')); }); await espera(1200);
    await d.locator('[data-tab="mias"]').click(); await espera(500); await d.locator('[data-mlista="todas"]').click(); await espera(500);
    const txt = await d.locator('.tv-mmain').innerText();
    paso(/Revisar las fotos del catálogo/.test(txt) && !/Llamar al contador/.test(txt), 'Escritorio (como Ana, editora): Mías muestra lo que le asignaron y no lo del dueño'); await foto(d, 'escritorio-como-ana');
    paso(!(await sel.evaluate(s => [...s.options].some(o => o.value === 'p:Ana'))) && await sel.evaluate(s => [...s.options].some(o => o.value === 'p:Beto')), 'Escritorio (como Ana): no se ofrece asignarle a sí misma, sí a Beto');
    await d.evaluate(() => { window.AO_NUBE = { yo: () => ({ nombre: 'Dueña', rol: 'admin' }) }; dispatchEvent(new Event('ao:yo')); }); await espera(1000);
    await d.locator('[data-mlista="todas"]').click(); await espera(500);
    const txtA = await d.locator('.tv-mmain').innerText(); paso(/Llamar al contador/.test(txtA) && !/Revisar las fotos del catálogo/.test(txtA), 'Escritorio (como administradora): ve lo del dueño y no lo que tiene Ana');
    paso(!erroresD.length, `Escritorio: sin errores de JavaScript${erroresD.length ? ': ' + erroresD.slice(0, 3).join(' | ') : ''}`);
    await dctx.close();
  } finally { await browser.close(); o.cerrar(); }
  console.log(`\n${fallos ? fallos + ' paso(s) fallaron' : 'todo en orden'} (${res.length} comprobaciones)`);
  return { fallos, res };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await correr({ capturas: process.argv.includes('--capturas') });
  process.exit(r.fallos ? 1 : 0);
}
