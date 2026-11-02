// Lo que se puede HACER con una campaña, un conjunto o un anuncio (Fase A2, 9 oct 2026; plan §3 y §5 A2). Puro: lo usan la vista, la
// demo y tests/anuncios-vista.test.mjs. LA REGLA DEL DINERO: lo que baja el gasto (pausar, bajar un presupuesto, archivar) es de un
// clic; lo que gasta (activar, reanudar, subir un presupuesto, alargar el fin, relanzar) pide DOS clics y el segundo dice la cifra
// («Sí, activar — hasta 15,00 US$ al día»). Quien decide de verdad es el servidor (topes, Meta); aquí solo se ofrece lo que tiene sentido.
import { esc, dinero, fechaCorta, presupuesto } from './comun.js';

export const GASTO = new Set(['activar', 'reanudar', 'subir_presupuesto', 'alargar', 'relanzar']);
export const LIBRES = new Set(['pausar', 'bajar_presupuesto', 'archivar']);
export const TEXTO = { pausar: 'Pausar', activar: 'Activar', reanudar: 'Reanudar', subir_presupuesto: 'Subir presupuesto', bajar_presupuesto: 'Bajar presupuesto', alargar: 'Alargar la fecha de fin', relanzar: 'Relanzar', archivar: 'Archivar' };
const VERBO = { activar: 'activar', reanudar: 'reanudar', subir_presupuesto: 'subir', alargar: 'alargar', relanzar: 'relanzar' };
const INTERRUPTOR = ['pausar', 'activar', 'reanudar'];
const NIVEL = { campana: 'la campaña', conjunto: 'el conjunto', anuncio: 'el anuncio' };

const clave = n => String(n?.estado || '').toUpperCase();
const vence = (fin, ahora) => { const t = fin ? Date.parse(String(fin).length === 10 ? fin + 'T23:59:59' : fin) : NaN; return !Number.isNaN(t) && t < ahora; };
/** ¿Esta campaña ya terminó? (Meta la sigue llamando ACTIVE cuando su fin ya pasó.) */
export const terminada = (n, ahora = Date.now()) => clave(n) === 'COMPLETED' || vence(n?.fin, ahora);
const gasto = n => Number(n?.cifras?.gasto) > 0;
const tienePres = n => n?.presupuesto?.usd != null && !!n.presupuesto.tipo;

/**
 * La fila (de campanas.buscar/aplanar: { nivel, nodo, campana, conjunto }) → las acciones que tienen sentido, en orden:
 * [{ tipo, texto, gasto, interruptor, nota }]. ACTIVE → pausar (nunca activar); PAUSED → activar (o reanudar si ya gastó);
 * ARCHIVED → solo relanzar (la campaña); DISAPPROVED → pausar o archivar (activarlo no sirve: hay que cambiar el anuncio);
 * una campaña terminada → relanzar, alargar o archivar; lo que está en pausa por su campaña → se reanuda la campaña.
 */
export function accionesDe(f, ahora = Date.now()) {
  if (!f || !f.nodo) return [];
  const n = f.nodo, k = clave(n), nivel = f.nivel, camp = f.campana && f.campana !== n ? f.campana : null;
  const t = [];
  const add = (tipo, nota = '') => t.push({ tipo, texto: TEXTO[tipo], gasto: GASTO.has(tipo), interruptor: false, nota });
  if (k === 'DELETED') return [];
  if (k === 'ARCHIVED') { if (nivel === 'campana') add('relanzar', 'se duplica EN PAUSA con fechas nuevas; luego la activas'); return t; }
  if (camp && (terminada(camp, ahora) || clave(camp) === 'ARCHIVED')) { add('archivar', 'no se borra: se archiva'); return t; }
  if (nivel === 'campana' && terminada(n, ahora)) {
    add('relanzar', 'terminó: se duplica EN PAUSA con fechas nuevas; luego la activas');
    if (n.fin) add('alargar', 'la fecha de fin ya pasó: alargarla la vuelve a poner a gastar');
    add('archivar', 'no se borra: se archiva');
    return t;
  }
  const pres = tienePres(n) && nivel !== 'anuncio', fin = !!n.fin && nivel !== 'anuncio';
  if (k === 'CAMPAIGN_PAUSED' || k === 'ADSET_PAUSED') {
    if (pres) add('bajar_presupuesto');
    add('archivar', 'no se borra: se archiva');
    return t.map(a => ({ ...a, depende: k === 'CAMPAIGN_PAUSED' ? 'campana' : 'conjunto' }));
  }
  if (k === 'PAUSED') {
    add(gasto(n) ? 'reanudar' : 'activar');
    if (pres) { add('subir_presupuesto'); add('bajar_presupuesto'); }
    if (fin) add('alargar');
    if (nivel === 'campana') add('relanzar', 'se duplica EN PAUSA con fechas nuevas; luego la activas');
    add('archivar', 'no se borra: se archiva');
  } else if (k === 'DISAPPROVED') {
    add('pausar'); add('archivar', 'no se borra: se archiva');
  } else { // ACTIVE, WITH_ISSUES, PENDING_REVIEW, IN_PROCESS, PREAPPROVED, PENDING_BILLING_INFO…
    const roto = /^(WITH_ISSUES|PENDING_BILLING_INFO)$/.test(k);
    add('pausar');
    if (pres) { if (!roto) add('subir_presupuesto'); add('bajar_presupuesto'); }
    if (fin && !roto) add('alargar');
    add('archivar', 'no se borra: se archiva');
  }
  const i = t.findIndex(a => INTERRUPTOR.includes(a.tipo)); if (i >= 0) t[i] = { ...t[i], interruptor: true };
  return t;
}
export const interruptorDe = acciones => acciones.find(a => a.interruptor) || null;
export const menuDe = acciones => acciones.filter(a => !a.interruptor);

/** Lo que sostiene el gasto de esta fila: su presupuesto, o el de su conjunto, o el de su campaña. → { usd, tipo, de } o null */
export function presupuestoDe(f) {
  for (const [n, de] of [[f?.nodo, f?.nivel], [f?.conjunto, 'conjunto'], [f?.campana, 'campana']]) if (tienePres(n)) return { ...n.presupuesto, de };
  return null;
}
/** ¿Subir de `actual` a `nuevo` reinicia el aprendizaje? (más de un 20 % en algo que aprende; §7.1 y §7.5) */
export function reiniciaAprendizaje(f, actual, nuevo) {
  const aprende = n => n?.aprendizaje?.estado === 'LEARNING';
  const algo = f?.nivel === 'campana' ? (f.nodo.conjuntos || []).some(aprende) : aprende(f?.nodo) || aprende(f?.conjunto);
  return !!algo && Number(actual) > 0 && Number(nuevo) > Number(actual) * 1.2;
}
export const AVISO_APRENDIZAJE = 'Esto reinicia el aprendizaje: sube más de un 20 % algo que todavía está aprendiendo. Mejor un 20 % cada 2–3 días.';

/** El importe del formulario de presupuesto → '' si vale, o por qué no (sin llamar a nadie). */
export function errorImporte(tipo, valor, actual) {
  const v = Number(String(valor ?? '').replace(',', '.'));
  if (String(valor ?? '').trim() === '' || !Number.isFinite(v)) return 'Escribe un importe.';
  if (v <= 0) return 'El presupuesto tiene que ser mayor que 0.';
  if (actual != null && tipo === 'subir_presupuesto' && !(v > actual)) return 'Para subirlo, el importe nuevo tiene que ser mayor que el de ahora.';
  if (actual != null && tipo === 'bajar_presupuesto' && !(v < actual)) return 'Para bajarlo, el importe nuevo tiene que ser menor que el de ahora.';
  return '';
}
export const importe = v => Math.round(Number(String(v ?? '').replace(',', '.')) * 100) / 100;

/** El texto del SEGUNDO botón, con la cifra: «Sí, activar — hasta 15,00 US$ al día». */
export function botonSi(tipo, confirmar, moneda = 'USD') {
  const c = confirmar?.cifras || {}, n = k => Number(c[k]) > 0;
  const cifra = n('dia') ? `hasta ${dinero(c.dia, moneda)} al día` : n('campana') ? `hasta ${dinero(c.campana, moneda)} en la campaña` : n('semana') ? `hasta ${dinero(c.semana, moneda)} esta semana` : tipo === 'relanzar' ? 'nace en pausa' : '';
  return `Sí, ${VERBO[tipo] || tipo}${cifra ? ' — ' + cifra : ''}`;
}
/** Las cifras de la confirmación (día, semana, mes, campaña), cada una con su moneda. */
export function cifrasConfirmarHTML(cifras = {}, moneda = 'USD') {
  const L = [['dia', 'Al día'], ['semana', 'Esta semana'], ['mes', 'Hasta fin de mes'], ['campana', 'En toda la campaña']].filter(([k]) => cifras[k] != null);
  if (!L.length) return '';
  return `<dl class="anu-ccif">${L.map(([k, t]) => `<div><dt>${t}</dt><dd>hasta ${esc(dinero(cifras[k], moneda))}</dd></div>`).join('')}</dl>`;
}

/* ---------- HTML: el interruptor, el «⋯» y el menú ---------- */
const nombre = f => String(f?.nodo?.nombre || '(sin nombre)');
export function interruptorHTML(f, acciones, { moneda } = {}) {
  const i = interruptorDe(acciones);
  if (!i) {
    const d = acciones.find(a => a.depende);
    return d ? `<span class="anu-dep">En pausa por su ${d.depende === 'campana' ? 'campaña' : 'conjunto'}</span>` : '';
  }
  return `<button type="button" class="anu-int${i.gasto ? ' gasta' : ''}" data-acc="${i.tipo}" data-id="${esc(f.id)}" aria-label="${esc(i.texto)} ${esc(NIVEL[f.nivel])} «${esc(nombre(f))}»${i.gasto ? ' (gasta: te pido confirmar con la cifra)' : ''}">${i.tipo === 'pausar' ? '<span class="anu-int-i" aria-hidden="true">❚❚</span>' : '<span class="anu-int-i" aria-hidden="true">▶</span>'}${esc(i.texto)}</button>`;
}
export function masHTML(f, acciones) {
  if (!menuDe(acciones).length) return '';
  return `<button type="button" class="anu-mas" data-menu="${esc(f.id)}" aria-haspopup="menu" aria-expanded="false" aria-label="Más acciones para «${esc(nombre(f))}»" title="Más acciones">⋯</button>`;
}
/** Interruptor + «⋯» juntos (la celda de la tabla y la tarjeta del Resumen). */
export function controlesHTML(f, ahora = Date.now()) {
  const a = accionesDe(f, ahora);
  const h = interruptorHTML(f, a) + masHTML(f, a);
  return h ? `<span class="anu-ctl">${h}</span>` : '';
}
/** El menú de una fila: role="menu", cada acción un menuitem con su nota; las de gasto lo dicen. */
export function menuHTML(f, ahora = Date.now()) {
  const l = menuDe(accionesDe(f, ahora));
  return `<div class="anu-menu" role="menu" aria-label="Acciones para «${esc(nombre(f))}»">${l.map(a => `<button type="button" role="menuitem" tabindex="-1" data-acc="${a.tipo}" data-id="${esc(f.id)}"><span>${esc(a.texto)}${a.gasto ? ' <em class="anu-gasta">gasta</em>' : ''}</span>${a.nota ? `<small>${esc(a.nota)}</small>` : ''}</button>`).join('')}</div>`;
}
/** Las acciones como botones a la vista (el panel de detalle). */
export function accionesBotonesHTML(f, ahora = Date.now()) {
  const l = accionesDe(f, ahora);
  if (!l.length) return '';
  const dep = l.find(a => a.depende);
  return `<section class="anu-dsec" aria-labelledby="anuDAc"><h3 id="anuDAc">Acciones</h3>${dep ? `<p class="anu-ayuda">En pausa por su ${dep.depende === 'campana' ? 'campaña' : 'conjunto'}: para que vuelva a salir, reanuda ${dep.depende === 'campana' ? 'la campaña' : 'el conjunto'}.</p>` : ''}
    <div class="anu-dacc">${l.map(a => `<button type="button" class="anu-btn${a.interruptor ? ' pri' : ''}" data-acc="${a.tipo}" data-id="${esc(f.id)}">${esc(a.texto)}${a.gasto ? ' <em class="anu-gasta">gasta</em>' : ''}</button>`).join('')}</div>
    <p class="anu-ayuda">Pausar, bajar o archivar es de un clic. Lo que gasta te pide un segundo clic que dice la cifra, y nunca pasa de tus topes.</p></section>`;
}

/* ---------- el diálogo: el formulario, la confirmación con la cifra y los errores ---------- */
const hoyYmd = (ahora = Date.now()) => { const d = new Date(ahora); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
/** ¿Esta acción pide datos antes del primer clic? */
export const pideDatos = tipo => tipo === 'subir_presupuesto' || tipo === 'bajar_presupuesto' || tipo === 'alargar' || tipo === 'relanzar';
export function formularioHTML(f, tipo, { moneda = 'USD', valor = '', fin = '', inicio = '', error = '', ahora = Date.now() } = {}) {
  const p = presupuestoDe(f), hoy = hoyYmd(ahora), cur = String(moneda || 'USD').toUpperCase();
  let campos = '';
  if (tipo === 'subir_presupuesto' || tipo === 'bajar_presupuesto') {
    campos = `<p class="anu-dact">Ahora: <b>${esc(p ? presupuesto(p, moneda) : 'sin presupuesto propio')}</b>${p && p.de && p.de !== f.nivel ? ` (de su ${p.de === 'campana' ? 'campaña' : 'conjunto'})` : ''}</p>
      <label class="anu-campo"><span>Nuevo presupuesto ${p?.tipo === 'total' ? 'total' : 'diario'}, en ${esc(cur)}</span><span class="anu-imp"><input type="number" inputmode="decimal" min="0.01" step="0.01" data-campo="valor" value="${esc(valor)}" aria-describedby="anuDlgErr" required><b aria-hidden="true">${esc(cur)}</b></span></label>`;
  } else if (tipo === 'alargar') {
    campos = `<p class="anu-dact">Termina ahora: <b>${esc(fechaCorta(f.nodo.fin, 'sin fin'))}</b></p>
      <label class="anu-campo"><span>Nueva fecha de fin</span><input type="date" data-campo="fin" min="${hoy}" value="${esc(fin)}" aria-describedby="anuDlgErr" required></label>`;
  } else if (tipo === 'relanzar') {
    campos = `<p class="anu-dact">Se duplica <b>EN PAUSA</b> con fechas nuevas y la etiqueta de la oficina. No gasta hasta que tú la actives (con su cifra).</p>
      <div class="anu-fila2"><label class="anu-campo"><span>Empieza</span><input type="date" data-campo="inicio" min="${hoy}" value="${esc(inicio || hoy)}"></label>
      <label class="anu-campo"><span>Termina (opcional)</span><input type="date" data-campo="fin" min="${hoy}" value="${esc(fin)}"></label></div>`;
  }
  const libre = LIBRES.has(tipo);
  return `<h2 id="anuDlgT">${esc(TEXTO[tipo])}</h2><p class="anu-dobj">${esc(NIVEL[f.nivel].replace(/^la |^el /, '').replace(/^./, c => c.toUpperCase()))} «${esc(nombre(f))}»</p>
    <form class="anu-dform" data-form="${tipo}" novalidate>${campos}
    <p class="anu-derr" id="anuDlgErr" role="alert">${esc(error)}</p>
    <div class="anu-acts"><button type="submit" class="anu-btn pri">${libre ? esc(TEXTO[tipo]) : 'Ver lo que gasta'}</button><button type="button" class="anu-btn" data-dlg="cancelar">Cancelar</button></div>
    ${libre ? '<p class="anu-ayuda">Baja el gasto: se hace con este clic.</p>' : '<p class="anu-ayuda">Todavía no cambia nada: el siguiente paso te dice la cifra y te pide el «Sí».</p>'}</form>`;
}
/** El segundo clic: el texto del servidor, las cifras, el aviso (antes del «Sí», sin bloquearlo) y el botón con la cifra. */
export function confirmarHTML(f, tipo, confirmar, { moneda = 'USD', aviso = '', ahora = Date.now() } = {}) {
  const v = confirmar?.vence ? (typeof confirmar.vence === 'number' ? confirmar.vence : Date.parse(confirmar.vence)) : NaN;
  const vencido = !Number.isNaN(v) && v <= ahora, quedan = Number.isNaN(v) ? null : Math.max(0, Math.round((v - ahora) / 1000));
  const rev = f && /PENDING_REVIEW|IN_PROCESS/.test(clave(f.nodo)) ? '<p class="anu-ayuda">Está en revisión: se activa igual y empieza a salir cuando Meta lo apruebe.</p>' : '';
  return `<h2 id="anuDlgT">¿${esc(TEXTO[tipo] || 'Aplicar')}? Esto gasta</h2>${f ? `<p class="anu-dobj">«${esc(nombre(f))}»</p>` : ''}${confirmar?.cuenta || f?.nodo?.cuentaTexto ? `<p class="anu-dcuenta" data-cuenta-confirmar>En: <b>${esc(confirmar?.cuenta || f.nodo.cuentaTexto)}</b></p>` : ''}
    <p class="anu-dtexto">${esc(confirmar?.texto || '')}</p>${cifrasConfirmarHTML(confirmar?.cifras, moneda)}
    ${aviso ? `<p class="anu-daviso" role="note"><b>Antes de decir que sí</b><span>${esc(aviso)}</span></p>` : ''}${rev}
    ${vencido ? '<p class="anu-derr" role="alert">Venció: vuelve a pedirlo.</p><div class="anu-acts"><button type="button" class="anu-btn pri" data-dlg="otra">Pedirlo otra vez</button><button type="button" class="anu-btn" data-dlg="cancelar">Cancelar</button></div>'
      : `<div class="anu-acts"><button type="button" class="anu-btn si" data-dlg="si">${esc(botonSi(tipo, confirmar, moneda))}</button><button type="button" class="anu-btn" data-dlg="cancelar">Cancelar</button></div>
      <p class="anu-ayuda anu-vence">${quedan == null ? '' : `Esta confirmación vale ${quedan >= 60 ? `${Math.floor(quedan / 60)} min ${String(quedan % 60).padStart(2, '0')} s` : `${quedan} s`}; luego hay que volver a pedirla.`}</p>`}`;
}
/** Un error del servidor (o de la demo) en palabras: el tope con su cifra, lo que dijo Meta (con el mínimo), lo vencido. */
export function errorHTML(f, tipo, r = {}, { moneda = 'USD' } = {}) {
  const tit = r.error === 'tope' ? 'No cabe en tus topes' : r.error === 'meta' ? 'Meta no lo aceptó' : r.error === 'confirmacion' ? 'Venció: vuelve a pedirlo' : r.status === 403 ? 'Esto no se puede desde aquí' : 'No se pudo';
  const extra = r.error === 'tope' ? `<dl class="anu-ccif">${r.tope != null ? `<div><dt>Tu tope</dt><dd>${esc(dinero(r.tope, moneda))}</dd></div>` : ''}${r.quedaria != null ? `<div><dt>Quedaría en</dt><dd>${esc(dinero(r.quedaria, moneda))}</dd></div>` : ''}</dl><p class="anu-ayuda">No hay atajo: si quieres gastar más, sube el tope en Ajustes → Anuncios.</p>` : '';
  const min = r.error === 'meta' && Number(r.minimo) > 0 ? `<button type="button" class="anu-btn pri" data-dlg="minimo" data-minimo="${esc(r.minimo)}">Poner el mínimo (${esc(dinero(r.minimo, moneda))})</button>` : '';
  const otra = r.error === 'confirmacion' ? '<button type="button" class="anu-btn pri" data-dlg="otra">Pedirlo otra vez</button>' : '';
  return `<h2 id="anuDlgT">${esc(tit)}</h2>${f ? `<p class="anu-dobj">${esc(TEXTO[tipo] || tipo)} «${esc(nombre(f))}»</p>` : ''}
    <p class="anu-derr" role="alert">${esc(r.motivo || r.mensaje || 'La oficina no contestó.')}</p>${extra}<p class="anu-ayuda">No cambió nada.</p>
    <div class="anu-acts">${min}${otra}<button type="button" class="anu-btn" data-dlg="cancelar">Cerrar</button></div>`;
}
