// MEDIR (Fases A6 y A7, 9 oct 2026) en el panel de Anuncios: el bloque del Resumen con «Informe del mes» y «Crear indicadores», y la
// ventana del informe (role="dialog", modal.open/close) con el selector de mes, «Copiar» y «Guardar en el Cerebro». El texto lo arma el
// servidor (anuncios/informe.mjs, sin modelo); en la demo y en «Ver con datos de ejemplo», lo mismo con los datos de ejemplo
// (src/anuncios/datos.js), y guardar no se puede. El Markdown se pinta con el mismo pintor seguro que el informe de redes.
import { esc, svg } from './comun.js';
import { informeHTML, mesesAtras, nombreMes } from '../analiticas-informe.js';

/** El bloque «Medir» del Resumen: el informe y, si faltan, los indicadores de «Cómo va el negocio» (el ROAS solo con píxel y compras). */
export function medirHTML(d) {
  const ind = d?.indicadores || null, rp = ind?.roasPosible || { puede: false, motivo: '' };
  const tiene = ind ? [ind.gasto && 'el gasto del mes', ind.costo && 'el costo por resultado de 30 días', ind.roas && 'el ROAS de 30 días'].filter(Boolean) : [];
  const faltan = ind ? !ind.gasto || !ind.costo || (!ind.roas && rp.puede) : false;
  const roasNota = ind && !ind.roas && !rp.puede && rp.motivo ? `<p class="anu-ayuda">${esc(rp.motivo)}</p>` : '';
  const indic = !ind ? '' : faltan
    ? `<div class="anu-medir-it"><h3>Llevar a «Cómo va el negocio»</h3><p>El gasto del mes, el costo por resultado de 30 días${rp.puede ? ' y el ROAS' : ''}, con su tendencia, al lado de tus otros indicadores. Cada lectura de Meta los pone al día (un punto por día): son las mismas cifras de este panel.</p>${roasNota}<div class="anu-acts"><button type="button" class="anu-btn" data-a="indicadores">Crear indicadores</button></div></div>`
    : `<div class="anu-medir-it"><h3>En «Cómo va el negocio»</h3><p>Ya están ${esc(tiene.join(', '))}: se ponen al día con cada lectura de Meta (tecla N).</p>${roasNota}</div>`;
  return `<section class="anu-sec anu-medir" aria-labelledby="anuMedT"><h2 id="anuMedT">Medir</h2><div class="anu-medir-caja">
    <div class="anu-medir-it"><h3>Informe del mes</h3><p>Lo gastado, cada campaña con su costo por resultado, los mejores creativos, lo que se aplicó de las sugerencias y qué pasó, y lo que se pausó o activó. Lo arma la oficina con sus datos, sin un modelo: lo que no sabe dice «sin datos».</p>
      <div class="anu-acts"><button type="button" class="anu-btn pri" data-a="informe">Informe del mes</button></div></div>${indic}${conversionesHTML(d?.conversiones)}</div></section>`;
}

const hora = iso => { const t = Date.parse(iso || ''); return Number.isFinite(t) ? new Date(t).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''; };
/**
 * Fase A6 (10 oct 2026): la API DE CONVERSIONES en «Medir». Apagada o encendida (en palabras, nunca solo un color), lo enviado hoy, el
 * último error, y cuándo conviene cada vía. `c` es GET /api/anuncios → `conversiones` (sin datos personales); sin él (otra oficina), nada.
 */
export function conversionesHTML(c) {
  if (!c) return '';
  const cuando = `<p class="anu-ayuda"><b>¿Cuándo conviene?</b> Si vendes en una <b>web</b>, que tu tienda (o Stripe, o un formulario) avise a la oficina: Meta recibe la compra aunque el píxel del navegador se pierda. Si vendes por <b>mensajes</b> (Instagram, Messenger), marca en la conversación de la Bandeja «Registrar venta» o «Registrar contacto calificado»: así Meta aprende qué anuncios traen clientes de verdad, no solo conversaciones.</p>`;
  if (!c.encendida) return `<div class="anu-medir-it" data-conv="apagada"><h3>API de conversiones: apagada</h3><p>Le dice a Meta qué se vendió y quién escribió en serio, desde la oficina (servidor a servidor). El correo y el teléfono van cifrados; nada sale en claro.</p>${cuando}<div class="anu-acts"><button type="button" class="anu-btn" data-a="ajustes">Encenderla en Ajustes</button></div></div>`;
  const h = c.hoy || {}, estado = !c.listo ? `Encendida, pero no puede mandar: ${esc(c.motivo || '')}` : `Encendida. Hoy: ${h.enviados || 0} evento(s) enviados (${h.compras || 0} compra(s), ${h.contactos || 0} contacto(s))${c.pendientes ? `; ${c.pendientes} esperando para reintentar` : ''}.`;
  const err = c.ultimoError && (!c.ultimoEnvioAt || c.ultimoErrorAt > c.ultimoEnvioAt || c.fallos) ? `<p class="anu-ayuda anu-conv-err" role="note"><b>Último error${c.ultimoErrorAt ? ` (${esc(hora(c.ultimoErrorAt))})` : ''}:</b> ${esc(c.ultimoError)}</p>` : '';
  const ult = c.ultimoEnvioAt ? `<p class="anu-ayuda">Último envío: ${esc(hora(c.ultimoEnvioAt))}.</p>` : '';
  return `<div class="anu-medir-it" data-conv="encendida"><h3>API de conversiones</h3><p>${estado}</p>${ult}${err}${cuando}
    <div class="anu-acts">${c.prueba ? '<button type="button" class="anu-btn" data-a="conv-probar">Mandar un evento de prueba</button>' : '<span class="anu-ayuda">Para probarla, pon el código de «Probar eventos» en Ajustes → Anuncios.</span>'}<button type="button" class="anu-btn" data-a="ajustes">Ajustes</button></div></div>`;
}

/** La ventana del informe. → { abrir(desde), cerrar(devolver), abierto() } */
export function crearVentanaInforme({ ov, datos, modal, decir, enEjemplo }) {
  const fondo = document.createElement('div'); fondo.className = 'anu-fondo anu-fondo-inf'; fondo.hidden = true;
  fondo.innerHTML = `<div class="anu-dlg anu-dlg-inf" role="dialog" aria-modal="true" aria-labelledby="anuInfT" tabindex="-1">
    <div class="anu-bcab"><h2 id="anuInfT">Informe de anuncios del mes</h2><button type="button" class="anu-icb" data-infx aria-label="Cerrar el informe" title="Cerrar (Esc)">${svg('x')}</button></div>
    <div class="anu-inf-barra"><label class="anu-sel"><span>Mes</span><select data-infmes></select></label><span class="anu-inf-sp"></span>
      <button type="button" class="anu-btn" data-infcopiar>Copiar</button><button type="button" class="anu-btn pri" data-infguardar>Guardar en el Cerebro</button></div>
    <p class="anu-inf-estado" role="status" aria-live="polite"></p>
    <article class="anu-inf-t" tabindex="0" aria-label="El informe del mes"></article></div>`;
  ov.appendChild(fondo);
  const $ = s => fondo.querySelector(s), sel = $('[data-infmes]'), art = $('.anu-inf-t'), estado = $('.anu-inf-estado');
  const I = { mes: null, r: null, origen: null, pide: 0 };

  async function cargar() {
    const n = ++I.pide; I.r = null; estado.textContent = '';
    art.innerHTML = '<p class="anu-cargando">Armando el informe…</p>';
    const r = await datos.informe(I.mes, { ejemplo: enEjemplo() });
    if (n !== I.pide || fondo.hidden) return;
    I.r = r.status === 200 ? r : null;
    art.innerHTML = I.r ? informeHTML(r.texto, esc) : `<p class="anu-aviso-error" role="alert">No se pudo armar el informe: ${esc(r.motivo || 'la oficina no contestó')}</p>`;
    $('[data-infguardar]').disabled = !I.r; $('[data-infcopiar]').disabled = !I.r;
    decir(I.r ? `Informe de ${nombreMes(I.mes)}${r.cifras?.gasto == null ? ': sin datos de gasto' : ''}.` : 'No se pudo armar el informe.');
  }
  async function abrir(desde) {
    I.origen = desde || null;
    const meses = mesesAtras(new Date(), 12);
    if (!I.mes || !meses.includes(I.mes)) I.mes = meses[0];
    sel.innerHTML = meses.map((m, i) => `<option value="${m}"${m === I.mes ? ' selected' : ''}>${esc(nombreMes(m))}${i === 0 ? ' (en curso)' : ''}</option>`).join('');
    fondo.hidden = false; modal.open(fondo);
    setTimeout(() => sel.focus(), 20);
    await cargar();
  }
  function cerrar(devolver = true) {
    if (fondo.hidden) return false;
    I.pide++; modal.close(fondo); fondo.hidden = true; art.innerHTML = ''; estado.textContent = '';
    if (devolver) { const o = I.origen && document.contains(I.origen) ? I.origen : ov.querySelector('[data-a="informe"]'); o?.focus({ preventScroll: true }); }
    return true;
  }
  async function guardar(b) {
    if (!I.r) return;
    b.disabled = true; estado.textContent = 'Guardando…';
    const r = await datos.guardarInforme(I.mes, { ejemplo: enEjemplo() });
    b.disabled = false;
    estado.textContent = r.status === 200 && r.nota ? `Guardado en el Cerebro: ${r.nota}. Los agentes lo encuentran y el resumen del lunes lo cita el mes que viene.` : `No se guardó: ${r.motivo || 'la oficina no contestó'}`;
  }
  async function copiar() {
    try { await navigator.clipboard.writeText(I.r?.texto || ''); estado.textContent = 'Copiado: es Markdown, pégalo donde quieras.'; }
    catch { estado.textContent = 'No se pudo copiar: selecciona el texto del informe.'; }
  }
  fondo.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-infx')) return cerrar();
    if (b.hasAttribute('data-infguardar')) return guardar(b);
    if (b.hasAttribute('data-infcopiar')) return copiar();
  });
  fondo.addEventListener('change', e => { if (e.target === sel) { I.mes = sel.value; cargar(); } });
  fondo.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrar(); } });
  fondo.addEventListener('pointerdown', e => { if (e.target === fondo) cerrar(); });
  return { abrir, cerrar, abierto: () => !fondo.hidden };
}
