// Agents Office V4.10 (1 oct 2026, auditoría PRE-01…PRE-17) — la VISTA PREVIA de una pieza, por red y por formato.
// Antes había una sola maqueta (una tarjeta de feed de Instagram a 4:5) para todo. Ahora cada combinación tiene la suya:
//   Instagram · Feed (la proporción REAL del primer archivo, de 4:5 a 1.91:1; el carrusel se pasa con flechas y puntos)
//   Instagram · Perfil (la cuadrícula a 3:4, con lo programado alrededor)
//   Instagram · Reel e Historia (9:16, con su interfaz encima y las zonas que tapa: 14 % arriba, 35 % abajo en el reel, 20 % en la historia, 6 % a los lados)
//   Facebook · Feed (el texto ARRIBA, «Ver más» tras 3 líneas, varias fotos en mosaico), Reel e Historia
// La parte pura (qué pestañas hay, la proporción, dónde corta el pie, el resumen para el lector de pantalla) se prueba en
// tests/contenido-preview.test.mjs; `initPreview` es el controlador del panel (pestañas, carrusel, «más», zonas) y repinta los medios
// solo cuando cambian: al teclear se cambia solo el texto (PRE-13).
//   initPreview(box, { esc, cuenta: () => ({ instagram, facebook }), otras: () => piezas }) → { paint(pieza), text(pieza) }
import { textoPara, primerComentario, postDePieza, PROPORCION_FEED } from './contenido-reglas.js';

export const ZONAS = Object.freeze({ reel: { arriba: 0.14, abajo: 0.35, lados: 0.06 }, historia: { arriba: 0.14, abajo: 0.20, lados: 0.06 } });
const VISTAS = {
  'ig-feed': { red: 'instagram', vista: 'feed', label: 'Feed', red_: 'IG' },
  'ig-perfil': { red: 'instagram', vista: 'perfil', label: 'Perfil', red_: 'IG' },
  'ig-reel': { red: 'instagram', vista: 'reel', label: 'Reel', red_: 'IG' },
  'ig-historia': { red: 'instagram', vista: 'historia', label: 'Historia', red_: 'IG' },
  'fb-feed': { red: 'facebook', vista: 'feed', label: 'Feed', red_: 'FB' },
  'fb-reel': { red: 'facebook', vista: 'reel', label: 'Reel', red_: 'FB' },
  'fb-historia': { red: 'facebook', vista: 'historia', label: 'Historia', red_: 'FB' },
};
export const NOMBRE_VISTA = id => { const v = VISTAS[id]; return v ? `${v.red === 'instagram' ? 'Instagram' : 'Facebook'} · ${v.label}` : ''; };

/** Las pestañas que tiene sentido mirar para esta pieza, según sus redes y su formato (la primera es la principal). */
export function pestanasDe(p = {}) {
  const redes = Array.isArray(p.redes) && p.redes.length ? p.redes : ['instagram'], f = p.formato || 'post', out = [];
  if (redes.includes('instagram')) {
    if (f === 'historia') out.push('ig-historia');
    else if (f === 'reel') out.push('ig-reel', 'ig-feed', 'ig-perfil');
    else out.push('ig-feed', 'ig-perfil');
    if (p.historiaTambien && f !== 'historia') out.push('ig-historia');
  }
  if (redes.includes('facebook')) out.push(f === 'historia' ? 'fb-historia' : f === 'reel' ? 'fb-reel' : 'fb-feed');
  return out;
}

/**
 * Cómo se ve un archivo en el feed: Instagram respeta su proporción entre 4:5 (0,8) y 1.91:1; lo de fuera no lo acepta (las reglas
 * lo dicen como error). Sin medidas no se sabe: se muestra a 4:5 y se dice. → { ratio, real, fuera: 'alta' | 'ancha' | null, medida }
 */
export function proporcionFeed(m) {
  if (!m || !(m.ancho > 0) || !(m.alto > 0)) return { ratio: 0.8, real: null, fuera: null, medida: false };
  const r = m.ancho / m.alto;
  return { ratio: Math.min(1.91, Math.max(0.8, r)), real: r, fuera: r < PROPORCION_FEED.min ? 'alta' : r > PROPORCION_FEED.max ? 'ancha' : null, medida: true };
}

/**
 * Lo que se lee del pie ANTES del «… más»: Instagram lo pliega a 2 líneas, Facebook a 3, contando los saltos de línea. `cpl` son los
 * caracteres que caben en una línea de un teléfono (~350 px); `prefijo` lo que ocupa el nombre de la cuenta en la primera línea.
 * → { visible, cortado, antes } (antes = caracteres visibles)
 */
export function cortePie(texto, { lineas = 2, cpl = 40, prefijo = 0 } = {}) {
  const t = String(texto ?? '').replace(/\r\n/g, '\n').trim();
  if (!t) return { visible: '', cortado: false, antes: 0 };
  const out = []; let usadas = 0, cortado = false;
  const filas = t.split('\n');
  for (let i = 0; i < filas.length; i++) {
    const raw = filas[i], extra = out.length === 0 ? prefijo : 0, n = Math.max(1, Math.ceil((raw.length + extra) / cpl));
    if (usadas + n <= lineas) { out.push(raw); usadas += n; if (usadas === lineas && i < filas.length - 1) { cortado = true; break; } continue; }
    out.push(raw.slice(0, Math.max(0, (lineas - usadas) * cpl - extra - 6)).trimEnd()); cortado = true; break; // «… más» ocupa unos 6
  }
  const visible = out.join('\n').trimEnd();
  if (!cortado && visible.length < t.length) cortado = true;
  return { visible, cortado, antes: visible.replace(/\n/g, '').length };
}

/** Una frase para el lector de pantalla con lo que importa de esa vista: qué red, qué formato, cuánto del texto se ve y qué tapa la interfaz. */
export function resumenAria(p = {}, tab, { corte, fuera } = {}) {
  const v = VISTAS[tab]; if (!v) return 'Vista previa';
  const partes = [`Vista previa de ${NOMBRE_VISTA(tab)}`];
  const n = (p.medios || []).length;
  partes.push(n ? `${n} ${n === 1 ? 'archivo' : 'archivos'}` : 'sin archivos');
  if (v.vista === 'historia') partes.push('una historia no muestra el texto');
  else if (corte) partes.push(corte.cortado ? `antes de «más» se leen ${corte.antes} caracteres` : 'el texto se ve entero');
  if (v.vista === 'reel' || v.vista === 'historia') { const z = ZONAS[v.vista]; partes.push(`el ${Math.round(z.abajo * 100)} % inferior y el ${Math.round(z.arriba * 100)} % superior quedan bajo la interfaz`); }
  if (fuera) partes.push(fuera === 'alta' ? 'la imagen es más alta que 4:5: Instagram no la acepta en el feed' : 'la imagen es más ancha que 1.91:1: Instagram no la acepta en el feed');
  return partes.join('; ') + '.';
}

/* ---------- pintar ---------- */
const esVideo = id => /\.(mp4|webm|mov|m4v)$/i.test(id || '');
const mediaUrl = id => (typeof id === 'string' && !id.startsWith('demo/') ? '/media/' + id.split('/').map(encodeURIComponent).join('/') : null);
const hue = s => [...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
function medio(src, esc, fit = 'cover') {
  const u = mediaUrl(src);
  if (!u) return `<span class="pv-m ph" style="--h:${hue(src)}" aria-hidden="true">${esVideo(src) ? '<i class="pv-play">▶</i>' : ''}</span>`;
  return esVideo(src) ? `<span class="pv-m vid" aria-hidden="true"><video src="${esc(u)}#t=0.1" preload="metadata" muted playsinline style="object-fit:${fit}"></video><i class="pv-play">▶</i></span>`
    : `<span class="pv-m" aria-hidden="true"><img src="${esc(u)}" alt="" decoding="async" style="object-fit:${fit}"></span>`;
}
const realzar = html => html.replace(/(^|[\s(])([#@][\p{L}\p{N}_.]+)/gu, '$1<span class="pv-tag">$2</span>');
const iniciales = s => String(s || '').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '·';
const SVG = {
  heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/></svg>',
  comment: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-3.2-6.4A8 8 0 0 1 20 12Zm0 0v8l-3-2.6"/></svg>',
  send: '<svg viewBox="0 0 24 24"><path d="M21 3 3 10l7 3 3 7 8-17Zm-11 10 5-5"/></svg>',
  save: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-5-6 5Z"/></svg>',
  dots: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg>',
  music: '<svg viewBox="0 0 24 24"><path d="M9 18V5l11-2v13M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3Zm11-2a3 3 0 1 1-3-3 3 3 0 0 1 3 3Z"/></svg>',
  globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>',
  like: '<svg viewBox="0 0 24 24"><path d="M7 11v9H4v-9Zm0 0 4-8a2 2 0 0 1 2 2v4h5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 16.8 20H7"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M14 5l7 7-7 7v-4c-6 0-9 2-11 5 1-6 4-10 11-11Z"/></svg>',
  cam: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="3"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8 7l2-3h4l2 3"/></svg>',
};
const ic = k => `<span class="pv-ic" aria-hidden="true">${SVG[k]}</span>`;
const fechaCorta = p => { if (!p.fecha) return 'sin día'; const d = new Date(`${p.fecha}T00:00:00`); return `${d.getDate()} ${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][d.getMonth()]}`; };

/** La cuenta con la que sale en cada red: la de Meta si está conectada; si no, la empresa (nunca «tu_cuenta»). */
export function cuentaPara(red, cuentas = {}) {
  const c = cuentas[red] || {}, base = cuentas.empresa || 'Tu empresa';
  const nombre = red === 'instagram' ? (c.usuario || c.nombre || base.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9._]+/g, '')) : (c.nombre || base);
  return { nombre: nombre || 'cuenta', iniciales: iniciales(c.nombre || base), conectada: !!(c.usuario || c.nombre) };
}

export function initPreview(box, { esc, cuenta = () => ({}), otras = () => [] }) {
  let tab = '', slide = 0, zonas = true, abierto = false, comAbierto = false, cur = null, mediaKey = '';
  const st = { corte: null };

  function datos(p) {
    const post = postDePieza(p), tabs = pestanasDe(p); if (!tabs.includes(tab)) tab = tabs[0] || 'ig-feed';
    const v = VISTAS[tab], medios = post.medios, cuentas = cuenta();
    return { post, tabs, v, medios, ac: cuentaPara(v.red, cuentas) };
  }

  function caption(p, d) {
    if (d.v.vista === 'historia' || d.v.vista === 'perfil') return '';
    const txt = textoPara(d.post, d.v.red);
    const reel = d.v.vista === 'reel', fb = d.v.red === 'facebook';
    const c = cortePie(txt, { lineas: reel ? 1 : fb ? 3 : 2, cpl: reel ? 34 : fb ? 44 : 40, prefijo: fb ? 0 : d.ac.nombre.length + 1 });
    st.corte = c;
    if (!txt) return `<div class="pv-cap" data-pv="cap"><em class="pv-none">Sin texto todavía</em></div>`;
    const cuerpo = abierto || !c.cortado ? txt : c.visible;
    const mas = c.cortado ? `<button type="button" class="pv-mas" data-pv-mas aria-expanded="${abierto}">${abierto ? 'menos' : fb ? 'Ver más' : 'más'}</button>` : '';
    return `<div class="pv-cap" data-pv="cap">${fb || reel ? '' : `<b>${esc(d.ac.nombre)}</b> `}${realzar(esc(cuerpo))}${c.cortado && !abierto ? '<span class="pv-ell">… </span>' : ' '}${mas}</div>`;
  }
  function comentario(p, d) {
    if (d.v.red !== 'instagram' || d.v.vista !== 'feed') return '';
    const com = primerComentario(d.post); if (!com) return '';
    const n = (com.match(/(^|\s)#[\p{L}\p{N}_]+/gu) || []).length;
    return `<div class="pv-coms" data-pv="com"><button type="button" class="pv-vercom" data-pv-com aria-expanded="${comAbierto}">${comAbierto ? 'Ocultar el comentario' : 'Ver 1 comentario'}</button>${comAbierto ? `<div class="pv-com"><b>${esc(d.ac.nombre)}</b> ${realzar(esc(com))}</div>` : ''}${n ? `<span class="pv-hint">${n} ${n === 1 ? 'hashtag' : 'hashtags'} en el comentario</span>` : ''}</div>`;
  }

  /** Los archivos con flechas y puntos (carrusel o tanda de historias). */
  function nav(n, oscuro) {
    if (n < 2) return '';
    return `<button type="button" class="pv-arr l${oscuro ? ' dk' : ''}" data-pv-sl="-1" aria-label="Archivo anterior"${slide === 0 ? ' disabled' : ''}>‹</button><button type="button" class="pv-arr r${oscuro ? ' dk' : ''}" data-pv-sl="1" aria-label="Archivo siguiente"${slide >= n - 1 ? ' disabled' : ''}>›</button><span class="pv-count" aria-live="polite">${slide + 1}/${n}</span>`;
  }

  function feedIG(p, d) {
    const ms = d.medios, n = ms.length; if (slide >= n) slide = Math.max(0, n - 1);
    const pr0 = proporcionFeed(ms[0]), cur_ = ms[slide], prS = proporcionFeed(cur_);
    const recorta = cur_ && prS.medida && pr0.medida && Math.abs(prS.real - pr0.ratio) > 0.02 && slide > 0; // el carrusel hereda la proporción de la primera
    let m;
    if (!n) m = `<div class="pv-media" style="aspect-ratio:4/5"><span class="pv-empty">${p.formato === 'reel' ? 'Un reel necesita un video' : 'Sin imagen todavía'}</span></div>`;
    else if (zonas && (recorta || pr0.fuera) ) {
      // con «ver recortes»: el archivo entero y, sombreado, lo que Instagram deja fuera
      const real = recorta ? prS.real : pr0.real, ventana = recorta ? pr0.ratio : (pr0.fuera === 'alta' ? 0.8 : 1.91);
      const vertical = real < ventana; const cut = vertical ? (1 - real / ventana) / 2 * 100 : (1 - ventana / real) / 2 * 100;
      // un archivo muy alto (9:16) se enseña entero pero sin pasar de ~440 px de alto, y el aviso va DEBAJO: dentro quedaba fuera de la vista
      const ar = Math.max(0.5, Math.min(2.2, real)), ancho = ar < 0.8 ? `width:min(100%, ${Math.round(440 * ar)}px);margin:0 auto;` : '';
      m = `<div class="pv-media pv-cut" style="${ancho}aspect-ratio:${ar}">${medio(cur_.src, esc, 'cover')}<i class="pv-shade ${vertical ? 'tb' : 'lr'}" style="--c:${cut.toFixed(1)}%" aria-hidden="true"></i>${nav(n)}</div><p class="pv-flag">${recorta ? 'Instagram recorta lo sombreado: el carrusel toma la proporción de la primera.' : pr0.fuera === 'alta' ? 'Fuera del feed: más alta que 4:5, Instagram no la acepta así. Lo sombreado es lo que sobra.' : 'Fuera del feed: más ancha que 1.91:1, Instagram no la acepta así. Lo sombreado es lo que sobra.'}</p>`;
    } else m = `<div class="pv-media" style="aspect-ratio:${pr0.ratio}">${medio(cur_.src, esc, 'cover')}${nav(n)}</div>`;
    const dots = n > 1 ? `<div class="pv-dots" aria-hidden="true">${ms.map((_, i) => `<i class="${i === slide ? 'on' : ''}"></i>`).join('')}</div>` : '';
    return `<div class="pv-card pv-igfeed"><div class="pv-h"><span class="pv-av">${esc(d.ac.iniciales)}</span><b>${esc(d.ac.nombre)}</b><span class="pv-sp"></span>${ic('dots')}</div>${m}
      <div class="pv-bar">${ic('heart')}${ic('comment')}${ic('send')}${dots}<span class="pv-sp"></span>${ic('save')}</div>
      <div class="pv-likes">Les gusta a <b>…</b></div>${caption(p, d)}${comentario(p, d)}<div class="pv-time">${p.fecha ? 'PROGRAMADA · ' + esc(fechaCorta(p)).toUpperCase() : 'SIN DÍA'}</div></div>`;
  }

  function vertical(p, d) {
    const reel = d.v.vista === 'reel', fb = d.v.red === 'facebook', ms = d.medios, n = ms.length; if (slide >= n) slide = Math.max(0, n - 1);
    const m = ms[slide], pr = proporcionFeed(m), no916 = pr.medida && Math.abs(pr.real - 0.5625) > 0.03;
    const z = ZONAS[reel ? 'reel' : 'historia'];
    const capa = !n ? `<span class="pv-empty dk">${reel ? 'Un reel necesita un video' : 'Una historia necesita una imagen o un video'}</span>` : medio(m.src, esc, no916 ? 'contain' : 'cover');
    const zon = zonas ? `<i class="pv-zone t" style="height:${z.arriba * 100}%" aria-hidden="true"><span>lo tapa la interfaz</span></i><i class="pv-zone b" style="height:${z.abajo * 100}%" aria-hidden="true"><span>lo tapa la interfaz · ${Math.round(z.abajo * 100)} %</span></i><i class="pv-zone l" style="width:${z.lados * 100}%" aria-hidden="true"></i><i class="pv-zone r" style="width:${z.lados * 100}%" aria-hidden="true"></i>` : '';
    let ui;
    if (reel) ui = `<div class="pv-ui" aria-hidden="true"><div class="pv-top"><b>${fb ? 'Reels' : 'Reels'}</b><span class="pv-sp"></span>${ic('cam')}</div>
        <div class="pv-side">${ic(fb ? 'like' : 'heart')}${ic('comment')}${ic(fb ? 'share' : 'send')}${ic('dots')}</div></div>
        <div class="pv-low"><div class="pv-who"><span class="pv-av sm">${esc(d.ac.iniciales)}</span><b>${esc(d.ac.nombre)}</b><span class="pv-follow" aria-hidden="true">Seguir</span></div>${caption(p, d)}<div class="pv-audio" aria-hidden="true">${ic('music')} Audio original · ${esc(d.ac.nombre)}</div></div>`;
    else ui = `<div class="pv-ui" aria-hidden="true"><div class="pv-prog">${(n ? ms : [0]).map((_, i) => `<i class="${i < slide ? 'done' : i === slide ? 'on' : ''}"></i>`).join('')}</div>
        <div class="pv-top st"><span class="pv-av sm">${esc(d.ac.iniciales)}</span><b>${esc(d.ac.nombre)}</b><span class="pv-ago">${p.hora ? esc(p.hora) : ''}</span><span class="pv-sp"></span>${ic('dots')}</div></div>
        <div class="pv-low st" aria-hidden="true"><span class="pv-msg">${fb ? 'Responder…' : 'Enviar mensaje'}</span>${ic(fb ? 'like' : 'heart')}${ic('send')}</div>`;
    const extra = reel && d.v.red === 'instagram' && n ? `<div class="pv-mini"><figure><span class="pv-mini-b" style="aspect-ratio:3/4">${medio(ms[0].src, esc)}</span><figcaption>En tu perfil (3:4)</figcaption></figure><figure><span class="pv-mini-b" style="aspect-ratio:4/5">${medio(ms[0].src, esc)}</span><figcaption>En el feed (4:5)</figcaption></figure></div>` : '';
    return `<div class="pv-phone${no916 ? ' bands' : ''}"><div class="pv-screen">${capa}${zon}${ui}${nav(n, true)}</div></div>${extra}`;
  }

  function feedFB(p, d) {
    const ms = d.medios, n = ms.length, vid = ms.find(esVideoM);
    let m = '';
    if (vid) m = `<div class="pv-media" style="aspect-ratio:${proporcionFeed(vid).medida ? proporcionFeed(vid).ratio : 16 / 9}">${medio(vid.src, esc)}</div>`;
    else if (n === 1) m = `<div class="pv-media" style="aspect-ratio:${proporcionFeed(ms[0]).ratio}">${medio(ms[0].src, esc)}</div>`;
    else if (n > 1) m = `<div class="pv-mosaic n${Math.min(n, 4)}">${ms.slice(0, 4).map((x, i) => `<span class="pv-tile">${medio(x.src, esc)}${i === 3 && n > 4 ? `<b class="pv-more">+${n - 4}</b>` : ''}</span>`).join('')}</div>`;
    const propio = (p.textoFacebook || '').trim();
    return `<div class="pv-card pv-fb"><div class="pv-h"><span class="pv-av sq">${esc(d.ac.iniciales)}</span><span class="pv-fbn"><b>${esc(d.ac.nombre)}</b><small>${p.fecha ? 'Programada · ' + esc(fechaCorta(p)) : 'Sin día'} · ${ic('globe')}</small></span><span class="pv-sp"></span>${ic('dots')}</div>
      ${caption(p, d)}${m}<div class="pv-fbbar" aria-hidden="true"><span>${ic('like')} Me gusta</span><span>${ic('comment')} Comentar</span><span>${ic('share')} Compartir</span></div></div>
      ${propio ? '<p class="pv-hint">Facebook lleva su propio texto (el de «Otro texto para Facebook»).</p>' : ''}`;
  }
  const esVideoM = m => m?.tipo === 'video' || esVideo(m?.src);

  function perfil(p, d) {
    const resto = (otras() || []).filter(x => x.id !== p.id && x.fecha && (x.redes || []).includes('instagram') && x.formato !== 'historia' && (x.medios || []).length && x.estado !== 'idea');
    const yo = { ...p, _yo: true };
    const lista = [yo, ...resto].filter(x => x._yo || x.fecha).sort((a, b) => `${b.fecha || '9999'} ${b.hora || '99'}`.localeCompare(`${a.fecha || '9999'} ${a.hora || '99'}`)).slice(0, 12);
    const tile = x => `<span class="pv-gt${x._yo ? ' yo' : ''}">${(x.medios || [])[0] ? medio(x.medios[0], esc) : '<span class="pv-m none"></span>'}${x.formato === 'carrusel' ? '<i class="pv-gi" aria-hidden="true">❐</i>' : x.formato === 'reel' ? '<i class="pv-gi" aria-hidden="true">▶</i>' : ''}<small>${x._yo ? 'ESTA' : esc(fechaCorta(x))}</small></span>`;
    return `<div class="pv-card pv-prof"><div class="pv-ph"><span class="pv-av lg">${esc(d.ac.iniciales)}</span><div><b>${esc(d.ac.nombre)}</b><small>Así queda tu perfil con lo programado (de lo más nuevo a lo más viejo).</small></div></div>
      <div class="pv-grid">${lista.map(tile).join('')}</div></div><p class="pv-hint">Desde 2025 Instagram muestra el perfil a 3:4: los bordes de un 4:5 o de un cuadrado se recortan.</p>`;
  }

  function notas(p, d) {
    const out = [];
    if (d.v.vista === 'historia' && (p.texto || '').trim()) out.push('Este texto no aparece en una historia: va dentro de la imagen o el video.');
    if (st.corte?.cortado && d.v.vista !== 'perfil' && d.v.vista !== 'historia') out.push(`Antes de «${d.v.red === 'facebook' ? 'Ver más' : 'más'}» se leen ${st.corte.antes} caracteres: ahí va el gancho.`);
    const pr = proporcionFeed(d.medios[0]);
    if (d.v.vista === 'feed' && d.medios.length && !pr.medida) out.push('No sé las medidas de este archivo: se muestra a 4:5.');
    if ((d.v.vista === 'reel' || d.v.vista === 'historia') && d.medios.length) { const z = ZONAS[d.v.vista]; out.push(`Deja el texto importante fuera del ${Math.round(z.arriba * 100)} % de arriba y del ${Math.round(z.abajo * 100)} % de abajo: ahí va la interfaz.`); if (pr.medida && Math.abs(pr.real - 0.5625) > 0.03) out.push('No es vertical 9:16: sale con bandas.'); }
    return out.length ? `<ul class="pv-notes">${out.map(t => `<li>${t}</li>`).join('')}</ul>` : '';
  }

  function paint(p) {
    cur = p; const d = datos(p);
    const tabs = `<div class="pv-tabs" role="tablist" aria-label="Ver cómo queda en">${d.tabs.map(t => `<button type="button" role="tab" id="pv-t-${t}" aria-selected="${t === tab}" tabindex="${t === tab ? 0 : -1}" data-pv-tab="${t}"><b class="pv-net ${VISTAS[t].red}">${VISTAS[t].red_}</b>${VISTAS[t].label}</button>`).join('')}</div>`;
    const body = d.v.vista === 'perfil' ? perfil(p, d) : d.v.vista === 'feed' ? (d.v.red === 'instagram' ? feedIG(p, d) : feedFB(p, d)) : vertical(p, d);
    const fuera = d.v.vista === 'feed' && d.v.red === 'instagram' ? proporcionFeed(d.medios[0]).fuera : null;
    const conZonas = d.v.vista === 'reel' || d.v.vista === 'historia' || (d.v.vista === 'feed' && d.v.red === 'instagram' && d.medios.length > 0);
    box.innerHTML = `${tabs}<div class="pv-stage" role="tabpanel" aria-labelledby="pv-t-${tab}">
      <div class="pv-mock" role="group" aria-roledescription="vista previa" aria-label="${esc(resumenAria(p, tab, { corte: st.corte, fuera }))}">${body}</div>
      ${conZonas ? `<label class="pv-zt"><input type="checkbox" data-pv-zonas${zonas ? ' checked' : ''}> Ver ${d.v.vista === 'feed' ? 'recortes' : 'zonas que tapa la interfaz'}</label>` : ''}${notas(p, d)}</div>`;
    mediaKey = key(p);
  }
  const key = p => JSON.stringify([tab, slide, zonas, p.formato, p.redes, p.medios, p.medidas, p.historiaTambien, p.fecha, p.hora, cuenta()]);
  /** Al teclear: si solo cambió el texto, se cambia solo el pie (los <img> y <video> se quedan). */
  function text(p) {
    if (!box.firstChild || key(p) !== mediaKey) return paint(p);
    cur = p; const d = datos(p);
    const cap = box.querySelector('[data-pv="cap"]'); if (cap) cap.outerHTML = caption(p, d);
    const com = box.querySelector('[data-pv="com"]'), nc = comentario(p, d);
    if (com) com.outerHTML = nc || '<span data-pv="com" hidden></span>'; else if (nc) box.querySelector('.pv-likes, .pv-cap')?.insertAdjacentHTML('afterend', nc);
    const n = box.querySelector('.pv-notes'), nn = notas(p, d); if (n) n.outerHTML = nn || ''; else if (nn) box.querySelector('.pv-stage')?.insertAdjacentHTML('beforeend', nn);
    const mock = box.querySelector('.pv-mock'); if (mock) mock.setAttribute('aria-label', resumenAria(p, tab, { corte: st.corte }));
  }

  box.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !cur) return;
    if (b.dataset.pvTab) { tab = b.dataset.pvTab; slide = 0; abierto = false; paint(cur); box.querySelector(`[data-pv-tab="${tab}"]`)?.focus(); return; }
    if (b.dataset.pvSl) { slide = Math.max(0, slide + Number(b.dataset.pvSl)); paint(cur); (box.querySelector(`[data-pv-sl="${b.dataset.pvSl}"]:not([disabled])`) || box.querySelector('[data-pv-sl]:not([disabled])'))?.focus(); return; }
    if ('pvMas' in b.dataset) { abierto = !abierto; text(cur); box.querySelector('[data-pv-mas]')?.focus(); return; }
    if ('pvCom' in b.dataset) { comAbierto = !comAbierto; text(cur); box.querySelector('[data-pv-com]')?.focus(); }
  });
  // deslizar con el dedo (o el ratón) sobre el archivo pasa al siguiente o al anterior, como en la app (PRE-07)
  let sx = null;
  box.addEventListener('pointerdown', e => { sx = e.target.closest('.pv-media, .pv-screen') && !e.target.closest('button') && box.querySelector('[data-pv-sl]') ? { x: e.clientX, y: e.clientY } : null; });
  box.addEventListener('pointerup', e => { if (!sx) return; const dx = e.clientX - sx.x, dy = e.clientY - sx.y; sx = null; if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) box.querySelector(`[data-pv-sl="${dx < 0 ? 1 : -1}"]:not([disabled])`)?.click(); });
  box.addEventListener('pointercancel', () => { sx = null; });
  box.addEventListener('change', e => { if (e.target.matches('[data-pv-zonas]')) { zonas = e.target.checked; paint(cur); box.querySelector('[data-pv-zonas]')?.focus(); } });
  box.addEventListener('keydown', e => {
    const t = e.target.closest('[role="tab"]');
    if (t && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); e.stopPropagation(); const all = [...box.querySelectorAll('[role="tab"]')], i = all.indexOf(t), nx = all[(i + (e.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length]; tab = nx.dataset.pvTab; slide = 0; paint(cur); box.querySelector(`[data-pv-tab="${tab}"]`)?.focus(); return; }
    if (e.target.closest('.pv-mock') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && box.querySelector('[data-pv-sl]')) { e.preventDefault(); e.stopPropagation(); box.querySelector(`[data-pv-sl="${e.key === 'ArrowRight' ? 1 : -1}"]:not([disabled])`)?.click(); }
  });
  return { paint, text, reset() { tab = ''; slide = 0; abierto = false; comAbierto = false; } };
}
