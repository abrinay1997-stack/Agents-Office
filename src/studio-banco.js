// El BANCO DE PRESETS del Estudio (docs/propuesta-banco-presets.md §7 y §15; integración F1, 1 oct 2026).
// No es una vista ni un modal: es un paso del compositor (puertas, tu foto, referencias por ejes, la pila de chips, el canal, el
// escenario 3D y «Qué hará») y una hoja, aside.st-bank, que tapa la galería (el buscador y los grupos, o el escenario 3D).
// Las tres puertas son ATAJOS (§15.1): nada se borra al cambiar de una a otra y todo se combina; el modo se deduce de lo que
// pusiste (modoDe). El plan lo hace el mismo compilador puro del servidor (src/presets-core.js): en la oficina lo pide a
// /api/media/presets/compile (no gasta), en la demo lo compila aquí con la fábrica incrustada. Solo GENERAR gasta
// (/api/media/presets/apply) y el costo se ve antes, en el botón y en «Qué hará».
//   initBanco(ctx) → { el, sheet, activo(), generar(), toggle(), abrir(), cerrar(), abierto(), qaHTML(it), guardarDesde(it), refrescar(), setModels(l) }
import * as core from './presets-core.js';
import * as E3 from './escena3d-core.js';
import { initEscena3d } from './escena3d.js';
import { iconoSVG } from '../presets/iconos.mjs';
import { cargarFabricaDemo } from './presets-fabrica.js';

/* ---------- lo puro (con tests: tests/studio-banco.test.mjs) ---------- */
export const PUERTAS = [
  { id: 'cero', es: 'Desde cero', ayuda: 'Solo tu idea y los presets' },
  { id: 'foto', es: 'Mejorar mi foto', ayuda: 'Tu foto se conserva; cambia lo que elijas' },
  { id: 'ref', es: 'Copiar de una referencia', ayuda: 'Se imita su estilo, color o composición; nunca su producto' },
];
export const MODO_ES = { cero: 'Desde cero', foto: 'Sobre tu foto', ref: 'Con una referencia', 'foto+ref': 'Tu foto + una referencia' };
export const INTENSIDADES = [['suave', 'Suave'], ['normal', 'Normal'], ['fuerte', 'Fuerte']];
export const ATAJOS_REF = [
  { id: 'look', es: 'Todo el look', ejes: { estilo: 2, color: 2, composicion: 0, luz: 2, fondo: 2, pose: 0, producto: 0 } },
  { id: 'color', es: 'Solo color (LUT)', ejes: { estilo: 0, color: 2, composicion: 0, luz: 0, fondo: 0, pose: 0, producto: 0 } },
  { id: 'comp', es: 'Solo composición', ejes: { estilo: 0, color: 0, composicion: 2, luz: 0, fondo: 0, pose: 0, producto: 0 } },
  { id: 'anuncio', es: 'Hazlo como este anuncio', ejes: { ...core.EJES_REF_ANUNCIO } },
];
const arr = v => (Array.isArray(v) ? v : v == null ? [] : [v]);

/** La línea de la tarjeta que dice cómo se hace (§7.4): en texto, nunca solo con color u opacidad. */
export function marca(p, { sharp = true, sirve = null } = {}) {
  if (p.ejecutor === 'local') return sharp ? 'gratis · en tu máquina' : 'no disponible en esta máquina';
  if (sirve && sirve.on === false) return 'sin motor: actívalo';
  if (p.honestidad) return String(p.honestidad);
  const soloFoto = arr(p.modos).length && arr(p.modos).every(m => m === 'foto' || m === 'foto+ref');
  if (p.ejecutor === 'local+ia') return soloFoto ? 'necesita tu foto · la IA y aquí se garantiza' : 'la IA, y aquí se garantiza';
  return soloFoto ? 'necesita tu foto · la IA rehace la imagen' : 'la IA rehace la imagen';
}
/** Lo que se ve al abrir el banco sin buscar (D13): Favoritos, De PanaClaw, Recientes y las estrella de la puerta. */
export function portada(presets, { fav = [], rec = [], puerta = 'foto', max = 8 } = {}) {
  const by = new Map(presets.map(p => [p.id, p])), modo = puerta === 'ref' ? 'foto+ref' : puerta;
  const ok = p => p && core.modoAdmite(p, modo);
  const sec = (titulo, ids) => ({ titulo, ids: ids.filter(id => by.has(id)).slice(0, max) });
  return [
    sec('Favoritos', fav), sec('De PanaClaw', presets.filter(p => p.categoria === 'mios').map(p => p.id)),
    sec('Recientes', rec), sec('Para empezar', presets.filter(p => p.estrella && ok(p)).map(p => p.id)),
  ].filter(s => s.ids.length);
}
/** El estado del compositor → el pedido del compilador (el mismo que manda la página al servidor). */
export function pedidoDe(st) {
  return {
    pila: st.pila.map(x => ({ id: x.id, ...(x.params && Object.keys(x.params).length ? { params: x.params } : {}) })),
    params: st.canal ? { canal: st.canal } : {},
    entradas: { foto: st.foto ? [st.foto] : [], referencias: st.refs.map(r => ({ id: r.id, ejes: { ...r.ejes } })) },
    idea: st.idea || '', ...(st.escena ? { escena: st.escena } : {}), ...(st.modelo ? { model: st.modelo } : {}), n: st.n || 1,
  };
}
/** El modo que sale de lo que pusiste (las puertas solo son atajos). */
export const modoDeEstado = st => core.modoDe({ foto: st.foto ? [st.foto] : [], referencias: st.refs }, 'image');
/** ¿Algún preset de la pila ya exporta para un canal? Si no, elegir un canal añade «Exportar para un canal». */
export function exportaYa(pila, byId) {
  return pila.some(x => { const p = byId.get(x.id); return p && (arr(p.parametros).some(q => q.tipo === 'canal') || arr(p.post).includes('exportar') || arr(p.local).some(o => o.op === 'exportar')); });
}
/** Añadir a la pila con las reglas del banco: una sola vez cada uno; el mismo eje exclusivo, el último gana (con DESHACER). */
export function anadir(pila, p, byId) {
  if (pila.some(x => x.id === p.id)) return { pila, aviso: null };
  const exc = core.EJES_EXCLUSIVOS.filter(e => p.capa !== 'receta' && arr(p.ejes).includes(e));
  const fuera = exc.length ? pila.filter(x => { const q = byId.get(x.id); return q && q.capa !== 'receta' && exc.some(e => arr(q.ejes).includes(e)); }) : [];
  const out = [...pila.filter(x => !fuera.includes(x)), { id: p.id, params: {} }];
  return { pila: out, aviso: fuera.length ? { texto: `${exc[0][0].toUpperCase() + exc[0].slice(1)}: «${p.nombre}» sustituyó a «${byId.get(fuera[0].id)?.nombre || fuera[0].id}»`, antes: pila } : null };
}
/** El resumen de la QA de un archivo para su tarjeta: { estado, texto } o null. */
export function qaResumen(qa) {
  if (!qa || !Array.isArray(qa.checks)) return null;
  const mal = qa.checks.filter(c => c.ok === false), sin = qa.checks.filter(c => c.ok == null), bien = qa.checks.filter(c => c.ok === true);
  if (mal.length) return { estado: 'revisar', texto: `Revisar: ${mal[0].motivo}` };
  return { estado: 'ok', texto: `QA ✓ ${bien.length} de ${qa.checks.length}${sin.length ? ` · ${sin.length} sin medir` : ''}` };
}
export const usd = n => (n ? 'US$' + (+n).toFixed(2).replace('.', ',') : 'gratis');

/* ---------- la interfaz ---------- */
const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const FAV = 'ao.studio.presets.fav', REC = 'ao.studio.presets.rec', EST = 'ao.studio.banco';

export function initBanco(ctx) {
  const { esc, api, src, live, say, pick, subir, idea, n: cantidad, onState, abrirArchivo, mostrarGaleria } = ctx;
  let fab = ctx.fabrica || { presets: [], grupos: [], canales: [], iconos: {}, sinonimos: { frases: {} } };
  let presets = fab.presets.filter(p => arr(p.medios).includes('image')), info = new Map(), sharp = true, models = [];
  let byId = new Map(presets.map(p => [p.id, p]));
  const guardado = LS.get(EST, {});
  const st = { puerta: PUERTAS.some(p => p.id === guardado.puerta) ? guardado.puerta : 'foto', foto: null, refs: [], pila: Array.isArray(guardado.pila) ? guardado.pila.filter(x => x && typeof x.id === 'string') : [], /* se limpia al llegar los presets */ canal: guardado.canal || null, escena: guardado.escena ? E3.normalizar(guardado.escena) : null, modelo: null, idea: '', n: 1 };
  let plan = null, planSig = '', planT = null, planBusy = 0, deshacer = null, q = '', grupoAbierto = null, editor = null, resultados = [], guardarPara = null;
  const fav = new Set(LS.get(FAV, [])), rec = LS.get(REC, []);
  const keep = () => LS.set(EST, { puerta: st.puerta, pila: st.pila, canal: st.canal, escena: st.escena });
  const ico = (p, tam = 20) => iconoSVG(p.icono, { tam, iconos: fab.iconos });
  const nombre = id => byId.get(id)?.nombre || id;

  /* el paso del compositor */
  const el = document.createElement('div'); el.className = 'st-step bk'; el.setAttribute('role', 'group'); el.setAttribute('aria-labelledby', 'bkT');
  /* la hoja sobre la galería */
  const sheet = document.createElement('aside'); sheet.className = 'st-bank'; sheet.hidden = true; sheet.setAttribute('role', 'region'); sheet.setAttribute('aria-label', 'Banco de presets');
  const file = document.createElement('input'); file.type = 'file'; file.accept = 'image/png,image/jpeg,image/webp'; file.hidden = true; let fileFor = null;
  el.appendChild(file);
  const $ = s => el.querySelector(s), $$ = s => sheet.querySelector(s);

  const activo = () => st.pila.length > 0 || !!st.escena;
  function pintar() {
    const modo = modoDeEstado(st), propio = st.pila.length || st.escena;
    const refsHTML = st.refs.map((r, i) => `<div class="bk-ref"><img src="${esc(src(r.id))}" alt=""><div class="bk-refb"><div class="bk-refh"><b>Referencia ${i + 1}</b><button type="button" class="bk-x" data-unref="${i}" aria-label="Quitar la referencia ${i + 1}">✕</button></div>
      <div class="bk-atajos" role="group" aria-label="Qué copiar de la referencia ${i + 1}">${ATAJOS_REF.map(a => `<button type="button" data-atajo="${a.id}" data-ri="${i}" aria-pressed="${core.EJES_REF.every(k => (a.ejes[k] || 0) === (r.ejes[k] || 0))}">${a.es}</button>`).join('')}</div>
      <details class="bk-ejes"><summary>Ejes: ${core.EJES_REF.filter(k => r.ejes[k] > 0).map(k => core.EJES_REF_ES[k].toLowerCase()).join(', ') || 'ninguno'}</summary>
      ${core.EJES_REF.map(k => `<div class="bk-eje"><button type="button" role="switch" aria-checked="${r.ejes[k] > 0}" data-eje="${k}" data-ri="${i}">${core.EJES_REF_ES[k]}${k === 'color' ? ' <small>aquí, sin IA</small>' : k === 'producto' ? ' <small>tu producto en esa foto</small>' : ''}</button>
        <span class="bk-seg" role="group" aria-label="Fuerza de ${core.EJES_REF_ES[k]}">${[1, 2, 3].map(v => `<button type="button" data-fz="${v}" data-eje="${k}" data-ri="${i}" aria-pressed="${r.ejes[k] === v}"${r.ejes[k] > 0 ? '' : ' disabled'}>${core.FUERZA_ES[v]}</button>`).join('')}</span></div>`).join('')}</details></div></div>`).join('');
    const chips = st.pila.map((x, i) => { const p = byId.get(x.id); if (!p) return ''; const pasos = p.capa === 'receta' ? arr(p.incluye).length : 0, int = x.params?.intensidad || 'normal';
      return `<li class="bk-chip"><span class="bk-ci">${ico(p, 16)}</span><span class="bk-cn"><b>${esc(p.nombre)}</b>${pasos ? `<small>${pasos} pasos</small>` : ''}<small>${esc(marca(p, { sharp, sirve: info.get(p.id) }))}</small></span>
        <span class="bk-seg" role="group" aria-label="Intensidad de ${esc(p.nombre)}">${INTENSIDADES.map(([v, t]) => `<button type="button" data-int="${v}" data-pi="${i}" aria-pressed="${int === v}">${t}</button>`).join('')}</span>
        <button type="button" class="bk-x" data-unpila="${i}" aria-label="Quitar ${esc(p.nombre)}">✕</button></li>`; }).join('');
    const canales = fab.canales || [], cP = canales.filter(c => c.grupo === 'panama'), cO = canales.filter(c => c.grupo !== 'panama');
    el.innerHTML = `<div class="st-h" id="bkT"><b>${iconoSVG('M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z', { tam: 14 })}</b> Presets <span class="st-hn">opcional · combínalos</span></div>
      <div class="bk-doors" role="group" aria-label="¿De dónde partes? (atajos: nada se borra al cambiar)">${PUERTAS.map(p => `<button type="button" data-puerta="${p.id}" aria-pressed="${st.puerta === p.id}" title="${esc(p.ayuda)}">${esc(p.es)}</button>`).join('')}</div>
      <p class="bk-modo" aria-live="polite">Ahora: <b>${MODO_ES[modo] || modo}</b>${st.escena ? ' · con escenario 3D' : ''}</p>
      <div class="bk-in">
        <div class="bk-slot"><span class="bk-lbl">Tu foto</span>${st.foto ? `<span class="bk-th"><img src="${esc(src(st.foto))}" alt=""><button type="button" class="bk-x" data-unfoto aria-label="Quitar tu foto">✕</button></span>` : `<button type="button" class="bk-add" data-subir="foto">Subir</button><button type="button" class="bk-add" data-galeria="foto">De la galería</button>`}</div>
        <div class="bk-slot bk-slotr"><span class="bk-lbl">Referencias <small>se imita, nunca se copia su producto</small></span>${refsHTML}${st.refs.length < 3 ? `<span class="bk-addrow"><button type="button" class="bk-add" data-subir="ref">Subir</button><button type="button" class="bk-add" data-galeria="ref">De la galería</button></span>` : ''}</div>
      </div>
      <div class="bk-pilah"><span class="bk-lbl">Lo que se hará</span><button type="button" class="bk-open" aria-expanded="${!sheet.hidden && sheet.dataset.modo === 'banco'}" title="Abrir el banco de presets (B)">${iconoSVG('M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z', { tam: 16 })}<span>Banco · B</span></button></div>
      ${chips ? `<ol class="bk-pila" aria-label="Presets elegidos, en el orden en que se hacen">${chips}</ol>` : '<p class="bk-vacio">Ningún preset todavía: ábrelo con «Banco» o escribe <kbd>/</kbd> al principio de la idea.</p>'}
      <div class="bk-toast" role="status"${deshacer ? '' : ' hidden'}>${deshacer ? `<span>${esc(deshacer.texto)}</span><button type="button" data-deshacer>DESHACER</button>` : ''}</div>
      <div class="bk-canal"><span class="bk-lbl">Para dónde</span><div class="bk-chips" role="group" aria-label="Canal">${cP.map(c => `<button type="button" data-canal="${esc(c.id)}" aria-pressed="${st.canal === c.id}" title="${esc(`${c.ancho}×${c.alto}${c.formato ? ' ' + c.formato : ''}`)}">${esc(c.nombre)}</button>`).join('')}
        <label class="bk-otras"><span class="e3d-vh">Otras tiendas</span><select data-otras aria-label="Otras tiendas"><option value="">Otras tiendas…</option>${cO.map(c => `<option value="${esc(c.id)}"${st.canal === c.id ? ' selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></label>${st.canal ? '<button type="button" data-canal="" aria-label="Sin canal">Sin canal</button>' : ''}</div></div>
      <div class="bk-esc"><span class="bk-lbl">Escenario 3D <small>la cámara a una distancia, en cm o m</small></span>${st.escena ? `<p class="bk-escl">${esc(E3.describirEscena(st.escena, plan?.familia || 'conversacional').resumen || '')}</p>` : ''}
        <span class="bk-addrow"><button type="button" class="bk-add" data-escena="abrir" aria-expanded="${!sheet.hidden && sheet.dataset.modo === 'escena'}">${st.escena ? 'Cambiar la escena' : 'Usar un escenario 3D'}</button>${st.escena ? '<button type="button" class="bk-add" data-escena="quitar">Quitar la escena</button>' : ''}</span></div>
      ${propio ? queHaraHTML() : ''}
      ${guardarPara ? guardarHTML() : propio ? '<button type="button" class="bk-link" data-guardar="receta">Guardar esta receta como preset…</button>' : ''}
      <div class="bk-res" aria-live="polite">${resultados.map(resHTML).join('')}</div>`;
    onState?.();
  }
  function queHaraHTML() {
    if (!plan) return `<details class="bk-que" open><summary>Qué hará · calculando…</summary></details>`;
    const c = plan, err = c.errores || [], av = (c.avisos || []).map(a => a.texto).filter(Boolean);
    const alt = c.alternativas || [];
    return `<details class="bk-que"${err.length ? ' open' : ''}><summary>Qué hará · <b>${esc(c.costo?.texto || '—')}</b>${c.model ? ` · ${esc(models.find(m => m.id === c.model)?.name || c.model)}` : c.soloLocal ? ' · en tu máquina' : ''}</summary>
      ${err.length ? `<ul class="bk-err" role="alert">${err.map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
      ${(c.pasos_es || []).length ? `<ol class="bk-pasos">${c.pasos_es.map(p => `<li>${esc(p)}</li>`).join('')}</ol>` : ''}
      ${c.conserva_es ? `<p class="bk-cons"><b>No cambia:</b> ${esc(c.conserva_es)}</p>` : ''}
      ${c.porque ? `<p class="bk-por">${esc(c.porque)}</p>` : ''}
      ${alt.length ? `<label class="bk-alt">Otro modelo <select data-modelo><option value="">El recomendado</option>${alt.map(a => `<option value="${esc(a.id)}"${st.modelo === a.id ? ' selected' : ''}>${esc(a.nombre)}${a.porque ? ' · ' + esc(a.porque) : ''}</option>`).join('')}</select></label>` : ''}
      ${c.qa?.length ? `<p class="bk-qa0">Al terminar se comprueba: ${c.qa.map(esc).join(', ')}.</p>` : ''}
      ${av.length ? `<ul class="bk-av">${av.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
      ${c.prompt ? `<details class="bk-prompt"><summary>Ver el prompt (inglés${c.prompt_es ? ', con traducción' : ''})</summary><pre>${esc(c.prompt)}</pre>${c.prompt_es ? `<p>${esc(c.prompt_es)}</p>` : ''}</details>` : ''}</details>`;
  }
  function guardarHTML() {
    const g = guardarPara;
    return `<form class="bk-guardar" data-form="guardar"><b>Guardar como preset</b><p>Queda como una nota del Cerebro (Estudio/Presets) y sale en el banco, en «De PanaClaw».</p>
      <label>Nombre <input name="nombre" maxlength="48" required value="${esc(g.nombre || '')}" autocomplete="off"></label>
      <label>Marca o campaña <small>opcional, se enlaza en el Cerebro</small><input name="marca" maxlength="60" autocomplete="off"></label>
      <span class="bk-addrow"><button type="submit" class="bk-pri">Guardar</button><button type="button" data-guardar="no">Cancelar</button></span><span class="bk-gmsg" role="status"></span></form>`;
  }
  function resHTML(r) {
    const j = r.job, it = r.item, qa = it?.qa, rs = qaResumen(qa);
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
    const ped = pedidoDe(st), sig = JSON.stringify(ped);
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
  function pintarQue() { const d = $('.bk-que'); const was = d?.open; if (d) { const t = document.createElement('div'); t.innerHTML = queHaraHTML(); const n = t.firstElementChild; if (was) n.open = true; d.replaceWith(n); } else pintar(); onState?.(); }
  const cambio = () => { keep(); pintar(); replan(); };

  /* la hoja: el banco o el escenario */
  function cards(ids, { lista = true } = {}) {
    return `<ul class="bk-cards"${lista ? '' : ''}>${ids.map(id => byId.get(id)).filter(Boolean).map(p => { const on = st.pila.some(x => x.id === p.id), s = info.get(p.id);
      return `<li class="bk-cw"><button type="button" class="bk-card" data-pid="${esc(p.id)}" aria-pressed="${on}"><span class="bk-ci">${ico(p)}</span><span class="bk-cn"><b>${esc(p.nombre)}</b>${p.tecnico ? `<small>${esc(p.tecnico)}</small>` : ''}<small class="bk-mk">${esc(marca(p, { sharp, sirve: s }))}${p.estado === 'beta' ? ' · beta' : ''}</small></span></button><button type="button" class="bk-star" data-star="${esc(p.id)}" aria-pressed="${fav.has(p.id)}" aria-label="${fav.has(p.id) ? 'Quitar de favoritos' : 'Marcar favorito'}: ${esc(p.nombre)}">${fav.has(p.id) ? '★' : '☆'}</button></li>`; }).join('')}</ul>`;
  }
  function pintarHoja() {
    if (sheet.hidden) return;
    if (sheet.dataset.modo === 'escena') return; // el editor se pinta a sí mismo
    const modo = modoDeEstado(st);
    let cuerpo;
    if (q.trim()) {
      const hits = core.buscar(q, presets, { favoritos: [...fav], recientes: rec, max: 40 }).filter(h => byId.has(h.id));
      cuerpo = hits.length ? cards(hits.map(h => h.id)) : `<p class="bk-nada">Nada con «${esc(q)}». ${ctx.pedirDimitri ? '<button type="button" data-dimitri>Pedírselo a Dimitri</button>' : 'Prueba con otras palabras: «fondo blanco», «más luz», «como este anuncio».'}</p>`;
      $$('.bk-n').textContent = `${hits.length} ${hits.length === 1 ? 'resultado' : 'resultados'}`;
    } else {
      const secs = portada(presets, { fav: [...fav], rec, puerta: st.puerta });
      const grupos = (fab.grupos || []).filter(g => g.medio === 'image' || g.id === 'mios');
      cuerpo = secs.map(s => `<section class="bk-sec"><h3>${esc(s.titulo)}</h3>${cards(s.ids)}</section>`).join('') +
        `<section class="bk-sec"><h3>Todos los grupos</h3>${grupos.map(g => { const ids = presets.filter(p => (p.categoria || '') === g.id).map(p => p.id); if (!ids.length) return ''; const open = grupoAbierto === g.id;
          return `<details class="bk-g" data-g="${esc(g.id)}"${open ? ' open' : ''}><summary>${iconoSVG(g.icono, { tam: 18, iconos: fab.iconos })}<span><b>${esc(g.nombre || g.es || g.id)}</b>${g.frase ? `<small>${esc(g.frase)}</small>` : ''}</span><i>${ids.length}</i></summary>${open ? cards(ids) : ''}</details>`; }).join('')}</section>`;
      $$('.bk-n').textContent = `${presets.length} presets · ${MODO_ES[modo] || modo}`;
    }
    $$('.bk-body').innerHTML = cuerpo;
  }
  function abrir(modo = 'banco') {
    if (!sheet.parentNode) return;
    sheet.dataset.modo = modo; sheet.hidden = false; mostrarGaleria?.();
    if (modo === 'banco') {
      if (editor) { editor.destroy(); editor = null; }
      sheet.innerHTML = `<div class="bk-sh"><b>Banco de presets</b><span class="sp"></span><button type="button" class="bk-x" data-cerrar aria-label="Cerrar el banco (Esc)">✕</button></div>
        <label class="bk-q"><span class="e3d-vh">Buscar un preset</span><input type="search" class="bk-qi" placeholder="Qué quieres: «se ve oscura», «fondo blanco», «como este anuncio»…" value="${esc(q)}" autocomplete="off"></label>
        <p class="bk-n" aria-live="polite"></p><div class="bk-body"></div>`;
      pintarHoja(); setTimeout(() => $$('.bk-qi')?.focus(), 30);
    } else {
      sheet.innerHTML = `<div class="bk-sh"><b>Escenario 3D</b><span class="sp"></span><button type="button" class="bk-pri" data-cerrar>Listo</button><button type="button" class="bk-x" data-cerrar aria-label="Cerrar el escenario (Esc)">✕</button></div>
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
    pintar(); if (volver) (modo === 'escena' ? $('[data-escena="abrir"]') : $('.bk-open'))?.focus({ preventScroll: true });
  }
  const toggle = () => (sheet.hidden || sheet.dataset.modo !== 'banco' ? abrir('banco') : cerrar());

  function usar(p) {
    if (p.propio) { // un preset propio: su receta entra entera (pila, canal, escena, ejes)
      st.pila = p.propio.pila.filter(x => byId.has(x.id)).map(x => ({ id: x.id, params: { ...(x.params || {}) } }));
      if (p.propio.canal) st.canal = p.propio.canal; if (p.propio.escena) st.escena = E3.normalizar(p.propio.escena);
      if (p.propio.ejes) st.refs = st.refs.map(r => ({ ...r, ejes: { ...p.propio.ejes } }));
      deshacer = null; say?.(`«${p.nombre}»: su receta entró entera.`);
    } else if (st.pila.some(x => x.id === p.id)) { st.pila = st.pila.filter(x => x.id !== p.id); deshacer = null; }
    else { const r = anadir(st.pila, p, byId); deshacer = r.aviso; st.pila = r.pila; if (st.canal && !exportaYa(st.pila, byId) && byId.has('sal-canal')) st.pila.push({ id: 'sal-canal', params: { canal: st.canal } }); }
    const i = rec.indexOf(p.id); if (i >= 0) rec.splice(i, 1); rec.unshift(p.id); rec.length = Math.min(rec.length, 12); LS.set(REC, rec);
    cambio(); pintarHoja();
  }
  function setCanal(id) {
    st.canal = id || null;
    st.pila = st.pila.map(x => (x.id === 'sal-canal' ? { ...x, params: { ...x.params, canal: st.canal } } : x)).filter(x => x.id !== 'sal-canal' || st.canal);
    if (st.canal && st.pila.length && !exportaYa(st.pila, byId) && byId.has('sal-canal')) st.pila.push({ id: 'sal-canal', params: { canal: st.canal } });
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
    if (c >= 0.5 && !confirm(`Esto cuesta aprox. ${usd(c)}. ¿Generar?`)) return;
    try {
      const r = await api('POST', '/api/media/presets/apply', pedidoDe({ ...st, idea: idea?.() || '', n: cantidad?.() || 1 }));
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

  /* eventos del paso */
  el.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.puerta) { st.puerta = t.dataset.puerta; keep(); pintar(); if (t.dataset.puerta === 'foto' && !st.foto) pick('Elige tu foto', f => tomar('foto', f)); else if (t.dataset.puerta === 'ref' && !st.refs.length) pick('Elige la referencia', f => tomar('ref', f)); else if (t.dataset.puerta === 'cero') abrir('banco'); $(`[data-puerta="${t.dataset.puerta}"]`)?.focus(); return; }
    if (t.dataset.subir) { fileFor = t.dataset.subir; file.click(); return; }
    if (t.dataset.galeria) { cerrar(false); const rol = t.dataset.galeria; pick(rol === 'foto' ? 'Elige tu foto' : 'Elige la referencia', f => tomar(rol, f)); return; }
    if (t.hasAttribute('data-unfoto')) { st.foto = null; cambio(); $('[data-galeria="foto"]')?.focus(); return; }
    if (t.dataset.unref != null) { st.refs.splice(+t.dataset.unref, 1); cambio(); return; }
    if (t.dataset.atajo) { const a = ATAJOS_REF.find(x => x.id === t.dataset.atajo), r = st.refs[+t.dataset.ri]; if (a && r) { r.ejes = { ...a.ejes }; cambio(); $(`[data-atajo="${a.id}"][data-ri="${t.dataset.ri}"]`)?.focus(); } return; }
    if (t.getAttribute('role') === 'switch' && t.dataset.eje) { const r = st.refs[+t.dataset.ri]; if (r) { r.ejes[t.dataset.eje] = r.ejes[t.dataset.eje] > 0 ? 0 : 2; cambio(); const d = el.querySelectorAll('.bk-ejes')[+t.dataset.ri]; if (d) d.open = true; el.querySelector(`[role=switch][data-eje="${t.dataset.eje}"][data-ri="${t.dataset.ri}"]`)?.focus(); } return; }
    if (t.dataset.fz) { const r = st.refs[+t.dataset.ri]; if (r) { r.ejes[t.dataset.eje] = +t.dataset.fz; cambio(); const d = el.querySelectorAll('.bk-ejes')[+t.dataset.ri]; if (d) d.open = true; } return; }
    if (t.dataset.int) { const x = st.pila[+t.dataset.pi]; if (x) { x.params = { ...(x.params || {}), intensidad: t.dataset.int }; if (t.dataset.int === 'normal') delete x.params.intensidad; cambio(); el.querySelector(`[data-int="${t.dataset.int}"][data-pi="${t.dataset.pi}"]`)?.focus(); } return; }
    if (t.dataset.unpila != null) { const i = +t.dataset.unpila; st.pila.splice(i, 1); deshacer = null; cambio(); (el.querySelectorAll('[data-unpila]')[Math.min(i, st.pila.length - 1)] || $('.bk-open'))?.focus(); pintarHoja(); return; }
    if (t.hasAttribute('data-deshacer') && deshacer) { st.pila = deshacer.antes; deshacer = null; cambio(); pintarHoja(); $('.bk-open')?.focus(); return; }
    if (t.classList.contains('bk-open')) { toggle(); return; }
    if (t.dataset.canal != null) { setCanal(t.dataset.canal); el.querySelector(`[data-canal="${t.dataset.canal}"]`)?.focus() || $('[data-otras]')?.focus(); return; }
    if (t.dataset.escena === 'abrir') { abrir('escena'); return; }
    if (t.dataset.escena === 'quitar') { st.escena = null; cerrar(false); cambio(); $('[data-escena="abrir"]')?.focus(); return; }
    if (t.dataset.guardar) { guardarPara = t.dataset.guardar === 'no' ? null : t.dataset.guardar === 'receta' ? { desde: null, nombre: '' } : { desde: t.dataset.guardar, nombre: '' }; pintar(); setTimeout(() => (guardarPara ? $('.bk-guardar input') : $('[data-guardar="receta"]'))?.focus(), 0); return; }
    if (t.dataset.ver) { abrirArchivo?.(t.dataset.ver); return; }
  });
  el.addEventListener('change', e => {
    if (e.target.matches('[data-otras]')) { setCanal(e.target.value); $('[data-otras]')?.focus(); }
    if (e.target.matches('[data-modelo]')) { st.modelo = e.target.value || null; replan(true); }
  });
  el.addEventListener('input', e => { if (e.target.matches('[data-ba]')) e.target.closest('.bk-ba').style.setProperty('--bk-x', e.target.value + '%'); });
  el.addEventListener('submit', e => { if (e.target.matches('[data-form="guardar"]')) { e.preventDefault(); guardar(e.target); } });
  file.addEventListener('change', async () => { const fs = [...file.files]; file.value = ''; if (!fs.length) return; const items = await subir(fs); if (items[0]) tomar(fileFor === 'ref' ? 'ref' : 'foto', items[0].file); });

  /* eventos de la hoja */
  sheet.addEventListener('click', e => {
    const t = e.target.closest('button');
    if (t?.hasAttribute('data-cerrar')) { cerrar(); return; }
    if (t?.dataset.pid) { const p = byId.get(t.dataset.pid); if (p) { usar(p); sheet.querySelector(`[data-pid="${CSS.escape(p.id)}"]`)?.focus(); } return; }
    if (t?.dataset.star) { const id = t.dataset.star; fav.has(id) ? fav.delete(id) : fav.add(id); LS.set(FAV, [...fav]); pintarHoja(); sheet.querySelector(`[data-star="${CSS.escape(id)}"]`)?.focus(); return; }
    if (t?.hasAttribute('data-dimitri')) { ctx.pedirDimitri?.(q); return; }
  });
  sheet.addEventListener('toggle', e => { const d = e.target; if (d.matches?.('.bk-g')) { if (d.open) { grupoAbierto = d.dataset.g; sheet.querySelectorAll('.bk-g[open]').forEach(x => { if (x !== d) x.open = false; }); if (!d.querySelector('.bk-cards')) d.insertAdjacentHTML('beforeend', cards(presets.filter(p => p.categoria === d.dataset.g).map(p => p.id))); } else if (grupoAbierto === d.dataset.g) grupoAbierto = null; } }, true);
  sheet.addEventListener('input', e => { if (e.target.matches('.bk-qi')) { q = e.target.value; pintarHoja(); } });
  sheet.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (e.target.matches('.bk-qi') && q) { q = ''; e.target.value = ''; pintarHoja(); } else cerrar(); e.preventDefault(); e.stopPropagation(); return; }
    const c = e.target.closest?.('.bk-card'); if (!c) return;
    if (e.key === ' ') { e.preventDefault(); sheet.querySelector(`[data-star="${CSS.escape(c.dataset.pid)}"]`)?.click(); return; } // Espacio marca ★ (§7.4); Enter añade
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const l = [...sheet.querySelectorAll('.bk-card')], i = l.indexOf(c); l[Math.max(0, Math.min(l.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus(); }
  });

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
    qaHTML(it) { const r = qaResumen(it?.qa); return r ? `<span class="bk-q bk-q-${r.estado}">${esc(r.texto)}</span>` : ''; },
    guardarDesde(it) { guardarPara = { desde: it.file, nombre: '' }; pintar(); setTimeout(() => $('.bk-guardar input')?.focus(), 0); },
    /** «/» al principio de la idea abre el banco (§7.1). */
    barra(texto) { if (/^\/\S*$/.test(texto)) { q = texto.slice(1); abrir('banco'); return true; } return false; },
  };
}
