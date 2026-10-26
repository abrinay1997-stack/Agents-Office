// «Preparar desde mi web» en la oficina LOCAL (serve.mjs). La misma lógica que la nube (arranque-web.mjs lee la web con protección SSRF; arranque-core.mjs compara y decide), con archivos:
//   data/arranque-propuesta.json   la propuesta que el dueño revisa (nada se escribe en el Cerebro hasta que decide)
//   data/arranque-aplicadas.json   lo último que se aplicó, para poder deshacerlo (las notas reemplazadas quedan como <nota>.md.backup-<hora> junto a la original)
//   data/cifras-porconfirmar.json  las cifras que la web sugiere o que chocan con lo que ya tienes: los agentes NO las leen hasta que las confirmes
import fs from 'node:fs';
import path from 'node:path';
import { pickJSON } from './sub-core.mjs';
import { injectionIn } from './safety.mjs';
import { leerWeb, textoParaModelo, urlSegura } from './arranque-web.mjs';
import { sistemaArranque, pedidoArranque, armarPropuesta, planDeAplicar, GRUPO } from './arranque-core.mjs';
import { readVault } from './graph-build.mjs';
import { renombrar } from './fs-seguro.mjs';

const MAX_POR_HORA = 6, EN_MARCHA_MS = 6 * 60 * 1000, GUARDADAS = 3;

/**
 * d: { brain, data, nombre, lider(dept) → agente, ask(system, user, opts) → { text }, notice(kind, text, opts), cifras() → [..], guardarCifras(items), guardarBrief(id, texto), alCambiarNotas() → Promise, fetchFn? }
 */
export function crearArranqueLocal(d) {
  const archivo = (n) => path.join(d.data, n);
  const leer = (n, def) => { try { return JSON.parse(fs.readFileSync(archivo(n), 'utf8')) ?? def; } catch { return def; } };
  const escribir = (n, v) => { fs.mkdirSync(d.data, { recursive: true }); const f = archivo(n); fs.writeFileSync(f + '.tmp', JSON.stringify(v, null, 2)); renombrar(f + '.tmp', f); };
  let corriendo = 0, ultimoError = null; const recientes = [];

  const notasActuales = () => {
    const { notes } = readVault(d.brain), out = [];
    for (const [nombre, n] of notes) { let mt = 0; try { mt = fs.statSync(n.path).mtimeMs; } catch { /* sin fecha */ } out.push({ nombre, grupo: n.group, texto: n.text, actualizado: mt, archivo: n.path }); }
    return out;
  };
  const lideres = () => { const o = {}; for (const dept of ['emails', 'sales', 'marketing', 'ops', 'fin', 'delivery']) { const L = d.lider(dept); if (L) o[dept] = { id: L.id, nombre: L.name, brief: L.brief || '' }; } return o; };

  /** ¿se puede empezar otra lectura? Una a la vez y como mucho MAX_POR_HORA por hora. */
  function turno(ahora = Date.now()) {
    while (recientes.length && ahora - recientes[0] > 3600e3) recientes.shift();
    if (corriendo && ahora - corriendo < EN_MARCHA_MS) return { ok: false, motivo: 'Ya estoy leyendo una web: espera a que termine (unos minutos).' };
    if (recientes.length >= MAX_POR_HORA) return { ok: false, motivo: `Ya leí ${MAX_POR_HORA} veces en la última hora (cada lectura gasta una llamada al modelo): prueba más tarde.` };
    corriendo = ahora; ultimoError = null; recientes.push(ahora); return { ok: true };
  }
  const estado = (ahora = Date.now()) => ({ corriendo: !!corriendo && ahora - corriendo < EN_MARCHA_MS, error: ultimoError });
  const soltar = (error = null) => { corriendo = 0; ultimoError = error; };

  /** Lee la web (si hay) y lo que cuenta el dueño, pregunta al modelo y GUARDA la propuesta. No toca el Cerebro. */
  async function preparar({ url, about }) {
    try {
      d.notice('onboard', url ? `Leyendo ${url} y lo que me contaste para preparar la propuesta… tarda un momento. Todavía no cambio nada.` : 'Leyendo lo que me contaste para preparar la propuesta… Todavía no cambio nada.');
      let web = null; const avisos = [];
      if (url) {
        web = await leerWeb(url, { fetchFn: d.fetchFn || ((...a) => fetch(...a)) });
        if (!web.ok) { if (!about) { soltar(web.motivo); d.notice('onboard', web.motivo, { level: 'error' }); return { error: web.motivo }; } avisos.push({ nivel: 'medio', texto: `${web.motivo} Usé solo lo que me contaste.` }); web = null; }
      }
      const lead = d.lider('ops');
      const { text } = await d.ask(sistemaArranque(d.nombre), pedidoArranque(url, about, web ? textoParaModelo(web.paginas) : ''), { maxTokens: 6000, timeout: 600000, model: 'sonnet', agent: lead, runMode: 'piece', kind: 'arranque', tools: false });
      const j = pickJSON(text).j || {};
      const pend = porConfirmar();
      const propuesta = armarPropuesta({ j, url, about, web, notasActuales: notasActuales(), lideres: lideres(), cifrasActuales: d.cifras(), porConfirmar: pend });
      propuesta.avisos.unshift(...avisos);
      const orden = injectionIn(JSON.stringify(j));
      if (orden) propuesta.avisos.unshift({ nivel: 'alto', texto: `Lo que salió trae órdenes escondidas para un asistente (${orden}). Revísalo con cuidado y no apliques lo que no reconozcas.` });
      if (!propuesta.notas.length) { soltar('sin notas'); d.notice('onboard', 'No saqué nada que proponer: la web casi no tenía texto o lo que contaste era muy poco. Cuéntame más en «Lo que la web no dice».', { level: 'warn' }); return { error: 'sin notas' }; }
      escribir('arranque-propuesta.json', propuesta); soltar();
      const r = propuesta.resumen;
      d.notice('onboard', `Listo: leí ${web ? web.paginas.length + ' página(s) de tu web' : 'lo que me contaste'} y preparé ${r.notas} nota(s) (${r.nuevas} nuevas, ${r.distintas} distintas de las que ya tienes${r.conflictos ? `, ${r.conflictos} dato(s) en conflicto con tu Cerebro` : ''}). No cambié nada: revísalas en Ajustes → Preparar desde mi web → «Revisar lo que leí».`, { level: r.conflictos ? 'warn' : 'info' });
      return { propuesta };
    } catch (e) { soltar(String(e.message || e).slice(0, 200)); d.notice('onboard', 'No pude preparar la propuesta: ' + String(e.message || e).slice(0, 200), { level: 'error' }); return { error: String(e.message || e) }; }
  }
  const propuesta = () => leer('arranque-propuesta.json', null);

  /** Aplica lo que el dueño decidió. → { ok, escritas, respaldadas, porConfirmar, briefs, saltadas } o { error, status } */
  async function aplicar({ id, decisiones = {}, ahora = Date.now() }) {
    const prop = propuesta();
    if (!prop || (id && prop.id !== id)) return { error: 'Esa propuesta ya no está: vuelve a leer la web.', status: 404 };
    if (prop.estado === 'aplicada') return { error: 'Esa propuesta ya se aplicó. Si te equivocaste, usa «Deshacer».', status: 409 };
    if (prop.estado === 'descartada') return { error: 'Esa propuesta se descartó.', status: 409 };
    const actuales = notasActuales(), plan = planDeAplicar(prop, decisiones, { notasActuales: actuales, lideres: lideres(), ahora });
    const reg = { id: prop.id, at: ahora, escritas: [], briefs: [], porConfirmar: [] };
    const dirEmpresa = path.join(d.brain, GRUPO);
    const respaldoDe = new Map(plan.respaldar.map((r) => [r.nombre, r]));
    for (const n of plan.escribir) {
      const previa = actuales.find((x) => x.nombre === n.nombre);
      const f = previa?.archivo || path.join(dirEmpresa, `${n.nombre}.md`);
      let backup = null;
      if (previa && respaldoDe.has(n.nombre)) { backup = `${f}.backup-${ahora}`; fs.copyFileSync(f, backup); }
      fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', n.texto); renombrar(f + '.tmp', f);
      reg.escritas.push({ nombre: n.nombre, archivo: f, backup, nueva: !previa });
    }
    let briefs = 0; for (const b of plan.briefs) { d.guardarBrief(b.id, b.texto); reg.briefs.push(b.id); briefs++; }
    const pend = [...plan.porConfirmar, ...plan.cifras];
    if (pend.length) { const cur = porConfirmar(); for (const c of pend) { const i = cur.findIndex((x) => x.name.toLowerCase() === c.name.toLowerCase()); if (i >= 0) cur[i] = { ...c, note: c.note || 'desde la web: confírmalo' }; else cur.push({ ...c, note: c.note || 'desde la web: confírmalo' }); reg.porConfirmar.push(c.name); } escribir('cifras-porconfirmar.json', { items: cur.slice(0, 200) }); }
    const lista = [reg, ...leer('arranque-aplicadas.json', { lista: [] }).lista].slice(0, GUARDADAS); escribir('arranque-aplicadas.json', { lista });
    escribir('arranque-propuesta.json', { ...prop, estado: 'aplicada', aplicada: { at: ahora, escritas: reg.escritas.map((e) => e.nombre), saltadas: plan.saltadas } });
    if (plan.escribir.length) await d.alCambiarNotas();
    d.notice('onboard', `Apliqué lo que decidiste: ${plan.escribir.length} nota(s) escritas${plan.respaldar.length ? ` (${plan.respaldar.length} anterior(es) quedaron respaldadas junto a su archivo)` : ''}, ${briefs} jefe(s) con instrucciones nuevas y ${pend.length} cifra(s) esperando tu confirmación. Puedes deshacerlo.`);
    return { ok: true, escritas: reg.escritas.map((e) => e.nombre), respaldadas: plan.respaldar.length, porConfirmar: pend.length, briefs, saltadas: plan.saltadas };
  }

  /** Deshace la última aplicación: las notas nuevas se quitan, las reemplazadas vuelven de su respaldo. */
  async function deshacer({ id }) {
    const reg0 = leer('arranque-aplicadas.json', { lista: [] }), reg = reg0.lista.find((r) => r.id === id) || (!id ? reg0.lista[0] : null);
    if (!reg) return { error: 'No hay nada que deshacer.', status: 404 };
    if (reg.deshecha) return { error: 'Eso ya se deshizo.', status: 409 };
    let vueltas = 0, quitadas = 0;
    for (const e of reg.escritas) {
      if (e.backup && fs.existsSync(e.backup)) { fs.copyFileSync(e.backup, e.archivo); vueltas++; }
      else if (e.nueva) { try { fs.unlinkSync(e.archivo); quitadas++; } catch { /* ya no estaba */ } }
    }
    escribir('arranque-aplicadas.json', { lista: reg0.lista.map((r) => (r.id === reg.id ? { ...r, deshecha: Date.now() } : r)) });
    const prop = propuesta(); if (prop && prop.id === reg.id) escribir('arranque-propuesta.json', { ...prop, estado: 'lista', aplicada: null });
    await d.alCambiarNotas();
    return { ok: true, restauradas: vueltas, quitadas };
  }

  function descartar({ id }) {
    const prop = propuesta(); if (!prop || (id && prop.id !== id)) return { error: 'Esa propuesta ya no está.', status: 404 };
    if (prop.estado === 'aplicada') return { error: 'Esa propuesta ya se aplicó.', status: 409 };
    escribir('arranque-propuesta.json', { ...prop, estado: 'descartada' }); return { ok: true };
  }

  /* ---------- cifras por confirmar ---------- */
  function porConfirmar() { const v = leer('cifras-porconfirmar.json', { items: [] }); return Array.isArray(v.items) ? v.items : []; }
  /** Confirma (pasa a las cifras de la empresa) o descarta, por nombre. → { confirmadas } o { descartadas } */
  function resolver(nombres, confirmar) {
    const quiero = new Set((Array.isArray(nombres) ? nombres : []).map((n) => String(n).toLowerCase()));
    const cur = porConfirmar(), tomadas = cur.filter((c) => quiero.has(c.name.toLowerCase()));
    escribir('cifras-porconfirmar.json', { items: cur.filter((c) => !quiero.has(c.name.toLowerCase())) });
    if (confirmar && tomadas.length) { const todas = d.cifras(); for (const c of tomadas) { const sin = { ...c, note: '' }; const i = todas.findIndex((x) => x.name.toLowerCase() === c.name.toLowerCase()); if (i >= 0) todas[i] = sin; else todas.push(sin); } d.guardarCifras(todas); }
    return confirmar ? { confirmadas: tomadas.length } : { descartadas: tomadas.length };
  }

  return { turno, estado, preparar, propuesta, aplicar, deshacer, descartar, porConfirmar, resolver, urlSegura };
}
