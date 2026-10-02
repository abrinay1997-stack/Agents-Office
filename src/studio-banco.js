// El BANCO DE PRESETS del Estudio (docs/propuesta-banco-presets.md §7 y §15; integración F1, 1 oct 2026).
// No es una vista ni un modal: es un paso del compositor (puertas, tu foto, referencias por ejes, la pila de chips, el canal, el
// escenario 3D y «Qué hará») y una hoja, aside.st-bank, que tapa la galería (el buscador y los grupos, o el escenario 3D).
// Las tres puertas son ATAJOS (§15.1): nada se borra al cambiar de una a otra y todo se combina; el modo se deduce de lo que
// pusiste (modoDe). El plan lo hace el mismo compilador puro del servidor (src/presets-core.js): en la oficina lo pide a
// /api/media/presets/compile (no gasta), en la demo lo compila aquí con la fábrica incrustada. Solo GENERAR gasta
// (/api/media/presets/apply) y el costo se ve antes, en el botón y en «Qué hará».
//   initBanco(ctx) → { el, sheet, activo(), generar(), toggle(), abrir(), cerrar(), abierto(), qaHTML(it), guardarDesde(it), refrescar(), setModels(l), costo(), replan(), estado(), barra(t) }
//
// Injerto (1 oct 2026, de lane/presets-banco2): la lógica pura vive en src/studio-banco-core.js (con tests) y aquí solo se dibuja.
// La hoja mide su propio ancho (@container bk): con sitio, la lista y, si el compositor está plegado, una columna «Mi receta ·
// Qué hará»; a 700 px o menos, tres pestañas (Elegir · Mi receta · Qué hará).
// Teclado: en las tarjetas, roving tabindex con ↑ ↓ Inicio Fin (↑ en la primera vuelve al buscador, ↓ en el buscador baja a la
// lista); Enter añade o quita; Espacio marca ★; «/» va al buscador; Esc por capas (el detalle de un chip, el formulario de
// guardar, lo escrito en el buscador y, al final, la hoja, que devuelve el foco a su botón).
import * as core from './presets-core.js';
import * as E3 from './escena3d-core.js';
import { initEscena3d } from './escena3d.js';
import { iconoSVG } from '../presets/iconos.mjs';
import { cargarFabricaDemo } from './presets-fabrica.js';
import * as K from './studio-banco-core.js';

// lo puro, con el mismo nombre de siempre (src/studio-lotes.js importa marca, anadir y usd de aquí)
export * from './studio-banco-core.js';

const arr = v => (Array.isArray(v) ? v : v == null ? [] : [v]);
const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const FAV = 'ao.studio.presets.fav', REC = 'ao.studio.presets.rec', EST = 'ao.studio.banco';
const TYPING = t => /^(INPUT|TEXTAREA|SELECT)$/.test(t?.tagName || '') || !!t?.isContentEditable;
let uid = 0;

export function initBanco(ctx) {
  const { esc, api, src, live, say, pick, subir, idea, n: cantidad, onState, abrirArchivo, mostrarGaleria } = ctx;
  const U = 'bk' + (++uid);
  let fab = ctx.fabrica || { presets: [], grupos: [], canales: [], iconos: {}, sinonimos: { frases: {} } };
  let presets = fab.presets.filter(p => arr(p.medios).includes('image')), info = new Map(), sharp = true, models = [];
  let byId = new Map(presets.map(p => [p.id, p]));
  const guardado = LS.get(EST, {});
  const st = { puerta: K.PUERTAS.some(p => p.id === guardado.puerta) ? guardado.puerta : 'foto', foto: null, refs: [], pila: Array.isArray(guardado.pila) ? guardado.pila.filter(x => x && typeof x.id === 'string') : [], /* se limpia al llegar los presets */ canal: guardado.canal || null, escena: guardado.escena ? E3.normalizar(guardado.escena) : null, modelo: null, idea: '', n: 1 };
  let plan = null, planSig = '', planT = null, planBusy = 0, deshacer = null, toastT = 0, q = '', grupoAbierto = null, editor = null, resultados = [], guardarPara = null;
  let chipAbierto = null, tab = 'elegir', rov = '', estrecho = false, favVista = [], recVista = []; // las secciones se arman con lo de al abrir: la lista no salta mientras eliges
  const fav = new Set(LS.get(FAV, [])), rec = LS.get(REC, []);
  const keep = () => LS.set(EST, { puerta: st.puerta, pila: st.pila, canal: st.canal, escena: st.escena });
  const ico = (p, tam = 20) => iconoSVG(p.icono, { tam, iconos: fab.iconos });

  /* el paso del compositor: lo que se redibuja (main), el aviso con DESHACER (fijo: es una región viva) y el input de archivos */
  const el = document.createElement('div'); el.className = 'st-step bk'; el.setAttribute('role', 'group'); el.setAttribute('aria-labelledby', U + 'T');
  const main = document.createElement('div'); main.className = 'bk-main';
  const toastC = document.createElement('div'); toastC.className = 'bk-toast'; toastC.setAttribute('role', 'status'); toastC.hidden = true;
  const file = document.createElement('input'); file.type = 'file'; file.accept = 'image/png,image/jpeg,image/webp'; file.hidden = true; let fileFor = null;
  el.append(main, toastC, file);
  /* la hoja sobre la galería */
  const sheet = document.createElement('aside'); sheet.className = 'st-bank'; sheet.hidden = true; sheet.setAttribute('role', 'region'); sheet.setAttribute('aria-label', 'Banco de presets');
  const $ = s => main.querySelector(s), $$ = s => sheet.querySelector(s);

  /** Redibuja una zona sin perder el foco (el mismo data-f) ni los <details data-d> abiertos. */
  function rehacer(box, html) {
    if (!box) return;
    const a = document.activeElement, k = a && box.contains(a) ? a.dataset.f : null;
    const abiertos = new Set([...box.querySelectorAll('details[data-d][open]')].map(d => d.dataset.d));
    box.innerHTML = html;
    for (const d of abiertos) { const x = box.querySelector(`details[data-d="${CSS.escape(d)}"]`); if (x) x.open = true; }
    if (k) box.querySelector(`[data-f="${CSS.escape(k)}"]`)?.focus({ preventScroll: true });
  }
  const foco = (box, f) => box?.querySelector(`[data-f="${CSS.escape(f)}"]`)?.focus({ preventScroll: true });

  const activo = () => st.pila.length > 0 || !!st.escena;
  const hojaBanco = () => !sheet.hidden && sheet.dataset.modo === 'banco';

  /* ---------- el aviso con DESHACER: abajo, en la hoja si está abierta (en el teléfono tapa el compositor) ---------- */
  function avisar(texto, antes = null) {
    clearTimeout(toastT);
    deshacer = antes ? { texto, antes } : null;
    pintarToast(texto);
    toastT = setTimeout(() => { deshacer = null; pintarToast(''); }, antes ? 8000 : 4000);
  }
  function pintarToast(texto) {
    const enHoja = hojaBanco() ? $$('.bk-toast') : null;
    for (const t of [toastC, $$('.bk-toast')]) {
      if (!t) continue;
      const aqui = texto && (enHoja ? t === enHoja : t === toastC);
      t.hidden = !aqui;
      t.innerHTML = aqui ? `<span>${esc(texto)}</span>${deshacer ? '<button type="button" data-deshacer data-f="deshacer">DESHACER</button>' : ''}` : '';
    }
  }
  const foto0 = () => ({ pila: st.pila.map(x => ({ ...x, params: { ...(x.params || {}) } })), foto: st.foto, refs: st.refs.map(r => ({ ...r, ejes: { ...r.ejes } })) });

  /* ---------- el paso del compositor ---------- */
  function chipsHTML(w) {
    const cs = K.chipsDe(st.pila, byId);
    if (!cs.length) return '';
    return `<ol class="bk-pila" aria-label="Presets elegidos, en el orden en que se eligieron">${cs.map(c => {
      const p = c.preset; if (!p) return '';
      const pid = `${U}-${w}-pop-${c.i}`, abierto = chipAbierto === c.id;
      const disc = c.receta ? `${c.pasos.length} ${c.pasos.length === 1 ? 'paso' : 'pasos'}` : 'Qué hace';
      return `<li class="bk-chip${c.fuera ? ' bk-fuera' : ''}${c.receta ? ' bk-rcp' : ''}"><span class="bk-ci">${ico(p, 16)}</span>
        <span class="bk-cn"><b>${esc(c.nombre)}</b><small>${esc(K.marca(p, { sharp, sirve: info.get(p.id) }))}</small>${c.fuera ? `<small class="bk-fz">No se hará: ${esc(c.aviso)}</small>` : ''}</span>
        <button type="button" class="bk-x" data-unpila="${c.i}" data-f="un-${w}-${esc(c.id)}" aria-label="Quitar ${esc(c.nombre)}">✕</button>
        <span class="bk-crow">${c.intensidad != null ? `<span class="bk-seg" role="group" aria-label="Intensidad de ${esc(c.nombre)}">${K.INTENSIDADES.map(([v, t]) => `<button type="button" data-int="${v}" data-pi="${c.i}" data-f="in-${w}-${esc(c.id)}-${v}" aria-pressed="${c.intensidad === v}">${t}</button>`).join('')}</span>` : ''}
          <button type="button" class="bk-disc" data-chip="${esc(c.id)}" data-f="dc-${w}-${esc(c.id)}" aria-expanded="${abierto}" aria-controls="${pid}">${disc} <span aria-hidden="true">${abierto ? '▴' : '▾'}</span></button></span>
        <div class="bk-pop" id="${pid}"${abierto ? '' : ' hidden'}>${c.tecnico ? `<p class="bk-tec">${esc(c.tecnico)}</p>` : ''}
          ${c.receta ? (c.pasos.length ? `<ol class="bk-pasos" aria-label="Lo que lleva dentro">${c.pasos.map(x => `<li>${esc(x.nombre)}</li>`).join('')}</ol>` : '<p>Sin pasos: otros presets le ganaron todo.</p>') : ''}
          ${p.frase ? `<p>${esc(p.frase)}</p>` : ''}${p.honestidad ? `<p class="bk-hon">${esc(p.honestidad)}</p>` : ''}</div></li>`;
    }).join('')}</ol>`;
  }
  function refsHTML() {
    return st.refs.map((r, i) => { const at = K.atajoDe(r.ejes), on = core.EJES_REF.filter(k => r.ejes[k] > 0);
      return `<div class="bk-ref"><img src="${esc(src(r.id))}" alt=""><div class="bk-refb"><div class="bk-refh"><b>Referencia ${i + 1}</b><button type="button" class="bk-x" data-unref="${i}" data-f="unref-${i}" aria-label="Quitar la referencia ${i + 1}">✕</button></div>
      <div class="bk-atajos" role="group" aria-label="Qué copiar de la referencia ${i + 1}">${K.ATAJOS_REF.map(a => `<button type="button" data-atajo="${a.id}" data-ri="${i}" data-f="at-${i}-${a.id}" aria-pressed="${at === a.id}">${a.es}</button>`).join('')}</div>
      <details class="bk-ejes" data-d="ejes-${i}"><summary data-f="ejs-${i}">Ejes: ${on.map(k => core.EJES_REF_ES[k].toLowerCase()).join(', ') || 'ninguno'}</summary>
      ${core.EJES_REF.map(k => { const inf = K.EJE_INFO[k], nota = k === 'producto' && !st.foto ? 'necesita tu foto' : inf.local ? 'aquí, sin IA' : 'la IA rehace la imagen';
        return `<div class="bk-eje"><button type="button" role="switch" aria-checked="${r.ejes[k] > 0}" data-eje="${k}" data-ri="${i}" data-f="ej-${i}-${k}" title="${esc(inf.ayuda)}">${esc(inf.es)} <small>${nota}</small></button>
        <span class="bk-seg" role="group" aria-label="Fuerza de ${esc(inf.es)}">${[1, 2, 3].map(v => `<button type="button" data-fz="${v}" data-eje="${k}" data-ri="${i}" data-f="fz-${i}-${k}-${v}" aria-pressed="${r.ejes[k] === v}"${r.ejes[k] > 0 ? '' : ' disabled'}>${K.INTENSIDADES[v - 1][1]}</button>`).join('')}</span></div>`; }).join('')}</details></div></div>`; }).join('');
  }
  function pintar() {
    const modo = K.modoDeEstado(st), propio = st.pila.length || st.escena, falta = K.faltaEnPuerta(st);
    const canales = fab.canales || [], cP = canales.filter(c => c.grupo === 'panama'), cO = canales.filter(c => c.grupo !== 'panama');
    const chips = chipsHTML('c');
    rehacer(main, `<div class="st-h" id="${U}T"><b>${iconoSVG('M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z', { tam: 14 })}</b> Presets <span class="st-hn">opcional · combínalos</span></div>
      <div class="bk-doors" role="group" aria-label="¿De dónde partes? (atajos: nada se borra al cambiar)">${K.PUERTAS.map(p => `<button type="button" data-puerta="${p.id}" data-f="door-${p.id}" aria-pressed="${st.puerta === p.id}" title="${esc(p.ayuda)}">${esc(p.es)}</button>`).join('')}</div>
      <p class="bk-modo" aria-live="polite">Ahora: <b>${K.MODO_ES[modo] || modo}</b>${st.escena ? ' · con escenario 3D' : ''}${falta ? ` · <span class="bk-falta">${esc(falta)}</span>` : ''}</p>
      <div class="bk-in">
        <div class="bk-slot"><span class="bk-lbl">Tu foto <small>se conserva</small></span>${st.foto ? `<span class="bk-th"><img src="${esc(src(st.foto))}" alt=""><button type="button" class="bk-x" data-unfoto data-f="unfoto" aria-label="Quitar tu foto">✕</button></span>` : `<button type="button" class="bk-add" data-subir="foto" data-f="sub-foto">Subir</button><button type="button" class="bk-add" data-galeria="foto" data-f="gal-foto">De la galería</button>`}</div>
        <div class="bk-slot bk-slotr"><span class="bk-lbl">Referencias <small>se imita, nunca se copia su producto</small></span>${refsHTML()}${st.refs.length < 3 ? `<span class="bk-addrow"><button type="button" class="bk-add" data-subir="ref" data-f="sub-ref">Subir</button><button type="button" class="bk-add" data-galeria="ref" data-f="gal-ref">De la galería</button></span>` : ''}</div>
      </div>
      <div class="bk-pilah"><span class="bk-lbl">Lo que se hará</span><button type="button" class="bk-open" data-f="open" aria-expanded="${hojaBanco()}" title="Abrir el banco de presets (B)">${iconoSVG('M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z', { tam: 16 })}<span>Banco · B</span></button></div>
      ${chips || '<p class="bk-vacio">Ningún preset todavía: ábrelo con «Banco» o escribe <kbd>/</kbd> al principio de la idea.</p>'}
      <div class="bk-canal"><span class="bk-lbl">Para dónde</span><div class="bk-chips" role="group" aria-label="Canal">${cP.map(c => `<button type="button" data-canal="${esc(c.id)}" data-f="canal-${esc(c.id)}" aria-pressed="${st.canal === c.id}" title="${esc(`${c.ancho}×${c.alto}${c.formato ? ' ' + c.formato : ''}`)}">${esc(c.nombre)}</button>`).join('')}
        <label class="bk-otras"><span class="e3d-vh">Otras tiendas</span><select data-otras data-f="otras" aria-label="Otras tiendas"><option value="">Otras tiendas…</option>${cO.map(c => `<option value="${esc(c.id)}"${st.canal === c.id ? ' selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></label>${st.canal ? '<button type="button" data-canal="" data-f="canal-" aria-label="Sin canal">Sin canal</button>' : ''}</div></div>
      <div class="bk-esc"><span class="bk-lbl">Escenario 3D <small>la cámara a una distancia, en cm o m</small></span>${st.escena ? `<p class="bk-escl">${esc(E3.describirEscena(st.escena, plan?.familia || 'conversacional').resumen || '')}</p>` : ''}
        <span class="bk-addrow"><button type="button" class="bk-add" data-escena="abrir" data-f="esc-abrir" aria-expanded="${!sheet.hidden && sheet.dataset.modo === 'escena'}">${st.escena ? 'Cambiar la escena' : 'Usar un escenario 3D'}</button>${st.escena ? '<button type="button" class="bk-add" data-escena="quitar" data-f="esc-quitar">Quitar la escena</button>' : ''}</span></div>
      ${propio ? queHaraHTML() : ''}
      ${guardarPara ? guardarHTML() : propio ? '<button type="button" class="bk-link" data-guardar="receta" data-f="g-receta">Guardar esta receta como preset…</button>' : ''}
      <div class="bk-res" aria-live="polite">${resultados.map(resHTML).join('')}</div>`);
    pintarLado();
    onState?.();
  }
  function queCuerpo() {
    if (!plan) return '<p class="bk-nota">Calculando…</p>';
    const c = plan, err = c.errores || [], av = (c.avisos || []).map(a => a.texto || String(a)).filter(Boolean), alt = c.alternativas || [];
    return `${err.length ? `<ul class="bk-err" role="alert">${err.map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
      ${(c.pasos_es || []).length ? `<ol class="bk-pasos">${c.pasos_es.map(p => `<li>${esc(p)}</li>`).join('')}</ol>` : ''}
      ${c.conserva_es ? `<p class="bk-cons"><b>No cambia:</b> ${esc(c.conserva_es)}</p>` : ''}
      ${c.porque ? `<p class="bk-por">${esc(c.porque)}</p>` : ''}
      ${alt.length ? `<label class="bk-alt">Otro modelo <select data-modelo data-f="modelo"><option value="">El recomendado</option>${alt.map(a => `<option value="${esc(a.id)}"${st.modelo === a.id ? ' selected' : ''}>${esc(a.nombre)}${a.porque ? ' · ' + esc(a.porque) : ''}</option>`).join('')}</select></label>` : ''}
      ${c.qa?.length ? `<p class="bk-qa0">Al terminar se comprueba: ${c.qa.map(esc).join(', ')}.</p>` : ''}
      ${av.length ? `<ul class="bk-av">${av.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
      ${c.prompt ? `<details class="bk-prompt" data-d="prompt"><summary data-f="prompt">Ver el prompt (inglés${c.prompt_es ? ', con traducción' : ''})</summary><pre lang="en">${esc(c.prompt)}</pre>${c.prompt_es ? `<p>${esc(c.prompt_es)}</p>` : ''}</details>` : ''}`;
  }
  const queResumen = () => (!plan ? 'calculando…' : `<b>${esc(plan.costo?.texto || '—')}</b>${plan.model ? ` · ${esc(models.find(m => m.id === plan.model)?.name || plan.model)}` : plan.soloLocal ? ' · en tu máquina' : ''}`);
  function queHaraHTML() {
    const err = plan?.errores?.length;
    return `<details class="bk-que" data-d="que"${!plan || err ? ' open' : ''}><summary data-f="que">Qué hará · ${queResumen()}</summary>${queCuerpo()}</details>`;
  }
  function guardarHTML() {
    const g = guardarPara;
    return `<form class="bk-guardar" data-form="guardar"><b>Guardar como preset</b><p>Queda como una nota del Cerebro (Estudio/Presets) y sale en el banco, en «De PanaClaw».</p>
      <label>Nombre <input name="nombre" maxlength="48" required value="${esc(g.nombre || '')}" autocomplete="off" data-f="g-nombre"></label>
      <label>Marca o campaña <small>opcional, se enlaza en el Cerebro</small><input name="marca" maxlength="60" autocomplete="off" data-f="g-marca"></label>
      <span class="bk-addrow"><button type="submit" class="bk-pri" data-f="g-ok">Guardar</button><button type="button" data-guardar="no" data-f="g-no">Cancelar</button></span><span class="bk-gmsg" role="status"></span></form>`;
  }
  function resHTML(r) {
    const j = r.job, it = r.item, qa = it?.qa, rs = K.qaResumen(qa);
    if (!it) return `<div class="bk-r"><b>${j.state === 'failed' ? 'No salió' : 'Haciéndose…'}</b> <span>${esc(j.state === 'failed' ? j.error || '' : j.engine === 'local' ? 'en tu máquina' : j.modelName || '')}</span></div>`;
    const antes = it.versionOf;
    return `<div class="bk-r"><div class="bk-rh"><b>Resultado</b>${rs ? `<span class="bk-q bk-q-${rs.estado}">${esc(rs.texto)}</span>` : ''}</div>
      ${antes ? `<div class="bk-ba" style="--bk-x:50%"><img src="${esc(src(antes))}" alt="Antes"><img class="bk-desp" src="${esc(src(it.file))}" alt="Después"><label class="bk-bal"><span class="e3d-vh">Antes y después</span><input type="range" min="0" max="100" value="50" data-ba aria-label="Antes y después: mueve para comparar"></label><span class="bk-bt bk-bt1">Antes</span><span class="bk-bt bk-bt2">Después</span></div>` : `<img class="bk-solo" src="${esc(src(it.file))}" alt="">`}
      ${qa ? `<ul class="bk-checks">${qa.checks.map(c => `<li class="${c.ok === true ? 'ok' : c.ok === false ? 'mal' : 'nm'}"><b>${c.ok === true ? '✓' : c.ok === false ? '⚠' : '·'}</b> ${esc(c.motivo || c.id)}</li>`).join('')}</ul>` : ''}
      ${(it.post?.avisos || []).length ? `<ul class="bk-av">${it.post.avisos.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
      <span class="bk-addrow"><button type="button" data-ver="${esc(it.file)}">Ver en grande</button><button type="button" data-guardar="${esc(it.file)}">Guardar como preset…</button></span></div>`;
  }

  /* el plan: el servidor (no gasta) o, en la demo, aquí mismo */
  function replan(now) {
    clearTimeout(planT);
    if (!activo()) { plan = null; planSig = ''; return Promise.resolve(null); }
    st.idea = idea?.() || ''; st.n = cantidad?.() || 1;
    const ped = K.pedidoDe(st), sig = JSON.stringify(ped);
    if (sig === planSig && plan) return Promise.resolve(plan);
    return new Promise(listo => { planT = setTimeout(async () => {
      const mine = ++planBusy;
      try {
        let c;
        if (live()) c = (await api('POST', '/api/media/presets/compile', ped)).plan;
        else c = core.compilar({ ...ped, byId: presets, models, familias: fab.familias, tipos: fab.tipos, canales: fab.canales, cifras: {}, capacidades: { local: true }, escena3d: E3, kind: 'image' });
        if (mine !== planBusy) return;
        plan = c; planSig = sig;
      } catch (e) { if (mine === planBusy) { plan = { errores: [e.message], avisos: [], pasos_es: [], costo: { texto: '—' } }; planSig = sig; } }
      if (editor && plan?.familia) editor.setFamilia(plan.familia);
      pintarQue(); listo(plan);
    }, now ? 0 : 220); });
  }
  function pintarQue() {
    const d = $('.bk-que');
    if (d) { rehacer(d, `<summary data-f="que">Qué hará · ${queResumen()}</summary>${queCuerpo()}`); if (plan?.errores?.length) d.open = true; } else pintar();
    const pq = $$('.bk-pq .bk-qb');
    if (pq) { rehacer(pq, activo() ? `<p class="bk-qr">Qué hará · ${queResumen()}</p>${queCuerpo()}` : '<p class="bk-nota">Elige un preset o un escenario 3D: aquí verás qué hará y cuánto cuesta, antes de gastar.</p>'); }
    pintarTabs();
    onState?.();
  }
  const cambio = () => { keep(); pintar(); replan(); };

  /* ---------- la hoja: el banco o el escenario ---------- */
  function cards(ids, sec) {
    return `<ul class="bk-cards" data-sec="${esc(sec)}">${ids.map(id => byId.get(id)).filter(Boolean).map(p => { const on = st.pila.some(x => x.id === p.id), s = info.get(p.id), k = `${sec}|${p.id}`, mid = `${U}-m-${sec}-${p.id}`.replace(/[^\w-]/g, '_');
      return `<li class="bk-cw"><button type="button" class="bk-card" data-pid="${esc(p.id)}" data-k="${esc(k)}" data-f="card-${esc(k)}" tabindex="-1" aria-pressed="${on}" aria-describedby="${mid}"><span class="bk-ci">${ico(p)}</span><span class="bk-cn"><b>${esc(p.nombre)}${p.capa === 'receta' ? ' <span class="bk-rc">receta</span>' : ''}</b>${p.tecnico ? `<small>${esc(p.tecnico)}</small>` : ''}<small class="bk-mk bk-mk-${K.tipoMarca(p, { sharp, sirve: s })}" id="${mid}">${esc(K.marca(p, { sharp, sirve: s }))}${p.estado === 'beta' ? ' · beta' : ''}</small></span></button><button type="button" class="bk-star" data-star="${esc(p.id)}" tabindex="-1" aria-pressed="${fav.has(p.id)}" aria-label="Favorito: ${esc(p.nombre)}" title="${fav.has(p.id) ? 'Quitar de favoritos' : 'Marcar favorito'} (Espacio)">${fav.has(p.id) ? '★' : '☆'}</button></li>`; }).join('')}</ul>`;
  }
  /** Una sola tarjeta de la lista entra con Tab (roving tabindex): la última que tuvo el foco, o la primera. */
  function rovingListo() {
    const cs = [...sheet.querySelectorAll('.bk-card')];
    const act = cs.find(c => c === document.activeElement) || cs.find(c => c.dataset.k === rov && visible(c)) || cs.find(visible);
    for (const c of cs) c.tabIndex = c === act ? 0 : -1;
  }
  const visible = c => !c.closest('details:not([open])');
  function pintarHoja() {
    if (sheet.hidden || sheet.dataset.modo !== 'banco') return;
    const modo = K.modoDeEstado(st), n = $$('.bk-n');
    let cuerpo;
    if (q.trim()) {
      const hits = core.buscar(q, presets, { favoritos: favVista, recientes: recVista, max: 40 }).filter(h => byId.has(h.id));
      cuerpo = hits.length ? `<h3 class="bk-sr">Resultados</h3>${cards(hits.map(h => h.id), 'r')}` : `<p class="bk-nada">Nada con «${esc(q)}». ${ctx.pedirDimitri ? '<button type="button" data-dimitri data-f="dimitri">Pedírselo a Dimitri</button>' : 'Prueba con otras palabras: «fondo blanco», «más luz», «como este anuncio».'}</p>`;
      if (n) n.textContent = K.cuantos(hits.length);
    } else {
      const secs = K.portada(presets, { fav: favVista, rec: recVista, puerta: st.puerta, foto: st.foto });
      const grupos = (fab.grupos || []).filter(g => g.medio === 'image' || g.id === 'mios');
      const pu = K.PUERTAS.find(d => d.id === st.puerta);
      cuerpo = secs.map(s => `<section class="bk-sec"><h3>${esc(s.titulo === 'Para empezar' ? `Para empezar · ${pu?.es || ''}` : s.titulo)}</h3>${cards(s.ids, s.titulo)}</section>`).join('') +
        `<section class="bk-sec"><h3>Todos los grupos</h3>${grupos.map(g => { const ids = presets.filter(p => (p.categoria || '') === g.id).map(p => p.id); if (!ids.length) return ''; const open = grupoAbierto === g.id;
          return `<details class="bk-g" data-g="${esc(g.id)}"${open ? ' open' : ''}><summary data-f="g-${esc(g.id)}">${iconoSVG(g.icono, { tam: 18, iconos: fab.iconos })}<span><b>${esc(g.nombre || g.es || g.id)}</b>${g.frase ? `<small>${esc(g.frase)}</small>` : ''}</span><i>${ids.length}</i></summary>${open ? cards(ids, 'g:' + g.id) : ''}</details>`; }).join('')}</section>`;
      if (n) n.textContent = `${presets.length} presets · ${K.MODO_ES[modo] || modo}`;
    }
    const a = document.activeElement, pid = a?.classList?.contains('bk-card') && sheet.contains(a) ? a.dataset.pid : null;
    rehacer($$('.bk-body'), cuerpo);
    if (pid && !sheet.contains(document.activeElement)) { const c = sheet.querySelector(`.bk-card[data-pid="${CSS.escape(pid)}"]`); if (c) { rov = c.dataset.k; c.focus({ preventScroll: true }); } } // la tarjeta cambió de sección: el foco la sigue
    const m = $$('.bk-shm'); if (m) m.textContent = K.MODO_ES[modo] || modo;
    rovingListo();
  }
  /** La columna (o las pestañas) «Mi receta · Qué hará» de la hoja: la misma pila del compositor, para cuando no se ve. */
  function pintarLado() {
    const pr = $$('.bk-pr .bk-pl'); if (!pr) return;
    rehacer(pr, chipsHTML('s') || '<p class="bk-vacio">Aún ninguno: elige en la lista con Enter o con un clic.</p>');
    pintarTabs();
  }
  function pintarTabs() {
    const r = $$('[data-tn="receta"]'); if (r) r.textContent = st.pila.length ? String(st.pila.length) : '';
    const qn = $$('[data-tn="que"]'); if (qn) qn.textContent = plan?.errores?.length ? '!' : '';
    if (qn) qn.title = plan?.errores?.length ? 'Hay algo que revisar antes de generar' : '';
  }
  function ponTab(k, enfocar) {
    tab = k; sheet.dataset.tab = k;
    for (const b of sheet.querySelectorAll('.bk-tabs [data-tab]')) { const s = b.dataset.tab === k; b.setAttribute('aria-selected', String(s)); b.tabIndex = s ? 0 : -1; if (s && enfocar) b.focus(); }
  }
  /** Con pestañas (estrecho) los roles son de pestañas; con columnas, cada parte es una región con su título. */
  function ponRoles() {
    const tl = $$('.bk-tabs'); if (!tl) return;
    sheet.dataset.estrecho = estrecho ? '1' : '';
    if (estrecho) tl.setAttribute('role', 'tablist'); else tl.removeAttribute('role');
    for (const b of tl.querySelectorAll('[data-tab]')) if (estrecho) b.setAttribute('role', 'tab'); else b.removeAttribute('role');
    for (const p of sheet.querySelectorAll('.bk-pane')) if (estrecho) p.setAttribute('role', 'tabpanel'); else p.setAttribute('role', 'region');
  }
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(([en]) => { const s = en.contentRect.width <= K.ESTRECHO; if (s !== estrecho) { estrecho = s; ponRoles(); } }) : null;
  ro?.observe(sheet);

  function abrir(modo = 'banco') {
    if (!sheet.parentNode) return;
    sheet.dataset.modo = modo; sheet.hidden = false; mostrarGaleria?.();
    if (modo === 'banco') {
      if (editor) { editor.destroy(); editor = null; }
      favVista = [...fav]; recVista = [...rec];
      sheet.innerHTML = `<div class="bk-sh"><b id="${U}-sh">Banco de presets</b><span class="bk-shm"></span><span class="sp"></span><button type="button" class="bk-x" data-cerrar aria-label="Cerrar el banco" title="Cerrar (Esc)">✕</button></div>
        <div class="bk-tabs" aria-label="Partes del banco">${K.PESTANAS.map(([k, t]) => `<button type="button" id="${U}-t-${k}" data-tab="${k}" aria-controls="${U}-p-${k}" aria-selected="${tab === k}"${tab === k ? '' : ' tabindex="-1"'}>${t}<span class="bk-tn" data-tn="${k}"></span></button>`).join('')}</div>
        <div class="bk-cols">
          <section class="bk-pane bk-pe" id="${U}-p-elegir" data-pane="elegir" aria-labelledby="${U}-t-elegir">
            <div class="bk-qw"><label class="bk-q"><span class="e3d-vh">Buscar un preset</span><input type="search" class="bk-qi" data-f="q" placeholder="Qué quieres: «se ve oscura», «fondo blanco», «como este anuncio»…" value="${esc(q)}" autocomplete="off" spellcheck="false" aria-describedby="${U}-qn"></label>
            <p class="bk-n" id="${U}-qn" aria-live="polite"></p></div><div class="bk-body"></div></section>
          <div class="bk-side">
            <section class="bk-pane bk-pr" id="${U}-p-receta" data-pane="receta" aria-labelledby="${U}-t-receta"><h3 class="bk-sr">Mi receta</h3><div class="bk-pl"></div></section>
            <section class="bk-pane bk-pq" id="${U}-p-que" data-pane="que" aria-labelledby="${U}-t-que"><h3 class="bk-sr">Qué hará</h3><div class="bk-qb"></div></section>
          </div>
        </div>
        <div class="bk-toast" role="status" hidden></div>`;
      sheet.dataset.tab = tab; ponRoles(); pintarHoja(); pintarLado(); pintarQue();
      setTimeout(() => { if (tab === 'elegir' || !estrecho) $$('.bk-qi')?.focus(); else $$(`.bk-tabs [data-tab="${tab}"]`)?.focus(); }, 30);
    } else {
      sheet.innerHTML = `<div class="bk-sh"><b>Escenario 3D</b><span class="sp"></span><button type="button" class="bk-pri" data-cerrar>Listo</button><button type="button" class="bk-x" data-cerrar aria-label="Cerrar el escenario" title="Cerrar (Esc)">✕</button></div>
        <p class="bk-ayuda">El producto se achica por la distancia de la cámara; el fondo no cambia y nada se recorta. La imagen gris de «Lo que ve la cámara» va al modelo como guía de composición.</p><div class="bk-e3d"></div>`;
      if (!st.escena) { st.escena = E3.normalizar({ ...E3.ESCENA_DEFECTO, cuadro: { proporcion: (fab.canales.find(c => c.id === st.canal)?.proporcion) || E3.ESCENA_DEFECTO.cuadro.proporcion } }); cambio(); }
      editor = initEscena3d($$('.bk-e3d'), { value: st.escena, familia: plan?.familia || 'conversacional', onChange: e => { st.escena = e; keep(); const l = $('.bk-escl'); if (l) l.textContent = E3.describirEscena(e, plan?.familia || 'conversacional').resumen || ''; else pintar(); replan(); } });
      setTimeout(() => sheet.querySelector('.e3d-canvas, button')?.focus(), 30);
    }
    pintar();
  }
  function cerrar(volver = true) {
    if (sheet.hidden) return;
    const modo = sheet.dataset.modo; sheet.hidden = true; if (editor) { editor.destroy(); editor = null; } sheet.innerHTML = '';
    pintar(); if (deshacer) pintarToast(deshacer.texto);
    if (volver) (modo === 'escena' ? $('[data-escena="abrir"]') : $('.bk-open'))?.focus({ preventScroll: true });
  }
  const toggle = () => (sheet.hidden || sheet.dataset.modo !== 'banco' ? abrir('banco') : cerrar());

  function usar(p) {
    const antes = foto0();
    if (p.propio) { // un preset propio: su receta entra entera (pila, canal, escena, ejes)
      st.pila = p.propio.pila.filter(x => byId.has(x.id)).map(x => ({ id: x.id, params: { ...(x.params || {}) } }));
      if (p.propio.canal) st.canal = p.propio.canal; if (p.propio.escena) st.escena = E3.normalizar(p.propio.escena);
      if (p.propio.ejes) st.refs = st.refs.map(r => ({ ...r, ejes: { ...p.propio.ejes } }));
      avisar(`«${p.nombre}»: su receta entró entera.`, antes);
    } else if (st.pila.some(x => x.id === p.id)) { st.pila = st.pila.filter(x => x.id !== p.id); if (chipAbierto === p.id) chipAbierto = null; avisar(`Quitado: «${p.nombre}»`, antes); }
    else {
      const r = K.anadir(st.pila, p, byId); st.pila = r.pila;
      if (st.canal && !K.exportaYa(st.pila, byId) && byId.has('sal-canal')) st.pila.push({ id: 'sal-canal', params: { canal: st.canal } });
      if (r.aviso) avisar(r.aviso.texto, antes); else avisar(`Añadido: «${p.nombre}»`);
    }
    const i = rec.indexOf(p.id); if (i >= 0) rec.splice(i, 1); rec.unshift(p.id); rec.length = Math.min(rec.length, 12); LS.set(REC, rec);
    cambio(); pintarHoja();
  }
  function quitarDePila(i) {
    const x = st.pila[i]; if (!x) return;
    const antes = foto0(); st.pila.splice(i, 1); if (chipAbierto === x.id) chipAbierto = null;
    avisar(`Quitado: «${byId.get(x.id)?.nombre || x.id}»`, antes); cambio(); pintarHoja();
  }
  function setCanal(id) {
    st.canal = id || null;
    st.pila = st.pila.map(x => (x.id === 'sal-canal' ? { ...x, params: { ...x.params, canal: st.canal } } : x)).filter(x => x.id !== 'sal-canal' || st.canal);
    if (st.canal && st.pila.length && !K.exportaYa(st.pila, byId) && byId.has('sal-canal')) st.pila.push({ id: 'sal-canal', params: { canal: st.canal } });
    if (st.escena && st.canal) { const pr = fab.canales.find(c => c.id === st.canal)?.proporcion; if (pr && E3.PROPORCIONES.includes(pr)) st.escena = E3.normalizar({ ...st.escena, cuadro: { proporcion: pr } }); if (editor) editor.set(st.escena); }
    cambio();
  }
  function tomar(rol, f) {
    if (/\.(mp4|webm|mp3|wav|flac|m4a|ogg)$/i.test(f)) return say?.('Ahí va una imagen.', true);
    if (rol === 'foto') { st.foto = f; if (st.puerta === 'cero') st.puerta = 'foto'; }
    else if (!st.refs.some(r => r.id === f) && st.refs.length < 3) st.refs.push({ id: f, ejes: { ...core.EJES_REF_DEF } });
    cambio();
  }
  /** GENERAR con presets: el único gasto, por /api/media/presets/apply (pasa por los topes del Estudio). */
  async function generar() {
    if (!live()) return say?.('En la demo solo se ve el plan: abre la oficina con el iniciador para generar.', true);
    await replan(true);
    if (plan?.errores?.length) { const d = $('.bk-que'); if (d) d.open = true; d?.querySelector('summary')?.focus(); return say?.(plan.errores[0], true); }
    const c = plan?.costo?.usd || 0;
    if (c >= 0.5 && !confirm(`Esto cuesta aprox. ${K.usd(c)}. ¿Generar?`)) return;
    try {
      const r = await api('POST', '/api/media/presets/apply', K.pedidoDe({ ...st, idea: idea?.() || '', n: cantidad?.() || 1 }));
      for (const j of r.jobs || []) { resultados.unshift({ job: j, item: null }); seguir(j.id); }
      resultados = resultados.slice(0, 3);
      say?.(r.plan?.soloLocal ? 'Haciéndose en tu máquina: gratis, en unos segundos.' : `En marcha con ${models.find(m => m.id === r.plan?.model)?.name || r.plan?.model}: sale en la galería y aquí abajo, con su comprobación.`);
      ctx.trabajos?.(r.jobs || [], r.budget); pintar();
    } catch (e) { say?.(e.message, true); }
  }
  async function seguir(id) {
    for (let i = 0; i < 40; i++) {
      let j; try { j = (await api('GET', `/api/media/jobs/${id}?wait=20000`)).job; } catch { return; }
      const r = resultados.find(x => x.job.id === id); if (!r) return; r.job = j;
      if (j.state === 'done' || j.state === 'failed') {
        if (j.items?.[0]) { try { r.item = await api('GET', '/api/media/item/' + encodeURIComponent(j.items[0])); } catch { r.item = { file: j.items[0] }; } }
        pintar(); ctx.recargar?.(); return;
      }
    }
  }
  async function guardar(form) {
    const fd = new FormData(form), nombreP = String(fd.get('nombre') || '').trim(), msg = form.querySelector('.bk-gmsg');
    if (!nombreP) { msg.textContent = 'Ponle un nombre.'; form.querySelector('input[name=nombre]').focus(); return; }
    if (!live()) { msg.textContent = 'En la demo no se guarda: abre la oficina.'; return; }
    try {
      const body = { nombre: nombreP, marca: String(fd.get('marca') || '').trim() || undefined, ...(guardarPara.desde ? { desde: guardarPara.desde } : { receta: { pila: st.pila, ejes: st.refs[0]?.ejes || null, escena: st.escena, canal: st.canal, modelo: st.modelo } }) };
      const r = await api('POST', '/api/media/presets', body);
      guardarPara = null; say?.(`Guardado: «${r.preset.nombre}» (v${r.preset.v}) en el Cerebro, ${r.archivo}. Ya sale en el banco, en «De PanaClaw».`);
      await refrescar(); pintar();
    } catch (e) { msg.textContent = e.message; }
  }

  /* ---------- lo que se toca: la pila y el aviso (en el compositor y en la hoja) ---------- */
  function accionComun(t, box) {
    if (t.hasAttribute('data-deshacer')) {
      if (!deshacer) return true;
      const a = deshacer.antes; st.pila = a.pila; st.foto = a.foto; st.refs = a.refs; deshacer = null; clearTimeout(toastT); pintarToast('');
      cambio(); pintarHoja(); say?.('Deshecho.');
      (box === sheet ? ($$('.bk-card[tabindex="0"]') || $$('.bk-qi')) : $('.bk-open'))?.focus({ preventScroll: true });
      return true;
    }
    if (t.dataset.unpila != null) {
      const i = +t.dataset.unpila, w = box === sheet ? 's' : 'c'; quitarDePila(i);
      const sig = st.pila[Math.min(i, st.pila.length - 1)];
      if (sig) foco(box === sheet ? $$('.bk-pr') : main, `un-${w}-${sig.id}`); else (box === sheet ? $$('.bk-qi') : $('.bk-open'))?.focus({ preventScroll: true });
      return true;
    }
    if (t.dataset.int) { st.pila = K.ponerIntensidad(st.pila, +t.dataset.pi, t.dataset.int); cambio(); return true; }
    if (t.dataset.chip) { chipAbierto = chipAbierto === t.dataset.chip ? null : t.dataset.chip; pintar(); return true; }
    return false;
  }
  /** Esc por capas dentro del banco (compositor u hoja): true si lo gastó. */
  function escape(e, enHoja) {
    const capa = K.capaEsc({ chip: !!chipAbierto && !!e.target.closest?.('.bk-pila'), guardar: !enHoja && !!guardarPara && !!e.target.closest?.('.bk-guardar'), enBuscador: e.target.matches?.('.bk-qi'), q, hoja: enHoja });
    if (!capa) return false;
    if (capa === 'chip') { const k = chipAbierto; chipAbierto = null; pintar(); foco(enHoja ? $$('.bk-pr') : main, `dc-${enHoja ? 's' : 'c'}-${k}`); }
    else if (capa === 'guardar') { guardarPara = null; pintar(); foco(main, 'g-receta'); }
    else if (capa === 'busqueda') { q = ''; e.target.value = ''; rov = ''; pintarHoja(); }
    else cerrar();
    return true;
  }

  /* eventos del paso */
  main.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (accionComun(t, el)) return;
    if (t.dataset.puerta) {
      const pu = t.dataset.puerta; st.puerta = pu; keep(); pintar();
      if (pu === 'foto' && !st.foto) pick('Elige tu foto', f => tomar('foto', f)); else if (pu === 'ref' && !st.refs.length) pick('Elige la referencia', f => tomar('ref', f)); else if (pu === 'cero') abrir('banco'); else pintarHoja();
      return;
    }
    if (t.dataset.subir) { fileFor = t.dataset.subir; file.click(); return; }
    if (t.dataset.galeria) { cerrar(false); const rol = t.dataset.galeria; pick(rol === 'foto' ? 'Elige tu foto' : 'Elige la referencia', f => tomar(rol, f)); return; }
    if (t.hasAttribute('data-unfoto')) { const antes = foto0(); st.foto = null; avisar('Quitaste tu foto', antes); cambio(); foco(main, 'gal-foto'); return; }
    if (t.dataset.unref != null) { const antes = foto0(), i = +t.dataset.unref; st.refs.splice(i, 1); avisar(`Quitaste la referencia ${i + 1}`, antes); cambio(); foco(main, st.refs.length ? `unref-${Math.min(i, st.refs.length - 1)}` : 'gal-ref'); return; }
    if (t.dataset.atajo) { st.refs = K.conAtajo(st.refs, +t.dataset.ri, t.dataset.atajo); cambio(); return; }
    if (t.getAttribute('role') === 'switch' && t.dataset.eje) { const r = st.refs[+t.dataset.ri]; if (r) { r.ejes[t.dataset.eje] = r.ejes[t.dataset.eje] > 0 ? 0 : 2; cambio(); } return; }
    if (t.dataset.fz) { const r = st.refs[+t.dataset.ri]; if (r) { r.ejes[t.dataset.eje] = +t.dataset.fz; cambio(); } return; }
    if (t.classList.contains('bk-open')) { toggle(); return; }
    if (t.dataset.canal != null) { setCanal(t.dataset.canal); if (!t.dataset.canal) foco(main, 'otras'); return; }
    if (t.dataset.escena === 'abrir') { abrir('escena'); return; }
    if (t.dataset.escena === 'quitar') { st.escena = null; cerrar(false); cambio(); foco(main, 'esc-abrir'); return; }
    if (t.dataset.guardar) { guardarPara = t.dataset.guardar === 'no' ? null : t.dataset.guardar === 'receta' ? { desde: null, nombre: '' } : { desde: t.dataset.guardar, nombre: '' }; pintar(); setTimeout(() => (guardarPara ? $('.bk-guardar input') : $('[data-guardar="receta"]'))?.focus(), 0); return; }
    if (t.dataset.ver) { abrirArchivo?.(t.dataset.ver); return; }
  });
  toastC.addEventListener('click', e => { const t = e.target.closest('button'); if (t) accionComun(t, el); });
  main.addEventListener('change', e => {
    if (e.target.matches('[data-otras]')) setCanal(e.target.value);
    if (e.target.matches('[data-modelo]')) { st.modelo = e.target.value || null; replan(true); }
  });
  main.addEventListener('input', e => { if (e.target.matches('[data-ba]')) e.target.closest('.bk-ba').style.setProperty('--bk-x', e.target.value + '%'); });
  main.addEventListener('submit', e => { if (e.target.matches('[data-form="guardar"]')) { e.preventDefault(); guardar(e.target); } });
  file.addEventListener('change', async () => { const fs = [...file.files]; file.value = ''; if (!fs.length) return; const items = await subir(fs); if (items[0]) tomar(fileFor === 'ref' ? 'ref' : 'foto', items[0].file); });
  el.addEventListener('keydown', e => {
    if (e.key === 'Escape' && escape(e, false)) { e.preventDefault(); e.stopPropagation(); return; } // si no, el Estudio: cierra la hoja o el Estudio
    if (e.key === '/' && !TYPING(e.target) && hojaBanco()) { e.preventDefault(); e.stopPropagation(); ponTab('elegir'); $$('.bk-qi')?.focus(); $$('.bk-qi')?.select(); }
  });

  /* eventos de la hoja */
  sheet.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.hasAttribute('data-cerrar')) { cerrar(); return; }
    if (accionComun(t, sheet)) return;
    if (t.dataset.tab) { ponTab(t.dataset.tab); return; }
    if (t.dataset.pid) { const p = byId.get(t.dataset.pid); if (p) { rov = t.dataset.k; usar(p); } return; }
    if (t.dataset.star) { const id = t.dataset.star; fav.has(id) ? fav.delete(id) : fav.add(id); LS.set(FAV, [...fav]); avisar(fav.has(id) ? `★ «${byId.get(id)?.nombre || id}» en Favoritos` : `«${byId.get(id)?.nombre || id}» ya no está en Favoritos`); pintarHoja(); return; }
    if (t.hasAttribute('data-dimitri')) { ctx.pedirDimitri?.(q); return; }
  });
  sheet.addEventListener('change', e => { if (e.target.matches('[data-modelo]')) { st.modelo = e.target.value || null; replan(true); } });
  sheet.addEventListener('toggle', e => { const d = e.target; if (d.matches?.('.bk-g')) { if (d.open) { grupoAbierto = d.dataset.g; sheet.querySelectorAll('.bk-g[open]').forEach(x => { if (x !== d) x.open = false; }); if (!d.querySelector('.bk-cards')) d.insertAdjacentHTML('beforeend', cards(presets.filter(p => p.categoria === d.dataset.g).map(p => p.id), 'g:' + d.dataset.g)); } else if (grupoAbierto === d.dataset.g) grupoAbierto = null; rovingListo(); } }, true);
  sheet.addEventListener('input', e => { if (e.target.matches('.bk-qi')) { q = e.target.value; rov = ''; pintarHoja(); } });
  sheet.addEventListener('focusin', e => { const c = e.target.closest?.('.bk-card'); if (c) { rov = c.dataset.k; rovingListo(); } });
  sheet.addEventListener('keydown', e => {
    const t = e.target;
    if (e.key === 'Escape') { if (t.closest?.('.e3d')) return; if (escape(e, true)) { e.preventDefault(); e.stopPropagation(); } return; }
    if (t.dataset?.tab && ['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) {
      const ks = K.PESTANAS.map(x => x[0]), i = ks.indexOf(t.dataset.tab);
      const k = e.key === 'Home' ? ks[0] : e.key === 'End' ? ks.at(-1) : ks[(i + (e.key === 'ArrowRight' ? 1 : ks.length - 1)) % ks.length];
      ponTab(k, true); e.preventDefault(); e.stopPropagation(); return;
    }
    if (t.classList?.contains('bk-card')) {
      if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); e.stopPropagation(); sheet.querySelector(`[data-star="${CSS.escape(t.dataset.pid)}"]`)?.click(); return; }
      const cs = [...sheet.querySelectorAll('.bk-card')].filter(visible), n = K.moverEnLista(e.key, cs.indexOf(t), cs.length);
      if (n === 'buscar') { e.preventDefault(); e.stopPropagation(); $$('.bk-qi')?.focus(); return; }
      if (n !== -1 && cs[n]) { e.preventDefault(); e.stopPropagation(); rov = cs[n].dataset.k; rovingListo(); cs[n].focus(); cs[n].scrollIntoView({ block: 'nearest' }); return; }
    }
    if (t.matches?.('.bk-qi') && e.key === 'ArrowDown') { const c = $$('.bk-card[tabindex="0"]') || $$('.bk-card'); if (c) { e.preventDefault(); e.stopPropagation(); c.focus(); } return; }
    if (e.key === '/' && !TYPING(t)) { e.preventDefault(); e.stopPropagation(); ponTab('elegir'); $$('.bk-qi')?.focus(); $$('.bk-qi')?.select(); }
  });
  sheet.addEventListener('keyup', e => { if (e.target.classList?.contains('bk-card') && (e.key === ' ' || e.key === 'Spacebar')) e.preventDefault(); }); // Espacio no «pulsa» la tarjeta

  async function refrescar() {
    if (!live()) { // la demo: la fábrica que build.mjs deja junto a la página
      const f = await cargarFabricaDemo().catch(() => null);
      if (f && f.presets) { fab = f; presets = f.presets.filter(p => arr(p.medios).includes('image')); byId = new Map(presets.map(p => [p.id, p])); st.pila = st.pila.filter(x => byId.has(x.id)); pintar(); pintarHoja(); replan(); }
      return;
    }
    try {
      const r = await api('GET', '/api/media/presets?medio=image');
      presets = r.presets || presets; byId = new Map(presets.map(p => [p.id, p])); sharp = r.sharp !== false;
      if (r.fabrica) fab = { ...fab, ...r.fabrica };
      st.pila = st.pila.filter(x => byId.has(x.id));
      info = new Map(presets.map(p => [p.id, { on: p.on, modelos: p.modelos, motivo: p.motivo }]));
      pintar(); pintarHoja();
    } catch {}
  }
  pintar(); replan();
  if (typeof location !== 'undefined' && location.protocol === 'file:') refrescar(); // la demo: la fábrica junto a la página
  return {
    el, sheet, activo, generar, toggle, abrir, cerrar, abierto: () => !sheet.hidden, refrescar,
    setModels(l) { models = Array.isArray(l) ? l : []; if (!live()) replan(); },
    replan: () => replan(),
    estado: () => ({ ...st, plan }),
    /** El texto del botón y de la línea de costo cuando manda el banco. */
    costo: () => (plan ? (plan.errores?.length ? 'revisa «Qué hará»' : plan.costo?.texto || '—') : 'calculando…'),
    /** Para la tarjeta de la galería: el resumen de la QA de un archivo que salió de un preset. */
    qaHTML(it) { const r = K.qaResumen(it?.qa); return r ? `<span class="bk-q bk-q-${r.estado}">${esc(r.texto)}</span>` : ''; },
    guardarDesde(it) { guardarPara = { desde: it.file, nombre: '' }; pintar(); setTimeout(() => $('.bk-guardar input')?.focus(), 0); },
    /** «/» al principio de la idea abre el banco (§7.1). */
    barra(texto) { if (/^\/\S*$/.test(texto)) { q = texto.slice(1); tab = 'elegir'; abrir('banco'); return true; } return false; },
  };
}
