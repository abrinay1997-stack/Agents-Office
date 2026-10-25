// Versión móvil (25 oct 2026) — DIMITRI CON IMÁGENES: adjuntar una foto (del Estudio, de la cámara o de la galería del teléfono) y ver los creativos
// que propone. Igual que en escritorio (src/sub.js): el ORIGINAL sube al Estudio (carpeta «Referencias de Dimitri») y a Claude le va una copia reducida
// (lado largo ≤ 1568 px, ≤ 1,5 MB) en `vision`; al servidor viajan `attach` (los ids) y `vision`. Hasta 4 por mensaje. Lo que GASTA no se confirma
// aquí: la tarjeta de «estudio» dice cuánto cuesta y manda a la vista de escritorio, donde están los dos clics y los topes (la regla del dinero no cambia).
import { esc, svg, hace } from '../ui.js';
import { ic, mediaSrc, esAudio, esVideo, leerDataURL } from '../b-comun.js';
import { MAX_ATTACH, DIMITRI_FOLDER, fitWithin, shrinkStep, b64Bytes, outgoing, usd, KIND } from '../../sub-studio.js';
import { elegirArchivos } from './estudio.js';

const IMG = /^image\/(png|jpe?g|webp)$/i;
const cargarImg = url => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('No pude abrir la imagen.')); i.src = url; });

/** La copia de una imagen para los ojos de Claude: lado largo ≤ 1568 px y ≤ 1,5 MB, en JPEG con fondo blanco (un PNG transparente no sale negro). */
export async function copiaParaVision(url) {
  const img = await cargarImg(url); let t = { ...fitWithin(img.naturalWidth, img.naturalHeight), q: 0.85 };
  for (let k = 0; k < 14; k++) {
    const c = document.createElement('canvas'); c.width = t.w; c.height = t.h; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, t.w, t.h); g.drawImage(img, 0, 0, t.w, t.h);
    const d = c.toDataURL('image/jpeg', t.q), nx = shrinkStep(t, b64Bytes(d)); if (!nx) return { media_type: 'image/jpeg', data: d.slice(d.indexOf(',') + 1) }; t = nx;
  }
  throw new Error('No pude reducirla para que Dimitri la vea.');
}

/** El cuerpo de lo que se manda a /api/sub/chat con las imágenes: lo puro (con test). */
export function salida(texto, adjuntos) {
  const o = outgoing(texto, adjuntos); if (!o.send) return null;
  const listos = o.ready, vis = listos.filter(a => a.vision).map(a => a.vision);
  return { text: o.text, attach: listos.map(a => a.file), ...(vis.length ? { vision: vis } : {}), perdidas: o.lost.length };
}

/** Las tiras de miniaturas de lo que adjuntó el dueño en un mensaje suyo (tocar una la abre en el Estudio). */
export function adjuntosBurbuja(m) {
  const l = (m.attach || []).filter(Boolean); if (!l.length) return '';
  return `<div class="mv-adjs">${l.map(f => esAudio(f) ? `<span class="mv-adj-m">${ic('nota_s')}</span>` : esVideo(f) ? `<button type="button" class="mv-adj-m" data-media="${esc(f)}" aria-label="Abrir el video">${ic('play')}</button>` : `<button type="button" class="mv-adj-m" data-media="${esc(f)}" aria-label="Abrir la imagen en el Estudio"><img src="${esc(mediaSrc(f))}" alt="" loading="lazy"></button>`).join('')}</div>`;
}

/** La tarjeta de lo que Dimitri propone al Estudio: cada creativo con su modelo, su idea, su costo y sus miniaturas si ya salió. Generar → escritorio. */
export function estudioHTML(m) {
  const s = m.studio; if (!s || !(s.creatives || []).length) return '';
  const cs = s.creatives, abiertos = cs.filter(c => !c.state || c.state === 'proposed'), total = abiertos.reduce((t, c) => t + (+c.cost || 0), 0);
  const ESTADO = { sent: 'enviado', running: 'generando…', done: 'listo', failed: 'falló', skipped: 'no se incluyó' };
  const fila = c => { const hecho = c.state && c.state !== 'proposed', fs = (c.files || []).filter(Boolean);
    return `<li class="mv-cre ${c.state || 'proposed'}"><div class="mv-cre-t"><b>${esc(c.title || 'Creativo')}</b><span class="mv-chip-k">${esc(KIND[c.kind] || 'IMAGEN')}</span></div>
      <small>${esc(c.modelName || c.model || '')}${c.n > 1 ? ' · ' + c.n : ''}${hecho ? ' · ' + esc(ESTADO[c.state] || c.state) : c.cost ? ' · ' + usd(c.cost) : ''}${c.state === 'failed' && c.error ? ' — ' + esc(c.error) : ''}</small>
      ${!hecho && c.prompt ? `<p class="mv-cre-p">${esc(c.prompt)}</p>` : ''}
      ${fs.length ? `<div class="mv-adjs">${fs.map(f => esAudio(f) ? `<span class="mv-adj-m">${ic('nota_s')}</span>` : `<button type="button" class="mv-adj-m" data-media="${esc(f)}" aria-label="Abrir en el Estudio">${esVideo(f) ? ic('play') : `<img src="${esc(mediaSrc(f))}" alt="" loading="lazy">`}</button>`).join('')}</div>` : ''}</li>`; };
  return `<section class="mv-tarjeta" aria-label="Creativos que propone"><h4>Propone ${cs.length} ${cs.length === 1 ? 'creativo' : 'creativos'}</h4><ul class="mv-cres">${cs.map(fila).join('')}</ul>
    ${abiertos.length ? `<p class="mv-meta"><b>Costo estimado: ${usd(total)}</b>. Generar gasta, así que se confirma en la versión de escritorio con los topes del Estudio.</p><button type="button" class="mv-btn primario" data-gasto>Revisar y generar en escritorio</button>` : ''}
    ${(s.actions || []).length ? `<p class="mv-meta">Y ${s.actions.length} ${s.actions.length === 1 ? 'acción' : 'acciones'} de orden en el Estudio (carpetas, mover).</p>` : ''}
    ${s.lote || s.loteRef ? '<p class="mv-meta">Incluye un lote de fotos: se sigue y se aprueba en escritorio.</p>' : ''}</section>`;
}

/** El adjuntar de la caja de Dimitri: el botón del clip, la tira de miniaturas, y la subida del original + la copia para la visión. */
export function crearAdjuntos(ctx, forma, { alCambiar = () => {} } = {}) {
  let lista = [], carpeta = null;
  const tira = document.createElement('div'); tira.className = 'mv-adj'; tira.hidden = true; tira.setAttribute('role', 'list'); tira.setAttribute('aria-label', 'Imágenes adjuntas');
  const clip = document.createElement('button'); clip.type = 'button'; clip.className = 'mv-ic mv-clip'; clip.setAttribute('aria-label', 'Adjuntar una imagen'); clip.innerHTML = ic('clip');
  forma.prepend(tira); forma.querySelector('textarea').before(clip);
  const hayCaja = () => lista.length > 0;
  function pintar() {
    tira.hidden = !lista.length; forma.closest('[data-vista]')?.classList.toggle('con-adj', !!lista.length);
    tira.innerHTML = lista.map(a => `<div class="mv-adj-i ${a.estado}" role="listitem" data-k="${a.k}">${a.vista ? `<img src="${esc(a.vista)}" alt="${esc(a.nombre)}">` : `<span>${ic('nota_s')}</span>`}${a.estado === 'subiendo' ? '<i class="ac-sp" aria-hidden="true"></i><span class="mv-sr">Subiendo</span>' : a.estado === 'falla' ? `<em title="${esc(a.error)}">!</em>` : ''}<button type="button" class="mv-adj-x" data-quita="${a.k}" aria-label="Quitar ${esc(a.nombre)}">${svg('cerrar')}</button></div>`).join('') + (lista.some(a => a.estado === 'falla') ? `<p class="mv-err" role="alert">${esc(lista.find(a => a.estado === 'falla').error)}</p>` : '');
    alCambiar();
  }
  tira.addEventListener('click', e => { const b = e.target.closest('[data-quita]'); if (!b) return; const a = lista.find(x => x.k === b.dataset.quita); if (a && a.vista && a.vista.startsWith('blob:')) URL.revokeObjectURL(a.vista); lista = lista.filter(x => x !== a); pintar(); });
  async function carpetaDimitri() {
    if (carpeta) return carpeta;
    try {
      const j = await ctx.api('/api/media?n=1'), f = (j.folders || []).find(x => x.name.toLowerCase() === DIMITRI_FOLDER.toLowerCase());
      if (f) return (carpeta = f.id);
      const r = await ctx.api('/api/media/folders', { method: 'POST', body: { name: DIMITRI_FOLDER } }); return (carpeta = r.folder.id);
    } catch { return null; }
  }
  function agregarArchivos(files) {
    for (const f of [...files]) {
      if (lista.length >= MAX_ATTACH) { ctx.toast(`Como mucho ${MAX_ATTACH} imágenes por mensaje.`); break; }
      if (!IMG.test(f.type)) { ctx.toast(`«${f.name || 'eso'}»: solo PNG, JPG o WEBP.`); continue; }
      if (f.size > 12 * 1024 * 1024) { ctx.toast(`«${f.name}» pasa de 12 MB.`); continue; }
      const a = { k: 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), nombre: f.name || 'foto', vista: URL.createObjectURL(f), estado: 'subiendo' }; lista.push(a);
      a.listo = (async () => {
        try {
          const [data, vis, folder] = await Promise.all([leerDataURL(f), copiaParaVision(a.vista), carpetaDimitri()]);
          const r = await ctx.api('/api/media/upload', { method: 'POST', body: { name: a.nombre, data, ...(folder ? { folder } : {}) } });
          a.file = r.item.file; a.vision = { file: a.file, ...vis }; a.estado = 'lista'; dispatchEvent(new Event('ao:media-changed'));
        } catch (e) { a.estado = 'falla'; a.error = e.message; }
        pintar();
      })();
    }
    pintar();
  }
  async function agregarGaleria(ids) {
    for (const id of ids) {
      if (!id || lista.some(a => a.file === id)) continue;
      if (lista.length >= MAX_ATTACH) { ctx.toast(`Como mucho ${MAX_ATTACH} imágenes por mensaje.`); break; }
      const a = { k: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), nombre: id.split('/').pop(), file: id, vista: esAudio(id) || esVideo(id) ? '' : mediaSrc(id), estado: esAudio(id) || esVideo(id) ? 'lista' : 'subiendo' }; lista.push(a);
      if (a.estado === 'lista') continue; // un video o un audio va por su id: Dimitri no lo ve, lo conoce por su nombre
      a.listo = copiaParaVision(a.vista).then(v => { a.vision = { file: id, ...v }; a.estado = 'lista'; }).catch(() => { a.estado = 'lista'; }).then(pintar);
    }
    pintar();
  }
  clip.addEventListener('click', () => {
    const h = ctx.hoja({ titulo: 'Adjuntar una imagen', cuerpo: `<p class="mv-meta">Hasta ${MAX_ATTACH} por mensaje. Dimitri la ve y la guarda en el Estudio.</p>
      <input type="file" id="mvAdjF" class="mv-sr" accept="image/png,image/jpeg,image/webp" capture="environment"><label for="mvAdjF" class="mv-btn mv-etq">${ic('foto')} Hacer una foto</label>
      <input type="file" id="mvAdjG" class="mv-sr" accept="image/png,image/jpeg,image/webp" multiple><label for="mvAdjG" class="mv-btn mv-etq">${ic('subir')} Elegir del teléfono</label>
      <button type="button" class="mv-btn mv-etq" data-est>${ic('estudio')} Elegir del Estudio</button>` });
    h.cuerpo.addEventListener('change', e => { if (e.target.type !== 'file') return; const fs = [...e.target.files]; e.target.value = ''; h.cerrar(); agregarArchivos(fs); });
    h.cuerpo.addEventListener('click', async e => { if (!e.target.closest('[data-est]')) return; h.cerrar(); await new Promise(r => setTimeout(r, 300)); const l = await elegirArchivos(ctx, { max: MAX_ATTACH - lista.length, titulo: 'Elegir del Estudio', tipo: 'image' }); if (l && l.length) agregarGaleria(l); });
  });
  return {
    hay: hayCaja, subiendo: () => lista.some(a => a.estado === 'subiendo'), agregarGaleria, agregarArchivos,
    /** → { text, attach, vision } o null (nada que mandar) */
    tomar(texto) { return salida(texto, lista.map(a => ({ state: a.estado === 'lista' ? 'ready' : a.estado === 'falla' ? 'failed' : 'uploading', file: a.file, vision: a.vision }))); },
    esperar: () => Promise.all(lista.map(a => a.listo)),
    limpiar() { for (const a of lista) if (a.vista && a.vista.startsWith('blob:')) URL.revokeObjectURL(a.vista); lista = []; pintar(); },
    devolver(l) { lista = l; pintar(); }, lista: () => lista,
  };
}
