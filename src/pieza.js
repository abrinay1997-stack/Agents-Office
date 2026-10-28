// Agents Office V4.7 (30 sep 2026) — el PANEL de una pieza de contenido: cuándo sale, dónde, qué archivos, qué dice, y si puede salir.
// Se guarda solo, con una pausa al teclear, y siempre al cerrarlo: el guardado cuelga del cierre y no del botón, o cerrar con Esc o con un
// clic fuera perdería lo escrito.
// V4.10 (1 oct 2026, auditoría CON-07/08/09/10/13/20 y PRE-01…17): el panel es un cajón sobre el calendario (no lo estruja) y, con sitio,
// va en DOS COLUMNAS: a la izquierda lo que se edita, a la derecha la vista previa en vivo por red y formato (contenido-preview.js). Con poco
// sitio, «Editar · Vista previa» arriba.
// C1 (8 oct 2026, pedido del dueño tras comparar con Metricool): el editor SE ESCRIBE PRIMERO. Arriba, una ficha por red con SU formato
// (reel en Instagram, post en Facebook: `formatos`, ver contenido-reglas.js) y «N problemas» que se despliega con sus arreglos de un clic;
// en medio, un solo cuadro con el texto, los archivos dentro (se ordenan arrastrando) y una barra: emoji, hashtags (tus juegos y los que más
// usas), primer comentario, enlace, textos guardados (una nota del Cerebro) y «✨ Mejorar con Marketing» (la propuesta de TU agente de
// contenido, con la voz de la marca; nada se guarda solo), con un contador por red. «Editar por red» pone pestañas sobre el mismo cuadro.
// Lo de cada red (la historia de Instagram, Pinterest, YouTube, TikTok) y las notas, plegados. Al pie, siempre a la vista: cuándo sale
// (con las horas rápidas y la mejor hora, que se despliegan) y «Aprobar ▾» (pasar a revisión, volver a borrador, «Publicar ya»).
//   initPieza({ host, datos, esc, pickMedia, openEstudio, onChange, note, otras, cuenta, medidaDe, redesUsadas, mejorHora, fuenteHora, zona, modal })
//     → { open, close, isOpen, current, addMedios, flush, refresh, repaintPreview }
// `datos` es lo de contenido-datos.js; `pickMedia()` abre el selector de la galería del Estudio y devuelve los ids elegidos; `otras()` las
// demás piezas (choques, huecos, la cuadrícula del perfil); `cuenta()` con qué cuenta sale; `medidaDe(id)` las medidas de un archivo.
import { ESTADO, FORMATO, RED, FICON, nbRed, HORAS_RAPIDAS, mediaUrl, thumbHTML } from './pieza-base.js';
import { dateOpts, timeOpts, fmtLong, fmtDay } from './calendar-core.js';
import { LIMITES, postDePieza, aplicarArreglo, textoPara, contarHashtags, revisarPublicacion, revisarMomento, longitudPara, FORMATOS_RED, formatoDe, formatoValido, nombreFormato, ponFormato, formatosConRedes } from './contenido-reglas.js';
import { initPreview } from './contenido-preview.js';
import { iconoRed } from './redes-iconos.js';
import { choqueDe, siguienteHueco, diasRapidos, textoSalida } from './contenido-cola.js';
import { mejoresDelDia, siguienteBuena } from './contenido-hora.js';
import { CADA, MAX_VECES } from './contenido-repetir.js';
import { cuentaDe, nombreCorto, cuentasLimpias } from './contenido-cuentas.js'; // 9 oct 2026: «Publicar en» (qué página, qué Instagram)
import { copiasDeMedios, tipoDeMedio, avisosDeLectura, PIDE_DESDE_IMAGEN } from './vision-copia.js'; // 28 oct 2026: «Mejorar con Marketing» MIRA las fotos y unos cuadros de los videos de la pieza
export { ESTADO, FORMATO, RED, FICON, HORAS_RAPIDAS, mediaUrl, thumbHTML };

// M2 (6 oct 2026): las redes que llevan su propio texto si hace falta (Instagram usa el principal; Facebook, «Texto de Facebook»)
const CON_TEXTO_PROPIO = ['linkedin', 'x', 'threads', 'bluesky', 'tiktok', 'pinterest', 'youtube'];
const PRIV = { youtube: [['public', 'Público'], ['unlisted', 'Oculto (con el enlace)'], ['private', 'Privado']], tiktok: [['PUBLIC_TO_EVERYONE', 'Todos'], ['MUTUAL_FOLLOW_FRIENDS', 'Amigos'], ['FOLLOWER_OF_CREATOR', 'Seguidores'], ['SELF_ONLY', 'Solo yo']] };
// C1: los emojis de la barra — los que más se usan en una publicación de negocio (no el teclado entero: para eso está el del sistema)
const EMOJIS = ['😊', '😍', '🤩', '😎', '🥳', '😂', '🙌', '👏', '🙏', '💪', '👉', '👇', '👀', '✅', '✨', '🔥', '💯', '🎉', '❤️', '💙', '⭐', '🌟', '☀️', '💡', '📌', '📍', '📅', '⏰', '📞', '💬', '📲', '📸', '🎥', '🛍️', '🎁', '💸', '🚀', '👓', '🕶️', '🤓'];
const MEJORAR_PIDE = ['Más corto', 'Más cercano', 'Con más gancho', 'Con una llamada a la acción'];
const SVG = {
  emoji: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.5"/><path d="M6.8 11.6c.8 1.4 1.9 2.1 3.2 2.1s2.4-.7 3.2-2.1"/><circle cx="7.5" cy="8" r=".9" class="fill"/><circle cx="12.5" cy="8" r=".9" class="fill"/></svg>',
  hash: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 3 6.5 17M13.5 3 12 17M3.5 7.5h14M2.5 12.5h14"/></svg>',
  com: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M17 9.5a6.5 6.5 0 0 1-9.6 5.7L3.5 16.5l1.3-3.6A6.5 6.5 0 1 1 17 9.5Z"/></svg>',
  enlace: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8.5 11.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5l-1 1M11.5 8.5a3.5 3.5 0 0 0-5 0L4 11a3.5 3.5 0 0 0 5 5l1-1"/></svg>',
  guardados: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2.5h10v15l-5-3.6-5 3.6Z"/></svg>',
  cal: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="4" width="14" height="13" rx="2"/><path d="M3 8h14M7 2.5v3M13 2.5v3"/></svg>',
  tel: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="6" y="2.5" width="8" height="15" rx="1.8"/><path d="M9 15h2"/></svg>',
  pc: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="4" width="15" height="10" rx="1.5"/><path d="M7.5 17h5M10 14v3"/></svg>',
};
let uid = 0;

/** Qué cambia en la pieza al aplicar el arreglo de un problema (las reglas hablan en «post»; la pieza, en español). */
export function parchePorArreglo(p, codigo) {
  const antes = postDePieza(p), despues = aplicarArreglo(antes, codigo), patch = {};
  if (despues.format !== antes.format) patch.formato = despues.format;
  if (JSON.stringify(despues.formatos || {}) !== JSON.stringify(antes.formatos || {})) patch.formatos = despues.formatos || {}; // C1: el arreglo del formato de una red
  if (despues.hashtagsEnComentario !== antes.hashtagsEnComentario) patch.hashtagsEnComentario = despues.hashtagsEnComentario;
  if (despues.hashtagsFinales !== antes.hashtagsFinales) patch.hashtags = despues.hashtagsFinales;
  if (JSON.stringify(despues.redes) !== JSON.stringify(antes.redes)) { patch.redes = despues.redes; Object.assign(patch, formatosConRedes(p, despues.redes)); }
  if (despues.historiaTambien !== antes.historiaTambien) patch.historiaTambien = despues.historiaTambien;
  const m1 = antes.medios.map(m => m.src), m2 = despues.medios.map(m => m.src); if (JSON.stringify(m1) !== JSON.stringify(m2)) patch.medios = m2;
  return patch;
}

export { choqueDe, siguienteHueco };

/** A4: las redes (Instagram y Facebook) donde esta pieza ya salió y se puede impulsar. */
export function impulsables(p, sal = null) {
  if (!p?.id || p.estado !== 'aprobada' || !sal || !['publicada', 'parcial'].includes(sal.clave)) return [];
  const redes = p.salida?.redes || {};
  return ['instagram', 'facebook'].filter(r => (p.redes || []).includes(r) && (!Object.keys(redes).length || redes[r]?.estado === 'publicada'));
}

/** C1: las redes que pueden llevar su propio texto en esta pieza (Instagram es el principal; Facebook, «Texto de Facebook»). */
export const redesConTexto = p => (p.redes || []).filter(r => r === 'facebook' || CON_TEXTO_PROPIO.includes(r));
/** El texto propio de una red ('' = el principal). */
export const textoPropio = (p, red) => (red === 'facebook' ? String(p.textoFacebook || '') : red ? String(p.textos?.[red] ?? '') : String(p.texto || ''));
/** El cambio que pone `v` como texto de esa red ('' = el principal). */
export const parcheTexto = (p, red, v) => (red === 'facebook' ? { textoFacebook: v } : red ? { textos: { ...(p.textos || {}), [red]: v } } : { texto: v });
/** Los contadores: uno por red con tope de caracteres que no sale como historia, con lo que de verdad sale allí. */
export function contadoresDe(p) {
  const post = postDePieza(p);
  return (p.redes || []).filter(r => LIMITES[r]?.caracteres && formatoDe(p, r) !== 'historia').map(r => { const n = longitudPara(textoPara(post, r), r), max = LIMITES[r].caracteres; return { red: r, n, max, over: n > max }; });
}
/** Quitar o poner un hashtag del campo «Hashtags» (sin repetir, sin mayúsculas que dupliquen). */
export function conHashtag(hashtags, tag, poner = true) {
  const lista = String(hashtags || '').split(/\s+/).filter(Boolean), t = tag.startsWith('#') ? tag : '#' + tag, ya = lista.some(x => x.toLowerCase() === t.toLowerCase());
  if (poner) return ya ? lista.join(' ') : [...lista, t].join(' ');
  return lista.filter(x => x.toLowerCase() !== t.toLowerCase()).join(' ');
}

export function initPieza({ host, datos, esc, pickMedia, openEstudio, onChange = () => {}, note = () => {}, otras = () => [], cuenta = () => ({}), cuentasMeta = () => null, medidaDe = () => null, redesUsadas = () => ['instagram', 'facebook'], mejorHora = async () => null, fuenteHora = () => '', zona = () => null, modal = { open() {}, close() {} } }) { // `modal`: el de la página (este archivo va en otro paquete: una sola pila de ventanas)
  const id0 = ++uid, I = k => `pz${id0}-${k}`;
  let escritorio = false; try { escritorio = localStorage.getItem('ao.ct.pv') === 'pc'; } catch {}
  host.innerHTML = `<div class="pz-head"></div>
    <div class="pz-swap" role="tablist" aria-label="Qué ver"><button type="button" role="tab" data-swap="edit" aria-selected="true">Editar</button><button type="button" role="tab" data-swap="ver" aria-selected="false">Vista previa</button></div>
    <div class="pz-body"><div class="pz-scroll" tabindex="-1"></div><aside class="pz-side" aria-label="Vista previa"><div class="pz-side-h"><span>Así se verá</span><span class="pz-dev" role="group" aria-label="Ver en"><button type="button" data-dev="tel" aria-pressed="${!escritorio}" title="En el teléfono">${SVG.tel}<span>Teléfono</span></button><button type="button" data-dev="pc" aria-pressed="${escritorio}" title="En la computadora">${SVG.pc}<span>Computadora</span></button></span></div><div class="pz-preview"></div><p class="pz-help pz-pvnota">Una aproximación: cada red decide al final cómo corta y encuadra.</p></aside></div>
    <div class="pz-foot"></div>`;
  const head = host.querySelector('.pz-head'), scroll = host.querySelector('.pz-scroll'), foot = host.querySelector('.pz-foot');
  // 9 oct 2026: la vista previa dice la cuenta ELEGIDA de cada red (su nombre y su foto), no la de Ajustes
  const cuentaVista = () => { const base = { ...cuenta() }; if (cur) for (const r of ['instagram', 'facebook']) { const c = cuentaDe(cur, r, cuentasMeta()); if (c && cuentasMeta()?.cuentas?.length) base[r] = { nombre: c.nombre, usuario: c.usuario || '', foto: c.foto || '' }; } return base; };
  const preview = initPreview(host.querySelector('.pz-preview'), { esc, cuenta: cuentaVista, otras: () => otras().map(o => (cur && o.id === cur.id ? cur : o)) });
  preview.escritorio?.(escritorio); host.classList.toggle('pz-pc', escritorio);
  let horaK = '', horaSug = null; // plan M3: la mejor hora de las redes de esta pieza
  let horaRed = ''; try { horaRed = JSON.parse(localStorage.getItem('ao.ct.horaRed') || '""') || ''; } catch {} // C2 (8 oct 2026): las mejores horas de UNA red (vacío = las de la pieza, juntas)
  let masRedes = false, repAbierto = false, tplAbierto = false; // C3 (8 oct 2026): «Guardar como plantilla» abierto en el pie // plan M5 · U7: «Repetir…» abierto en el pie // «Más redes»: las que el negocio no usa, a la vista solo si se piden
  let cur = null, dirty = {}, timer = null, saving = Promise.resolve(), opener = null, isModal = false, gone = false, stateText = '', stateBad = false;
  // C1: lo que el editor recuerda mientras la pieza está abierta
  let ctaAbierta = ''; // 9 oct 2026: la lista de cuentas de esa red, desplegada
  let porRed = false, tab = '', pop = '', verCom = false, verHash = false, verTextoHist = false, avisos = false, cuando = false, menu = false, confirmaYa = 0;
  let abiertos = new Set(), lastSel = null, dragI = null, guard = null, mej = { cargando: false, pide: '', propuesta: null, error: '', anterior: null, red: '', mirar: true, paso: '', lectura: null }, gConfirma = '', cacheVision = new Map();
  // la revisión se calcula aquí, con las mismas reglas que el servidor: se ve al instante, sin esperar al guardado. El servidor la vuelve a comprobar al aprobar.
  const rev = () => {
    const r = revisarPublicacion(postDePieza(cur), cur.redes), m = revisarMomento(cur.fecha, cur.hora);
    return { errores: [...m.errores, ...r.errores], avisos: [...m.avisos, ...r.avisos], arreglos: r.arreglos, momento: m };
  };
  /** Las redes que se ven en el panel: las del negocio y las de esta pieza; con «Más redes», todas. */
  const redesVisibles = () => { if (masRedes) return Object.keys(RED); const u = new Set([...redesUsadas(), ...(cur?.redes || [])]); return Object.keys(RED).filter(r => u.has(r)); };
  const isOpen = () => !host.hidden;
  const soloHistoria = () => cur.redes.every(r => formatoDe(cur, r) === 'historia');

  /* ---------- guardar ---------- */
  const hayAlgo = p => !!(p.titulo || p.texto || (p.medios || []).length || p.comentario || p.hashtags || p.notas);
  function schedule() { clearTimeout(timer); timer = setTimeout(flush, 700); setState('Escribiendo…'); }
  function set(patch) { if (!cur) return; Object.assign(cur, patch); Object.assign(dirty, patch); schedule(); paintReview(); paintFoot(); }
  function flush() {
    clearTimeout(timer); timer = null;
    saving = saving.then(async () => {
      if (!cur || gone || !Object.keys(dirty).length) return;
      const patch = dirty; dirty = {};
      try {
        setState('Guardando…');
        if (!cur.id) { if (!hayAlgo(cur)) { dirty = patch; setState(''); return; } const nueva = await datos.create({ ...cur, ...patch }); adopt(nueva); onChange(nueva, { creada: true }); }
        else { const r = await datos.patch(cur.id, patch); adopt(r.pieza); if (r.soltada) note('Ya no está aprobada: cambiaste algo de lo que sale. Vuelve a aprobarla.'); onChange(r.pieza, { soltada: r.soltada }); }
        setState('Guardado');
      } catch (e) { dirty = { ...patch, ...dirty }; setState(e.message || 'No se pudo guardar', true); }
    });
    return saving;
  }
  function adopt(p) { // lo del servidor (estado, revisión, id, medidas); lo que se está escribiendo no se pisa
    if (!cur) return; cur.id = p.id; cur.estado = p.estado; cur.aprobada = p.aprobada; cur.cambiadaTrasAprobar = p.cambiadaTrasAprobar; cur.creada = p.creada;
    if (p.medidas) cur.medidas = { ...(cur.medidas || {}), ...p.medidas };
    paintHead(); paintReview(); paintFoot();
  }
  function setState(t, bad) { stateText = t; stateBad = !!bad; const s = foot.querySelector('.pz-state'); if (s) { s.textContent = t; s.classList.toggle('bad', !!bad); } }

  /* ---------- pintar ---------- */
  const est = () => ESTADO[cur.estado] || ESTADO.borrador;
  function paintHead() {
    const e = est();
    head.innerHTML = `<span class="pz-chip pz-tone" style="--c:${e.color};--cd:${e.dark}" title="${esc(e.help)}"><i aria-hidden="true">${e.glyph}</i>${e.name}${cur.cambiadaTrasAprobar ? ' · CAMBIÓ' : ''}</span>
      <input class="pz-title" id="${I('t')}" maxlength="140" placeholder="Título (solo se ve aquí)" aria-label="Título de la pieza" value="${esc(cur.titulo)}">
      <button type="button" class="pz-x" data-a="close" aria-label="Cerrar la pieza" title="Cerrar (Esc)">✕</button>`;
  }
  const cnt = (n, max) => `${n.toLocaleString('es')} / ${max.toLocaleString('es')}`;
  function paintCuando() {
    const box = foot.querySelector('.pz-cuando'); if (!box) return;
    const p = cur, ch = choqueDe(p, otras()), m = revisarMomento(p.fecha, p.hora);
    box.innerHTML = `<div class="pz-row"><label for="${I('d')}">Día</label><select id="${I('d')}" class="pz-sel" data-f="fecha"><option value=""${p.fecha ? '' : ' selected'}>Sin día (banco de ideas)</option>${dateOpts(p.fecha)}</select>
        <label for="${I('h')}">Hora</label><select id="${I('h')}" class="pz-sel" data-f="hora"><option value=""${p.hora ? '' : ' selected'}>Sin hora</option>${timeOpts(p.hora)}</select></div>
      <div class="pz-row pz-quick pz-qdays" role="group" aria-label="Días rápidos">${diasRapidos(p.redes, otras(), { excluir: p.id }).map(d => `<button type="button" class="pz-qd" data-qd="${d.fecha}" aria-pressed="${p.fecha === d.fecha}" aria-label="${esc(d.largo)}${d.n ? `: ya ${d.n === 1 ? 'sale 1 pieza' : `salen ${d.n} piezas`}` : ': libre'}">${esc(d.corto)}${d.n ? `<i aria-hidden="true">${d.n}</i>` : ''}</button>`).join('')}</div>
      <div class="pz-best">${bestHTML()}</div>
      <div class="pz-row pz-quick" role="group" aria-label="Horas rápidas">${HORAS_RAPIDAS.map(h => `<button type="button" class="pz-qh" data-qh="${h}" aria-pressed="${p.hora === h}">${h}</button>`).join('')}<button type="button" class="pz-qh wide" data-a="hueco" title="El siguiente día sin nada en estas redes">Siguiente hueco libre</button></div>
      ${ch ? `<p class="pz-inline warn" role="status">Ya hay ${esc(FORMATO[ch.formato]?.toLowerCase() === 'historia' ? 'una historia' : 'un ' + (FORMATO[ch.formato] || 'post').toLowerCase())} a las ${esc(ch.hora)} ese día: «${esc(ch.titulo || 'sin título')}». Sepáralas al menos una hora.</p>` : ''}
      ${p.fecha && m.errores.length ? `<p class="pz-inline err" role="status">${esc(m.errores[0])}</p>` : p.fecha && p.hora ? `<p class="pz-inline ok">Sale ${esc(fmtLong(m.momento))}.${zonaTxt()}</p>` : ''}`;
  }
  /** C2 (8 oct 2026): de qué reloj es esa hora — el de la computadora de la oficina, con su desfase de UTC. */
  function zonaTxt() { const z = zona(); if (!z?.utc) return ''; const c = String(z.nombre || '').includes('/') ? String(z.nombre).split('/').pop().replace(/_/g, ' ') : ''; return ` <span class="pz-zona">Hora ${c ? 'de ' + esc(c) + ' ' : 'de esta computadora '}(${esc(z.utc)}).</span>`; }
  /** Las mejores horas (Metricool o lo ya publicado): las de ese día, o el siguiente hueco bueno si aún no tiene día. */
  function bestHTML() {
    const p = cur; if (!p) return '';
    const redesH = horaRed && p.redes.includes(horaRed) ? [horaRed] : [...p.redes], hk = [...redesH].sort().join(',');
    const sel = p.redes.length > 1 ? `<label class="pz-hred">Mejores horas de <select class="pz-sel" data-hred aria-label="Mejores horas de qué red"><option value="">sus ${p.redes.length} redes, juntas</option>${p.redes.map(r => `<option value="${r}"${redesH.length === 1 && redesH[0] === r ? ' selected' : ''}>${esc(RED[r]?.name || r)}</option>`).join('')}</select></label>` : '';
    if (hk !== horaK) {
      horaK = hk; horaSug = null;
      mejorHora(redesH).then(v => { if (cur && horaK === hk) { horaSug = v; const b = foot.querySelector('.pz-best'), a = document.activeElement, enSel = !!a?.matches?.('[data-hred]'); if (b && (!b.contains(a) || enSel)) { b.innerHTML = bestHTML(); if (enSel) b.querySelector('[data-hred]')?.focus(); } paintCuandoBtn(); } }).catch(() => {});
      return sel;
    }
    const v = horaSug; if (!v) return sel;
    if (!v.grid) return sel + (v.motivo ? `<p class="pz-help">${esc(v.motivo)}</p>` : '');
    const de = fuenteHora(v) + (redesH.length === 1 && p.redes.length > 1 ? ` · solo ${RED[redesH[0]]?.name || redesH[0]}` : '');
    if (p.fecha) {
      const tops = mejoresDelDia(v.grid, p.fecha, 3); if (!tops.length) return `${sel}<p class="pz-help">Ese día no tiene ninguna hora destacada (${esc(de)}).</p>`;
      return `${sel}<div class="pz-row pz-quick" role="group" aria-label="Mejores horas ese día, ${esc(de)}"><span class="pz-lab">Mejores ese día <small class="pz-hn">${esc(de)}</small></span>${tops.map(t => `<button type="button" class="pz-qh best" data-qh="${t.hora}" aria-pressed="${p.hora === t.hora}"><i aria-hidden="true">★</i> ${t.hora}</button>`).join('')}</div>`;
    }
    const s = siguienteBuenaDe(v); if (!s) return '';
    return `${sel}<div class="pz-row pz-quick"><button type="button" class="pz-qh wide best" data-buena="${s.fecha}|${s.hora}"><i aria-hidden="true">★</i> Siguiente buena hora: ${esc(fmtDay(new Date(s.fecha + 'T00:00:00').getTime()))}, ${s.hora}</button><small class="pz-hn">${esc(de)}</small></div>`;
  }
  function siguienteBuenaDe(v) {
    const p = cur, ocup = otras().filter(o => o.id !== p.id && o.fecha && o.hora && o.redes.some(r => p.redes.includes(r))).map(o => new Date(`${o.fecha}T${o.hora}:00`).getTime());
    return v?.grid ? siguienteBuena(v.grid, { ocupadas: ocup }) : null;
  }

  /** Las fichas de las redes: cada una con su formato (un desplegable si la red tiene más de uno). */
  function redesHTML() {
    const p = cur;
    const ficha = k => {
      const on = p.redes.includes(k), b = `<button type="button" class="pz-net" data-red="${k}" aria-pressed="${on}" title="${on ? 'Quitar' : 'Añadir'} ${RED[k].name}">${nbRed(k)} ${RED[k].name}</button>`;
      if (!on) return b;
      const f = formatoDe(p, k), ops = FORMATOS_RED[k] || ['post'], valida = formatoValido(k, f);
      const fmt = ops.length > 1 || !valida
        ? `<select class="pz-fsel" data-fmt-red="${k}" aria-label="Formato en ${RED[k].name}">${valida ? '' : `<option value="${f}" selected>${esc(FORMATO[f] || f)} (no la tiene)</option>`}${ops.map(o => `<option value="${o}"${valida && nombreFormato(k, f) === nombreFormato(k, o) ? ' selected' : ''}>${esc(nombreFormato(k, o))}</option>`).join('')}</select>`
        : `<span class="pz-fstat">${FICON[formatoDe(p, k)] || ''}${esc(nombreFormato(k, f))}</span>`;
      return `<span class="pz-rc${valida ? '' : ' bad'}">${b}${fmt}</span>`;
    };
    const resto = Object.keys(RED).length - redesVisibles().length;
    return `<div class="pz-nets" role="group" aria-labelledby="${I('rd')}">${redesVisibles().map(ficha).join('')}${resto > 0 || masRedes ? `<button type="button" class="pz-net more" data-a="mas-redes" aria-expanded="${masRedes}">${masRedes ? 'Menos redes' : `+ Más redes (${resto})`}</button>` : ''}</div>`;
  }

  /** 9 oct 2026: «Publicar en» — la cuenta de Instagram y la página de Facebook en que sale, siempre a la vista, y las demás para elegir. */
  function ctasHTML() {
    const redes = ['instagram', 'facebook'].filter(r => cur.redes.includes(r)); if (!redes.length) return '';
    const info = cuentasMeta();
    if (!info?.cuentas?.length) return `<p class="pz-help pz-ctnone">Sin Meta conectada: saldrá por la cuenta de Ajustes.</p>`;
    const av = c => `<span class="pz-cav" aria-hidden="true">${c?.foto ? `<img src="${esc(c.foto)}" alt="" referrerpolicy="no-referrer" loading="lazy">` : esc((nombreCorto(c) || '·').replace('@', '').slice(0, 1).toUpperCase())}</span>`;
    const quien = c => `<b>${esc(nombreCorto(c))}</b>${c.usuario && c.nombre ? ` <small>${esc(c.nombre)}</small>` : ''}`;
    const fila = red => {
      const c = cuentaDe(cur, red, info), todas = info.cuentas.filter(x => x.red === red), elegida = !!cuentasLimpias(cur.cuentas)[red], abierta = ctaAbierta === red && todas.length > 1;
      const linea = c ? `${av(c)}<span class="pz-ctt">Sale en ${quien(c)}${elegida ? '' : ' <small>(la de siempre)</small>'}${c.puedePublicar === false ? ` <em class="pz-ctmal">· ${esc(c.motivo || 'no puede publicar')}</em>` : ''}</span>` : `<span class="pz-ctt">Sin cuenta de ${RED[red].name}: el token de Meta no ve ninguna</span>`;
      const head = todas.length > 1 ? `<button type="button" class="pz-ctbtn" data-ctred="${red}" aria-expanded="${abierta}" aria-controls="${I('ctl-' + red)}" aria-label="${esc(`${RED[red].name}: sale en ${nombreCorto(c) || '—'}. Cambiar la cuenta`)}">${nbRed(red)}${linea}<span class="pz-ctc" aria-hidden="true">Cambiar ${abierta ? '▴' : '▾'}</span></button>`
        : `<div class="pz-ctbtn solo">${nbRed(red)}${linea}</div>`;
      const lista = abierta ? `<div class="pz-ctl" id="${I('ctl-' + red)}" role="radiogroup" aria-label="Cuenta de ${RED[red].name}">${todas.map((x, i) => `<label class="pz-cto${x.puedePublicar ? '' : ' no'}"><input type="radio" name="${I('ctr-' + red)}" value="${esc(x.id)}" data-cta="${red}"${c && x.id === c.id ? ' checked' : ''}${x.puedePublicar ? '' : ` disabled aria-describedby="${I(`ctm-${red}-${i}`)}"`}>${av(x)}<span>${quien(x)}${x.id === info.porDefecto?.[red] ? ' <small>· la de siempre</small>' : ''}${x.puedePublicar ? '' : `<small class="pz-ctmal" id="${I(`ctm-${red}-${i}`)}">${esc(x.motivo || '')}</small>`}</span></label>`).join('')}</div>` : '';
      return `<div class="pz-ct1">${head}${lista}</div>`;
    };
    return `<span class="pz-lab">Publicar en</span>${redes.map(fila).join('')}`;
  }
  function paintCtas() { const b = scroll.querySelector('.pz-ctas'); if (b && cur) b.innerHTML = ctasHTML(); }

  /** El cuadro de escribir: pestañas por red (si se pidieron), el texto, los archivos y la barra con sus ventanitas. */
  function compHTML() {
    const p = cur, conTexto = redesConTexto(p), hist = soloHistoria();
    if (!porRed && conTexto.some(r => textoPropio(p, r).trim())) porRed = true; // si alguna ya lleva su texto, se ve
    if (tab && !conTexto.includes(tab)) tab = '';
    const pv = porRed && conTexto.length;
    const tabs = pv ? `<div class="pz-ttabs" role="tablist" aria-label="Texto de cada red">${['', ...conTexto].map(r => { const propio = r && textoPropio(p, r).trim(); return `<button type="button" role="tab" id="${I('tt-' + (r || 'p'))}" data-ttab="${r}" aria-selected="${tab === r}" tabindex="${tab === r ? 0 : -1}" aria-controls="${I('tpanel')}"${r ? ` aria-label="${RED[r].name}${propio ? ' (texto propio)' : ' (usa el principal)'}"` : ''}>${r ? `${nbRed(r)} ${RED[r].name}${propio ? '<i class="pz-dot" aria-hidden="true"></i>' : ''}` : 'Principal'}</button>`; }).join('')}</div>` : '';
    const campo = !tab ? `data-f="texto"` : tab === 'facebook' ? `data-f="textoFacebook"` : `data-tx="${tab}"`;
    const vacioRed = tab && !textoPropio(p, tab).trim();
    const ph = !tab ? 'Escribe aquí lo que se publica, listo para salir. La primera línea es el gancho: es lo que se lee antes de «más».'
      : `Vacío = ${RED[tab].name} lleva el texto principal${p.hashtags && tab !== 'facebook' ? ' con sus hashtags' : ''}. Lo que escribas aquí sale tal cual en ${RED[tab].name}.`;
    const escribir = !hist || verTextoHist || p.texto;
    const texto = escribir ? `<div class="pz-tpanel" role="${pv ? 'tabpanel' : 'group'}" id="${I('tpanel')}"${pv ? ` aria-labelledby="${I('tt-' + (tab || 'p'))}"` : ''}>
        <label class="pz-lab pz-tlab" for="${I('tx')}">${tab ? `Texto para ${RED[tab].name}` : pv ? 'Texto principal' : 'Texto de la publicación'}${tab ? '' : pv ? ' <small class="pz-hn">· Instagram y las redes sin texto propio</small>' : ''}</label>
        <textarea id="${I('tx')}" class="pz-ta pz-main" ${campo} rows="${hist ? 3 : 7}" placeholder="${esc(ph)}">${esc(textoPropio(p, tab))}</textarea>
        ${vacioRed ? `<button type="button" class="pz-lk" data-a="copiar-principal">Partir del texto principal</button>` : ''}
      </div>` : `<p class="pz-help">Una historia no muestra texto ni hashtags: lo que deba leerse va dentro de la imagen o el video. <button type="button" class="pz-lk" data-a="texto-hist">Escribir texto de todos modos</button></p>`;
    const tools = escribir ? `<div class="pz-tools" role="toolbar" aria-label="Escribir">
        ${toolBtn('emoji', 'Emoji', SVG.emoji)}${hist ? '' : toolBtn('hash', 'Hashtags', SVG.hash)}
        ${hist ? '' : `<button type="button" class="pz-tb" data-a="comentario" aria-pressed="${!!(verCom || p.comentario)}" title="Primer comentario" aria-label="Primer comentario">${SVG.com}</button>`}
        ${toolBtn('enlace', 'Poner un enlace', SVG.enlace)}${toolBtn('guardados', 'Textos guardados', SVG.guardados)}
        <button type="button" class="pz-tb wide${pop === 'mejorar' ? ' on' : ''}" data-pop="mejorar" aria-expanded="${pop === 'mejorar'}" aria-controls="${I('pop')}"><span aria-hidden="true">✨</span> Mejorar<span class="pz-tbx">con Marketing</span></button>
        <span class="pz-cnts" aria-live="off">${cntsHTML()}</span>
      </div>` : '';
    const porRedBtn = conTexto.length && !hist ? `<button type="button" class="pz-switch" data-a="por-red" aria-pressed="${porRed}"><span class="pz-sw" aria-hidden="true"></span>Editar por red</button>` : '';
    return `<div class="pz-comp${pv ? ' tabs' : ''}">
      <div class="pz-comph"><span class="pz-lab">Lo que se publica</span>${porRedBtn}</div>
      ${tabs}${texto}
      <div class="pz-medios" role="list" aria-label="Imágenes y videos, en el orden en que salen"></div>
      ${tools}
      <div class="pz-pop" id="${I('pop')}" ${pop ? '' : 'hidden'}>${popHTML()}</div>
    </div>
    <p class="pz-help pz-mhelp">${mediosAyuda()}</p>
    ${!hist && (verHash || p.hashtags) ? `<div class="pz-extra" data-x="hash"><label for="${I('ht')}" class="pz-lab">Hashtags ${p.redes.includes('instagram') ? `<small class="pz-cnt" data-cnt="hashtags">${contarHashtags(p.hashtags)} / ${LIMITES.instagram.hashtags}</small>` : ''}</label>
        <input id="${I('ht')}" class="pz-in" data-f="hashtags" value="${esc(p.hashtags)}" placeholder="#optica #gafas">
        <label class="pz-chk"><input type="checkbox" data-f="hashtagsEnComentario"${p.hashtagsEnComentario ? ' checked' : ''}> Los hashtags van en el primer comentario, no en el texto</label></div>` : ''}
    ${!hist && (verCom || p.comentario) ? `<div class="pz-extra" data-x="com"><label for="${I('cm')}" class="pz-lab">Primer comentario <small class="pz-hn">opcional · se publica justo después</small></label>
        <textarea id="${I('cm')}" class="pz-ta" data-f="comentario" rows="2" placeholder="Por ejemplo: «Reserva en el enlace de la bio».">${esc(p.comentario)}</textarea></div>` : ''}`;
  }
  const toolBtn = (k, label, svg) => `<button type="button" class="pz-tb${pop === k ? ' on' : ''}" data-pop="${k}" aria-expanded="${pop === k}" aria-controls="${I('pop')}" title="${label}" aria-label="${label}">${svg}</button>`;
  function cntsHTML() {
    const activo = r => (tab ? r === tab : r === 'instagram' || !textoPropio(cur, r).trim()); // en la pestaña de una red, su contador; en la principal, los de las redes que la usan
    const c = contadoresDe(cur).map(x => `<span class="pz-cc${x.over ? ' over' : ''}${activo(x.red) ? '' : ' dim'}" data-cc="${x.red}" title="${RED[x.red].name}: ${x.n.toLocaleString('es')} de ${x.max.toLocaleString('es')} caracteres">${nbRed(x.red, { solo: true })}${cnt(x.n, x.max)}</span>`);
    if (cur.redes.includes('instagram') && formatoDe(cur, 'instagram') !== 'historia') { const post = postDePieza(cur), n = contarHashtags(textoPara(post, 'instagram')) + (cur.hashtagsEnComentario ? contarHashtags(cur.hashtags) : 0); /* como las reglas */ c.push(`<span class="pz-cc${n > LIMITES.instagram.hashtags ? ' over' : ''}" data-cc="hashtags" title="Hashtags en Instagram: ${n} de ${LIMITES.instagram.hashtags}">#${n}/${LIMITES.instagram.hashtags}</span>`); }
    return c.join('');
  }
  function mediosAyuda() {
    const f = cur.redes.includes('instagram') ? formatoDe(cur, 'instagram') : cur.formato;
    return f === 'carrusel' ? 'Un carrusel lleva de 2 a 10, y todos toman la proporción del primero. Arrástralos para cambiar el orden.' : f === 'reel' ? 'Un reel lleva un video vertical 9:16, de 3 s a 15 min.' : f === 'historia' ? 'Una historia es vertical, 9:16 (1080×1920). Un video, hasta 60 s.' : 'Un post lleva una imagen de 4:5 (1080×1350) a 1.91:1. Con varias, sale como carrusel en Instagram.';
  }

  /** Lo que se despliega bajo la barra: emojis, hashtags, enlace, textos guardados o la propuesta de Marketing. */
  function popHTML() {
    if (!pop || !cur) return '';
    if (pop === 'emoji') return `<div class="pz-emo" role="group" aria-label="Emojis">${EMOJIS.map(e => `<button type="button" data-emo="${e}">${e}</button>`).join('')}</div>`;
    if (pop === 'enlace') return `<div class="pz-row"><label class="pz-lab" for="${I('en')}">Enlace</label><input id="${I('en')}" class="pz-in pz-grow" data-enlace type="url" inputmode="url" placeholder="https://"><button type="button" class="pz-btn" data-a="poner-enlace">Ponerlo en el texto</button></div>${cur.redes.includes('instagram') ? '<p class="pz-help">En Instagram un enlace en el texto no se puede tocar: ponlo también en la bio o en una historia.</p>' : ''}`;
    if (pop === 'hash' || pop === 'guardados') {
      if (!guard) { cargarGuardados(); return '<p class="pz-help" role="status">Cargando…</p>'; }
      if (guard.error) return `<p class="pz-inline err" role="status">${esc(guard.error)}</p>`;
      const juegos = guard.textos.filter(x => x.hashtags), textos = guard.textos.filter(x => !x.hashtags);
      if (pop === 'hash') {
        const en = new Set(String(cur.hashtags || '').toLowerCase().split(/\s+/).filter(Boolean));
        return `${juegos.length ? `<p class="pz-lab">Tus juegos</p><div class="pz-row">${juegos.map((x, i) => `<button type="button" class="pz-btn" data-juego="${i}" title="${esc(x.texto)}">${esc(x.nombre)} <small class="pz-hn">${x.texto.split(/\s+/).length}</small></button>`).join('')}</div>` : ''}
          ${guard.usados.length ? `<p class="pz-lab">Los que más usas</p><div class="pz-row">${guard.usados.map(t => `<button type="button" class="pz-qh" data-tag="${esc(t)}" aria-pressed="${en.has(t.toLowerCase())}">${esc(t)}</button>`).join('')}</div>` : ''}
          ${!juegos.length && !guard.usados.length ? '<p class="pz-help">Todavía no usas hashtags en tus piezas ni tienes un juego guardado. Guarda uno en «Textos guardados» (solo hashtags, separados por espacios).</p>' : ''}
          <div class="pz-row"><button type="button" class="pz-btn" data-a="escribir-hash">Escribir hashtags</button></div>`;
      }
      return `${guard.textos.length ? `<ul class="pz-glist">${guard.textos.map((x, i) => `<li><button type="button" class="pz-gi" data-gi="${i}"><b>${esc(x.nombre)}</b><span>${esc(x.texto.replace(/\s+/g, ' ').slice(0, 90))}</span></button><button type="button" class="pz-gdel" data-gdel="${i}" aria-label="${gConfirma === x.nombre ? `Pulsa otra vez para borrar «${esc(x.nombre)}»` : `Borrar «${esc(x.nombre)}»`}">${gConfirma === x.nombre ? '¿Borrar?' : '✕'}</button></li>`).join('')}</ul>` : '<p class="pz-help">Aún no hay textos guardados. Guarda tu firma, una llamada a la acción o tus hashtags de siempre.</p>'}
        <div class="pz-row"><label class="pz-lab" for="${I('gn')}">Guardar lo escrito (o lo que tengas seleccionado) como</label><input id="${I('gn')}" class="pz-in pz-grow" data-gnombre maxlength="60" placeholder="Firma, Agenda tu cita, Hashtags de lentes…"><button type="button" class="pz-btn" data-a="guardar-texto">Guardar</button></div>
        <p class="pz-help">Se guardan en la nota «Contenido/Textos guardados» del Cerebro: los ve tu equipo y viajan con las notas. Nada privado.</p>`;
    }
    if (pop === 'mejorar') {
      const red = tab, donde = red ? RED[red].name : 'el texto principal';
      if (mej.cargando) return `<p class="pz-help" role="status"><span class="pz-spin" aria-hidden="true"></span> ${mej.paso ? esc(mej.paso) : `Tu agente de Marketing está escribiendo la propuesta para ${esc(donde)}… (suele tardar de 10 a 30 segundos)`}</p>`;
      if (mej.propuesta) {
        const n = longitudPara(mej.propuesta.texto, red || 'instagram'), max = LIMITES[red || 'instagram']?.caracteres;
        return `<p class="pz-lab">Propuesta de ${esc(mej.propuesta.agente || 'Marketing')} para ${esc(donde)} ${max ? `<small class="pz-cnt${n > max ? ' over' : ''}">${cnt(n, max)}</small>` : ''}</p>
          <blockquote class="pz-prop">${esc(mej.propuesta.texto)}</blockquote>${mej.propuesta.porque ? `<p class="pz-help">${esc(mej.propuesta.porque)}</p>` : ''}${lecturaHTML()}
          <div class="pz-row"><button type="button" class="pz-go sm" data-a="usar-prop">Usar este texto</button><button type="button" class="pz-btn" data-a="otra-prop">Otra versión</button><button type="button" class="pz-lk" data-a="descartar-prop">Descartar</button></div>`;
      }
      const ml = legibles();
      return `<p class="pz-help">Tu agente de contenido reescribe ${esc(donde)} con la voz de tu marca, sus instrucciones y tus cifras${ml.n ? ' — y mira ' + esc(ml.que) + ' de la publicación para escribir a partir de ' + (ml.fotos && ml.videos ? 'ellos' : ml.fotos ? (ml.fotos === 1 ? 'ella' : 'ellas') : (ml.videos === 1 ? 'él' : 'ellos')) : ''}. Tú decides si lo usas: no se guarda nada solo.</p>
        ${ml.n ? `<label class="pz-chk"><input type="checkbox" data-mmirar${mej.mirar ? ' checked' : ''}> Que mire ${esc(ml.que)}${ml.videos ? ' <small>(de un video ve unos cuadros, no oye el sonido)</small>' : ''}</label>` : '<p class="pz-help">Si le pones una foto o un video a la publicación, también puede escribirla a partir de lo que ve.</p>'}
        ${mej.anterior ? `<p class="pz-inline ok" role="status">Puse la propuesta. <button type="button" class="pz-lk" data-a="deshacer-prop">Deshacer</button></p>` : ''}
        ${mej.error ? `<p class="pz-inline err" role="status">${esc(mej.error)}</p>` : ''}
        <div class="pz-row" role="group" aria-label="Qué le pides">${ml.n ? `<button type="button" class="pz-qh pz-qimg" data-pide="${esc(PIDE_DESDE_IMAGEN)}" data-mirar>✨ A partir ${ml.fotos && ml.videos ? 'de las fotos y los videos' : ml.fotos ? (ml.fotos === 1 ? 'de la foto' : 'de las fotos') : (ml.videos === 1 ? 'del video' : 'de los videos')}</button>` : ''}${MEJORAR_PIDE.map(t => `<button type="button" class="pz-qh" data-pide="${esc(t)}">${esc(t)}</button>`).join('')}</div>
        <div class="pz-row"><label class="pz-lab" for="${I('mp')}">U otra cosa</label><input id="${I('mp')}" class="pz-in pz-grow" data-mpide maxlength="300" value="${esc(mej.pide)}" placeholder="Por ejemplo: menciona el examen gratis de octubre"><button type="button" class="pz-go sm" data-a="pedir-prop">Pedir propuesta</button></div>`;
    }
    return '';
  }
  function paintPop() { const b = scroll.querySelector('.pz-pop'); if (!b) return; b.hidden = !pop; b.innerHTML = popHTML(); scroll.querySelectorAll('[data-pop]').forEach(x => { x.setAttribute('aria-expanded', x.dataset.pop === pop); x.classList.toggle('on', x.dataset.pop === pop); }); }
  async function cargarGuardados(fresco) {
    if (guard && !fresco) return;
    try { const g = await datos.guardados(); guard = { textos: g.textos || [], usados: g.usados || [] }; } catch (e) { guard = { textos: [], usados: [], error: e.message }; }
    if (pop === 'hash' || pop === 'guardados') paintPop();
  }

  /** Lo de cada red y las notas, plegados: se abren solos si a algo le falta lo suyo. */
  function cfgHTML() {
    const p = cur, r = rev(), falta = red => Object.values(r.arreglos || {}).some(a => a.codigo === `opciones:${red}`);
    const det = (k, titulo, cuerpo, abre) => `<details class="pz-cfg" data-cfg="${k}"${k !== 'notas' ? ` data-op-red="${k}"` : ''}${abre || abiertos.has(k) ? ' open' : ''}><summary>${titulo}</summary><div class="pz-cfgb">${cuerpo}</div></details>`;
    const op = (red, k) => esc(String(p[red]?.[k] ?? ''));
    const out = [];
    if (p.redes.includes('instagram') && formatoDe(p, 'instagram') !== 'historia') {
      out.push(det('instagram', 'Configuración de Instagram', `<label class="pz-chk"><input type="checkbox" data-f="historiaTambien"${p.historiaTambien ? ' checked' : ''}> También como historia, 15 minutos después${p.historiaTambien ? ` <small class="pz-hn">· ${(p.historias || []).length ? `con ${(p.historias || []).length === 1 ? 'su imagen' : (p.historias || []).length + ' archivos'}` : 'falta su imagen'}</small>` : ''}</label>${p.historiaTambien ? `<div class="pz-row"><button type="button" class="pz-btn" data-a="hist-post"${p.medios.length ? '' : ' disabled'}>Usar la del post</button><button type="button" class="pz-btn" data-a="hist-pick">Elegir para la historia</button></div>` : ''}`, p.historiaTambien));
    }
    if (p.redes.includes('pinterest')) out.push(det('pinterest', 'Configuración de Pinterest', `<label class="pz-lab" for="${I('pi-t')}">Tablero <small class="pz-hn">su id en Pinterest o Metricool</small></label><input id="${I('pi-t')}" class="pz-in" data-op="pinterest.tablero" value="${op('pinterest', 'tablero')}" maxlength="80"><label class="pz-lab" for="${I('pi-n')}">Título del pin <small class="pz-hn">hasta 100</small></label><input id="${I('pi-n')}" class="pz-in" data-op="pinterest.titulo" value="${op('pinterest', 'titulo')}" maxlength="100"><label class="pz-lab" for="${I('pi-l')}">Enlace <small class="pz-hn">opcional · https://</small></label><input id="${I('pi-l')}" class="pz-in" data-op="pinterest.enlace" type="url" inputmode="url" value="${op('pinterest', 'enlace')}" placeholder="https://">`, falta('pinterest')));
    if (p.redes.includes('youtube')) out.push(det('youtube', `Configuración de YouTube${formatoDe(p, 'youtube') === 'reel' ? ' · Short' : ''}`, `<label class="pz-lab" for="${I('yt-t')}">Título <small class="pz-hn">obligatorio · hasta 100 · el texto principal es la descripción</small></label><input id="${I('yt-t')}" class="pz-in" data-op="youtube.titulo" value="${op('youtube', 'titulo')}" maxlength="100"><label class="pz-lab" for="${I('yt-p')}">Quién lo ve</label><select id="${I('yt-p')}" class="pz-sel" data-op="youtube.privacidad">${PRIV.youtube.map(([k, t]) => `<option value="${k}"${(p.youtube?.privacidad || 'public') === k ? ' selected' : ''}>${t}</option>`).join('')}</select><label class="pz-chk"><input type="checkbox" data-op="youtube.paraNinos"${p.youtube?.paraNinos ? ' checked' : ''}> Es contenido para niños</label>`, falta('youtube')));
    if (p.redes.includes('tiktok')) out.push(det('tiktok', 'Configuración de TikTok', `<label class="pz-lab" for="${I('tt-p')}">Quién lo ve</label><select id="${I('tt-p')}" class="pz-sel" data-op="tiktok.privacidad">${PRIV.tiktok.map(([k, t]) => `<option value="${k}"${(p.tiktok?.privacidad || 'PUBLIC_TO_EVERYONE') === k ? ' selected' : ''}>${t}</option>`).join('')}</select>`, falta('tiktok')));
    out.push(det('notas', `Notas para el equipo <small class="pz-hn">no se publican</small>`, `<label for="${I('nt')}" class="pz-lab">Notas</label><textarea id="${I('nt')}" class="pz-ta" data-f="notas" rows="2" placeholder="Por qué esta idea, qué falta, qué dato confirmar.">${esc(p.notas)}</textarea>`, !!p.notas));
    return out.join('');
  }

  function paintBody() {
    scroll.innerHTML = `
      <div class="pz-redesh"><span class="pz-lab" id="${I('rd')}">Redes y formato</span><span class="pz-avbox"></span></div>
      ${redesHTML()}
      <div class="pz-ctas">${ctasHTML()}</div>
      <section class="pz-review" aria-label="¿Puede salir?" ${avisos ? '' : 'hidden'}><div class="pz-rv" aria-live="polite"></div></section>
      ${compHTML()}
      <div class="pz-cfgs">${cfgHTML()}</div>`;
    paintMedios(); paintPreview(); paintReview();
  }
  function paintMedios() {
    const box = scroll.querySelector('.pz-medios'); if (!box) return;
    const md = m => { const x = cur.medidas?.[m]; return x?.ancho ? `${x.ancho}×${x.alto}${x.duracion ? ` · ${Math.round(x.duracion)} s` : ''}` : x?.duracion ? `${Math.round(x.duracion)} s` : ''; };
    const n = cur.medios.length;
    box.innerHTML = cur.medios.map((m, i) => `<div class="pz-m" role="listitem" draggable="true" data-i="${i}" title="${esc(`${i + 1}. ${m.split('/').pop()}${md(m) ? ' · ' + md(m) : ''} — arrástrala para cambiar el orden`)}">${thumbHTML(m, esc, 'pz-mt')}<span class="pz-mi" aria-hidden="true">${i + 1}</span>
        <span class="pz-ma"><button type="button" data-mv="${i}:-1" aria-label="Mover el archivo ${i + 1} antes"${i === 0 ? ' disabled' : ''}>‹</button><button type="button" data-mv="${i}:1" aria-label="Mover el archivo ${i + 1} después"${i === n - 1 ? ' disabled' : ''}>›</button><button type="button" data-rm="${i}" aria-label="Quitar el archivo ${i + 1}">✕</button></span></div>`).join('')
      + `<div class="pz-madds" role="listitem"><button type="button" class="pz-madd pz-btn" data-a="pick">+ Del Estudio</button><button type="button" class="pz-madd pz-btn" data-a="estudio">Crear con el Estudio</button></div>`;
  }
  function paintPreview() { if (cur) preview.paint(cur); }
  function paintReview() {
    if (!cur) return;
    const r = rev(), nE = r.errores.length, nA = r.avisos.length;
    const chip = scroll.querySelector('.pz-avbox');
    if (chip) chip.innerHTML = `<button type="button" class="pz-avchip ${nE ? 'bad' : nA ? 'warn' : 'ok'}" data-a="avisos" aria-expanded="${avisos}">${nE ? `${nE} ${nE === 1 ? 'problema' : 'problemas'}` : nA ? `✓ Puede salir · ${nA} ${nA === 1 ? 'aviso' : 'avisos'}` : '✓ Puede salir'}${nE && nA ? ` · ${nA} ${nA === 1 ? 'aviso' : 'avisos'}` : ''} <span aria-hidden="true">${avisos ? '▴' : '▾'}</span></button>`;
    const box = scroll.querySelector('.pz-rv'); if (!box) return;
    const fix = t => { const a = r.arreglos?.[t]; return a ? `<button type="button" class="pz-fix" data-fix="${esc(a.codigo)}">${esc(a.etiqueta)}</button>` : ''; };
    box.innerHTML = (nE ? `<ul class="pz-list">${r.errores.map(t => `<li class="err"><span><b class="pz-k">No puede salir:</b> ${esc(t)}</span>${fix(t)}</li>`).join('')}</ul>` : '<p class="pz-ok"><b>✓</b> Cumple las reglas de cada red y tiene día y hora.</p>')
      + (nA ? `<ul class="pz-list">${r.avisos.map(t => `<li class="warn"><span><b class="pz-k">Ojo:</b> ${esc(t)}</span>${fix(t)}</li>`).join('')}</ul>` : '');
  }
  function abrirAvisos(foco) {
    avisos = true; const sec = scroll.querySelector('.pz-review'); if (sec) sec.hidden = false; paintReview(); swap('edit');
    sec?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (foco) (sec?.querySelector('.pz-fix') || scroll.querySelector('[data-a="avisos"]'))?.focus({ preventScroll: true });
  }
  const cuandoTexto = p => (p.fecha ? `${fmtDay(new Date(`${p.fecha}T00:00:00`).getTime())}${p.hora ? ' · ' + p.hora : ' · sin hora'}` : 'Sin día');
  function paintCuandoBtn() { const b = foot.querySelector('[data-a="cuando"] .pz-cbt'); if (b && cur) b.textContent = cuandoTexto(cur); }
  function paintFoot() {
    if (!cur) return;
    const p = cur, r = rev(), listo = !r.errores.length, n = r.errores.length;
    const cuandoL = p.fecha ? fmtLong(new Date(`${p.fecha}T${p.hora || '00:00'}:00`).getTime()).replace(/, \d{2}:\d{2}$/, p.hora ? `, ${p.hora}` : ' (sin hora)') : '';
    const paso = p.fecha && p.hora && new Date(`${p.fecha}T${p.hora}:00`).getTime() < Date.now();
    const sal = textoSalida(p); // M1: lo que pasó al entregarla, cuando la cola la conoce
    const veredicto = p.estado === 'aprobada' && sal ? `<span class="pz-verd ${sal.malo ? 'bad' : 'ok'}">${esc(sal.texto)}</span>${sal.enlaces.map(l => ` <a class="pz-lk" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">Ver en ${esc(l.red)}</a>`).join('')}` : p.estado === 'aprobada' ? (paso ? `<span class="pz-verd bad">Vencida: era para el ${esc(cuandoL)} y no salió. Cámbiale el día.</span>` : `<span class="pz-when">✓ Sale ${esc(cuandoL)}</span>`) : listo ? `<span class="pz-verd ok">✓ Lista para salir${p.fecha ? ' el ' + esc(cuandoL) : ''}</span>` : `<button type="button" class="pz-verd bad" data-a="ver-problemas">${n === 1 ? '1 problema' : n + ' problemas'}: ${esc(r.errores[0])}</button>`;
    const reglas = revisarPublicacion(postDePieza(p), p.redes), puedeYa = !reglas.errores.length;
    const yaTxt = confirmaYa > Date.now() ? `Pulsa otra vez: sale en unos 5 minutos en ${p.redes.map(x => RED[x].name).join(', ')}` : 'Publicar ya · sale en unos 5 minutos';
    const menuHTML = `<div class="pz-menu" role="menu" id="${I('menu')}" aria-label="Más formas de guardarla"${menu ? '' : ' hidden'}>
        ${p.estado === 'borrador' || p.estado === 'idea' ? '<button type="button" role="menuitem" data-a="review">Pasar a revisión</button>' : '<button type="button" role="menuitem" data-a="draft">Volver a borrador</button>'}
        <button type="button" role="menuitem" data-a="ya"${puedeYa ? '' : ` aria-disabled="true" title="${esc('Todavía no puede salir: ' + (reglas.errores[0] || ''))}"`}>${esc(yaTxt)}</button>
      </div>`;
    const imp = impulsables(p, sal); // A4 (9 oct 2026): lo publicado en Instagram o Facebook se puede impulsar (un borrador de anuncio, en pausa)
    const impHTML = imp.length ? `<div class="pz-imp" role="group" aria-label="Impulsar con un anuncio">${imp.map(r => `<button type="button" class="pz-btn" data-a="impulsar" data-red="${r}" aria-describedby="${I('imp')}">${imp.length > 1 ? `Impulsar en ${RED[r].name}` : 'Impulsar'}</button>`).join('')}<small class="pz-hn" id="${I('imp')}">Crea una campaña en pausa con esta publicación; activarla te pedirá los dos clics.</small></div>` : '';
    foot.innerHTML = `<div class="pz-cuando" ${cuando ? '' : 'hidden'}></div>
      <div class="pz-vline">${veredicto}</div>${impHTML}
      <div class="pz-acts">
        <button type="button" class="pz-cbtn" data-a="cuando" aria-expanded="${cuando}" title="Cuándo sale">${SVG.cal}<span class="pz-cbt">${esc(cuandoTexto(p))}</span><span aria-hidden="true">${cuando ? '▴' : '▾'}</span></button>
        <span class="sp"></span>
        ${p.estado === 'aprobada' ? `<button type="button" class="pz-btn" data-a="back"${sal && ['en_red', 'entregando'].includes(sal.clave) ? ' title="Vuelve a revisión y se retira del conductor"' : ''}>${sal && ['en_red', 'entregando'].includes(sal.clave) ? 'Quitar el OK y retirarla' : 'Quitar el OK'}</button>`
          : `<span class="pz-split"><button type="button" class="pz-go${listo ? '' : ' locked'}" data-a="approve"${listo ? '' : ' aria-disabled="true"'} title="${listo ? 'Aprobarla: queda lista para salir a su hora' : 'Todavía no puede salir: ' + esc(r.errores[0] || '')}">${listo ? 'Aprobar' : '<span aria-hidden="true">🔒</span> Aprobar'}</button><button type="button" class="pz-go pz-gomas" data-a="menu" aria-haspopup="menu" aria-expanded="${menu}" aria-controls="${I('menu')}" aria-label="Más formas de guardarla">▾</button>${menuHTML}</span>`}
      </div>
      <div class="pz-links"><button type="button" class="pz-lk" data-a="dup">Duplicar</button><button type="button" class="pz-lk" data-a="rep" aria-expanded="${repAbierto}">Repetir…</button><button type="button" class="pz-lk" data-a="tpl" aria-expanded="${tplAbierto}">Guardar como plantilla</button><button type="button" class="pz-lk warn" data-a="delete">Eliminar</button></div>
      ${tplAbierto ? `<div class="pz-rep pz-tpl" role="group" aria-label="Guardar como plantilla"><label>Nombre <input class="pz-in" data-tpl="nombre" maxlength="60" value="${esc((p.titulo || '').slice(0, 60))}" placeholder="Por ejemplo: Promo del mes"></label><button type="button" class="pz-btn" data-a="tpl-ok">Guardar la plantilla</button><small class="pz-hn">Guarda el formato, las redes, el texto, el primer comentario y los hashtags (no los archivos ni la fecha). Es una nota del Cerebro que viaja con el equipo: nada privado.</small></div>` : ''}
      ${repAbierto ? `<div class="pz-rep" role="group" aria-label="Repetir esta pieza">${p.fecha ? `<label>Cada <select class="pz-sel" data-rep="cada">${Object.entries(CADA).map(([k, l]) => `<option value="${k}"${k === 'semana' ? ' selected' : ''}>${l.replace('Cada ', '')}</option>`).join('')}</select></label><label>Veces <select class="pz-sel" data-rep="veces">${Array.from({ length: MAX_VECES }, (_, i) => i + 1).map(n => `<option${n === 4 ? ' selected' : ''}>${n}</option>`).join('')}</select></label><button type="button" class="pz-btn" data-a="rep-ok">Crear los borradores</button><small class="pz-hn">Salen como borradores: cada una se revisa y se aprueba.</small>` : '<small class="pz-hn">Ponle un día primero: las copias se cuentan desde ese día.</small>'}</div>` : ''}
      <div class="pz-state${stateBad ? ' bad' : ''}" role="status" aria-live="polite">${esc(stateText)}</div>`;
    if (cuando) paintCuando();
  }

  /* ---------- escribir: el cursor, insertar, contar ---------- */
  const activeTA = () => scroll.querySelector('.pz-ta.pz-main');
  const taKey = ta => ta?.dataset.f || 'tx:' + (ta?.dataset.tx || '');
  function insertar(txt, { bloque = false, espacio = false } = {}) {
    let ta = activeTA();
    if (!ta && soloHistoria()) { verTextoHist = true; keep(() => paintBody(), '.pz-ta.pz-main'); ta = activeTA(); }
    if (!ta) return;
    const k = taKey(ta), a = lastSel?.k === k ? Math.min(lastSel.a, ta.value.length) : ta.value.length, b = lastSel?.k === k ? Math.min(lastSel.b, ta.value.length) : a;
    const antes = ta.value.slice(0, a), despues = ta.value.slice(b);
    const sep = !antes.trim() ? '' : bloque ? (antes.endsWith('\n\n') ? '' : antes.endsWith('\n') ? '\n' : '\n\n') : espacio && !/\s$/.test(antes) ? ' ' : '';
    ta.value = antes + sep + txt + (espacio && despues && !/^\s/.test(despues) ? ' ' : '') + despues;
    const pos = (antes + sep + txt).length; ta.focus({ preventScroll: true }); ta.setSelectionRange(pos, pos); lastSel = { k, a: pos, b: pos };
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const recordar = e => { const t = e.target; if (t?.classList?.contains('pz-main')) lastSel = { k: taKey(t), a: t.selectionStart, b: t.selectionEnd }; };
  for (const ev of ['keyup', 'mouseup', 'select', 'input', 'focusout']) host.addEventListener(ev, recordar);
  function contadores() {
    const c = scroll.querySelector('.pz-cnts'); if (c) c.innerHTML = cntsHTML();
    const c2 = scroll.querySelector('[data-cnt="hashtags"]'); if (c2) { const n = contarHashtags(cur.hashtags); c2.textContent = `${n} / ${LIMITES.instagram.hashtags}`; c2.classList.toggle('over', n > LIMITES.instagram.hashtags); }
    const t = scroll.querySelector(`[data-ttab="${tab}"]`); if (t && tab) { const propio = textoPropio(cur, tab).trim(); t.querySelector('.pz-dot')?.remove(); if (propio) t.insertAdjacentHTML('beforeend', '<i class="pz-dot" aria-hidden="true"></i>'); t.setAttribute('aria-label', `${RED[tab].name}${propio ? ' (texto propio)' : ' (usa el principal)'}`); }
  }

  /* ---------- eventos ---------- */
  host.addEventListener('input', e => {
    const f = e.target.dataset?.f; if (e.target.classList.contains('pz-title')) { set({ titulo: e.target.value }); return; }
    if (e.target.dataset?.tx) { set({ textos: { ...(cur.textos || {}), [e.target.dataset.tx]: e.target.value } }); contadores(); preview.text(cur); return; }
    if (e.target.dataset?.op && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') { opcion(e.target.dataset.op, e.target.value); return; }
    if ('mpide' in (e.target.dataset || {})) { mej.pide = e.target.value; return; }
    if ('mmirar' in (e.target.dataset || {})) { mej.mirar = !!e.target.checked; return; }
    if (!f || e.target.tagName === 'SELECT' || e.target.type === 'checkbox') return;
    set({ [f]: e.target.value }); contadores(); preview.text(cur);
  });
  /** Una opción de red (Pinterest, YouTube, TikTok): se guarda el objeto entero de esa red. */
  function opcion(ruta, v) { const [red, k] = ruta.split('.'); set({ [red]: { ...(cur[red] || {}), [k]: v } }); preview.text(cur); }
  host.addEventListener('change', e => {
    if (e.target.dataset?.cta) { const red = e.target.dataset.cta, v = e.target.value; set({ cuentas: { ...cuentasLimpias(cur.cuentas), [red]: v } }); keep(paintCtas, `[data-cta="${red}"][value="${CSS.escape(v)}"]`); /* la lista sigue abierta: con las flechas se recorre */ paintPreview(); setState(`Sale en ${nombreCorto(cuentaDe(cur, red, cuentasMeta()))}.`); return; } // 9 oct 2026: la cuenta de esa red
    if (e.target.dataset?.op && (e.target.tagName === 'SELECT' || e.target.type === 'checkbox')) { opcion(e.target.dataset.op, e.target.type === 'checkbox' ? e.target.checked : e.target.value); return; }
    if (e.target.dataset?.hred !== undefined) { horaRed = e.target.value; try { localStorage.setItem('ao.ct.horaRed', JSON.stringify(horaRed)); } catch {} const b = foot.querySelector('.pz-best'); if (b) b.innerHTML = bestHTML(); b?.querySelector('[data-hred]')?.focus(); return; } // C2: la red de las mejores horas
    if (e.target.dataset?.fmtRed) { const red = e.target.dataset.fmtRed; set(ponFormato(cur, red, e.target.value)); keep(() => paintBody(), `[data-fmt-red="${red}"]`); return; } // C1: el formato de esa red
    const f = e.target.dataset?.f; if (!f) return;
    if (e.target.type === 'checkbox') {
      if (f === 'historiaTambien') { abiertos.add('instagram'); set({ historiaTambien: e.target.checked, ...(e.target.checked && !(cur.historias || []).length && cur.medios[0] ? { historias: [cur.medios[0]] } : {}) }); keep(() => paintBody(), `[data-f="historiaTambien"]`); return; }
      set({ [f]: e.target.checked }); contadores(); paintPreview(); return;
    }
    if (e.target.tagName === 'SELECT') { set({ [f]: e.target.value }); keep(paintCuando, `[data-f="${f}"]`); paintCuandoBtn(); paintPreview(); }
  });
  host.addEventListener('toggle', e => { const d = e.target; if (d?.dataset?.cfg) { if (d.open) abiertos.add(d.dataset.cfg); else abiertos.delete(d.dataset.cfg); } }, true);
  /** Repinta y deja el foco donde estaba (un select o una casilla que se vuelve a crear). */
  function keep(fn, sel) { fn(); const el = host.querySelector(sel); if (el) el.focus({ preventScroll: true }); }
  const swapMedios = list => { const extra = {}; for (const m of list) if (!cur.medidas?.[m]) { const x = medidaDe(m); if (x) extra[m] = x; } if (Object.keys(extra).length) cur.medidas = { ...(cur.medidas || {}), ...extra }; set({ medios: list }); paintMedios(); paintPreview(); const h = scroll.querySelector('.pz-mhelp'); if (h) h.textContent = mediosAyuda(); };
  function swap(to) { host.dataset.swap = to; host.querySelectorAll('[data-swap]').forEach(b => b.setAttribute('aria-selected', b.dataset.swap === to)); if (to === 'ver') paintPreview(); }
  function abrirPop(k) { pop = pop === k ? '' : k; if (k === 'mejorar' && pop) { mej.error = ''; } paintPop(); const b = scroll.querySelector('.pz-pop'); if (pop) (b?.querySelector('input, button') || b)?.focus?.({ preventScroll: true }); }
  /** Qué lleva la pieza que el agente puede mirar: fotos (JPEG, PNG, WebP) y videos (unos cuadros). */
  function legibles() {
    const m = (cur?.medios || []).map(tipoDeMedio), fotos = m.filter(x => x === 'imagen').length, videos = m.filter(x => x === 'video').length;
    const que = [fotos ? (fotos === 1 ? 'la foto' : `las ${fotos} fotos`) : '', videos ? (videos === 1 ? 'el video' : `los ${videos} videos`) : ''].filter(Boolean).join(' y ');
    return { fotos, videos, n: fotos + videos, que };
  }
  /** Lo que de verdad miró el agente (lo cuenta el servidor, no lo supone la página) y lo que NO pudo mirar, en palabras. */
  function lecturaHTML() {
    if (!mej.propuesta) return '';
    return avisosDeLectura(mej.propuesta, { sinLeer: mej.lectura?.sinLeer, omitidos: mej.lectura?.omitidos, que: legibles().que }).map(a => a.tipo === 'aviso' ? `<p class="pz-inline err">${esc(a.texto)}</p>` : `<p class="pz-help${a.tipo === 'vio' ? ' pz-vi' : ''}">${esc(a.texto)}</p>`).join('');
  }
  async function pedirPropuesta(pide, { aPartirDe = false } = {}) {
    if (pide !== undefined) mej.pide = pide;
    if (aPartirDe) mej.mirar = true;
    await flush(); const red = tab, base = textoPropio(cur, red).trim() || (red ? String(cur.texto || '') : '');
    const ver = mej.mirar && legibles().n > 0;
    mej = { ...mej, cargando: true, paso: ver ? `Mirando ${legibles().que}…${legibles().videos ? ' (de un video saco unos cuadros: puede tardar unos segundos)' : ''}` : '', propuesta: null, error: '', red, lectura: null }; paintPop();
    try {
      let vision = null;
      if (ver) {
        const c = await copiasDeMedios(cur.medios, { urlDe: mediaUrl, cache: cacheVision });
        if (!cur) return;
        vision = { vision: c.imagenes, sinLeer: c.sinLeer, omitidos: c.omitidos };
        mej = { ...mej, paso: c.imagenes.length ? 'Tu agente de Marketing está mirando y escribiendo la propuesta… (suele tardar de 10 a 40 segundos)' : '' }; paintPop();
        if (!c.imagenes.length && !base.trim() && !String(cur.titulo || '').trim() && !String(cur.notas || '').trim()) throw new Error('No pude abrir ' + legibles().que + ' para que el agente lo mire' + (c.sinLeer[0] ? ` («${c.sinLeer[0].motivo}»)` : '') + ' y no hay texto de donde partir.');
      }
      const r = await datos.mejorar({ titulo: cur.titulo, texto: base, redes: cur.redes, formato: formatoDe(cur, red || cur.redes[0] || 'instagram'), hashtags: cur.hashtags, notas: cur.notas, medios: cur.medios }, red, mej.pide, vision);
      if (!cur) return; mej = { ...mej, cargando: false, paso: '', propuesta: r, lectura: vision ? { sinLeer: vision.sinLeer, omitidos: vision.omitidos } : null };
    }
    catch (err) { mej = { ...mej, cargando: false, paso: '', error: err.message || 'No llegó la propuesta' }; }
    if (pop === 'mejorar') { paintPop(); scroll.querySelector('.pz-pop [data-a="usar-prop"], .pz-pop [data-a="pedir-prop"]')?.focus({ preventScroll: true }); }
  }
  function cerrarMenu(foco = true) { if (!menu) return; menu = false; const m = foot.querySelector('.pz-menu'); if (m) m.hidden = true; const t = foot.querySelector('[data-a="menu"]'); if (t) { t.setAttribute('aria-expanded', 'false'); if (foco) t.focus({ preventScroll: true }); } }
  async function aprobar(o = {}) {
    await flush(); if (!cur.id) { setState('Escribe algo antes de aprobarla.', true); return; }
    if (!o.pronto) { const r = rev(); if (r.errores.length) { setState(r.errores[0], true); abrirAvisos(true); return; } }
    try { setState(o.pronto ? 'Aprobando para dentro de 5 minutos…' : 'Aprobando…'); const res = await datos.approve(cur.id, o); cur.fecha = res.pieza.fecha; cur.hora = res.pieza.hora; adopt(res.pieza); paintBody(); onChange(res.pieza, { aprobada: true }); setState(o.pronto ? `Aprobada para las ${res.pieza.hora}: sale en unos 5 minutos.` : 'Aprobada'); note(o.pronto ? `Aprobada para las ${res.pieza.hora}. Sale sola en unos minutos (Programación dice cómo va).` : 'Aprobada. Queda lista en Programación.'); }
    catch (err) { setState(err.message, true); }
  }
  host.addEventListener('click', async e => {
    if (menu && !e.target.closest('.pz-menu, [data-a="menu"]')) cerrarMenu(false); // un clic fuera cierra el menú de Aprobar
    const b = e.target.closest('button'); if (!b || !cur || b.closest('.pz-preview')) return;
    if (b.dataset.swap) { swap(b.dataset.swap); return; }
    if (b.dataset.dev) { escritorio = b.dataset.dev === 'pc'; try { localStorage.setItem('ao.ct.pv', escritorio ? 'pc' : 'tel'); } catch {} host.querySelectorAll('[data-dev]').forEach(x => x.setAttribute('aria-pressed', x.dataset.dev === b.dataset.dev)); host.classList.toggle('pz-pc', escritorio); preview.escritorio?.(escritorio); paintPreview(); return; }
    if (b.dataset.qd) { set({ fecha: b.dataset.qd }); keep(paintCuando, `[data-qd="${b.dataset.qd}"]`); paintCuandoBtn(); paintPreview(); return; }
    if (b.dataset.buena) { const [f, h] = b.dataset.buena.split('|'); set({ fecha: f, hora: h }); keep(paintCuando, `[data-qh="${h}"]`); paintCuandoBtn(); paintPreview(); setState(`Sale el ${fmtDay(new Date(f + 'T00:00:00').getTime())} a las ${h}: una buena hora.`); return; }
    if (b.dataset.qh) { set({ hora: b.dataset.qh }); keep(paintCuando, `[data-qh="${b.dataset.qh}"]`); paintCuandoBtn(); paintPreview(); return; }
    if (b.dataset.ctred) { const red = b.dataset.ctred; ctaAbierta = ctaAbierta === red ? '' : red; keep(paintCtas, `[data-ctred="${red}"]`); return; } /* un desplegable: el foco se queda en su botón */
    if (b.dataset.red) { const red = b.dataset.red, on = cur.redes.includes(red); const next = on ? cur.redes.filter(r => r !== red) : [...cur.redes, red]; if (!next.length) { setState('Elige al menos una red.', true); return; } set({ redes: next, ...formatosConRedes(cur, next) }); keep(() => paintBody(), `[data-red="${red}"]`); return; }
    if (b.dataset.ttab !== undefined) { tab = b.dataset.ttab; mej = { ...mej, propuesta: null, error: '', anterior: null }; keep(() => paintBody(), `[data-ttab="${tab}"]`); return; }
    if (b.dataset.pop) { abrirPop(b.dataset.pop); return; }
    if (b.dataset.emo) { insertar(b.dataset.emo); return; }
    if (b.dataset.tag) { const on = b.getAttribute('aria-pressed') === 'true'; verHash = true; set({ hashtags: conHashtag(cur.hashtags, b.dataset.tag, !on) }); keep(() => { paintBody(); }, `[data-tag="${CSS.escape(b.dataset.tag)}"]`); return; }
    if (b.dataset.juego) { const j = guard.textos.filter(x => x.hashtags)[+b.dataset.juego]; if (j) { let h = cur.hashtags; for (const t of j.texto.split(/\s+/)) h = conHashtag(h, t, true); verHash = true; set({ hashtags: h }); pop = ''; keep(() => paintBody(), '[data-f="hashtags"]'); setState(`Puse «${j.nombre}» en los hashtags.`); } return; }
    if (b.dataset.gi !== undefined) { const g = guard.textos[+b.dataset.gi]; if (!g) return; if (g.hashtags) { let h = cur.hashtags; for (const t of g.texto.split(/\s+/)) h = conHashtag(h, t, true); verHash = true; set({ hashtags: h }); pop = ''; keep(() => paintBody(), '[data-f="hashtags"]'); } else { pop = ''; paintPop(); insertar(g.texto, { bloque: true }); } return; }
    if (b.dataset.gdel !== undefined) {
      const g = guard.textos[+b.dataset.gdel]; if (!g) return;
      if (gConfirma !== g.nombre) { gConfirma = g.nombre; paintPop(); scroll.querySelector(`[data-gdel="${b.dataset.gdel}"]`)?.focus(); setTimeout(() => { if (gConfirma === g.nombre) { gConfirma = ''; if (pop === 'guardados') paintPop(); } }, 5000); return; }
      gConfirma = ''; try { const r = await datos.borrarGuardado(g.nombre); guard.textos = r.textos || []; setState(`Borrado «${g.nombre}».`); } catch (err) { setState(err.message, true); } paintPop(); return;
    }
    if (b.dataset.pide) { pedirPropuesta(b.dataset.pide, { aPartirDe: 'mirar' in b.dataset }); return; }
    if (b.dataset.fix && /^(texto-red|opciones):/.test(b.dataset.fix)) { // M2: lo escribe el dueño: se abre ese campo
      const [k, red] = b.dataset.fix.split(':');
      if (k === 'texto-red') { porRed = true; tab = red; paintBody(); const ta = activeTA(); ta?.scrollIntoView({ block: 'center', behavior: 'smooth' }); ta?.focus({ preventScroll: true }); return; }
      abiertos.add(red); const box = scroll.querySelector(`[data-op-red="${red}"]`);
      if (box) { if (box.tagName === 'DETAILS') box.open = true; box.scrollIntoView({ block: 'center', behavior: 'smooth' }); box.querySelector('textarea, input, select')?.focus({ preventScroll: true }); }
      return;
    }
    if (b.dataset.fix) { if (b.dataset.fix === 'medios') { const ids = await pickMedia(cur.medios); if (ids?.length) swapMedios([...cur.medios, ...ids.filter(x => !cur.medios.includes(x))]); return; } const patch = parchePorArreglo(cur, b.dataset.fix); if (Object.keys(patch).length) { set(patch); await flush(); paintBody(); scroll.querySelector('[data-a="avisos"]')?.focus({ preventScroll: true }); } return; }
    if (b.dataset.rm !== undefined) { swapMedios(cur.medios.filter((_, i) => i !== +b.dataset.rm)); scroll.querySelector('.pz-m [data-rm], [data-a="pick"]')?.focus({ preventScroll: true }); return; }
    if (b.dataset.mv) { const [i, d] = b.dataset.mv.split(':').map(Number), l = [...cur.medios], j = i + d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; swapMedios(l); scroll.querySelector(`[data-mv="${j}:${d}"]:not([disabled])`)?.focus({ preventScroll: true }) || scroll.querySelector(`[data-mv="${j}:${-d}"]`)?.focus({ preventScroll: true }); return; }
    const a = b.dataset.a; if (!a) return;
    if (a === 'close') return close();
    if (a === 'avisos') { avisos = !avisos; const sec = scroll.querySelector('.pz-review'); if (sec) sec.hidden = !avisos; paintReview(); scroll.querySelector('[data-a="avisos"]')?.focus({ preventScroll: true }); return; }
    if (a === 'por-red') {
      const con = redesConTexto(cur).filter(r => textoPropio(cur, r).trim());
      if (porRed && con.length) { setState(`${con.map(r => RED[r].name).join(' y ')} ${con.length === 1 ? 'lleva' : 'llevan'} su propio texto: vacíalo${con.length === 1 ? '' : 's'} para volver a uno solo.`, true); return; }
      porRed = !porRed; tab = ''; keep(() => paintBody(), '[data-a="por-red"]'); return;
    }
    if (a === 'copiar-principal') { const ta = activeTA(); if (ta) { ta.value = String(cur.texto || ''); ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus(); } b.remove(); return; }
    if (a === 'texto-hist') { verTextoHist = true; keep(() => paintBody(), '.pz-ta.pz-main'); return; }
    if (a === 'comentario') { if (!cur.comentario) verCom = !verCom; keep(() => paintBody(), verCom || cur.comentario ? '[data-f="comentario"]' : '[data-a="comentario"]'); return; }
    if (a === 'escribir-hash') { verHash = true; pop = ''; keep(() => paintBody(), '[data-f="hashtags"]'); return; }
    if (a === 'poner-enlace') { const u = String(scroll.querySelector('[data-enlace]')?.value || '').trim(); if (!/^https?:\/\/\S+\.\S+/.test(u)) { setState('Escribe una dirección completa, que empiece por https://', true); scroll.querySelector('[data-enlace]')?.focus(); return; } pop = ''; paintPop(); insertar(u, { espacio: true }); return; }
    if (a === 'guardar-texto') {
      const nombre = String(scroll.querySelector('[data-gnombre]')?.value || '').trim(), ta = activeTA();
      const k = ta ? taKey(ta) : '', selTxt = ta && lastSel?.k === k && lastSel.b > lastSel.a ? ta.value.slice(lastSel.a, lastSel.b) : '';
      const t = (selTxt || textoPropio(cur, tab) || '').trim();
      if (!nombre) { setState('Ponle un nombre, por ejemplo «Firma».', true); scroll.querySelector('[data-gnombre]')?.focus(); return; }
      if (!t) { setState('Escribe o selecciona primero el texto que quieres guardar.', true); return; }
      try { const r = await datos.guardar(nombre, t); guard = { ...(guard || { usados: [] }), textos: r.textos || [] }; setState(`Guardado «${nombre}».`); } catch (err) { setState(err.message, true); }
      paintPop(); return;
    }
    if (a === 'pedir-prop' || a === 'otra-prop') { pedirPropuesta(); return; }
    if (a === 'descartar-prop') { mej = { ...mej, propuesta: null }; paintPop(); scroll.querySelector('[data-a="pedir-prop"]')?.focus({ preventScroll: true }); return; }
    if (a === 'usar-prop') { const red = mej.red, prop = mej.propuesta; if (!prop) return; mej = { ...mej, anterior: { red, texto: textoPropio(cur, red) }, propuesta: null }; if (red) { porRed = true; tab = red; } set(parcheTexto(cur, red, prop.texto)); paintBody(); activeTA()?.focus({ preventScroll: true }); setState('Puse la propuesta: revísala y ajústala a tu gusto.'); return; }
    if (a === 'deshacer-prop') { const x = mej.anterior; if (x) { set(parcheTexto(cur, x.red, x.texto)); mej = { ...mej, anterior: null }; paintBody(); setState('Volvió el texto de antes.'); } return; }
    if (a === 'cuando') { cuando = !cuando; paintFoot(); foot.querySelector(cuando ? '.pz-cuando select' : '[data-a="cuando"]')?.focus({ preventScroll: true }); return; }
    if (a === 'menu') { menu = !menu; const m = foot.querySelector('.pz-menu'); if (m) m.hidden = !menu; b.setAttribute('aria-expanded', menu); if (menu) m?.querySelector('[role="menuitem"]')?.focus(); return; }
    if (a === 'ya') {
      if (b.getAttribute('aria-disabled') === 'true') { setState(b.title, true); abrirAvisos(false); return; }
      if (confirmaYa < Date.now()) { confirmaYa = Date.now() + 6000; b.textContent = `Pulsa otra vez: sale en unos 5 minutos en ${cur.redes.map(x => RED[x].name).join(', ')}`; setTimeout(() => { if (confirmaYa && confirmaYa <= Date.now() && b.isConnected) b.textContent = 'Publicar ya · sale en unos 5 minutos'; }, 6100); return; }
      confirmaYa = 0; cerrarMenu(false); await aprobar({ pronto: true }); return;
    }
    if (a === 'impulsar') { // A4: a Anuncios → Borradores con el borrador de esta publicación (lo hace la vista de Anuncios: servida o en su demo)
      await flush();
      const m = (cur.medios || []).find(x => !/\.(mp4|webm|mov)$/i.test(x));
      const ev = new CustomEvent('ao:abrir-anuncios', { cancelable: true, detail: { impulsar: { pieza: cur.id, red: b.dataset.red, texto: textoPara(postDePieza(cur), b.dataset.red) || cur.texto || '', miniatura: m ? mediaUrl(m) || '' : '', enlace: (cur.salida?.redes?.[b.dataset.red]?.url) || '', publicadaAt: cur.fecha && cur.hora ? new Date(`${cur.fecha}T${cur.hora}:00`).toISOString() : null } } });
      if (dispatchEvent(ev)) setState('Impulsar está en Anuncios (J): abre Anuncios → Borradores.', true);
      return;
    }
    if (a === 'rep') { repAbierto = !repAbierto; paintFoot(); foot.querySelector(repAbierto ? '[data-rep="cada"], [data-a="rep"]' : '[data-a="rep"]')?.focus(); return; }
    if (a === 'tpl') { tplAbierto = !tplAbierto; paintFoot(); foot.querySelector(tplAbierto ? '[data-tpl="nombre"]' : '[data-a="tpl"]')?.focus(); return; }
    if (a === 'tpl-ok') { // C3: la pieza como plantilla (nota del Cerebro, Contenido/Plantillas/<nombre>.md)
      const nombre = foot.querySelector('[data-tpl="nombre"]')?.value.trim() || '';
      if (!nombre) { setState('Ponle un nombre a la plantilla.', true); foot.querySelector('[data-tpl="nombre"]')?.focus(); return; }
      try { await datos.guardarPlantilla(nombre, cur); tplAbierto = false; paintFoot(); setState(`Plantilla «${nombre}» guardada: la usas desde «+ Crear» → «Desde una plantilla».`); foot.querySelector('[data-a="tpl"]')?.focus(); }
      catch (err) { setState(err.message, true); }
      return;
    }
    if (a === 'rep-ok') {
      await flush(); if (!cur.id) return;
      const cada = foot.querySelector('[data-rep="cada"]').value, veces = +foot.querySelector('[data-rep="veces"]').value;
      try { setState('Creando…'); const r = await datos.repetir(cur.id, cada, veces); for (const c of r.creadas || []) onChange(c, { creada: true }); repAbierto = false; paintFoot(); setState(`${(r.creadas || []).length} borradores creados (${CADA[cada].toLowerCase()}): revísalos en el calendario.`); }
      catch (err) { setState(err.message, true); }
      return;
    }
    if (a === 'mas-redes') { masRedes = !masRedes; keep(() => paintBody(), '[data-a="mas-redes"]'); return; }
    if (a === 'hueco') { const f = siguienteHueco(cur.redes, otras().filter(o => o.id !== cur.id)); set({ fecha: f, hora: cur.hora || '18:00' }); keep(paintCuando, '[data-a="hueco"]'); paintCuandoBtn(); paintPreview(); setState(`Siguiente hueco: ${fmtDay(new Date(f + 'T00:00:00').getTime())}.`); return; }
    if (a === 'hist-post') { if (cur.medios[0]) { set({ historias: [cur.medios[0]] }); keep(() => paintBody(), '[data-a="hist-post"]'); } return; }
    if (a === 'hist-pick') { const ids = await pickMedia(cur.historias || []); if (ids?.length) { set({ historias: ids.slice(0, 10) }); keep(() => paintBody(), '[data-a="hist-pick"]'); } return; }
    if (a === 'ver-problemas') { abrirAvisos(true); return; }
    if (a === 'pick') { const ids = await pickMedia(cur.medios); if (ids?.length) swapMedios([...cur.medios, ...ids.filter(x => !cur.medios.includes(x))]); return; }
    if (a === 'estudio') { await flush(); if (!cur.id) { if (!hayAlgo(cur)) set({ titulo: cur.titulo || 'Pieza nueva' }); await flush(); } openEstudio(cur); return; }
    if (a === 'approve') { await aprobar(); return; }
    if (a === 'review' || a === 'draft') { cerrarMenu(false); await flush(); if (!cur.id) return; try { const p = await datos.back(cur.id, a === 'review' ? 'revision' : 'borrador'); adopt(p); onChange(p, {}); setState(a === 'review' ? 'Pasó a revisión' : 'Vuelve a ser borrador'); } catch (err) { setState(err.message, true); } return; }
    if (a === 'back') { await flush(); try { const p = await datos.back(cur.id, 'revision'); adopt(p); paintBody(); onChange(p, {}); setState('Ya no está aprobada'); } catch (err) { setState(err.message, true); } return; }
    if (a === 'dup') {
      await flush(); const src = cur; const copia = {}; for (const k of ['titulo', 'fecha', 'hora', 'formato', 'formatos', 'redes', 'medios', 'historiaTambien', 'historias', 'texto', 'comentario', 'hashtags', 'hashtagsEnComentario', 'textoFacebook', 'notas', 'textos', 'pinterest', 'youtube', 'tiktok', 'cuentas']) copia[k] = JSON.parse(JSON.stringify(src[k] ?? (['textos', 'formatos', 'pinterest', 'youtube', 'tiktok', 'cuentas'].includes(k) ? null : '')));
      if (!copia.textos) delete copia.textos; if (!copia.formatos) delete copia.formatos;
      copia.titulo = (src.titulo || 'Pieza') + ' (copia)'; copia.fecha = ''; copia.hora = ''; copia.estado = 'borrador';
      try { const nueva = await datos.create(copia); nueva.medidas = { ...(src.medidas || {}), ...(nueva.medidas || {}) }; onChange(nueva, { creada: true }); open(nueva); setState('Duplicada sin día: elige cuándo sale.'); } catch (err) { setState(err.message, true); }
      return;
    }
    if (a === 'delete') { const p = cur; gone = true; close({ discard: true }); onChange(p, { eliminar: true }); return; }
  });
  host.addEventListener('ao:guardar', () => { flush(); }); // Ctrl+Enter (src/ventana-pasos.js): guardar ya; guardar no aprueba
  host.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches?.('[data-tpl="nombre"]')) { e.preventDefault(); foot.querySelector('[data-a="tpl-ok"]')?.click(); return; } // C3
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (menu) { cerrarMenu(); return; }
      if (pop) { const k = pop; pop = ''; paintPop(); scroll.querySelector(`[data-pop="${k}"]`)?.focus({ preventScroll: true }); return; }
      close(); return;
    }
    if (e.key === 'Enter' && e.target.matches?.('[data-enlace], [data-gnombre], [data-mpide]')) { e.preventDefault(); e.stopPropagation(); (e.target.closest('.pz-row')?.querySelector('[data-a]'))?.click(); return; }
    const mi = e.target.closest?.('[role="menuitem"]');
    if (mi && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); e.stopPropagation(); const all = [...foot.querySelectorAll('[role="menuitem"]')], i = all.indexOf(mi); all[(i + (e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length].focus(); return; }
    if (mi && e.key === 'Tab') cerrarMenu(false);
    const tt = e.target.closest?.('[data-ttab]');
    if (tt && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); e.stopPropagation(); const all = [...scroll.querySelectorAll('[data-ttab]')], i = all.indexOf(tt), nx = all[(i + (e.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length]; nx.click(); return; }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) e.stopPropagation();
  });
  // C1: los archivos se ordenan arrastrando (‹ › hacen lo mismo con el teclado o el dedo)
  host.addEventListener('dragstart', e => { const m = e.target.closest?.('.pz-m[data-i]'); if (!m) return; e.stopPropagation(); dragI = +m.dataset.i; m.classList.add('drag'); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'pz-m'); } catch {} });
  host.addEventListener('dragover', e => { if (dragI === null) return; const m = e.target.closest?.('.pz-m[data-i]'); if (m) { e.preventDefault(); e.stopPropagation(); scroll.querySelectorAll('.pz-m.over').forEach(x => x !== m && x.classList.remove('over')); m.classList.add('over'); } });
  host.addEventListener('drop', e => { if (dragI === null) return; const m = e.target.closest?.('.pz-m[data-i]'); if (!m) return; e.preventDefault(); e.stopPropagation(); const j = +m.dataset.i, l = [...cur.medios]; const [x] = l.splice(dragI, 1); l.splice(j, 0, x); dragI = null; swapMedios(l); setState(`El archivo pasó al lugar ${j + 1}.`); });
  host.addEventListener('dragend', () => { dragI = null; scroll.querySelectorAll('.pz-m.drag, .pz-m.over').forEach(x => x.classList.remove('drag', 'over')); });

  /* ---------- abrir y cerrar ---------- */
  function open(p) {
    gone = false; if (!isOpen()) opener = document.activeElement;
    cur = p.id ? JSON.parse(JSON.stringify(p)) : { id: '', titulo: '', fecha: p.fecha || '', hora: p.hora || '', formato: p.formato || 'post', formatos: {}, redes: p.redes || [...redesUsadas()], estado: 'borrador', responsable: '', medios: p.medios || [], historiaTambien: false, historias: [], texto: '', comentario: '', hashtags: '', hashtagsEnComentario: false, textoFacebook: '', notas: '', textos: {}, pinterest: null, youtube: null, tiktok: null, origen: 'dueno', tarea: '', aprobada: null, medidas: {}, ...(p.extra || {}) };
    cur.medidas ||= {}; cur.textos ||= {}; cur.formatos ||= {}; masRedes = false; repAbierto = false; tplAbierto = false; ctaAbierta = ''; horaK = ''; horaSug = null;
    if (!p.id) Object.assign(cur, p.extra?.formatos ? formatosConRedes(cur, cur.redes) : formatosConRedes({ ...cur, redes: [] }, cur.redes)); // C1: una red sin ese formato (X en una historia) entra con el suyo; C3: la de una plantilla trae el suyo
    porRed = false; tab = ''; pop = ''; verCom = false; verHash = false; verTextoHist = false; avisos = false; cuando = false; menu = false; confirmaYa = 0; abiertos = new Set(); lastSel = null; guard = null; gConfirma = ''; mej = { cargando: false, pide: '', propuesta: null, error: '', anterior: null, red: '', mirar: true, paso: '', lectura: null }; cacheVision.clear();
    dirty = {}; stateText = ''; stateBad = false; if (!cur.id && (cur.medios.length || cur.fecha)) dirty = { medios: cur.medios, ...(cur.fecha ? { fecha: cur.fecha, hora: cur.hora, formato: cur.formato, formatos: cur.formatos } : {}) };
    if (!cur.id && p.extra) dirty = { ...dirty, ...p.extra, formato: cur.formato, formatos: cur.formatos, redes: cur.redes }; // C3: lo que trae una plantilla se guarda solo
    host.hidden = false; host.classList.add('on'); isModal = true; host.setAttribute('role', 'dialog'); host.setAttribute('aria-modal', 'true'); // ventana centrada (25 oct 2026)
    host.setAttribute('aria-label', 'Pieza de contenido'); if (isModal) modal.open(host);
    preview.reset(); swap('edit');
    paintHead(); paintBody(); paintFoot(); if (!cur.id && (cur.medios.length || p.extra)) schedule();
    (cur.id ? scroll : head.querySelector('.pz-title')).focus({ preventScroll: true });
  }
  async function close(o = {}) {
    if (!isOpen()) return;
    if (!o.discard) await flush();
    if (isModal) modal.close(host);
    host.classList.remove('on'); host.hidden = true; const was = cur; cur = null; dirty = {};
    if (opener && document.contains(opener) && !o.quiet) opener.focus({ preventScroll: true });
    if (o.after) o.after(was);
    onChange(was, { cerrada: true });
  }
  return {
    open, close, isOpen, flush, current: () => cur,
    addMedios(ids) { if (!cur) return; swapMedios([...cur.medios, ...ids.filter(x => !cur.medios.includes(x))]); },
    refresh(p) { if (cur && p && p.id === cur.id) { adopt(p); if (p.fecha !== cur.fecha || p.hora !== cur.hora) { cur.fecha = p.fecha; cur.hora = p.hora; paintCuando(); paintCuandoBtn(); paintPreview(); } } },
    repaintPreview: () => { paintPreview(); paintCtas(); }, // y «Publicar en» (llegan las cuentas)
  };
}
