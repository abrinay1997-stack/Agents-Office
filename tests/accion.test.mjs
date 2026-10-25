// 25 oct 2026 — src/accion.js: el botón dice qué pasa (ocupado → hecho | error), no se doble-envía y los errores salen en español.
// Un DOM mínimo a mano (no hay jsdom en el repositorio).
import test from 'node:test';
import assert from 'node:assert/strict';

const attrs = (o) => ({ _a: {}, setAttribute(k, v) { this._a[k] = String(v); }, getAttribute(k) { return k in this._a ? this._a[k] : null; }, removeAttribute(k) { delete this._a[k]; }, ...o });
const clases = () => { const s = new Set(); return { add: (...c) => c.forEach(x => s.add(x)), remove: (...c) => c.forEach(x => s.delete(x)), contains: c => s.has(c), s }; };
function boton() { const b = attrs({ innerHTML: 'Guardar', classList: clases(), after(n) { this.siguiente = n; } }); return b; }
globalThis.document = { createElement: () => attrs({ classList: clases(), remove() { this.fuera = true; } }), body: { appendChild(n) { n.isConnected = true; globalThis.__live = n; } } };
const { conEstado, pedir, anunciar } = await import('../src/accion.js');
const espera = ms => new Promise(r => setTimeout(r, ms));

test('al instante el botón queda ocupado (aria-busy, texto «Guardando…»), y al terminar muestra ✓ y vuelve a lo de antes', async () => {
  const b = boton(); let sueltar; const p = conEstado(b, () => new Promise(r => { sueltar = r; }), { ocupado: 'Guardando…', hecho: 'Guardado', ms: 20 });
  assert.equal(b.getAttribute('aria-busy'), 'true'); assert.equal(b.getAttribute('aria-disabled'), 'true');
  assert.match(b.innerHTML, /Guardando…/); assert.ok(b.classList.contains('ac-busy'));
  sueltar({ hecho: 'Guardado y aplicado.' }); const r = await p;
  assert.equal(r.ok, true); assert.equal(b.getAttribute('aria-busy'), null); assert.match(b.innerHTML, /✓.*Guardado/); assert.ok(b.classList.contains('ac-ok'));
  await espera(40); assert.equal(b.innerHTML, 'Guardar'); assert.ok(!b.classList.contains('ac-ok'));
});
test('un segundo clic mientras trabaja no lanza otra petición', async () => {
  const b = boton(); let n = 0, sueltar; const f = () => { n++; return new Promise(r => { sueltar = r; }); };
  const p = conEstado(b, f); const otro = await conEstado(b, f);
  assert.equal(otro.ocupado, true); assert.equal(n, 1); sueltar(); await p;
});
test('un fallo deja el motivo en una alerta, el botón dice «Reintentar» y se puede volver a intentar', async () => {
  const b = boton(); const r = await conEstado(b, async () => { throw new Error('Sin conexión con la oficina.'); }, { ocupado: 'Guardando…' });
  assert.equal(r.ok, false); assert.equal(b.siguiente.getAttribute('role'), 'alert'); assert.match(b.siguiente.textContent, /Sin conexión/);
  assert.match(b.innerHTML, /Reintentar/); assert.ok(b.classList.contains('ac-bad')); assert.equal(b.getAttribute('aria-busy'), null); assert.match(b.getAttribute('aria-label'), /Reintentar: Sin conexión/);
  const r2 = await conEstado(b, async () => 1, { ms: 5 }); assert.equal(r2.ok, true); assert.equal(b.siguiente.fuera, true); assert.equal(b.getAttribute('aria-label'), null);
});
test('el resultado se anuncia en una región aria-live única', async () => {
  const b = boton(); await conEstado(b, async () => ({ hecho: 'Guardado y aplicado.' }), { ms: 5 }); await espera(60);
  assert.equal(globalThis.__live.getAttribute('aria-live'), 'polite'); assert.equal(globalThis.__live.textContent, 'Guardado y aplicado.');
  const antes = globalThis.__live; anunciar('otro'); assert.equal(globalThis.__live, antes);
});
test('pedir: errores de red, 5xx, 403 y el texto del servidor salen en español; el tiempo se corta', async () => {
  const real = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new TypeError('failed'); };
    await assert.rejects(pedir('/x'), /Sin conexión/);
    globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) }); await assert.rejects(pedir('/x'), /error 500/);
    globalThis.fetch = async () => ({ ok: false, status: 403, json: async () => ({}) }); await assert.rejects(pedir('/x'), /permiso/);
    globalThis.fetch = async () => ({ ok: false, status: 422, json: async () => ({ error: 'Presupuesto inválido' }) }); await assert.rejects(pedir('/x'), /Presupuesto inválido/);
    globalThis.fetch = (u, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(Object.assign(new Error('a'), { name: 'AbortError' }))));
    await assert.rejects(pedir('/x', {}, 20), /Tardó más de 20 segundos/);
  } finally { globalThis.fetch = real; }
});
