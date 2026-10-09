// La pestaña SUGERENCIAS (Fase A5, 9 oct 2026; plan §5 A5, §7 y §8.5). Puro: lo usan la vista, la demo y tests/anuncios-vista.test.mjs.
// El DIAGNÓSTICO es del servidor (anuncios/diagnostico.mjs: GET /api/anuncios/sugerencias); aquí solo se pinta cada sugerencia con su
// regla en palabras, el objeto (su nombre abre el detalle en Campañas), EL DATO que la motiva, EL PORQUÉ, EL CAMBIO exacto, EL EFECTO
// esperado y EL RIESGO («reinicia el aprendizaje», «gasta más: pide tus dos clics»), y sus botones: «Aplicar» (si gasta, «Aplicar — pide
// tus dos clics»: el servidor devuelve { confirmar } y la ventana del segundo clic de la A2 dice la cifra), «Descartar» (no vuelve en 7
// días) y «Recordármelo en 3 días». «Está aprendiendo: no tocar» es una tarjeta informativa, sin «Aplicar». Lo descartado se ESCRIBE
// («Descartada»), nunca se atenúa. En el Resumen van las 3 vivas más importantes (resumenSugerenciasHTML).
import { esc, dinero, chip, fechaCorta, haceCuanto } from './comun.js';
import { GASTO } from './acciones.js';

export const REGLA = {
  aprendizaje: 'Está aprendiendo: mejor no tocarlo', limitado: 'Aprendizaje limitado', esperar: 'Todavía es pronto para juzgar', cortar: 'Gasta sin resultados',
  fatiga: 'El creativo se está cansando', escalar: 'Va bien: se puede escalar', estructura: 'Demasiados conjuntos parecidos', rechazado: 'Anuncio rechazado',
  problemas: 'Con problemas en Meta', cuenta: 'La cuenta pide atención', impulsar: 'Una publicación que vale la pena impulsar',
};
export const reglaTexto = r => REGLA[r] || String(r || 'Sugerencia');
const NIVEL = { campana: 'Campaña', conjunto: 'Conjunto', anuncio: 'Anuncio', cuenta: 'Cuenta', publicacion: 'Publicación' };
const PRIO = { 1: ['Prioridad alta', 'rojo'], 2: ['Prioridad media', 'ambar'], 3: ['Prioridad baja', 'gris'] };
export const FILTROS_SUG = [['viva', 'Vivas'], ['aplicada', 'Aplicadas'], ['descartada', 'Descartadas']];
/** Los cambios que GASTAN (lo que pide los dos clics): los de la A2 más impulsar (A4). El servidor manda `gasto`; esto lo completa. */
const GASTA = new Set([...GASTO, 'impulsar']);

/** ¿Solo informa? «Aprendiendo, no tocar» y «todavía es pronto» no tienen nada que aplicar. */
export const informativa = s => s?.regla === 'aprendizaje' || s?.regla === 'esperar' || !s?.cambio?.tipo;
/** ¿Aplicarla gasta? (lo dice el servidor con `gasto`, o el riesgo, o el tipo de cambio) */
export const gastaSug = s => !!(s?.gasto || s?.riesgo?.gastaMas || GASTA.has(s?.cambio?.tipo));

/**
 * El botón principal de una sugerencia → { texto, gasta, abre } o null (las informativas no tienen). Si gasta, lo dice: «Aplicar — pide tus
 * dos clics». «revisar» no cambia nada: abre el detalle del objeto («Ver qué pasa»).
 */
export function botonAplicar(s) {
  if (!s || informativa(s) || s.estado !== 'viva') return null;
  const t = s.cambio.tipo;
  if (t === 'revisar') return { texto: 'Ver qué pasa', gasta: false, abre: true };
  if (gastaSug(s)) return { texto: 'Aplicar — pide tus dos clics', gasta: true, abre: false };
  if (t === 'borrador') return { texto: 'Aplicar — deja un borrador', gasta: false, abre: false };
  if (t === 'creativos') return { texto: 'Aplicar — pide variaciones', gasta: false, abre: false };
  return { texto: 'Aplicar', gasta: false, abre: false };
}

const ts = v => { const t = Date.parse(v || ''); return Number.isNaN(t) ? 0 : t; };
/** Ordena: prioridad (1 primero), lo que se puede aplicar antes que lo informativo, lo más nuevo antes. */
export function ordenarSugerencias(items = []) {
  return items.slice().sort((a, b) => (Number(a.prioridad) || 3) - (Number(b.prioridad) || 3) || informativa(a) - informativa(b)
    || ts(b.aplicadaAt || b.descartadaAt || b.creadaAt) - ts(a.aplicadaAt || a.descartadaAt || a.creadaAt) || String(a.id).localeCompare(String(b.id)));
}
/** Las de un filtro, en orden. 'viva' no incluye las pospuestas (van aparte, «Para más tarde»). */
export const deEstado = (items = [], estado = 'viva') => ordenarSugerencias(items.filter(s => (s.estado || 'viva') === estado));
/** Las `n` vivas más importantes para el Resumen: primero las que se pueden aplicar; las informativas solo si no llegan. */
export function topResumen(items = [], n = 3) {
  const v = deEstado(items, 'viva');
  return [...v.filter(s => !informativa(s)), ...v.filter(informativa)].slice(0, n);
}
export const cuentas = (items = []) => Object.fromEntries([...FILTROS_SUG.map(([k]) => k), 'pospuesta'].map(k => [k, items.filter(s => (s.estado || 'viva') === k).length]));

/** El cambio exacto en palabras. `f` (opcional) es la fila de Campañas del objeto: da el presupuesto de ahora para decir «de … a …». */
export function cambioTexto(s, { moneda = 'USD', f = null } = {}) {
  const c = s?.cambio || {}, nom = `«${s?.objeto?.nombre || f?.nodo?.nombre || 'esto'}»`, p = f?.nodo?.presupuesto || f?.conjunto?.presupuesto || f?.campana?.presupuesto;
  const cuanto = v => `${dinero(v, moneda)}${p?.tipo === 'total' ? ' en total' : ' al día'}`;
  const pc = v => (p?.usd > 0 && Number(v) > 0 ? ` (${Number(v) > p.usd ? '+' : '−'}${Math.round(Math.abs(Number(v) / p.usd - 1) * 100)} %)` : '');
  switch (c.tipo) {
    case 'pausar': return `Pausar ${nom}. Baja el gasto: es de un clic y se puede deshacer.`;
    case 'bajar_presupuesto': return c.valor != null ? `Bajar el presupuesto de ${nom}${p ? ` de ${cuanto(p.usd)}` : ''} a ${cuanto(c.valor)}${pc(c.valor)}.` : `Bajar el presupuesto de ${nom}.`;
    case 'subir_presupuesto': return c.valor != null ? `Subir el presupuesto de ${nom}${p ? ` de ${cuanto(p.usd)}` : ''} a ${cuanto(c.valor)}${pc(c.valor)}.` : `Subir el presupuesto de ${nom}.`;
    case 'relanzar': return `Relanzar ${nom}: se duplica EN PAUSA con fechas nuevas y la activas tú después.`;
    case 'borrador': return `Preparar un borrador con el texto corregido para ${nom}. No se crea nada en Meta hasta que lo pidas.`;
    case 'creativos': return `Pedir variaciones del creativo de ${nom} a tu agente de anuncios; las imágenes te llegan con la tarjeta de costo del Estudio.`;
    case 'revisar': return `Mirar lo que dice Meta en el detalle de ${nom}. No cambia nada.`;
    case 'impulsar': return `Impulsar la publicación ${nom} (gasta: te pedirá los dos clics).`;
    case 'activar': case 'reanudar': return `${c.tipo === 'activar' ? 'Activar' : 'Reanudar'} ${nom} (gasta: te pedirá los dos clics).`;
    case 'alargar': return `Alargar ${nom}${c.fin ? ` hasta el ${fechaCorta(c.fin)}` : ''} (gasta: te pedirá los dos clics).`;
    default: return c.tipo ? `${c.tipo.replace(/_/g, ' ')} ${nom}.` : 'Nada que cambiar: es para que lo sepas.';
  }
}

/** El riesgo: chips escritos y el texto del servidor. */
export function riesgoHTML(s) {
  const r = s?.riesgo || {}, ch = [];
  if (r.reiniciaAprendizaje) ch.push(chip('reinicia el aprendizaje', 'ambar'));
  if (gastaSug(s)) ch.push(chip('gasta más: pide tus dos clics', 'ambar'));
  if (!ch.length && !informativa(s)) ch.push(chip(s?.cambio?.tipo === 'revisar' ? 'no cambia nada' : 'no sube el gasto', 'verde'));
  return `${ch.length ? `<span class="anu-tchips">${ch.join('')}</span>` : ''}${r.texto ? `<span>${esc(r.texto)}</span>` : informativa(s) ? '<span>Ninguno: no hay nada que aplicar.</span>' : ''}`;
}

const estadoChip = (s, ahora) => {
  const e = s.estado || 'viva';
  if (e === 'aplicada') return chip(`Aplicada${s.aplicadaAt ? ' ' + (haceCuanto(s.aplicadaAt, ahora) || '') : ''}`.trim(), 'verde');
  if (e === 'descartada') return chip('Descartada: no vuelve en 7 días', 'gris');
  if (e === 'pospuesta') return chip(s.hasta ? `Pospuesta hasta el ${fechaCorta(s.hasta)}` : 'Pospuesta 3 días', 'gris');
  return '';
};
const objetoHTML = (s, existe) => {
  const o = s.objeto || {}, nivel = NIVEL[o.nivel] || '';
  const nom = esc(o.nombre || '(sin nombre)');
  return `${nivel ? `<span class="anu-nivel">${esc(nivel)}</span> ` : ''}${o.id && existe(o.id) ? `<button type="button" class="anu-abrir" data-sobj="${esc(o.id)}" aria-label="Ver ${esc(nivel.toLowerCase() || 'el objeto')} «${esc(o.nombre || '')}» en Campañas">${nom}</button>` : `<b>${nom}</b>`}`;
};
const dl = (k, v) => (v ? `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>` : '');

/** Los botones de una sugerencia viva (Aplicar · Descartar · Recordármelo en 3 días). Nunca uno dentro de otro. */
export function botonesSugHTML(s, { compacto = false } = {}) {
  if ((s.estado || 'viva') !== 'viva') return '';
  const b = botonAplicar(s), nom = esc(s.objeto?.nombre || '');
  const ap = b ? `<button type="button" class="anu-btn ${b.gasta ? 'gasta' : 'pri'}" data-sapl="${esc(s.id)}" aria-label="${esc(b.texto)}: ${esc(reglaTexto(s.regla).toLowerCase())}, «${nom}»">${esc(b.texto)}</button>` : '';
  if (compacto) return `<div class="anu-acts">${ap}</div>`;
  return `<div class="anu-acts">${ap}<button type="button" class="anu-btn" data-sdesc="${esc(s.id)}" aria-label="Descartar la sugerencia sobre «${nom}» (no vuelve en 7 días)">Descartar</button><button type="button" class="anu-btn" data-spos="${esc(s.id)}" aria-label="Recordármelo en 3 días: «${nom}»">Recordármelo en 3 días</button></div>`;
}

/** Una tarjeta. `buscarFila(id)` → la fila de Campañas (para el nombre que abre y el presupuesto de ahora). */
export function tarjetaSugHTML(s, { moneda = 'USD', buscarFila = () => null, compacto = false, ahora = Date.now() } = {}) {
  const info = informativa(s), [pt, pc] = PRIO[s.prioridad] || PRIO[3], f = buscarFila(s.cambio?.id || s.objeto?.id), e = s.estado || 'viva';
  const cab = `<p class="anu-sug-regla"><span class="anu-sug-prio t-${info ? 'azul' : pc}">${info ? 'Para saber' : esc(pt)}</span><b>${esc(reglaTexto(s.regla))}</b></p>`;
  const obj = `<h3 class="anu-sug-obj">${objetoHTML(s, id => !!buscarFila(id))}</h3>`;
  const est = estadoChip(s, ahora);
  if (compacto) return `<li class="anu-sug${info ? ' info' : ''}" data-sug="${esc(s.id)}">${cab}${obj}<dl class="anu-sug-dl">${dl('El dato', esc(s.dato))}${dl('El cambio', esc(cambioTexto(s, { moneda, f })))}</dl>${botonesSugHTML(s, { compacto: true })}</li>`;
  const despues = e === 'aplicada' ? dl('Qué pasó después', esc(s.resultado || 'Todavía no se sabe: se mide en los 7 días siguientes a aplicarla.')) : '';
  return `<li class="anu-sug${info ? ' info' : ''} e-${esc(e)}" data-sug="${esc(s.id)}">${cab}${obj}${est ? `<p class="anu-tchips">${est}</p>` : ''}
    <dl class="anu-sug-dl">${dl('El dato', esc(s.dato))}${dl('Por qué', esc(s.porque))}${dl(info ? 'Qué hacer' : 'El cambio', esc(info ? (s.efecto || 'Nada por ahora: déjalo trabajar.') : cambioTexto(s, { moneda, f })))}${info ? '' : dl('Qué se espera', esc(s.efecto))}${dl('El riesgo', riesgoHTML(s))}${despues}</dl>
    ${botonesSugHTML(s)}</li>`;
}

/** La pestaña entera. `r`: lo de GET /api/anuncios/sugerencias ({ items, cpaObjetivo, sinObjetivo }), o null mientras carga. */
export function sugerenciasHTML(r, { filtro = 'viva', moneda = 'USD', buscarFila = () => null, error = '', ahora = Date.now() } = {}) {
  const cab = `<div class="anu-bcab"><h2 id="anuSugT">Sugerencias</h2></div>
    <p class="anu-ayuda">La oficina revisa tus cifras después de cada lectura de Meta y te dice qué cambiaría, con el dato, el porqué y el riesgo. Lo que baja el gasto se aplica con un clic (y se puede deshacer); lo que gasta te pide tus dos clics con la cifra, y nunca pasa de tus topes.</p>`;
  if (error) return `${cab}<p class="anu-aviso-error" role="alert">No se pudieron traer las sugerencias: ${esc(error)} <button type="button" class="anu-btn" data-a="recargar-s">Reintentar</button></p>`;
  if (!r) return `${cab}<p class="anu-cargando">Cargando…</p>`;
  const items = r.items || [], n = cuentas(items);
  const sinObj = r.sinObjetivo ? `<p class="anu-daviso anu-sinobj" role="note"><b>Falta un dato</b><span>${esc(r.sinObjetivo)}</span><span>Ponlo en Ajustes → Anuncios → «Costo por resultado que te parece bueno».</span><button type="button" class="anu-btn" data-a="ajustes">Abrir Ajustes → Anuncios</button></p>` : '';
  const seg = `<div class="anu-barra"><div class="anu-seg" role="group" aria-label="Qué sugerencias ver">${FILTROS_SUG.map(([k, t]) => `<button type="button" data-sfiltro="${k}" aria-pressed="${k === filtro}">${esc(t)} <b class="anu-cuenta">${n[k]}</b></button>`).join('')}</div></div>`;
  const l = deEstado(items, filtro), o = { moneda, buscarFila, ahora };
  const vacio = { viva: ['Nada que mejorar ahora', 'Cuando las cifras pidan un cambio, aparece aquí con su dato y su riesgo.'], aplicada: ['Todavía no aplicaste ninguna', 'Lo que apliques queda aquí, con lo que pasó en los 7 días siguientes.'], descartada: ['No descartaste ninguna', 'Lo descartado no vuelve en 7 días.'] }[filtro] || ['Nada', ''];
  const lista = l.length ? `<ul class="anu-sugs" aria-labelledby="anuSugT">${l.map(s => tarjetaSugHTML(s, o)).join('')}</ul>` : `<div class="anu-vacio"><b>${esc(vacio[0])}</b><span>${esc(vacio[1])}</span></div>`;
  const pos = filtro === 'viva' ? deEstado(items, 'pospuesta') : [];
  const mas = pos.length ? `<h3 class="anu-sug-luego" id="anuSugLuego">Para más tarde <span class="anu-cuenta">${pos.length}</span></h3><ul class="anu-sugs" aria-labelledby="anuSugLuego">${pos.map(s => tarjetaSugHTML(s, o)).join('')}</ul>` : '';
  return `${cab}${sinObj}${seg}${lista}${mas}`;
}

/** El bloque del Resumen: las 3 vivas más importantes y «Ver todas». Sin respuesta del servidor, no se pinta. */
export function resumenSugerenciasHTML(r, { moneda = 'USD', buscarFila = () => null, ahora = Date.now() } = {}) {
  if (!r || !Array.isArray(r.items)) return '';
  const top = topResumen(r.items, 3), n = cuentas(r.items).viva;
  return `<section class="anu-sec anu-sec-sug" aria-labelledby="anuSugR"><div class="anu-bcab"><h2 id="anuSugR">Sugerencias <span class="anu-cuenta">${n}</span></h2><button type="button" class="anu-btn" data-ir="sugerencias">Ver todas</button></div>
    ${top.length ? `<ul class="anu-sugs mini">${top.map(s => tarjetaSugHTML(s, { moneda, buscarFila, compacto: true, ahora })).join('')}</ul>` : '<p class="anu-ayuda">Nada que mejorar ahora: la oficina vuelve a mirar tus cifras después de cada lectura de Meta.</p>'}</section>`;
}
