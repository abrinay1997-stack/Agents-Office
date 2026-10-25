// 25 oct 2026 — estados de acción: todo botón que dispara una petición usa conEstado (ocupado → hecho ✓ | error + Reintentar).
// Un solo anuncio para lectores de pantalla (#acLive). Sin librerías; el estilo está en src/css/accion.css.
let live = null;
export function anunciar(t) { // región aria-live única; se vacía y se escribe de nuevo para que repetir un texto también se lea
  if (!live || !live.isConnected) { live = document.getElementById('acLive'); if (live) { live.textContent = ''; } } // otro paquete (la versión móvil) ya pudo crearlo
  if (!live || !live.isConnected) { live = document.createElement('div'); live.id = 'acLive'; live.className = 'ac-live'; live.setAttribute('data-modal-keep', ''); live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite'); document.body.appendChild(live); }
  live.textContent = ''; setTimeout(() => { live.textContent = t || ''; }, 30);
}
export async function pedir(url, init = {}, ms = 20000) { // fetch + JSON; un fallo es un Error con el motivo en español
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { ...init, signal: c.signal }); let j = {}; try { j = await r.json(); } catch { /* sin cuerpo */ }
    if (!r.ok) throw new Error(j.error || (r.status >= 500 ? `La oficina tuvo un problema (error ${r.status}).` : r.status === 401 || r.status === 403 ? 'No tienes permiso, o tu sesión venció.' : `No se pudo (error ${r.status}).`));
    return j;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Tardó más de 20 segundos y se cortó. Revisa tu conexión y reintenta.');
    if (e instanceof TypeError) throw new Error('Sin conexión con la oficina. Revisa tu red y reintenta.');
    throw e;
  } finally { clearTimeout(t); }
}
export const enviar = (url, body, method = 'POST') => pedir(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });
// conEstado(botón, () => promesa, { ocupado, hecho, error, ms }) → { ok, valor } | { ok: false, error }. Un segundo clic mientras trabaja no hace nada.
export async function conEstado(b, fn, o = {}) {
  if (b.getAttribute('aria-busy') === 'true') return { ok: false, ocupado: true };
  if (!('ac0' in b)) b.ac0 = b.innerHTML; // el contenido de antes, para volver a él
  clearTimeout(b.acT); b.acE?.remove?.(); b.acE = null;
  if ('acL' in b) { if (b.acL === null) b.removeAttribute('aria-label'); else b.setAttribute('aria-label', b.acL); delete b.acL; }
  const poner = (cls, h) => { b.classList.remove('ac-busy', 'ac-ok', 'ac-bad'); if (cls) b.classList.add(cls); b.innerHTML = h; };
  b.classList.add('ac'); b.setAttribute('aria-busy', 'true'); b.setAttribute('aria-disabled', 'true'); // aria-disabled y no disabled: el foco se queda donde estaba
  poner('ac-busy', `<i class="ac-sp" aria-hidden="true"></i><span>${o.ocupado || 'Un momento…'}</span>`);
  try {
    const valor = await fn();
    b.removeAttribute('aria-busy'); b.removeAttribute('aria-disabled');
    const h = o.hecho ?? 'Hecho', dicho = valor && typeof valor.hecho === 'string' ? valor.hecho : h;
    poner('ac-ok', `<b aria-hidden="true">✓</b><span>${h}</span>`); anunciar(dicho);
    b.acT = setTimeout(() => { poner('', b.ac0); }, o.ms ?? 1800);
    return { ok: true, valor };
  } catch (e) {
    b.removeAttribute('aria-busy'); b.removeAttribute('aria-disabled');
    const m = e instanceof TypeError ? 'Sin conexión con la oficina. Revisa tu red y reintenta.' : (e && e.message) || 'No se pudo.', s = document.createElement('span');
    s.className = 'ac-err'; s.setAttribute('role', 'alert'); s.textContent = m;
    b.after?.(s); b.acE = s; poner('ac-bad', '<b aria-hidden="true">!</b><span>Reintentar</span>'); b.acL = b.getAttribute('aria-label'); b.setAttribute('aria-label', 'Reintentar: ' + m);
    return { ok: false, error: m };
  }
}
// El aviso de una vista que no pudo cargar: el motivo y «Reintentar» (cada vista escucha [data-ac-re]); nunca una pantalla en blanco.
export const fallaHTML = (motivo, que = 'No pude cargar.') => `<p class="ac-vacio" role="alert"><b>${que}</b> ${String(motivo || '').replace(/[<&]/g, c => (c === '<' ? '&lt;' : '&amp;'))} <button type="button" class="ac-re" data-ac-re>Reintentar</button></p>`;
// Los botones de antes (se apagan y dicen «Enviando…») sin migrar: al apagarse con un texto que acaba en «…» pasan a aria-busy, y el CSS les pone el giro.
if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined' && document.documentElement) new MutationObserver(rs => { for (const { target: b } of rs) { if (b.tagName !== 'BUTTON' || b.classList.contains('ac')) continue; if (b.disabled && /…\s*$/.test(b.textContent)) { b.setAttribute('aria-busy', 'true'); b.dataset.acAuto = '1'; } else if (b.dataset.acAuto) { b.removeAttribute('aria-busy'); delete b.dataset.acAuto; } } }).observe(document.documentElement, { attributes: true, attributeFilter: ['disabled'], subtree: true });
