// Agents Office (8 oct 2026, C3) — dos ventanas de Contenido que van en el paquete del editor (dist/pieza-editor.js, build-pieza.mjs):
// la página las pide por src/pieza-carga.js (`herramientas()`) y no pesan en su presupuesto.
//   abrirLlenar({ host, datos, esc, modal, redes, onHecho, onVer })
//      LLENAR LA SEMANA: los días sin nada en tus redes, cada uno con su mejor hora; en cada hueco, un borrador nuevo de Marketing (con
//      imagen del Estudio) o algo que ya funcionó y vuelve (sin repetirse en 8 semanas). Crea las copias que vuelven (en revisión) y UNA
//      tarea para Marketing; nada sale sin tu OK: lo apruebas en Programación, uno a uno o todo lo que puede salir.
//   abrirPlantillas({ host, datos, esc, modal, onUsar })
//      DESDE UNA PLANTILLA: las plantillas de publicación (notas del Cerebro, Contenido/Plantillas); «Usar» abre una pieza nueva con su
//      forma y su texto, en el siguiente hueco libre.
import { RED, FICON, nbRed } from './pieza-base.js';
import { nombreFormato } from './contenido-reglas.js';
import { numeroCorto } from './contenido-publicadas.js';
import { diaCorto, SEMANAS_SIN_REPETIR } from './contenido-llenar.js';

const pad = n => String(n).padStart(2, '0');
const hoyYmd = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const FUENTE = { metricool: 'su mejor hora según Metricool', propia: 'su mejor hora según lo que ya publicaste', mixta: 'su mejor hora según Metricool y lo ya publicado', ejemplo: 'su mejor hora (de ejemplo)', ninguna: 'las 18:00 (aún no hay mejores horas)' };
const badges = redes => redes.map(r => nbRed(r, { solo: true })).join('');
const nombresRedes = redes => redes.map(r => RED[r]?.name || r).join(' y ');

/** La caja común: un diálogo sobre Contenido, con su foco atrapado (modal de la página) y Esc para cerrar. */
function dialogo({ host, modal, titulo, id }) {
  const from = document.activeElement;
  const dlg = document.createElement('div');
  dlg.className = 'ct-pick ct-tool'; dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true'); dlg.setAttribute('aria-labelledby', id); dlg.setAttribute('data-modal-keep', '');
  dlg.innerHTML = `<div class="ct-pickbox"><div class="ct-pickh"><h3 id="${id}">${titulo}</h3><span class="sp"></span><button type="button" class="pz-x" data-a="x" aria-label="Cerrar">✕</button></div><div class="ct-toolb"><p class="ct-empty">Cargando…</p></div><div class="ct-pickf"></div></div>`;
  host.appendChild(dlg); modal.open(dlg);
  const cerrar = () => { modal.close(dlg); dlg.remove(); if (from && document.contains(from)) from.focus({ preventScroll: true }); };
  dlg.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); cerrar(); } });
  return { dlg, body: dlg.querySelector('.ct-toolb'), foot: dlg.querySelector('.ct-pickf'), cerrar };
}

export function abrirLlenar({ host, datos, esc, modal, redes = ['instagram', 'facebook'], onHecho = () => {}, onVer = () => {} }) {
  const D = dialogo({ host, modal, titulo: 'Llenar la semana', id: 'ctLlT' });
  let dias = 7, sel = new Set(redes), plan = null, asign = [], horas = [], pide = '', ocupado = false, seq = 0;
  const cuenta = () => { const mk = asign.filter(a => a === 'marketing').length, vu = asign.filter(a => a.startsWith('v:')).length; return { mk, vu, n: mk + vu }; };
  function pie() {
    const { mk, vu, n } = cuenta();
    D.foot.innerHTML = `<span class="pz-state" role="status" aria-live="polite">${n ? `${mk ? `${mk} para Marketing` : ''}${mk && vu ? ' · ' : ''}${vu ? `${vu} ${vu === 1 ? 'vuelve' : 'vuelven'}` : ''}` : ''}</span><span class="sp"></span><button type="button" class="pz-btn" data-a="x">Cancelar</button><button type="button" class="pz-go" data-a="ok"${n && !ocupado ? '' : ' disabled'}>${ocupado ? 'Creando…' : n ? `Crear ${n}` : 'Crear'}</button>`;
  }
  async function cargar() {
    const my = ++seq; D.body.setAttribute('aria-busy', 'true');
    try { const p = await datos.llenar({ desde: hoyYmd(), dias, redes: [...sel] }); if (my !== seq) return; plan = p; asign = p.huecos.map(h => (h.que === 'vuelve' ? 'v:' + h.vuelve : 'marketing')); horas = p.huecos.map(h => h.hora); pintar(); }
    catch (e) { if (my !== seq) return; D.body.innerHTML = `<p class="ct-empty" role="alert">${esc(e.message)}</p>`; }
    D.body.removeAttribute('aria-busy');
  }
  function fila(h, i) {
    const largo = `${diaCorto(h.fecha)}`;
    const ops = `<option value="marketing"${asign[i] === 'marketing' ? ' selected' : ''}>Borrador nuevo de Marketing</option>${plan.vuelven.map(v => `<option value="v:${esc(v.id)}"${asign[i] === 'v:' + v.id ? ' selected' : ''}>Vuelve: «${esc((v.titulo || v.texto || 'sin título').slice(0, 48))}» · ${numeroCorto(v.resultado.alcance)} de alcance</option>`).join('')}<option value=""${asign[i] === '' ? ' selected' : ''}>Nada: dejar el hueco</option>`;
    return `<li class="ll-h${asign[i] ? '' : ' off'}"><div class="ll-dia"><b>${esc(largo)}</b><input type="time" class="pz-in ll-hora" step="900" value="${esc(horas[i])}" data-ll-hora="${i}" aria-label="Hora del ${esc(largo)}"></div>
      <select class="pz-sel ll-que" data-ll-que="${i}" aria-label="Qué va el ${esc(largo)}">${ops}</select><small class="ll-r">${esc(h.razon || '')}</small></li>`;
  }
  function pintar() {
    const p = plan, n = p.huecos.length, rs = [...sel];
    const vu = p.vuelven.length
      ? `<section class="ll-vu" aria-labelledby="llVu"><h4 id="llVu">Lo que funcionó y puede volver <b>${p.vuelven.length}</b></h4><p class="pz-hn">Lo publicado con más interacciones que la mitad de lo tuyo, que no ha salido en ${SEMANAS_SIN_REPETIR} semanas. Vuelve tal cual (con sus archivos) y en revisión: lo apruebas tú.</p>
        <ul>${p.vuelven.map(v => `<li><span class="ll-vt">${badges(v.redes)}</span><span class="ll-vm"><b>${esc((v.titulo || v.texto || 'sin título').slice(0, 70))}</b><small>Salió el ${esc(diaCorto(v.ultima))} · ${numeroCorto(v.resultado.alcance)} de alcance · ${numeroCorto(v.resultado.interacciones)} interacciones</small></span></li>`).join('')}</ul></section>`
      : `<p class="pz-hn ll-novu">Nada puede volver todavía: hace falta lo ya publicado con sus cifras (Analíticas) y que haya salido hace más de ${SEMANAS_SIN_REPETIR} semanas.</p>`;
    D.body.innerHTML = `<div class="ll-opts"><label>Días <select class="pz-sel" data-ll="dias"><option value="7"${dias === 7 ? ' selected' : ''}>los próximos 7</option><option value="14"${dias === 14 ? ' selected' : ''}>los próximos 14</option></select></label>
        <div class="ll-redes" role="group" aria-label="En qué redes">${redes.map(r => `<button type="button" class="pz-net" data-ll-red="${r}" aria-pressed="${sel.has(r)}">${nbRed(r)} ${esc(RED[r]?.name || r)}</button>`).join('')}</div></div>
      <p class="ll-intro">${n ? `<b>${n} ${n === 1 ? 'día' : 'días'}</b> sin nada en ${esc(nombresRedes(rs))}. Cada hueco va a ${esc(FUENTE[p.hora?.fuente] || FUENTE.ninguna)}; cámbiala si quieres.` : `No hay huecos en ${dias === 7 ? 'los próximos 7 días' : 'los próximos 14 días'}: todos tienen algo en ${esc(nombresRedes(rs))}.${dias === 7 ? ' Prueba con 14.' : ''}`}</p>
      ${n ? `<ol class="ll-list">${p.huecos.map(fila).join('')}</ol>` : ''}
      ${vu}
      <label class="ll-pide">Para Marketing (opcional)<textarea class="pz-ta" rows="2" data-ll="pide" maxlength="600" placeholder="Por ejemplo: esta semana empujamos el examen gratis.">${esc(pide)}</textarea></label>
      <p class="pz-hn">${p.demo ? 'En la demo no hay agentes: los huecos de Marketing quedan como borradores vacíos.' : `Los borradores nuevos los escribe ${esc(p.agente || 'Marketing')} con una imagen del Estudio y te llegan como borradores. Nada sale sin tu OK.`}</p>`;
    pie();
  }
  async function crear() {
    const huecos = plan.huecos.map((h, i) => ({ fecha: h.fecha, hora: horas[i] || h.hora, que: asign[i] === 'marketing' ? 'marketing' : asign[i] ? 'vuelve' : '', vuelve: asign[i]?.startsWith('v:') ? asign[i].slice(2) : undefined })).filter(h => h.que);
    if (!huecos.length) return;
    ocupado = true; pie();
    let r;
    try { r = await datos.llenarHacer({ huecos, redes: [...sel], pide }); }
    catch (e) { ocupado = false; pie(); const s = D.foot.querySelector('.pz-state'); s.textContent = e.message; s.classList.add('bad'); return; }
    try { onHecho(r); } catch {}
    const vueltas = (r.creadas || []).filter(c => String(c.origen || '').startsWith('vuelve:'));
    D.body.innerHTML = `<div class="ll-hecho" role="status" tabindex="-1"><p><b>Listo.</b></p><ul>
        ${vueltas.length ? `<li>${vueltas.length} ${vueltas.length === 1 ? 'vuelve' : 'vuelven'}, en revisión: ${vueltas.map(c => `«${esc((c.titulo || 'sin título').slice(0, 50))}» el ${esc(diaCorto(c.fecha))} a las ${esc(c.hora)}`).join('; ')}.</li>` : ''}
        ${r.tarea ? `<li>${r.pedidos} ${r.pedidos === 1 ? 'pedido' : 'pedidos'} a Marketing: la tarea «${esc(r.tarea.titulo)}» para ${esc(r.tarea.agente || 'Marketing')}. Sus borradores llegan a esos días en unos minutos.</li>` : r.pedidos ? `<li>${r.pedidos} ${r.pedidos === 1 ? 'hueco' : 'huecos'} para Marketing${r.demo ? ', como borradores vacíos (en la demo no hay agentes)' : ''}.</li>` : ''}
        ${(r.errores || []).map(e => `<li class="bad">${esc(e)}</li>`).join('')}</ul>
        <p>Los apruebas en PROGRAMACIÓN, en «Borradores de la semana»: uno a uno o todos los que pueden salir con un clic.</p></div>`;
    D.foot.innerHTML = '<span class="sp"></span><button type="button" class="pz-btn" data-a="x">Cerrar</button><button type="button" class="pz-go" data-a="ver">Ver en Programación</button>';
    D.foot.querySelector('[data-a="ver"]').focus();
  }
  D.dlg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'x') { D.cerrar(); return; }
    if (b.dataset.a === 'ver') { D.cerrar(); onVer(); return; }
    if (b.dataset.a === 'ok' && !b.disabled) { crear(); return; }
    if (b.dataset.llRed) { const r = b.dataset.llRed; if (sel.has(r) && sel.size === 1) return; sel.has(r) ? sel.delete(r) : sel.add(r); b.setAttribute('aria-pressed', sel.has(r)); cargar().then(() => D.body.querySelector(`[data-ll-red="${r}"]`)?.focus()); }
  });
  D.dlg.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.ll === 'dias') { dias = +t.value; cargar().then(() => D.body.querySelector('[data-ll="dias"]')?.focus()); return; }
    if (t.dataset.llHora !== undefined) { if (/^\d{2}:\d{2}$/.test(t.value)) horas[+t.dataset.llHora] = t.value; return; }
    if (t.dataset.llQue !== undefined) {
      const i = +t.dataset.llQue; asign[i] = t.value;
      if (t.value.startsWith('v:')) asign.forEach((a, j) => { if (j !== i && a === t.value) { asign[j] = 'marketing'; const s = D.body.querySelector(`[data-ll-que="${j}"]`); if (s) s.value = 'marketing'; } }); // una pieza vuelve una sola vez
      D.body.querySelectorAll('.ll-h').forEach((li, j) => li.classList.toggle('off', !asign[j]));
      pie();
    }
  });
  D.dlg.addEventListener('input', e => { if (e.target.dataset.ll === 'pide') pide = e.target.value; });
  pie(); cargar().then(() => (D.body.querySelector('[data-ll="dias"]') || D.dlg.querySelector('[data-a="x"]'))?.focus());
}

export function abrirPlantillas({ host, datos, esc, modal, onUsar = () => {} }) {
  const D = dialogo({ host, modal, titulo: 'Desde una plantilla', id: 'ctTpT' });
  let lista = [], armado = -1, armT = 0;
  D.foot.innerHTML = '<span class="pz-state" role="status" aria-live="polite"></span><span class="sp"></span><button type="button" class="pz-btn" data-a="x">Cerrar</button>';
  const estado = (t, mal) => { const s = D.foot.querySelector('.pz-state'); s.textContent = t; s.classList.toggle('bad', !!mal); };
  function pintar() {
    D.body.innerHTML = lista.length
      ? `<p class="pz-hn">Son notas del Cerebro (Contenido/Plantillas): se corrigen allí a mano y viajan con el equipo. Se guardan desde el pie de una pieza, «Guardar como plantilla».</p><ul class="tp-list">${lista.map((t, i) => `<li class="tp-i"><div class="tp-m"><b>${esc(t.nombre)}</b><span class="tp-f">${FICON[t.formato] || ''}${esc(nombreFormato((t.redes || [])[0] || 'instagram', t.formato))}${Object.keys(t.formatos || {}).length ? ' y otros por red' : ''}</span><span class="tp-r">${badges(t.redes || [])}</span><p>${esc(String(t.texto || t.comentario || t.hashtags || '').replace(/\s+/g, ' ').slice(0, 150))}</p></div>
          <div class="tp-a"><button type="button" class="pz-go sm" data-usar="${i}" aria-label="Usar «${esc(t.nombre)}»">Usar</button><button type="button" class="pz-lk warn" data-borrar="${i}" aria-label="${armado === i ? 'Pulsa otra vez para borrar' : 'Borrar'} «${esc(t.nombre)}»">${armado === i ? 'Pulsa otra vez' : 'Borrar'}</button></div></li>`).join('')}</ul>`
      : '<p class="ct-empty">Todavía no tienes plantillas. Abre una pieza que se repite (la promo del mes, un testimonio…) y, al pie, «Guardar como plantilla».</p>';
  }
  async function cargar() { try { lista = await datos.plantillas(); pintar(); } catch (e) { D.body.innerHTML = `<p class="ct-empty" role="alert">${esc(e.message)}</p>`; } }
  D.dlg.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'x') { D.cerrar(); return; }
    if (b.dataset.usar !== undefined) { const t = lista[+b.dataset.usar]; D.cerrar(); if (t) onUsar(t); return; }
    if (b.dataset.borrar !== undefined) {
      const i = +b.dataset.borrar, t = lista[i]; if (!t) return;
      if (armado !== i) { armado = i; clearTimeout(armT); armT = setTimeout(() => { armado = -1; if (document.contains(D.dlg)) { pintar(); } }, 5000); pintar(); D.body.querySelector(`[data-borrar="${i}"]`)?.focus(); return; }
      armado = -1; clearTimeout(armT);
      try { await datos.borrarPlantilla(t.nombre); estado(`Plantilla «${t.nombre}» a la papelera.`); await cargar(); (D.body.querySelector('[data-usar]') || D.dlg.querySelector('[data-a="x"]'))?.focus(); }
      catch (er) { estado(er.message, true); }
    }
  });
  cargar().then(() => (D.body.querySelector('[data-usar]') || D.dlg.querySelector('[data-a="x"]'))?.focus());
}
