// El ASISTENTE de 5 pasos para crear una campaña (Fase A3, 9 oct 2026; plan §5.A3, §8.3 y §12). Va en la pestaña Borradores, a toda la
// vista en el teléfono. Cada cambio se guarda solo (PATCH a los 500 ms); el paso 3 pide `validar` para el costo máximo en palabras;
// el 4 elige de la galería o abre el Estudio «para el anuncio» (ctx.estudio, como «para la pieza» en Contenido) y pide al agente de
// anuncios una propuesta («✨ Mejorar», que nunca se pone sola: «Usar» o «Descartar»); el 5 revisa (un problema lleva a su paso y a su
// campo), enseña la vista previa de la oficina y, opcional, la de Meta (solo su <iframe> de facebook.com, con sandbox: nunca el HTML que
// manda Meta), y crea EN PAUSA con un clic (no gasta: activarla es otra cosa, con los dos clics de la A2).
// Lo puro (el HTML de cada paso) se exporta para tests/anuncios-vista.test.mjs; crearAsistente() es el que escucha y llama.
import { esc, svg } from './comun.js';
import { PASOS, OBJETIVOS, DESTINOS, LLAMADA, FORMATOS, MEJORAS, CATEGORIAS, PAISES, LARGO, MAX_CREATIVOS, MIN_RECOMENDADO, UBICACIONES_META,
  objetivoDe, llamadasDe, pasoDe, costoTexto, avisoSinFin, estadoB, editable, leer, poner, creativoNuevo, ajustarLlamadas, formatoDeMedidas, iframeMeta, deQuien, RED_ORIGEN, origenTexto } from './borrador.js';
import { listaBorradoresHTML, srcDe, esVideo, miniHTML } from './borradores.js';
import { previaHTML } from './vista-previa.js';

const idDe = bc => 'anuB-' + String(bc).replace(/[^a-zA-Z0-9]+/g, '-');
const normal = c => String(c || '').replace(/\[(\d+)\]/g, '.$1');
/** Los problemas de la última revisión, por campo: { 'publico.edadMin': 'texto', … } (el primero de cada campo). */
export function problemasPorCampo(b) {
  const m = {};
  for (const p of b?.validacion?.problemas || []) { const c = normal(p.campo) || '_'; if (!(c in m)) m[c] = p.texto; }
  return m;
}
/** Cuántos problemas caen en cada paso: [n0, n1, n2, n3, n4]. */
export function problemasPorPaso(b) {
  const n = PASOS.map(() => 0);
  for (const p of b?.validacion?.problemas || []) n[pasoDe(p.campo).paso]++;
  return n;
}

/* ---------- piezas ---------- */
function err(bc, P) { const t = P[bc]; return t ? `<p class="anu-berr" id="${idDe(bc)}-e">${esc(t)}</p>` : ''; }
function aria(bc, P, ayuda) { const ids = [ayuda ? idDe(bc) + '-a' : '', P[bc] ? idDe(bc) + '-e' : ''].filter(Boolean).join(' '); return `${ids ? ` aria-describedby="${ids}"` : ''}${P[bc] ? ' aria-invalid="true"' : ''}`; }
function campo(bc, label, valor, P, { tipo = 'text', ayuda = '', max = 0, attrs = '', area = false, sufijo = '' } = {}) {
  const v = valor == null ? '' : String(valor), id = idDe(bc);
  const ctl = area ? `<textarea id="${id}" data-bc="${esc(bc)}" rows="4"${aria(bc, P, ayuda || max)}${attrs}>${esc(v)}</textarea>` : `<input id="${id}" type="${tipo}" data-bc="${esc(bc)}" value="${esc(v)}"${aria(bc, P, ayuda || max)}${attrs}>`;
  const cuenta = max ? `<span data-cnt="${esc(bc)}">${cuentaTexto(v, max)}</span>` : '';
  return `<div class="anu-bcampo"><label for="${id}">${esc(label)}</label>${sufijo ? `<span class="anu-imp">${ctl}<b>${esc(sufijo)}</b></span>` : ctl}${ayuda || cuenta ? `<p class="anu-bayuda" id="${id}-a">${esc(ayuda)}${ayuda && cuenta ? ' ' : ''}${cuenta}</p>` : ''}${err(bc, P)}</div>`;
}
export const cuentaTexto = (v, max) => { const n = [...String(v || '')].length; return n <= max ? `${n} de ${max} letras: se ve entero.` : `${n} letras: Meta enseña ${max} y pone «… Ver más».`; };
function opciones(bc, nombre, lista, valor, P, { legend, ayuda = '' } = {}) {
  return `<fieldset class="anu-bopc"${P[bc] ? ' aria-invalid="true"' : ''}><legend>${esc(legend)}</legend>${ayuda ? `<p class="anu-bayuda">${esc(ayuda)}</p>` : ''}
    ${lista.map(o => `<label class="anu-bop${String(valor ?? '') === o.k ? ' on' : ''}"><input type="radio" name="${nombre}" data-bc="${esc(bc)}" value="${esc(o.k)}"${String(valor ?? '') === o.k ? ' checked' : ''}><span><b>${esc(o.n)}</b>${o.d ? `<small>${esc(o.d)}</small>` : ''}</span></label>`).join('')}${err(bc, P)}</fieldset>`;
}

/* ---------- los cinco pasos ---------- */
export function pasoObjetivoHTML(b, P = {}) {
  const o = objetivoDe(b.objetivo);
  return `${opciones('objetivo', 'anuBObj', OBJETIVOS, b.objetivo, P, { legend: '¿Qué quieres conseguir?' })}
    ${o?.k === 'mensajes' ? opciones('destino', 'anuBDest', DESTINOS.map(d => ({ ...d, d: '' })), b.destino, P, { legend: '¿Por dónde te escriben?', ayuda: 'El botón del anuncio abre esa conversación contigo.' }) : ''}
    ${o?.enlace || b.objetivo === 'conocer' ? campo('enlace', o?.enlace ? 'La dirección de tu web' : 'Tu web (opcional)', b.enlace, P, { tipo: 'url', ayuda: 'Empieza por https://. A ella llevan los anuncios.', attrs: ' inputmode="url" autocomplete="url" placeholder="https://"' }) : ''}`;
}
export function pasoPublicoHTML(b, P = {}) {
  const p = b.publico || {}, manual = p.modo === 'manual', radio = !!p.radio;
  return `<div class="anu-bbloque"><h3>${manual ? 'Público manual' : 'Advantage+: Meta busca a quién mostrarlo'}</h3>
      <p class="anu-bayuda">${manual ? 'Tú eliges los intereses. Suele salir más caro que dejar que Meta busque: úsalo si sabes muy bien a quién le hablas.' : 'Es lo que Meta recomienda hoy: tú dices dónde y la edad mínima, y Meta encuentra a quién le interesa. Suele salir más barato.'}</p>
      <button type="button" class="anu-btn" data-bmodo="${manual ? 'advantage' : 'manual'}">${manual ? 'Volver a Advantage+ (recomendado)' : 'Prefiero un público manual'}</button></div>
    <fieldset class="anu-bopc"><legend>¿Dónde?</legend>
      <label class="anu-bop${radio ? '' : ' on'}"><input type="radio" name="anuBDonde" data-bdonde="pais"${radio ? '' : ' checked'}><span><b>Todo un país</b></span></label>
      <label class="anu-bop${radio ? ' on' : ''}"><input type="radio" name="anuBDonde" data-bdonde="radio"${radio ? ' checked' : ''}><span><b>Alrededor de mi local</b><small>Un radio en km desde un punto.</small></span></label></fieldset>
    ${radio ? `<div class="anu-fila3">${campo('publico.radio.lat', 'Latitud', p.radio.lat, P, { tipo: 'number', attrs: ' step="any" inputmode="decimal"' })}${campo('publico.radio.lng', 'Longitud', p.radio.lng, P, { tipo: 'number', attrs: ' step="any" inputmode="decimal"' })}${campo('publico.radio.km', 'Radio', p.radio.km, P, { tipo: 'number', sufijo: 'km', attrs: ' min="1" max="80" inputmode="numeric"' })}</div>${err('publico.radio', P)}<p class="anu-bayuda">La latitud y la longitud de tu local las da Google Maps (clic derecho sobre el sitio).</p>`
      : `<div class="anu-bcampo"><label for="${idDe('publico.paises')}">País</label><select id="${idDe('publico.paises')}" data-bpais${aria('publico.paises', P)}>${PAISES.map(([k, n]) => `<option value="${k}"${(p.paises || [])[0] === k ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>${err('publico.paises', P)}</div>`}
    <div class="anu-fila2">${campo('publico.edadMin', 'Edad mínima', p.edadMin, P, { tipo: 'number', attrs: ' min="18" max="65" inputmode="numeric"' })}${campo('publico.edadMax', 'Edad máxima (vacía = 65 o más)', p.edadMax, P, { tipo: 'number', attrs: ' min="18" max="65" inputmode="numeric"' })}</div>
    ${manual ? campo('publico.intereses', 'Intereses (separados por comas)', (p.intereses || []).join(', '), P, { ayuda: 'Por ejemplo: moda, gafas de sol, salud visual. Meta los busca en su lista.' }) : ''}
    ${opciones('categoriaEspecial', 'anuBCat', CATEGORIAS, b.categoriaEspecial || '', P, { legend: '¿Tu anuncio es de alguna categoría especial?', ayuda: 'Meta lo exige: si es de empleo, vivienda, crédito o política, limita la edad y el lugar. Si no, «Ninguna».' })}`;
}
export function pasoPresupuestoHTML(b, P = {}, { moneda = 'USD', validando = false } = {}) {
  const pr = b.presupuesto || {}, aviso = avisoSinFin(b);
  return `${opciones('presupuesto.tipo', 'anuBTipo', [{ k: 'diario', n: 'Al día', d: 'Lo mismo cada día; Meta reparte dentro del día.' }, { k: 'total', n: 'En total', d: 'Una cifra para toda la campaña; necesita fecha de fin.' }], pr.tipo, P, { legend: '¿Cómo quieres el presupuesto?' })}
    ${campo('presupuesto.usd', pr.tipo === 'total' ? 'Presupuesto total' : 'Presupuesto al día', pr.usd, P, { tipo: 'number', sufijo: moneda, attrs: ' min="1" step="0.5" inputmode="decimal"' })}
    <div class="anu-fila2">${campo('inicio', 'Empieza', b.inicio, P, { tipo: 'date' })}<div>${campo('fin', 'Termina', b.fin, P, { tipo: 'date' })}${b.fin ? '<button type="button" class="anu-btn" data-bsinfin>Sin fecha de fin</button>' : ''}</div></div>
    <p class="anu-costo" data-costo aria-live="polite">${costoLinea(b, { moneda, validando })}</p>
    ${aviso ? `<p class="anu-daviso" data-avisofin><b>Ojo</b><span>${esc(aviso)}</span></p>` : ''}
    <p class="anu-bayuda">Meta reparte el presupuesto entre los creativos y los lugares (Advantage+). La oficina pone además el tope de la campaña en Meta, así no gasta más aunque la oficina esté cerrada.</p>`;
}
export function costoLinea(b, { moneda = 'USD', validando = false } = {}) {
  const c = b?.validacion?.costoMax, t = c ? costoTexto(c, moneda) : '';
  if (t) return `Costo máximo: <b>${esc(t)}</b>.`;
  return validando ? 'Calculando el costo máximo…' : 'El costo máximo sale al revisar el presupuesto.';
}
/** Fase A4 (9 oct 2026): el paso 4 de un borrador que IMPULSA una publicación: la publicación (miniatura, texto, enlace a la original) en
 *  lugar de la galería, y solo la llamada a la acción. Ni medios, ni texto, ni las mejoras de Meta: el anuncio es la publicación. */
export function pasoOrigenHTML(b, P = {}) {
  const o = b.origen, c = (b.creativos || [])[0] || {}, llam = llamadasDe(b.objetivo, b.destino), red = RED_ORIGEN[o.red] || o.red;
  const t = Date.parse(o.publicadaAt || ''), f = Number.isFinite(t) ? new Date(t).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const bc = 'creativos.0.llamada', sel = c.llamada || llam[0];
  return `<div class="anu-bbloque anu-borig"><h3>La publicación que impulsas</h3>
      <p class="anu-bayuda">El anuncio es esta publicación tal como salió en ${esc(red)}: su imagen o video y su texto, con lo que ya ganó (me gusta y comentarios). Aquí solo eliges el botón; por dónde te escriben, en el paso 1.</p>
      ${err('origen', P)}
      <div class="anu-borig-c">${o.miniatura ? `<span class="anu-borig-m"><img src="${esc(o.miniatura)}" alt="La publicación de ${esc(red)}" loading="lazy" decoding="async"></span>` : '<span class="anu-borig-m vacio" aria-hidden="true">Sin miniatura</span>'}
        <div class="anu-borig-x"><p class="anu-borig-r"><b>${esc(red)}</b>${f ? ` · publicada el ${esc(f)}` : ''}</p>
          <p class="anu-borig-t">${o.texto ? esc(o.texto) : '<i>Sin texto: sale la imagen o el video solos.</i>'}</p>
          ${o.enlace ? `<a class="anu-btn" href="${esc(o.enlace)}" target="_blank" rel="noopener noreferrer">Ver la original<span class="anu-sr"> en ${esc(red)} (se abre en otra pestaña)</span></a>` : ''}</div></div>
      <div class="anu-bcampo"><label for="${idDe(bc)}">Llamada a la acción (el botón)</label><select id="${idDe(bc)}" data-bc="${bc}"${aria(bc, P)}>${llam.map(k => `<option value="${k}"${sel === k ? ' selected' : ''}>${esc(LLAMADA[k])}</option>`).join('')}${c.llamada && !llam.includes(c.llamada) ? `<option value="${esc(c.llamada)}" selected>${esc(LLAMADA[c.llamada] || c.llamada)} (no vale para este objetivo)</option>` : ''}</select>${err(bc, P)}</div></div>`;
}
export function pasoCreativosHTML(b, P = {}, { estudio = false, mejora = null, puedeEditar = true } = {}) {
  if (b.origen) return pasoOrigenHTML(b, P);
  const cr = b.creativos || [], llam = llamadasDe(b.objetivo, b.destino), n = cr.length;
  const mej = (i, campo) => {
    const m = mejora && mejora.cr === cr[i]?.id && mejora.campo === campo ? mejora : null;
    const btn = `<button type="button" class="anu-btn anu-bmej" data-bmejorar="${i}" data-campo="${campo}"${m?.estado === 'pidiendo' ? ' aria-busy="true"' : ''}>${m?.estado === 'pidiendo' ? 'Pidiéndolo…' : '✨ Mejorar con el agente de anuncios'}</button>`;
    if (!m || m.estado === 'pidiendo') return btn;
    if (m.estado === 'error') return `${btn}<p class="anu-derr" role="alert">${esc(m.motivo)}</p>`;
    return `${btn}<div class="anu-bprop" role="region" aria-label="Propuesta de ${esc(m.agente || 'tu agente')}"><p class="anu-bprop-t">Propuesta de <b>${esc(m.agente || 'tu agente de anuncios')}</b>:</p><p class="anu-bprop-x">${esc(m.texto)}</p>${m.porque ? `<p class="anu-bayuda"><b>Por qué:</b> ${esc(m.porque)}</p>` : ''}
      <div class="anu-acts"><button type="button" class="anu-btn pri" data-busar="${i}" data-campo="${campo}">Usar</button><button type="button" class="anu-btn" data-bdescartar>Descartar</button></div></div>`;
  };
  const tarjeta = (c, i) => `<li class="anu-bcr" data-bcr="${i}"><div class="anu-bcr-cab">${miniHTML(c.media, 'anu-bcrm')}<div><h3>Creativo ${i + 1}</h3>
      <div class="anu-bcampo"><label for="${idDe(`creativos.${i}.formato`)}">Formato</label><select id="${idDe(`creativos.${i}.formato`)}" data-bc="creativos.${i}.formato"${aria(`creativos.${i}.formato`, P)}>${FORMATOS.map(f => `<option value="${f.k}"${String(c.formato || '') === f.k ? ' selected' : ''}>${esc(f.n)} — ${esc(f.d)}</option>`).join('')}</select>${err(`creativos.${i}.formato`, P)}</div>
      ${err(`creativos.${i}.media`, P)}</div>${puedeEditar ? `<button type="button" class="anu-btn" data-bquitar="${i}" aria-label="Quitar el creativo ${i + 1}">Quitar</button>` : ''}</div>
    ${campo(`creativos.${i}.texto`, 'Texto principal', c.texto, P, { area: true, max: LARGO.texto })}${mej(i, 'texto')}
    ${campo(`creativos.${i}.titular`, 'Titular', c.titular, P, { max: LARGO.titular })}${mej(i, 'titular')}
    ${campo(`creativos.${i}.descripcion`, 'Descripción (opcional)', c.descripcion, P, { max: LARGO.descripcion })}
    <div class="anu-bcampo"><label for="${idDe(`creativos.${i}.llamada`)}">Llamada a la acción (el botón)</label><select id="${idDe(`creativos.${i}.llamada`)}" data-bc="creativos.${i}.llamada"${aria(`creativos.${i}.llamada`, P)}>${llam.map(k => `<option value="${k}"${c.llamada === k ? ' selected' : ''}>${esc(LLAMADA[k])}</option>`).join('')}${c.llamada && !llam.includes(c.llamada) ? `<option value="${esc(c.llamada)}" selected>${esc(LLAMADA[c.llamada] || c.llamada)} (no vale para este objetivo)</option>` : ''}</select>${err(`creativos.${i}.llamada`, P)}</div></li>`;
  const mejoras = b.mejoras || {};
  return `<div class="anu-bbloque"><h3>Creativos <span class="anu-cuenta">${n} de ${MAX_CREATIVOS}</span></h3>
      <p class="anu-bayuda">Meta recomienda de ${MIN_RECOMENDADO} a ${MAX_CREATIVOS}: prueba varios y deja los que mejor funcionen. Para el feed, 1:1 o 4:5; para historias y reels, 9:16. Si solo hay uno, Meta lo recorta para cada lugar.${n && n < MIN_RECOMENDADO ? ` Llevas ${n}: con ${MIN_RECOMENDADO - n} más, Meta tiene con qué probar.` : ''}</p>
      ${err('creativos', P)}
      ${puedeEditar && n < MAX_CREATIVOS ? `<div class="anu-acts"><button type="button" class="anu-btn pri" data-bgaleria>Elegir de la galería</button>${estudio ? '<button type="button" class="anu-btn" data-bestudio>Crear con el Estudio</button>' : ''}</div>` : n >= MAX_CREATIVOS ? `<p class="anu-bayuda">Ya tienes ${MAX_CREATIVOS}: quita uno para añadir otro.</p>` : ''}</div>
    ${n ? `<ol class="anu-bcrs">${cr.map(tarjeta).join('')}</ol>` : '<div class="anu-vacio"><b>Todavía no hay creativos</b><span>Elige imágenes o videos de la galería del Estudio, o créalos ahora con el Estudio.</span></div>'}
    <fieldset class="anu-bopc anu-bmejoras"><legend>Las mejoras automáticas de Meta</legend><p class="anu-bayuda">Una por una: decides cuáles. Por defecto, solo las que no tocan tu texto.</p>
      ${MEJORAS.map(m => `<div class="anu-bmejora"><button type="button" role="switch" class="anu-sw" aria-checked="${!!mejoras[m.k]}" data-bmejora="${m.k}" aria-describedby="${idDe('mej-' + m.k)}"><span class="anu-sw-i" aria-hidden="true"></span><span><b>${esc(m.n)}</b> · ${mejoras[m.k] ? 'Encendida' : 'Apagada'}</span></button><p class="anu-bayuda" id="${idDe('mej-' + m.k)}">${esc(m.d)}</p></div>`).join('')}</fieldset>`;
}
export function pasoRevisionHTML(b, { moneda = 'USD', validando = false, ubic = 'feed', pagina = 'Tu página', metaPrev = null, servida = false, creandoDesde = 0, ahora = Date.now() } = {}) {
  const v = b.validacion, probs = v?.problemas || [], e = b.estado;
  let estado;
  if (e === 'creado') estado = `<div class="anu-bok t-verde" role="status"><b>Creado en pausa.</b><span>Actívalo desde Campañas cuando quieras (te pedirá los dos clics, con la cifra).</span>${b.meta?.campana ? `<button type="button" class="anu-btn pri" data-vercamp="${esc(b.meta.campana)}">Ver en Campañas</button>` : ''}</div>`;
  else if (e === 'creando') estado = `<div class="anu-bok t-ambar" role="status"><b>Creando en Meta…</b><span>Se suben las imágenes y se crean la campaña, el conjunto y los anuncios, todo EN PAUSA${creandoDesde ? ` (lleva ${Math.max(1, Math.round((ahora - creandoDesde) / 1000))} s)` : ''}. No gasta nada.</span><span class="anu-bprog" aria-hidden="true"><i></i></span></div>`;
  else if (validando && !v) estado = '<p class="anu-costo" role="status">Revisando con Meta…</p>';
  else if (!v) estado = '<p class="anu-costo">Todavía no se ha revisado: pulsa «Revisar».</p>';
  else if (!probs.length) estado = '<div class="anu-bok t-verde"><b>Todo en orden.</b><span>La oficina y Meta lo aceptan tal como está.</span></div>';
  else estado = `<div class="anu-bprobs" role="alert"><p><b>${probs.length} ${probs.length === 1 ? 'cosa por arreglar' : 'cosas por arreglar'}</b> antes de crearla. Pulsa una para ir a su campo:</p><ul>${probs.map((p, i) => { const d = pasoDe(p.campo); return `<li><button type="button" class="anu-bir" data-bir="${i}"><span class="anu-bir-p">Paso ${d.paso + 1} · ${esc(PASOS[d.paso].n)}</span><span>${esc(p.texto)}</span></button></li>`; }).join('')}</ul></div>`;
  const cr = b.creativos || [], o = b.origen;
  const previas = o ? `<div class="anu-pvs">${previaHTML(cr[0] || {}, { ubicacion: ubic, src: o.miniatura || null, pagina, enlace: b.enlace, n: 1 })}</div>` : cr.length ? `<div class="anu-pvs">${cr.map((c, i) => previaHTML(c, { ubicacion: ubic, src: srcDe(c.media), esVideo: esVideo(c.media), pagina, enlace: b.enlace, n: i + 1 })).join('')}</div>` : '<p class="anu-bayuda">Sin creativos todavía: no hay nada que enseñar.</p>';
  const meta = o ? `<p class="anu-bayuda">La de Meta no hace falta: es tu publicación tal como salió${o.enlace ? ` (<a href="${esc(o.enlace)}" target="_blank" rel="noopener noreferrer">ábrela en ${esc(RED_ORIGEN[o.red] || o.red)}<span class="anu-sr"> (se abre en otra pestaña)</span></a>)` : ''}.</p>`
    : !servida ? '<p class="anu-bayuda">La vista previa de Meta necesita la oficina abierta y tu cuenta conectada: en el ejemplo ves la de la oficina.</p>'
    : `<div class="anu-bmeta"><div class="anu-bcampo"><label for="anuBMetaU">La vista previa de Meta</label><select id="anuBMetaU" data-bmetau>${UBICACIONES_META.map(([k, n]) => `<option value="${k}"${metaPrev?.formato === k ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></div><button type="button" class="anu-btn" data-bmetaver${metaPrev?.estado === 'pidiendo' ? ' aria-busy="true"' : ''}>${metaPrev?.estado === 'pidiendo' ? 'Pidiéndola…' : 'Ver la de Meta'}</button></div>
      ${metaPrev?.estado === 'lista' ? `<iframe class="anu-bmetaif" title="Vista previa de Meta del anuncio" src="${esc(metaPrev.url)}" sandbox="allow-scripts allow-same-origin allow-popups" referrerpolicy="no-referrer" loading="lazy"></iframe>` : metaPrev?.estado === 'error' ? `<p class="anu-derr">${esc(metaPrev.motivo)}</p>` : ''}`;
  const puede = editable(b);
  const boton = !puede ? '' : `<div class="anu-bcrear"><button type="button" class="anu-btn si" data-bcrear${!v || probs.length || validando ? ' aria-disabled="true"' : ''}>${b.estado === 'fallo' ? 'Reintentar: crear en Meta (en pausa)' : 'Crear en Meta (en pausa)'}</button><p class="anu-bayuda">${!v ? 'Primero se revisa.' : probs.length ? `Arregla ${probs.length === 1 ? 'lo de arriba' : `las ${probs.length} cosas de arriba`} para poder crearla.` : 'Un clic: se crea EN PAUSA y no gasta. Activarla es otro paso, con la cifra y los dos clics.'}</p></div>`;
  return `${e === 'fallo' && b.error ? `<p class="anu-aviso-error" role="alert">No se pudo crear: ${esc(b.error)}</p>` : ''}
    <div class="anu-bbloque"><div class="anu-bcab"><h3>La revisión</h3>${puede ? `<button type="button" class="anu-btn" data-bvalidar${validando ? ' aria-busy="true"' : ''}>${validando ? 'Revisando…' : 'Revisar otra vez'}</button>` : ''}</div>${estado}
      ${o ? `<p class="anu-costo anu-borig-rev">${esc(origenTexto(b).replace(/^s/, 'S'))}: la misma imagen o video y el mismo texto.</p>` : ''}
      ${v?.costoMax ? `<p class="anu-costo">Costo máximo: <b>${esc(costoTexto(v.costoMax, moneda))}</b>.</p>` : ''}</div>
    ${boton}
    <div class="anu-bbloque"><div class="anu-bcab"><h3>Cómo se verá</h3><div class="anu-seg" role="group" aria-label="Dónde se ve"><button type="button" data-bubic="feed" aria-pressed="${ubic === 'feed'}">Feed · 1:1 y 4:5</button><button type="button" data-bubic="historia" aria-pressed="${ubic === 'historia'}">Historias y reels · 9:16</button></div></div>
      <p class="anu-bayuda">La vista previa de la oficina: una idea de cómo queda, no la de Meta.</p>${previas}${meta}</div>`;
}

/** El asistente entero: cabecera (volver, nombre, guardado), los pasos, el paso abierto y el pie (Atrás · Siguiente). */
export function asistenteHTML(b, paso, o = {}) {
  const P = problemasPorCampo(b), n = problemasPorPaso(b), e = estadoB(b), puede = editable(b);
  const cuerpo = [() => pasoObjetivoHTML(b, P), () => pasoPublicoHTML(b, P), () => pasoPresupuestoHTML(b, P, o), () => pasoCreativosHTML(b, P, { ...o, puedeEditar: puede }), () => pasoRevisionHTML(b, o)][paso]();
  return `<div class="anu-asis" data-basis="${esc(b.id)}">
    <div class="anu-asis-cab"><button type="button" class="anu-btn" data-bvolver>${svg('menos').replace('<svg', '<svg style="transform:rotate(90deg)"')}Borradores</button>
      <div class="anu-bcampo anu-bnombre"><label for="${idDe('nombre')}">Nombre de la campaña <small>(solo lo ves tú)</small></label><input id="${idDe('nombre')}" type="text" data-bc="nombre" value="${esc(b.nombre || '')}"${aria('nombre', P)}${puede ? '' : ' readonly'}>${err('nombre', P)}</div>
      <p class="anu-asis-st"><span class="anu-chip t-${e.tono}">${esc(e.texto)}</span> <span data-bguardado>${esc(o.guardado || '')}</span>${b.de && b.de !== 'dueno' ? ` · lo empezó ${esc(deQuien(b.de, o.agentName))}` : ''}</p></div>
    <nav class="anu-pasos-nav" aria-label="Pasos de la campaña"><ol class="anu-pasos">${PASOS.map((p, i) => `<li><button type="button" data-paso="${i}"${i === paso ? ' aria-current="step"' : ''} aria-label="Paso ${i + 1}: ${esc(p.n)}${n[i] ? `, ${n[i]} por arreglar` : ''}"><span class="anu-pn" aria-hidden="true">${i + 1}</span><span>${esc(p.n)}</span>${n[i] ? `<span class="anu-pmal">${n[i]} por arreglar</span>` : ''}</button></li>`).join('')}</ol></nav>
    <section class="anu-paso" aria-labelledby="anuBPasoT"><h2 id="anuBPasoT" tabindex="-1"><span class="anu-sr">Paso ${paso + 1} de ${PASOS.length}: </span>${esc(PASOS[paso].n)}</h2>
      ${!puede && paso < 4 ? `<p class="anu-bayuda">${b.estado === 'creando' ? 'Se está creando en Meta: espera a que termine.' : 'Ya se creó en Meta: lo ves como quedó; los cambios se hacen desde Campañas.'}</p>` : ''}
      <fieldset class="anu-bfs"${puede || paso === 4 ? '' : ' disabled'}><legend class="anu-sr">${esc(PASOS[paso].n)}</legend>${cuerpo}</fieldset></section>
    <div class="anu-asis-pie"><button type="button" class="anu-btn" data-bnav="-1"${paso === 0 ? ' aria-disabled="true"' : ''}>Atrás</button><span class="anu-asis-n">Paso ${paso + 1} de ${PASOS.length}</span>${paso < PASOS.length - 1 ? `<button type="button" class="anu-btn pri" data-bnav="1">Siguiente: ${esc(PASOS[paso + 1].n)}</button>` : '<span></span>'}</div></div>`;
}

/* ---------- el que escucha y llama ---------- */
/**
 * crearAsistente({ ov, datos, ctx, modal, decir, aviso, enEjemplo, moneda, repintar, irACampana }) → { html, click, input, change,
 * keydown, abrir, nueva, cargar, back, selection, abierto, alAbrir }. `repintar()` vuelve a pintar la pestaña (la vista conserva el foco).
 */
export function crearAsistente(env) {
  const { ov, datos, ctx, modal, decir, aviso, enEjemplo, moneda, repintar, irACampana } = env;
  const A = { items: null, error: '', b: null, paso: 0, pend: new Set(), timer: 0, guardando: null, guardado: '', confirmar: null, mejora: null, ubic: 'feed', metaPrev: null, validando: false, creandoDesde: 0, sondeo: 0, galeria: null };
  const opc = () => ({ ejemplo: enEjemplo() });
  const agentName = id => ctx.agentName?.(id) || id;
  const pagina = () => ctx.negocio?.() || 'Tu página';
  const fondo = document.createElement('div'); fondo.className = 'anu-fondo anu-fondo-gal'; fondo.hidden = true;
  fondo.innerHTML = '<div class="anu-dlg anu-dlg-gal" role="dialog" aria-modal="true" aria-labelledby="anuGalT" tabindex="-1"><div class="anu-dlg-in"></div></div>';
  ov.appendChild(fondo);
  const galIn = fondo.querySelector('.anu-dlg-in');

  async function cargar() {
    const r = await datos.borradores(opc());
    if (r.status === 200) { A.items = r.items || []; A.error = ''; if (A.b) { const x = A.items.find(i => i.id === A.b.id); if (x && !A.pend.size && !A.guardando) A.b = x; } }
    else A.error = r.motivo || 'la oficina no contestó';
    repintar();
  }
  function html() {
    if (A.b) return asistenteHTML(A.b, A.paso, { moneda: moneda(), validando: A.validando, ubic: A.ubic, pagina: pagina(), metaPrev: A.metaPrev, servida: !!ctx.servida && !enEjemplo(), creandoDesde: A.creandoDesde, estudio: typeof ctx.estudio === 'function', mejora: A.mejora, guardado: A.guardado, agentName });
    return listaBorradoresHTML(A.items, { moneda: moneda(), confirmar: A.confirmar, agentName, error: A.error });
  }
  const pintarYEnfocar = sel => { repintar(); if (sel) setTimeout(() => ov.querySelector(sel)?.focus({ preventScroll: false }), 20); };

  /* --- guardar solo, a los 500 ms --- */
  function programar(raiz) { A.pend.add(raiz); A.guardado = 'Sin guardar…'; marcarGuardado(); clearTimeout(A.timer); A.timer = setTimeout(guardar, 500); }
  function marcarGuardado() { const n = ov.querySelector('[data-bguardado]'); if (n) n.textContent = A.guardado; }
  async function guardar() {
    clearTimeout(A.timer);
    if (!A.b || !A.pend.size) return;
    if (A.guardando) { await A.guardando; return guardar(); }
    const id = A.b.id, claves = [...A.pend]; A.pend.clear();
    const cuerpo = Object.fromEntries(claves.map(k => [k, A.b[k] === undefined ? null : A.b[k]]));
    A.guardado = 'Guardando…'; marcarGuardado();
    A.guardando = datos.guardarBorrador(id, cuerpo, opc());
    const r = await A.guardando; A.guardando = null;
    if (!A.b || A.b.id !== id) return;
    if (r.status === 200 && r.borrador) {
      const local = Object.fromEntries([...A.pend].map(k => [k, A.b[k]])); // lo cambiado mientras se guardaba se queda
      A.b = { ...r.borrador, ...local }; A.guardado = 'Guardado'; marcarGuardado();
      const i = (A.items || []).findIndex(x => x.id === id); if (i >= 0) A.items[i] = r.borrador;
      if (A.paso === 2 && !A.pend.size) validar({ callado: true });
      else if (A.paso !== 2 && claves.some(k => k !== 'nombre')) repintarPasos();
    } else {
      for (const k of claves) A.pend.add(k);
      A.guardado = r.status === 409 ? 'No se guardó' : 'No se pudo guardar'; marcarGuardado();
      decir(`No se guardó: ${r.motivo || 'la oficina no contestó'}`);
      if (r.status === 409) { A.pend.clear(); await cargar(); }
      else { clearTimeout(A.timer); A.timer = setTimeout(guardar, 5000); }
    }
  }
  async function guardarYa() { clearTimeout(A.timer); if (A.guardando) await A.guardando; if (A.pend.size) await guardar(); }
  /** Lo que cambió fuera del campo (los números de «por arreglar» de los pasos) sin volver a pintar el campo en el que escribes. */
  function repintarPasos() {
    const nav = ov.querySelector('.anu-pasos'); if (!nav || !A.b) return;
    const n = problemasPorPaso(A.b);
    nav.querySelectorAll('[data-paso]').forEach(btn => { const i = +btn.dataset.paso, m = btn.querySelector('.anu-pmal'); if (n[i] && !m) btn.insertAdjacentHTML('beforeend', `<span class="anu-pmal">${n[i]} por arreglar</span>`); else if (!n[i] && m) m.remove(); else if (m) m.textContent = `${n[i]} por arreglar`; });
  }

  /* --- cambiar el borrador --- */
  function cambiar(ruta, v, { pintar = false } = {}) {
    if (!A.b || !editable(A.b)) return;
    const r = poner(A.b, ruta, v); A.b = r.b;
    if (ruta === 'objetivo' || ruta === 'destino') { if (ruta === 'objetivo' && v === 'mensajes' && !A.b.destino) A.b.destino = 'whatsapp'; if (ruta === 'objetivo' && v !== 'mensajes') A.b.destino = null; A.b = ajustarLlamadas(A.b); A.pend.add('destino'); A.pend.add('creativos'); }
    if (ruta === 'categoriaEspecial' && v) { A.b.publico = { ...A.b.publico, edadMin: 18, edadMax: null, intereses: [] }; A.pend.add('publico'); }
    A.b.validacion = A.b.validacion && { ...A.b.validacion, problemas: (A.b.validacion.problemas || []).filter(p => !normal(p.campo).startsWith(ruta)) }; // lo que tocaste deja de marcarse en rojo hasta la próxima revisión
    programar(r.raiz);
    if (pintar) repintar();
    else { const e = ov.querySelector(`[data-bc="${CSS.escape(ruta)}"]`); if (e && e.getAttribute('aria-invalid')) { e.removeAttribute('aria-invalid'); document.getElementById(idDe(ruta) + '-e')?.remove(); } }
  }
  const valorDe = (el, ruta) => {
    if (el.type === 'number') { const s = el.value.trim(); if (s === '') return ruta === 'publico.edadMax' ? null : ''; return Number(s.replace(',', '.')); }
    if (ruta === 'publico.intereses') return el.value.split(',').map(s => s.trim()).filter(Boolean);
    if (ruta === 'categoriaEspecial') return el.value || null;
    if (/\.formato$/.test(ruta)) return el.value || null;
    return el.value;
  };

  /* --- revisar, crear, sondear --- */
  async function validar({ callado = false } = {}) {
    if (!A.b) return; await guardarYa();
    const id = A.b.id; A.validando = true;
    if (A.paso === 2) { const c = ov.querySelector('[data-costo]'); if (c) c.innerHTML = costoLinea({}, { validando: true }); } else repintar();
    const r = await datos.validarBorrador(id, opc());
    A.validando = false; if (!A.b || A.b.id !== id) return;
    if (r.status === 200 && r.borrador) { A.b = { ...A.b, validacion: r.borrador.validacion, estado: r.borrador.estado, error: r.borrador.error }; }
    else if (!callado) decir('No se pudo revisar: ' + (r.motivo || 'la oficina no contestó'));
    if (A.paso === 2) { const c = ov.querySelector('[data-costo]'); if (c) c.innerHTML = costoLinea(A.b, { moneda: moneda() }); repintarPasos(); const f = ov.querySelector('[data-avisofin]'), a = avisoSinFin(A.b); if (!!f !== !!a) repintar(); }
    else { repintar(); if (!callado && A.paso === 4) { const v = A.b.validacion; decir(!v ? 'No se pudo revisar.' : v.ok ? 'Revisado: todo en orden.' : `Revisado: ${v.problemas.length} ${v.problemas.length === 1 ? 'cosa' : 'cosas'} por arreglar.`); } }
  }
  async function crear() {
    if (!A.b || !editable(A.b)) return;
    const v = A.b.validacion;
    if (!v || (v.problemas || []).length || A.validando) { decir(!v ? 'Primero se revisa: pulsa «Revisar otra vez».' : 'Antes hay que arreglar lo de la revisión.'); ov.querySelector('[data-bir]')?.focus(); return; }
    await guardarYa();
    const id = A.b.id, r = await datos.crearEnMeta(id, opc());
    if (!A.b || A.b.id !== id) return;
    if (r.status === 202 || (r.status === 200 && r.borrador?.estado === 'creando')) {
      A.b = { ...A.b, ...(r.borrador || {}), estado: 'creando', error: null }; A.creandoDesde = Date.now(); repintar(); decir('Creando en Meta, en pausa…');
      sondear(id); return;
    }
    if (r.status === 422) { A.b = { ...A.b, validacion: { ...(A.b.validacion || {}), ok: false, problemas: r.problemas || [] } }; repintar(); decir(`Meta encontró ${(r.problemas || []).length} cosas por arreglar.`); setTimeout(() => ov.querySelector('[data-bir]')?.focus(), 30); return; }
    if (r.status === 409) { decir(r.motivo || 'Ya se creó.'); await cargar(); return; }
    A.b = { ...A.b, estado: 'fallo', error: r.motivo || 'la oficina no contestó' }; repintar(); decir('No se pudo crear: ' + A.b.error);
  }
  function sondear(id) {
    clearTimeout(A.sondeo);
    const fin = Date.now() + 180000;
    const paso = async () => {
      const r = await datos.borradores(opc());
      if (r.status === 200) {
        A.items = r.items || []; const x = A.items.find(i => i.id === id);
        if (x && A.b?.id === id) A.b = { ...x };
        if (x && x.estado !== 'creando') {
          A.creandoDesde = 0; repintar();
          if (x.estado === 'creado') { decir('Creado en pausa. Actívalo desde Campañas cuando quieras: te pedirá los dos clics.'); aviso?.(`«${x.nombre}» se creó EN PAUSA en Meta. Actívalo desde Campañas cuando quieras.`); env.alCrear?.(x); setTimeout(() => ov.querySelector('.anu-bok [data-vercamp]')?.focus(), 30); }
          else decir('No se pudo crear: ' + (x.error || 'Meta no contestó.'));
          return;
        }
      }
      if (Date.now() > fin) { decir('Meta tarda: la campaña aparecerá en Campañas cuando termine.'); return; }
      if (A.b?.id === id && A.paso === 4) { const s = ov.querySelector('.anu-bok.t-ambar span'); if (s) s.textContent = `Se suben las imágenes y se crean la campaña, el conjunto y los anuncios, todo EN PAUSA (lleva ${Math.round((Date.now() - A.creandoDesde) / 1000)} s). No gasta nada.`; }
      A.sondeo = setTimeout(paso, 1500);
    };
    A.sondeo = setTimeout(paso, 900);
  }

  /* --- mejorar con el agente --- */
  async function mejorar(i, campo) {
    const c = A.b?.creativos?.[i]; if (!c) return;
    await guardarYa();
    A.mejora = { cr: c.id, campo, estado: 'pidiendo' }; repintar(); decir('Pidiéndoselo a tu agente de anuncios…');
    const r = await datos.mejorarBorrador(A.b.id, { creativo: c.id, campo }, opc());
    if (!A.mejora || A.mejora.cr !== c.id) return;
    A.mejora = r.status === 200 && r.texto ? { cr: c.id, campo, estado: 'lista', texto: r.texto, porque: r.porque, agente: r.agente } : { cr: c.id, campo, estado: 'error', motivo: 'No llegó la propuesta: ' + (r.motivo || 'la oficina no contestó') };
    repintar(); decir(A.mejora.estado === 'lista' ? `Propuesta de ${A.mejora.agente || 'tu agente'}: ${A.mejora.texto}` : A.mejora.motivo);
    setTimeout(() => ov.querySelector(A.mejora?.estado === 'lista' ? `[data-busar="${i}"]` : `[data-bmejorar="${i}"][data-campo="${campo}"]`)?.focus(), 30);
  }

  /* --- añadir creativos: de la galería o del Estudio --- */
  function anadir(medios) {
    if (!A.b || !editable(A.b)) return 0;
    const ya = new Set((A.b.creativos || []).map(c => c.media)), hueco = MAX_CREATIVOS - (A.b.creativos || []).length;
    const nuevos = medios.filter(m => m && !ya.has(m.file || m)).slice(0, Math.max(0, hueco)).map(m => creativoNuevo(m.file || m, { formato: m.w ? formatoDeMedidas(m.w, m.h) : '', objetivo: A.b.objetivo, destino: A.b.destino }));
    if (!nuevos.length) return 0;
    cambiar('creativos', [...(A.b.creativos || []), ...nuevos], { pintar: true });
    return nuevos.length;
  }
  let galOrigen = null;
  async function abrirGaleria(desde) {
    galOrigen = desde; A.galeria = { q: '', items: null, sel: new Set(), cargando: true };
    fondo.hidden = false; modal.open(fondo); pintarGaleria(); galIn.querySelector('input')?.focus();
    await buscarGaleria('');
  }
  async function buscarGaleria(q) {
    if (!A.galeria) return; A.galeria.q = q; A.galeria.cargando = true;
    const r = await datos.galeria({ q }, opc());
    if (!A.galeria || A.galeria.q !== q) return;
    A.galeria.cargando = false; A.galeria.items = r.status === 200 ? (r.items || []).filter(it => it.kind !== 'audio') : []; A.galeria.error = r.status === 200 ? '' : (r.motivo || 'la oficina no contestó');
    pintarGaleria(true);
  }
  function pintarGaleria(soloRejilla) {
    const g = A.galeria; if (!g) return;
    const hueco = MAX_CREATIVOS - (A.b?.creativos || []).length, ya = new Set((A.b?.creativos || []).map(c => c.media));
    const rej = g.cargando && !g.items ? '<p class="anu-cargando">Cargando…</p>' : g.error ? `<p class="anu-derr">No se pudo leer la galería: ${esc(g.error)}</p>` : !g.items.length ? `<p class="anu-bayuda">${g.q ? `Nada en la galería con «${esc(g.q)}».` : 'La galería del Estudio está vacía: crea algo con «Crear con el Estudio».'}</p>`
      : g.items.map(it => { const en = ya.has(it.file), on = g.sel.has(it.file); return `<button type="button" class="anu-gpk" data-gfile="${esc(it.file)}" aria-pressed="${on || en}"${en ? ' aria-disabled="true"' : ''}>${miniHTML(it.file, 'anu-gpkm')}<span>${esc(String(it.prompt || it.file).slice(0, 60))}</span><small>${en ? 'Ya está en el anuncio' : it.w ? `${it.w}×${it.h}${formatoDeMedidas(it.w, it.h) ? ' · ' + formatoDeMedidas(it.w, it.h) : ''}` : esc(it.kind === 'video' ? 'video' : 'imagen')}</small></button>`; }).join('');
    if (soloRejilla && galIn.querySelector('.anu-grej')) { galIn.querySelector('.anu-grej').innerHTML = rej; pintarPie(); return; }
    galIn.innerHTML = `<div class="anu-bcab"><h2 id="anuGalT">Elegir de la galería del Estudio</h2><button type="button" class="anu-icb" data-gx aria-label="Cerrar">${svg('x')}</button></div>
      <label class="anu-bcampo"><span>Buscar</span><input type="search" data-gq value="${esc(g.q)}" placeholder="Buscar en la galería…"></label>
      <div class="anu-grej" role="group" aria-label="Imágenes y videos">${rej}</div>
      <div class="anu-acts anu-gpie"><span class="anu-bayuda" data-gn>${hueco > 0 ? `Caben ${hueco} más.` : 'Ya hay 6: quita uno para añadir otro.'}</span><button type="button" class="anu-btn pri" data-gusar aria-disabled="true">Usar</button><button type="button" class="anu-btn" data-gx>Cancelar</button></div>`;
    pintarPie();
  }
  function pintarPie() { const g = A.galeria, b = galIn.querySelector('[data-gusar]'); if (!b || !g) return; b.textContent = g.sel.size ? `Usar ${g.sel.size}` : 'Usar'; b.setAttribute('aria-disabled', String(!g.sel.size)); }
  function cerrarGaleria(usar) {
    const g = A.galeria; if (!g) return false;
    A.galeria = null; modal.close(fondo); fondo.hidden = true; galIn.innerHTML = '';
    if (usar && g.sel.size) { const n = anadir([...g.sel].map(f => g.items.find(i => i.file === f) || f)); decir(`${n} ${n === 1 ? 'creativo añadido' : 'creativos añadidos'}.`); setTimeout(() => ov.querySelector(`[data-bcr="${(A.b?.creativos?.length || 1) - n}"] textarea`)?.focus(), 30); }
    else if (galOrigen && document.contains(galOrigen)) galOrigen.focus(); else ov.querySelector('[data-bgaleria]')?.focus();
    return true;
  }
  fondo.addEventListener('click', e => {
    if (e.target === fondo) return cerrarGaleria(false);
    const b = e.target.closest('button'); if (!b || !A.galeria) return;
    if (b.hasAttribute('data-gx')) return cerrarGaleria(false);
    if (b.hasAttribute('data-gusar')) { if (A.galeria.sel.size) cerrarGaleria(true); return; }
    if (b.dataset.gfile && b.getAttribute('aria-disabled') !== 'true') {
      const f = b.dataset.gfile, g = A.galeria, hueco = MAX_CREATIVOS - (A.b?.creativos || []).length;
      if (g.sel.has(f)) g.sel.delete(f); else if (g.sel.size < hueco) g.sel.add(f); else { decir(`Caben ${hueco} más: deja de elegir otra antes.`); return; }
      b.setAttribute('aria-pressed', String(g.sel.has(f))); pintarPie();
    }
  });
  let qT = 0;
  fondo.addEventListener('input', e => { if (e.target.matches('[data-gq]')) { clearTimeout(qT); const v = e.target.value; qT = setTimeout(() => buscarGaleria(v.trim()), 250); } });
  fondo.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrarGaleria(false); } });

  function abrirEstudio() {
    if (!A.b || typeof ctx.estudio !== 'function') return;
    const id = A.b.id;
    guardarYa().then(() => ctx.estudio({ id, titulo: A.b?.nombre || 'Campaña', para: 'anuncio' }, ids => ctx.abrir?.({ tab: 'borradores', borrador: id, paso: 3, medios: ids || [] })));
  }

  /* --- abrir, nueva, volver --- */
  async function abrir(id, { paso = 0, medios = [] } = {}) {
    if (!A.items) await cargar();
    let b = (A.items || []).find(x => x.id === id);
    if (!b) { const r = await datos.borradores(opc()); if (r.status === 200) { A.items = r.items; b = A.items.find(x => x.id === id); } }
    if (!b) { decir('Ese borrador ya no está.'); A.b = null; repintar(); return; }
    A.b = structuredClone(b); A.paso = Math.max(0, Math.min(4, paso)); A.mejora = null; A.metaPrev = null; A.guardado = ''; A.confirmar = null;
    if (b.estado === 'creando') { A.creandoDesde = Date.parse(b.actualizadoAt) || Date.now(); sondear(b.id); }
    const n = medios.length ? anadir(medios) : 0;
    if (A.paso === 4 || (A.paso === 2 && !b.validacion)) validar({ callado: true });
    pintarYEnfocar(n ? `[data-bcr="${A.b.creativos.length - n}"] textarea` : '#anuBPasoT');
    if (medios.length) decir(n ? `${n} ${n === 1 ? 'creativo añadido' : 'creativos añadidos'} desde el Estudio.` : 'No se añadió nada del Estudio.');
  }
  /** A4: impulsar una publicación (de Contenido o de Analíticas): el servidor (o la demo) hace el borrador y se abre en el paso 4. */
  async function impulsar(det = {}) {
    const r = await datos.impulsar(det, opc());
    if (r.status !== 200 || !r.borrador) { await cargar(); aviso?.(`No se pudo impulsar esa publicación: ${r.motivo || 'la oficina no contestó'}`); return false; }
    A.items = [r.borrador, ...(A.items || []).filter(x => x.id !== r.borrador.id)];
    await abrir(r.borrador.id, { paso: 3 });
    aviso?.(`${r.ya ? 'Ya tenías un borrador con esa publicación: aquí está.' : `Borrador listo: ${origenTexto(r.borrador)}.`} No se crea nada en Meta hasta que pulses «Crear en Meta (en pausa)»; activarla te pedirá los dos clics con la cifra.`);
    return true;
  }
  async function nueva() {
    const r = await datos.nuevoBorrador({}, opc());
    if (r.status !== 200 || !r.borrador) { decir('No se pudo empezar la campaña: ' + (r.motivo || 'la oficina no contestó')); return; }
    A.items = [r.borrador, ...(A.items || []).filter(x => x.id !== r.borrador.id)];
    await abrir(r.borrador.id, { paso: 0 });
    decir('Campaña nueva: paso 1 de 5, el objetivo.');
  }
  async function volver() { await guardarYa(); clearTimeout(A.sondeo); const id = A.b?.id; A.b = null; A.mejora = null; A.galeria = null; await cargar(); setTimeout(() => ov.querySelector(`[data-babrir="${CSS.escape(id || '')}"]`)?.focus(), 30); }
  function irPaso(i, foco) {
    i = Math.max(0, Math.min(PASOS.length - 1, i));
    guardarYa(); A.paso = i; A.mejora = null; repintar();
    if (i === 4 || (i === 2 && !A.b?.validacion)) validar({ callado: true });
    setTimeout(() => { const f = foco && ov.querySelector(`[data-bc="${CSS.escape(foco)}"]`); (f || ov.querySelector('#anuBPasoT'))?.focus(); if (f?.scrollIntoView) f.scrollIntoView({ block: 'center' }); }, 30);
  }

  /* --- eventos (la vista se los pasa) --- */
  function click(b) {
    if (b.dataset.a === 'nueva') { nueva(); return true; }
    if (b.dataset.a === 'recargar-b') { cargar(); return true; }
    if (b.dataset.babrir) { abrir(b.dataset.babrir, { paso: 0 }); return true; }
    if (b.dataset.bborrar) { A.confirmar = b.dataset.bborrar; pintarYEnfocar(`[data-bborrar-si="${CSS.escape(A.confirmar)}"]`); return true; }
    if (b.dataset.bborrarNo) { const id = A.confirmar; A.confirmar = null; pintarYEnfocar(`[data-bborrar="${CSS.escape(id)}"]`); return true; }
    if (b.dataset.bborrarSi) {
      const id = b.dataset.bborrarSi, nom = (A.items || []).find(x => x.id === id)?.nombre || '';
      datos.borrarBorrador(id, opc()).then(async r => { A.confirmar = null; await cargar(); if (r.status === 200) { aviso?.(`Borraste el borrador «${nom}»: va a la papelera de la oficina; en Meta no cambió nada.`); ov.querySelector('[data-a="nueva"]')?.focus(); } else decir('No se pudo borrar: ' + (r.motivo || 'la oficina no contestó')); });
      return true;
    }
    if (b.dataset.vercamp) { if (A.b) { guardarYa(); clearTimeout(A.sondeo); A.b = null; A.mejora = null; } irACampana(b.dataset.vercamp); return true; } // al volver a Borradores se ve la lista
    if (!A.b) return false;
    if (b.hasAttribute('data-bvolver')) { volver(); return true; }
    if (b.dataset.paso != null) { irPaso(+b.dataset.paso); return true; }
    if (b.dataset.bnav) { if (b.getAttribute('aria-disabled') === 'true') return true; irPaso(A.paso + +b.dataset.bnav); return true; }
    if (b.dataset.bmodo) { cambiar('publico.modo', b.dataset.bmodo, { pintar: true }); decir(b.dataset.bmodo === 'manual' ? 'Público manual: ahora puedes escribir intereses.' : 'De vuelta a Advantage+.'); setTimeout(() => ov.querySelector('[data-bmodo]')?.focus(), 20); return true; }
    if (b.hasAttribute('data-bsinfin')) { cambiar('fin', null, { pintar: true }); setTimeout(() => ov.querySelector('[data-bc="fin"]')?.focus(), 20); return true; }
    if (b.dataset.bmejora) { const k = b.dataset.bmejora; cambiar('mejoras.' + k, !A.b.mejoras?.[k], { pintar: true }); setTimeout(() => ov.querySelector(`[data-bmejora="${k}"]`)?.focus(), 20); return true; }
    if (b.hasAttribute('data-bgaleria')) { abrirGaleria(b); return true; }
    if (b.hasAttribute('data-bestudio')) { abrirEstudio(); return true; }
    if (b.dataset.bquitar != null) { const i = +b.dataset.bquitar, l = [...(A.b.creativos || [])]; l.splice(i, 1); cambiar('creativos', l, { pintar: true }); decir(`Quitaste el creativo ${i + 1}.`); setTimeout(() => (ov.querySelector(`[data-bquitar="${Math.min(i, l.length - 1)}"]`) || ov.querySelector('[data-bgaleria]'))?.focus(), 20); return true; }
    if (b.dataset.bmejorar != null) { if (b.getAttribute('aria-busy') !== 'true') mejorar(+b.dataset.bmejorar, b.dataset.campo); return true; }
    if (b.dataset.busar != null) { const i = +b.dataset.busar, c = b.dataset.campo, t = A.mejora?.texto; A.mejora = null; if (t != null) cambiar(`creativos.${i}.${c}`, t, { pintar: true }); decir('Usaste la propuesta.'); setTimeout(() => ov.querySelector(`[data-bc="creativos.${i}.${c}"]`)?.focus(), 20); return true; }
    if (b.hasAttribute('data-bdescartar')) { const m = A.mejora; A.mejora = null; repintar(); decir('Propuesta descartada: tu texto sigue igual.'); setTimeout(() => ov.querySelector(`[data-bmejorar][data-campo="${m?.campo}"]`)?.focus(), 20); return true; }
    if (b.hasAttribute('data-bvalidar')) { validar(); return true; }
    if (b.dataset.bir != null) { const p = A.b.validacion?.problemas?.[+b.dataset.bir]; if (p) { const d = pasoDe(p.campo); irPaso(d.paso, d.campo && normal(d.campo)); decir(`Paso ${d.paso + 1}: ${p.texto}`); } return true; }
    if (b.hasAttribute('data-bcrear')) { crear(); return true; }
    if (b.dataset.bubic) { A.ubic = b.dataset.bubic; repintar(); return true; }
    if (b.hasAttribute('data-bmetaver')) { pedirMeta(); return true; }
    return false;
  }
  async function pedirMeta() {
    const sel = ov.querySelector('[data-bmetau]'), formato = sel?.value || UBICACIONES_META[0][0];
    await guardarYa();
    A.metaPrev = { formato, estado: 'pidiendo' }; repintar();
    const r = await datos.vistaPreviaMeta(A.b.id, formato, opc());
    const url = r.status === 200 ? iframeMeta(r.html) : null;
    A.metaPrev = url ? { formato, estado: 'lista', url } : { formato, estado: 'error', motivo: r.status === 200 ? 'Meta devolvió una vista previa que la oficina no puede enseñar con seguridad: mira la de la oficina.' : (r.motivo || 'Meta no la dio.') };
    repintar(); decir(url ? 'La vista previa de Meta, debajo.' : A.metaPrev.motivo);
  }
  function input(e) {
    const el = e.target;
    if (el.dataset.bc && el.type !== 'radio' && el.tagName !== 'SELECT') {
      const ruta = el.dataset.bc; cambiar(ruta, valorDe(el, ruta));
      const c = ov.querySelector(`[data-cnt="${CSS.escape(ruta)}"]`); if (c) c.textContent = cuentaTexto(el.value, ruta.endsWith('texto') ? LARGO.texto : ruta.endsWith('titular') ? LARGO.titular : LARGO.descripcion);
      if (ruta === 'fin' || ruta === 'inicio' || ruta.startsWith('presupuesto')) { const cc = ov.querySelector('[data-costo]'); if (cc) cc.textContent = 'El costo máximo se recalcula en cuanto se guarda…'; }
      return true;
    }
    return false;
  }
  function change(e) {
    const el = e.target;
    if (el.dataset.bc && (el.type === 'radio' || el.tagName === 'SELECT')) { cambiar(el.dataset.bc, valorDe(el, el.dataset.bc), { pintar: true }); return true; }
    if (el.dataset.bc && (el.type === 'date')) { if (el.dataset.bc === 'fin' && !!el.value !== !!ov.querySelector('[data-bsinfin]')) setTimeout(repintar, 0); return true; }
    if (el.hasAttribute('data-bpais')) { cambiar('publico.paises', [el.value], { pintar: true }); return true; }
    if (el.dataset.bdonde) { cambiar('publico.radio', el.dataset.bdonde === 'radio' ? { lat: 8.9824, lng: -79.5199, km: 10 } : null, { pintar: true }); if (el.dataset.bdonde === 'radio') decir('Alrededor de un punto: por defecto, Ciudad de Panamá, 10 km. Cambia la latitud y la longitud a las de tu local.'); return true; }
    return !!el.dataset.bc;
  }
  function keydown(e) {
    const el = e.target;
    if (el.dataset?.paso != null && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); const l = [...ov.querySelectorAll('[data-paso]')], i = l.indexOf(el); l[(i + (e.key === 'ArrowRight' ? 1 : l.length - 1)) % l.length]?.focus(); return true; }
    return false;
  }
  return {
    html, click, input, change, keydown, cargar, abrir, nueva, impulsar,
    get abierto() { return A.b; },
    /** Esc: la galería, la propuesta, luego volver a la lista. */
    back() { if (A.galeria) return cerrarGaleria(false); if (A.mejora) { A.mejora = null; repintar(); return true; } if (A.confirmar) { A.confirmar = null; repintar(); return true; } if (A.b) { volver(); return true; } return false; },
    cerrar() { clearTimeout(A.sondeo); if (A.galeria) cerrarGaleria(false); guardarYa(); },
    selection() { return A.b ? { view: 'anuncios', label: `Borrador «${String(A.b.nombre || '').slice(0, 60)}»${enEjemplo() ? ' (ejemplo)' : ''} · paso ${A.paso + 1}: ${PASOS[A.paso].n}`, kind: 'borrador', id: A.b.id } : null; },
    reiniciar() { clearTimeout(A.sondeo); A.items = null; A.b = null; A.mejora = null; A.confirmar = null; },
  };
}
