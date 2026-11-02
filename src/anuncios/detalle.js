// El DETALLE de una campaña, un conjunto o un anuncio (Fase A1), al lado de la tabla: dónde está, su estado en palabras, el aprendizaje,
// el presupuesto, el público, el creativo (miniatura, texto, titular, llamada), lo que dijo la revisión de Meta y las cifras del rango.
// La miniatura viene de Meta (o del ejemplo); si no carga, queda el texto. Fase A2: sus acciones, como botones a la vista.
import { accionesBotonesHTML } from './acciones.js';
import { esc, dinero, pct, num, frec, fechaCorta, estadoDe, aprendizajeDe, chip, resultados, presupuesto, svg, SIN } from './comun.js';
import { nombreRango } from './campanas.js';

const NIVEL = { campana: 'Campaña', conjunto: 'Conjunto de anuncios', anuncio: 'Anuncio' };
const dato = (k, v) => `<div class="anu-dato"><dt>${esc(k)}</dt><dd>${v}</dd></div>`;

export function cifrasHTML(c = {}, moneda) {
  const L = [['Gasto', dinero(c.gasto, moneda)], ['Resultados', resultados(c)], ['Costo por resultado', dinero(c.costoPorResultado, moneda)], ['Impresiones', num(c.impresiones)], ['Alcance', num(c.alcance)],
    ['Frecuencia', frec(c.frecuencia)], ['Clics (todos)', num(c.clics)], ['Clics al enlace', num(c.clicsEnlace)], ['CTR de enlace', pct(c.ctr)], ['CTR (todos los clics)', pct(c.ctrTodos)], ['CPC de enlace', dinero(c.cpc, moneda)], ['CPC (todos los clics)', dinero(c.cpcTodos, moneda)], ['CPM', dinero(c.cpm, moneda)]];
  return `<dl class="anu-cifras">${L.map(([k, v]) => dato(k, esc(v))).join('')}</dl>`;
}

function publicoHTML(p) {
  if (!p) return SIN;
  if (typeof p === 'string') return esc(p);
  if (Array.isArray(p)) return p.map(esc).join(' · ') || SIN;
  const partes = [];
  if (p.texto) partes.push(esc(p.texto));
  if (p.lugares?.length) partes.push(esc(p.lugares.join(', ')));
  if (p.edad) partes.push(esc(`${p.edad.min ?? 18}–${p.edad.max ?? '65+'} años`));
  if (p.advantage) partes.push('público Advantage+');
  if (p.intereses?.length) partes.push(esc('intereses: ' + p.intereses.join(', ')));
  return partes.join(' · ') || SIN;
}

export function detalleHTML(f, { moneda = 'USD', rango = '7d', ahora = Date.now() } = {}) {
  if (!f) return '<p class="anu-vacio">No encuentro eso: puede que Meta ya no lo devuelva.</p>';
  const n = f.nodo, e = estadoDe(n), ruta = [f.nivel !== 'campana' ? `Campaña «${esc(f.campana.nombre)}»` : '', f.nivel === 'anuncio' ? `Conjunto «${esc(f.conjunto.nombre)}»` : ''].filter(Boolean).join(' › ');
  const datos = [dato('Estado', chip(e.texto, e.tono))];
  if (f.nivel === 'campana') {
    datos.push(dato('Objetivo', esc(n.objetivoTexto || n.objetivo || SIN)), dato('Presupuesto', esc(presupuesto(n.presupuesto, moneda))), dato('Tope de la campaña', esc(n.spendCap != null ? dinero(n.spendCap, moneda) : 'sin tope')),
      dato('Empieza', esc(fechaCorta(n.inicio))), dato('Termina', esc(fechaCorta(n.fin, 'sin fin'))), dato('Conjuntos', esc(String((n.conjuntos || []).length))));
    if (n.creadoFuera) datos.push(dato('Origen', 'Creada fuera de la oficina (en el Administrador de anuncios)'));
  } else if (f.nivel === 'conjunto') {
    const ap = aprendizajeDe(n.aprendizaje);
    datos.push(dato('Aprendizaje', ap.texto === SIN ? SIN : chip(ap.texto, ap.tono)), dato('Optimiza para', esc(n.optimizacion || SIN)), dato('Destino', esc(n.destino || SIN)),
      dato('Presupuesto', esc(presupuesto(n.presupuesto, moneda))), dato('Público', publicoHTML(n.publico)), dato('Anuncios', esc(String((n.anuncios || []).length))));
  }
  let creativo = '', revision = '';
  if (f.nivel === 'anuncio') {
    const cr = n.creativo || {};
    creativo = `<section class="anu-dsec" aria-labelledby="anuDCr"><h3 id="anuDCr">El creativo</h3><figure class="anu-crea">${cr.miniatura ? `<img src="${esc(cr.miniatura)}" alt="Miniatura del anuncio «${esc(n.nombre)}»" loading="lazy" referrerpolicy="no-referrer">` : '<div class="anu-sinimg">Sin miniatura</div>'}
      <figcaption>${cr.titulo ? `<b>${esc(cr.titulo)}</b>` : ''}${cr.texto ? `<p>${esc(cr.texto)}</p>` : '<p>Sin texto.</p>'}${cr.llamada ? `<span class="anu-cta">${esc(cr.llamada)}</span>` : ''}</figcaption></figure></section>`;
    const rv = n.revision || [], pb = n.problemas || [];
    revision = `<section class="anu-dsec" aria-labelledby="anuDRv"><h3 id="anuDRv">Revisión de Meta</h3>${!rv.length && !pb.length ? '<p>Sin observaciones.</p>' : ''}
      ${rv.length ? `<p class="anu-mal-t">Lo que dijo la revisión:</p><ul class="anu-mal">${rv.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${pb.length ? `<p class="anu-mal-t">Problemas:</p><ul class="anu-mal">${pb.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</section>`;
  }
  else if ((n.problemas || []).length) revision = `<section class="anu-dsec" aria-labelledby="anuDRv"><h3 id="anuDRv">Problemas que marca Meta</h3><ul class="anu-mal">${n.problemas.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>`;
  return `<div class="anu-dh"><div><p class="anu-dnivel">${NIVEL[f.nivel]}${ruta ? ` · <span>${ruta}</span>` : ''}</p><h2 id="anuDTit">${esc(n.nombre || '(sin nombre)')}</h2></div>
      <button type="button" class="anu-icb" data-cerrardet aria-label="Cerrar el detalle" title="Cerrar (Esc)">${svg('x')}</button></div>
    <dl class="anu-datos">${datos.join('')}</dl>${accionesBotonesHTML(f, ahora)}${creativo}${revision}
    <section class="anu-dsec" aria-labelledby="anuDCi"><h3 id="anuDCi">Cifras de ${esc(nombreRango(rango).toLowerCase())}</h3>${cifrasHTML(n.cifras, moneda)}</section>
    <p class="anu-ayuda">Id de Meta: <code>${esc(n.id)}</code></p>`;
}
