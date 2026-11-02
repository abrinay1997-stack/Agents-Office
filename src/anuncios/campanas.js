// La pestaña CAMPAÑAS (Fase A1): una tabla que se despliega campaña → conjunto → anuncio, con rango, filtros y orden. El NOMBRE de
// cada fila es el botón que abre su detalle al lado; el triángulo de al lado (otro botón, nunca uno dentro de otro) la despliega. En una
// vista estrecha la tabla se lee como tarjetas (src/css/anuncios.css, @container): cada celda lleva su rótulo en data-l.
// Fase A2 (9 oct 2026): la columna «Acción» con el interruptor (Pausar un clic; Activar/Reanudar con los dos clics) y el «⋯» del menú.
import { esc, dinero, pct, frec, fechaCorta, leyendaRango, estadoDe, aprendizajeDe, chip, resultados, presupuesto, tieneProblemas, esActiva, esPausada, svg, SIN, cuentaChip, selectorCuentaHTML } from './comun.js';
import { filtrarVista } from '../../anuncios/cuentas.mjs';
import { controlesHTML } from './acciones.js';

export const RANGOS = [['hoy', 'Hoy'], ['7d', '7 días'], ['30d', '30 días'], ['mes', 'Este mes']];
export const FILTROS = [['todas', 'Todas'], ['activas', 'Activas'], ['pausa', 'En pausa'], ['problemas', 'Con problemas']];
export const ORDENES = [['gasto', 'Más gasto'], ['resultados', 'Más resultados'], ['costo', 'Menor costo por resultado'], ['ctr', 'Mayor CTR de enlace'], ['frecuencia', 'Mayor frecuencia'], ['nombre', 'Nombre'], ['fin', 'Termina antes']];
export const nombreRango = r => (RANGOS.find(([k]) => k === r) || RANGOS[1])[1];

export function filtrar(campanas = [], filtro = 'todas') {
  if (filtro === 'activas') return campanas.filter(esActiva);
  if (filtro === 'pausa') return campanas.filter(esPausada);
  if (filtro === 'problemas') return campanas.filter(tieneProblemas);
  return campanas.slice();
}

const valor = (n, clave) => {
  if (clave === 'nombre') return String(n.nombre || '').toLocaleLowerCase('es');
  if (clave === 'fin') { const t = n.fin ? Date.parse(n.fin) : NaN; return Number.isNaN(t) ? null : t; }
  const c = n.cifras || {}, v = clave === 'costo' ? c.costoPorResultado : c[clave];
  return v == null || !Number.isFinite(Number(v)) ? null : Number(v);
};
const SUBE = { nombre: true, costo: true, fin: true }; // las que se leen de menor a mayor
/** Ordena una lista (y, por dentro, sus conjuntos y anuncios con la misma regla). Lo que no se sabe va siempre al final. */
export function ordenar(lista = [], clave = 'gasto') {
  const asc = !!SUBE[clave];
  const cmp = (a, b) => {
    const x = valor(a, clave), y = valor(b, clave);
    if (x == null && y == null) return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');
    if (x == null) return 1; if (y == null) return -1;
    if (x === y) return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');
    return (typeof x === 'string' ? x.localeCompare(y, 'es') : x - y) * (asc ? 1 : -1);
  };
  return lista.slice().sort(cmp).map(n => (n.conjuntos ? { ...n, conjuntos: ordenar(n.conjuntos, clave) } : n.anuncios ? { ...n, anuncios: ordenar(n.anuncios, clave) } : n));
}

/** Campañas → filas a la vista: cada campaña, y debajo de la que está abierta sus conjuntos, y debajo del abierto sus anuncios. */
export function aplanar(campanas = [], abiertos = new Set()) {
  const filas = [];
  for (const c of campanas) {
    const hc = (c.conjuntos || []).length, ac = abiertos.has(c.id);
    filas.push({ nivel: 'campana', id: c.id, nodo: c, campana: c, hijos: hc, abierto: ac && hc > 0 });
    if (!ac) continue;
    for (const j of c.conjuntos || []) {
      const ha = (j.anuncios || []).length, aj = abiertos.has(j.id);
      filas.push({ nivel: 'conjunto', id: j.id, nodo: j, campana: c, conjunto: j, hijos: ha, abierto: aj && ha > 0 });
      if (!aj) continue;
      for (const a of j.anuncios || []) filas.push({ nivel: 'anuncio', id: a.id, nodo: a, campana: c, conjunto: j, hijos: 0, abierto: false });
    }
  }
  return filas;
}
/** Busca un id en el árbol → la fila con sus padres (para el detalle), o null */
export function buscar(campanas = [], id) {
  for (const c of campanas) {
    if (c.id === id) return { nivel: 'campana', id, nodo: c, campana: c };
    for (const j of c.conjuntos || []) {
      if (j.id === id) return { nivel: 'conjunto', id, nodo: j, campana: c, conjunto: j };
      for (const a of j.anuncios || []) if (a.id === id) return { nivel: 'anuncio', id, nodo: a, campana: c, conjunto: j };
    }
  }
  return null;
}

const NIVEL = { campana: 'Campaña', conjunto: 'Conjunto', anuncio: 'Anuncio' };
/** El aprendizaje de una campaña es el de sus conjuntos: uno solo se dice; varios, cuántos aprenden. */
function aprendizajeCampana(c) {
  const js = (c.conjuntos || []).filter(j => j.aprendizaje?.estado);
  if (!js.length) return { texto: SIN, tono: 'gris' };
  if (js.length === 1) return aprendizajeDe(js[0].aprendizaje);
  const n = js.filter(j => j.aprendizaje.estado === 'LEARNING').length, f = js.filter(j => j.aprendizaje.estado === 'FAIL').length;
  return n ? { texto: `${n} de ${js.length} aprendiendo`, tono: 'ambar' } : f ? { texto: `${f} limitado${f === 1 ? '' : 's'}`, tono: 'rojo' } : { texto: 'Fuera del aprendizaje', tono: 'verde' };
}

export function filaHTML(f, moneda, { sel, ahora = Date.now() } = {}) {
  const n = f.nodo, c = n.cifras || {}, e = estadoDe(n), problemas = tieneProblemas(n);
  const ap = f.nivel === 'campana' ? aprendizajeCampana(n) : f.nivel === 'conjunto' ? aprendizajeDe(n.aprendizaje) : { texto: SIN, tono: 'gris' };
  const pres = f.nivel === 'anuncio' ? SIN : presupuesto(n.presupuesto, moneda);
  const fin = f.nivel === 'campana' ? fechaCorta(n.fin, 'sin fin') : SIN;
  const tog = f.hijos ? `<button type="button" class="anu-tog" data-tog="${esc(f.id)}" aria-expanded="${f.abierto}" aria-label="${f.abierto ? 'Plegar' : 'Desplegar'} ${f.nivel === 'campana' ? 'los conjuntos' : 'los anuncios'} de «${esc(n.nombre)}»">${svg(f.abierto ? 'menos' : 'mas')}</button>` : '<span class="anu-tog-hueco" aria-hidden="true"></span>';
  const marcas = `${cuentaChip(n)}${n.creadoFuera ? chip('creado fuera', 'gris') : ''}${problemas && e.tono !== 'rojo' ? chip('pide atención', 'rojo') : ''}`;
  return `<tr class="anu-fila n-${f.nivel}${sel === f.id ? ' sel' : ''}" data-fila="${esc(f.id)}">
    <th scope="row" class="anu-cn" data-l="${NIVEL[f.nivel]}"><span class="anu-nom">${tog}<span class="anu-nomt"><span class="anu-nivel">${NIVEL[f.nivel]}</span><button type="button" class="anu-abrir" data-abrir="${esc(f.id)}"${sel === f.id ? ' aria-current="true"' : ''}>${esc(n.nombre || '(sin nombre)')}</button>${marcas ? `<span class="anu-marcas">${marcas}</span>` : ''}</span></span></th>
    <td data-l="Acción" class="anu-cacc">${controlesHTML(f, ahora) || `<span class="anu-sinacc">${SIN}</span>`}</td>
    <td data-l="Estado">${chip(e.texto, e.tono)}</td>
    <td data-l="Aprendizaje">${ap.texto === SIN ? SIN : chip(ap.texto, ap.tono)}</td>
    <td data-l="Presupuesto" class="anu-n">${esc(pres)}</td>
    <td data-l="Gasto" class="anu-n">${esc(dinero(c.gasto, moneda))}</td>
    <td data-l="Resultados" class="anu-n">${esc(resultados(c))}</td>
    <td data-l="Costo por resultado" class="anu-n">${esc(dinero(c.costoPorResultado, moneda))}</td>
    <td data-l="CTR de enlace" class="anu-n">${esc(pct(c.ctr))}</td>
    <td data-l="Frecuencia" class="anu-n">${esc(frec(c.frecuencia))}</td>
    <td data-l="Fin">${esc(fin)}</td></tr>`;
}

export function barraHTML({ rango, filtro, orden, cuentas = {}, selCuenta = '' }) {
  const seg = (lista, actual, attr, label) => `<div class="anu-seg" role="group" aria-label="${label}">${lista.map(([k, n]) => `<button type="button" data-${attr}="${k}" aria-pressed="${k === actual}">${esc(n)}${cuentas[k] != null && attr === 'filtro' ? ` <b class="anu-cuenta">${cuentas[k]}</b>` : ''}</button>`).join('')}</div>`;
  return `<div class="anu-barra">${seg(RANGOS, rango, 'rango', 'Rango de fechas')}${seg(FILTROS, filtro, 'filtro', 'Qué campañas')}
    ${selCuenta}<label class="anu-sel"><span>Ordenar</span><select data-orden>${ORDENES.map(([k, n]) => `<option value="${k}"${k === orden ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label></div>`;
}

export function campanasHTML(d0, { rango = '7d', filtro = 'todas', orden = 'gasto', abiertos = new Set(), sel = null, ahora = Date.now(), cuenta = 'todas' } = {}) {
  const d = filtrarVista(d0, cuenta), todas = d?.campanas || [], moneda = d?.cuenta?.moneda || 'USD', selCuenta = selectorCuentaHTML(d0, cuenta);
  const cuentas = Object.fromEntries(FILTROS.map(([k]) => [k, filtrar(todas, k).length]));
  const lista = ordenar(filtrar(todas, filtro), orden), filas = aplanar(lista, abiertos);
  const vacio = !todas.length ? '<div class="anu-vacio"><b>No hay campañas en esta cuenta</b><span>Cuando haya alguna (creada aquí o en el Administrador de anuncios de Meta), aparece aquí con sus cifras.</span></div>'
    : !lista.length ? `<div class="anu-vacio"><b>Ninguna campaña ${esc((FILTROS.find(([k]) => k === filtro) || [])[1]?.toLowerCase() || '')}</b><span>Prueba con otro filtro.</span></div>` : '';
  return `${barraHTML({ rango, filtro, orden, cuentas, selCuenta })}
    ${leyendaRango(d)}
    <p class="anu-ayuda">Cifras de ${esc(nombreRango(rango).toLowerCase())}, en ${esc(moneda)}. Pulsa el nombre para ver el detalle; el triángulo despliega lo de dentro. Pausar es de un clic; lo que gasta te pide un segundo clic con la cifra.</p>
    ${vacio || `<div class="anu-tabla-caja"><table class="anu-tabla"><caption class="anu-sr">Campañas, conjuntos y anuncios con sus cifras de ${esc(nombreRango(rango).toLowerCase())}</caption>
      <thead><tr><th scope="col">Nombre</th><th scope="col">Acción</th><th scope="col">Estado</th><th scope="col">Aprendizaje</th><th scope="col" class="anu-n">Presupuesto</th><th scope="col" class="anu-n">Gasto</th><th scope="col" class="anu-n">Resultados</th><th scope="col" class="anu-n">Costo por resultado</th><th scope="col" class="anu-n">CTR de enlace</th><th scope="col" class="anu-n">Frecuencia</th><th scope="col">Fin</th></tr></thead>
      <tbody>${filas.map(f => filaHTML(f, moneda, { sel, ahora })).join('')}</tbody></table></div>`}`;
}
