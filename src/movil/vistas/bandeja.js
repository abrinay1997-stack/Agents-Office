// Versión móvil (25 oct 2026) — BANDEJA: los comentarios y los mensajes privados de Instagram y Facebook (Meta), hechos para contestar con el
// pulgar. La lista dice red, cuenta y «en un anuncio»; tocar abre el HILO a pantalla completa con la publicación, la conversación, el borrador
// que dejó un agente (editable) y, solo para el dueño, ENVIAR con un segundo toque en una hoja. La ventana de 24 h de los mensajes se ve
// siempre (y fuera de ella no hay botón de enviar); ocultar un comentario se puede DESHACER y nunca borra. Las reglas son las del servidor
// (contenido/bandeja.mjs): un agente solo deja borradores; aquí solo se decide y se ve. Lógica pura reutilizada: src/contenido-bandeja.js.
import { accionesDe, ventanaDe, esConversacion, ultimoMensaje, publicacionDe, fuenteDe } from '../../contenido-bandeja.js';
import { cuentaDeItem, cuentaLinea, comoCuenta, opcionesCuentaBandeja } from '../../bandeja-cuenta.js';
import { esc, svg, vacio, esqueleto, falla, hace } from '../ui.js';
import { iconoRed, con, NOMBRE_RED, motivo } from './d-comun.js';

const TIPO = { conversaciones: 'Mensaje', comentarios: 'Comentario', resenas: 'Reseña' };
const EST = { nuevo: ['Sin responder', 'aviso'], borrador: ['Con borrador', 'info'], respondido: ['Respondido', 'bien'], descartado: ['Descartado', ''], fallo: ['No salió', 'mal'] };
const MAX_MENSAJE = 1000;
const bytes = t => new TextEncoder().encode(String(t || '')).length;
const FILTROS = [['pendiente', 'Pendientes'], ['mensajes', 'Mensajes'], ['comentarios', 'Comentarios'], ['anuncios', 'En anuncios'], ['respondido', 'Respondidos']];
const cuando = m => { const t = Date.parse(m.cuando || m.llego || ''); return Number.isFinite(t) ? hace(t) : ''; };

export function montarBandeja(host, ctx, { alContar = () => {} } = {}) {
  const el = document.createElement('div'); el.className = 'mv-scroll md-bandeja'; el.setAttribute('aria-label', 'Bandeja');
  el.innerHTML = `<div class="mv-chips md-filtros" role="group" aria-label="Qué ver">${FILTROS.map(([k, n]) => `<button type="button" class="mv-chip" data-f="${k}" aria-pressed="false">${n}<b data-nf="${k}"></b></button>`).join('')}</div>
    <div class="mv-cuerpo md-b-cuerpo" aria-live="polite"></div>`;
  host.append(el);
  const cuerpo = el.querySelector('.md-b-cuerpo');
  const S = { cuenta: '', items: [], d: null, f: 'pendiente', cargado: false, error: null, timer: null, abierta: null };

  async function cargar({ silencioso = false } = {}) {
    if (!silencioso && !S.cargado) cuerpo.innerHTML = esqueleto(4);
    try { S.d = await ctx.api('/api/contenido/bandeja?abierta=1'); S.items = S.d.items || []; S.cargado = true; S.error = null; alContar(S.d.pendientes || 0); }
    catch (e) { S.error = motivo(e); }
    pintar(); if (S.abierta) repintarHilo();
  }
  const pendiente = m => ['nuevo', 'borrador', 'fallo'].includes(m.estado);
  const pasa = (m, f) => f === 'pendiente' ? pendiente(m) : f === 'mensajes' ? m.tipo === 'conversaciones' : f === 'comentarios' ? m.tipo === 'comentarios' : f === 'anuncios' ? !!m.enAnuncio : m.estado === 'respondido';

  function fila(m) {
    const a = accionesDe(m), ult = esConversacion(m) ? ultimoMensaje(m) : null, txt = ult ? `${ult.de === 'tu' ? 'Tú: ' : ''}${ult.texto || '(adjunto)'}` : m.texto;
    const est = EST[m.estado] || EST.nuevo;
    return `<li><button type="button" class="md-bj" data-id="${esc(m.id)}">
      <span class="md-av" aria-hidden="true">${esc((m.autor || '?').trim().charAt(0).toUpperCase())}<i>${iconoRed(m.red === 'facebook' && m.tipo === 'conversaciones' ? 'messenger' : m.red, { tam: 16 })}</i></span>
      <span class="md-bj-c"><span class="md-bj-q"><b>${esc(m.autor || 'Alguien')}</b><small>${TIPO[m.tipo] || ''}${m.puntuacion != null ? ` · ${m.puntuacion}★` : ''} · ${esc(cuando(m))}</small></span>
        ${cuentaDeItem(m) ? `<span class="md-bj-cta" data-bj-cuenta>${esc(cuentaLinea(cuentaDeItem(m)))}</span>` : ''}
        <span class="md-bj-t">${esc(String(txt || '').replace(/\s+/g, ' ').slice(0, 140))}</span>
        <span class="md-pz-m"><span class="md-chip ${est[1]}">${est[0]}</span>${a.anuncio ? `<span class="md-chip info">EN UN ANUNCIO: ${esc(a.anuncio.nombre.slice(0, 28))}</span>` : ''}${a.ventana ? `<span class="md-chip ${a.ventana.abierta ? 'bien' : 'mal'}" data-vt="${esc(m.id)}">${esc(a.ventana.corto)}</span>` : ''}${a.oculto ? '<span class="md-chip">Oculto</span>' : ''}${m.sospecha ? '<span class="md-chip mal">🛡 revisar</span>' : ''}${a.sugerencia ? '<span class="md-chip aviso">Sugieren ocultarlo</span>' : ''}</span></span></button></li>`;
  }
  function pintar() {
    el.querySelectorAll('[data-f]').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.f === S.f)); const n = S.items.filter(m => pasa(m, b.dataset.f)).length, nb = b.querySelector('b'); nb.textContent = n; nb.hidden = !n; });
    if (!S.cargado) { cuerpo.innerHTML = S.error ? falla(S.error) : esqueleto(4); return; }
    const lista = S.items.filter(m => pasa(m, S.f) && (!S.cuenta || m.cuentaId === S.cuenta));
    const oc = opcionesCuentaBandeja(S.d), selC = oc.length ? `<label class="mv-lab" for="mdBjCta">Cuenta</label><select id="mdBjCta" data-cuenta-sel>${oc.map(([k, n]) => `<option value="${esc(k)}"${k === S.cuenta ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>` : '';
    const mm = S.d?.fuentes?.meta?.mensajes, franja = mm && mm.ok === false ? `<p class="md-aviso">Los mensajes privados esperan el acceso avanzado de Meta (${esc(mm.motivo || 'aún no está')}). Los comentarios siguen llegando.</p>` : '';
    const mod = S.d?.modo === 'simulacro' ? '<p class="md-aviso">Modo simulacro: lo que envíes se apunta, pero no sale de verdad.</p>' : S.d?.modo === 'apagado' ? '<p class="md-aviso">La publicación está apagada: ninguna respuesta sale.</p>' : '';
    cuerpo.innerHTML = selC + franja + mod + (lista.length ? `<ul class="md-lista">${lista.map(fila).join('')}</ul>` : vacio(S.f === 'pendiente' ? 'Nadie espera respuesta' : 'Nada por aquí', S.f === 'pendiente' ? 'Cuando alguien comente o escriba, lo verás aquí.' : 'Prueba con otro filtro.', { icono: 'check' }));
  }

  // ---------------------------------------------------------------- el hilo (pantalla completa)
  function hiloHTML(m) {
    const a = accionesDe(m), pub = publicacionDe(m), conv = esConversacion(m), cerrado = m.estado === 'respondido' || m.estado === 'descartado';
    const burbujas = conv ? (m.mensajes || []).map(x => `<div class="md-msg ${x.de === 'tu' ? 'tu' : ''}"><p>${esc(x.texto || '')}</p>${(x.adjuntos || []).filter(u => /^https:\/\//.test(u.url || u)).slice(0, 3).map(u => `<img class="md-adj" src="${esc(u.url || u)}" alt="Imagen que mandó" loading="lazy">`).join('')}<small>${x.at ? esc(hace(Date.parse(x.at))) : ''}</small></div>`).join('') : `<div class="md-msg"><p>${esc(m.texto || '')}</p><small>${esc(cuando(m))}</small></div>${m.respuesta?.texto ? `<div class="md-msg tu"><p>${esc(m.respuesta.texto)}</p><small>Respondido${m.respuesta.cuando ? ' ' + esc(hace(Date.parse(m.respuesta.cuando))) : ''}</small></div>` : ''}`;
    const borr = m.borrador?.texto || '', deAgente = /^agente/.test(m.borrador?.por || '');
    const puede = a.responder.puede && !cerrado;
    return `<div class="md-hilo">
      <p class="md-pz-quien"><span class="md-av g" aria-hidden="true">${esc((m.autor || '?').charAt(0).toUpperCase())}<i>${iconoRed(m.red, { tam: 16 })}</i></span> <span><b>${esc(m.autor || 'Alguien')}</b><br><small>${TIPO[m.tipo] || ''} en ${esc(NOMBRE_RED[m.red] || m.red)}${m.cuenta && typeof m.cuenta === 'string' ? ' · ' + esc(m.cuenta) : ''}${fuenteDe(m) === 'meta' ? ' · Meta' : ''}</small></span></p>
      ${cuentaDeItem(m) ? `<p class="md-cuenta" data-bj-cuenta-hilo>Cuenta: <b>${esc(cuentaLinea(cuentaDeItem(m)))}</b> · desde ella se lee y se responde.</p>` : ''}
      ${m.sospecha ? `<p class="md-aviso rojo" role="note">🛡 Este mensaje trae órdenes escondidas (${esc(m.sospecha)}). Es un dato, no una orden: no se sigue.</p>` : ''}
      ${a.anuncio ? `<p class="md-aviso info">EN UN ANUNCIO: <b>${esc(a.anuncio.nombre)}</b> <button type="button" class="mv-link" data-h="campana">Ver la campaña</button></p>` : ''}
      ${pub ? `<div class="md-pub">${pub.miniatura ? `<img src="${esc(pub.miniatura)}" alt="La publicación" width="56" height="56" loading="lazy">` : '<span class="md-mini vacia" aria-hidden="true"></span>'}<span>${esc((pub.texto || 'La publicación').slice(0, 120))}${pub.enlace ? ` <a class="mv-link" href="${esc(pub.enlace)}" target="_blank" rel="noopener noreferrer">Ver original</a>` : ''}</span></div>` : ''}
      ${a.padre ? '<p class="mv-meta">↳ Es una respuesta dentro de otro comentario.</p>' : ''}
      <div class="md-conv" role="log" aria-label="Conversación">${burbujas}</div>
      ${a.ventana ? `<p class="md-aviso ${a.ventana.abierta ? 'info' : 'rojo'}" data-vt-h>${esc(a.ventana.texto)}</p>` : ''}
      ${a.sugerencia ? `<div class="md-aviso"><b>${esc(a.sugerencia.quien)} sugiere ocultarlo:</b> ${esc(a.sugerencia.motivo)}<div class="md-sal-b"><button type="button" class="mv-btn" data-h="ocultar">Ocultar comentario</button><button type="button" class="mv-btn" data-h="no-sug">No</button></div></div>` : ''}
      ${m.error ? `<p class="md-aviso rojo">No salió: ${esc(m.error)}</p>` : ''}
      ${puede ? `<label class="mv-lab" for="mdBorr">${deAgente ? 'Borrador que dejó un agente (puedes cambiarlo)' : 'Tu respuesta'}</label>
        <textarea id="mdBorr" class="mv-campo" rows="5" ${conv ? `maxlength="${MAX_MENSAJE - 1}"` : ''} placeholder="Escribe la respuesta…">${esc(borr)}</textarea>
        <p class="mv-meta" data-cuenta aria-live="polite">${conv ? cuentaTxt(borr) : ''}</p>
        <div class="md-acciones"><button type="button" class="mv-btn" data-h="guardar">Guardar borrador</button><button type="button" class="mv-btn primario" data-h="enviar">Enviar…</button></div>`
        : `<p class="md-aviso">${esc(a.responder.motivo || '')}</p>`}
      <div class="md-acciones">
        ${a.ocultar ? `<button type="button" class="mv-btn" data-h="ocultar">${a.ocultar === 'ocultar' ? 'Ocultar comentario' : 'Volver a mostrarlo'}</button>` : ''}
        ${!cerrado ? '<button type="button" class="mv-btn" data-h="descartar">No necesita respuesta</button>' : m.estado === 'descartado' ? '<button type="button" class="mv-btn" data-h="reabrir">Reabrir</button>' : ''}
      </div></div>`;
  }
  const cuentaTxt = t => { const n = [...String(t || '')].length, b = bytes(t); return `${n} de ${MAX_MENSAJE - 1} letras${b > MAX_MENSAJE ? ` · son ${b} bytes: te sobran ${b - MAX_MENSAJE}` : ''}`; };
  const item = id => S.items.find(m => m.id === id);

  function abrirHilo(id) {
    const m = item(id); if (!m) return;
    const h = ctx.hoja({ titulo: `${m.autor || 'Alguien'} · ${TIPO[m.tipo] || ''}`, lleno: true, clase: 'md-hoja-hilo', cuerpo: hiloHTML(m), alCerrar: () => { S.abierta = null; } });
    S.abierta = { id, h };
    h.cuerpo.addEventListener('input', e => { if (e.target.id === 'mdBorr') { const c = h.cuerpo.querySelector('[data-cuenta]'); if (c && esConversacion(item(id))) c.textContent = cuentaTxt(e.target.value); } });
    h.cuerpo.addEventListener('click', async e => {
      const b = e.target.closest('[data-h]'); if (!b) return; const m2 = item(id); if (!m2) return;
      const ta = h.cuerpo.querySelector('#mdBorr'), texto = ta ? ta.value.trim() : '', k = b.dataset.h, base = `/api/contenido/bandeja/${encodeURIComponent(id)}`;
      try {
        if (k === 'campana') { h.cerrar(); setTimeout(() => ctx.navegar('anuncios', { tab: 'campanas', objeto: m2.enAnuncio?.campana || '' }), 200); return; }
        if (k === 'guardar') { await con(b, () => ctx.api(base, { method: 'PATCH', body: { borrador: texto } }), { hecho: 'Guardado' }); await cargar({ silencioso: true }); return; }
        if (k === 'enviar') return enviar(m2, texto, b, h);
        if (k === 'ocultar') return ocultar(m2, b);
        if (k === 'no-sug') { try { sessionStorage.setItem('ao.bj.nosug.' + id, '1'); } catch {} delete m2.sugerirOcultar; repintarHilo(); return; }
        if (k === 'descartar') { await con(b, () => ctx.api(base + '/descartar', { method: 'POST', body: {} }), { hecho: 'Descartado' }); h.cerrar(); await cargar({ silencioso: true }); return; }
        if (k === 'reabrir') { await con(b, () => ctx.api(base + '/reabrir', { method: 'POST', body: {} }), { hecho: 'Reabierto' }); await cargar({ silencioso: true }); }
      } catch (err) { ctx.toast(motivo(err)); }
    });
  }
  function repintarHilo() {
    if (!S.abierta) return; const m = item(S.abierta.id); if (!m) return;
    const ta = S.abierta.h.cuerpo.querySelector('#mdBorr'), tengo = ta ? ta.value : null, enfocado = ta && document.activeElement === ta;
    if (enfocado) return; // no se pisa lo que el dueño está escribiendo
    S.abierta.h.cuerpo.innerHTML = hiloHTML(m); if (tengo && !m.borrador?.texto) { const t2 = S.abierta.h.cuerpo.querySelector('#mdBorr'); if (t2) t2.value = tengo; }
  }

  // ENVIAR: SIEMPRE un segundo toque, en una hoja con lo que saldrá y a quién. Solo el dueño (el servidor lo vuelve a comprobar).
  async function enviar(m, texto, b, hHilo) {
    if (!texto) { ctx.toast('Escribe la respuesta antes de enviarla.'); hHilo.cuerpo.querySelector('#mdBorr')?.focus(); return; }
    const conv = esConversacion(m);
    if (conv) { const v = ventanaDe(m.ventana); if (!v.abierta) { ctx.toast(v.texto); return; } if ([...texto].length >= MAX_MENSAJE || bytes(texto) > MAX_MENSAJE) { ctx.toast(`Es muy largo para Meta: ${cuentaTxt(texto)}.`); return; } }
    const modoTxt = S.d?.modo === 'simulacro' ? '\nEstás en modo simulacro: se apunta como enviado, pero no sale.' : '';
    const si = await ctx.confirmar({ titulo: '¿Enviar esta respuesta?', texto: `${comoCuenta(m) ? `Responder como ${comoCuenta(m)}.\n` : ''}Para ${m.autor || 'esta persona'} en ${NOMBRE_RED[m.red] || m.red}${conv ? ' (mensaje privado)' : ' (comentario público)'}:\n\n«${texto.slice(0, 280)}${texto.length > 280 ? '…' : ''}»\n\nSale una sola vez y no se puede retirar.${modoTxt}`, ok: 'Enviar ahora' });
    if (!si) return;
    const r = await con(b, async () => {
      await ctx.api(`/api/contenido/bandeja/${encodeURIComponent(m.id)}`, { method: 'PATCH', body: { borrador: texto } }).catch(() => {});
      return ctx.api(`/api/contenido/bandeja/${encodeURIComponent(m.id)}/enviar`, { method: 'POST', body: { texto } });
    }, { hecho: 'Enviada', ocupado: 'Enviando…' });
    if (r.ok) { ctx.toast(r.valor?.simulada ? 'Apuntada en el simulacro (no salió de verdad).' : 'Respuesta enviada.'); hHilo.cerrar(); await cargar({ silencioso: true }); }
  }
  async function ocultar(m, b) {
    const o = !m.oculto;
    const r = await con(b, () => ctx.api(`/api/contenido/bandeja/${encodeURIComponent(m.id)}/ocultar`, { method: 'POST', body: { ocultar: o } }), { hecho: o ? 'Oculto' : 'Visible' });
    if (!r.ok) return; const tok = r.valor?.deshacer?.token || r.valor?.deshacer;
    await cargar({ silencioso: true });
    ctx.toast(o ? 'Comentario oculto. Solo tú y quien lo escribió lo ven.' : 'El comentario vuelve a verse.', tok ? { accion: 'Deshacer', alAccion: async () => { try { await ctx.api('/api/contenido/bandeja/deshacer', { method: 'POST', body: { token: tok } }); ctx.toast('Deshecho.'); } catch (e) { ctx.toast(motivo(e)); } cargar({ silencioso: true }); }, ms: 9000 } : {});
  }

  el.addEventListener('change', e => { if (e.target.matches('[data-cuenta-sel]')) { S.cuenta = e.target.value; pintar(); } });
  el.addEventListener('click', e => {
    const f = e.target.closest('[data-f]'); if (f) { S.f = f.dataset.f; pintar(); return; }
    if (e.target.closest('[data-reintentar]')) { cargar(); return; }
    const b = e.target.closest('[data-id]'); if (b) abrirHilo(b.dataset.id);
  });
  ctx.tirar(el, () => cargar({ silencioso: true }));
  // la ventana de 24 h se recalcula cada minuto mientras se ve (y Meta se relee cada minuto mientras la Bandeja está abierta)
  const vivo = () => el.offsetParent !== null && document.visibilityState !== 'hidden';
  S.timer = setInterval(() => { if (vivo()) cargar({ silencioso: true }); }, 60e3);
  return { el, mostrar: () => cargar({ silencioso: S.cargado }), precargar: () => cargar({ silencioso: true }), _S: S };
}
