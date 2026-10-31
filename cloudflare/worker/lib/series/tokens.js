// Series en la nube, N4: los tokens de un solo uso de GENERAR SERIE (tabla series_tokens, migración 0202). Misma interfaz que lib/tokens.js (poner · leer · tomar · limpiar).
// `tomar` lee y borra: solo UNA petición consigue el token (el DELETE cambia una fila para una sola). El vencimiento lo mira quien lo usa; `limpiar` borra lo caducado (la poda diaria).
const claveOk = (k) => typeof k === 'string' && /^[A-Za-z0-9_-]{6,80}$/.test(k);
export function tokensSerie(db, { ahora = () => Date.now() } = {}) {
  return {
    async poner(token, valor, caduca) {
      if (!claveOk(token)) throw new Error('token no válido');
      await db.prepare('insert or replace into series_tokens (token, json, caduca) values (?,?,?)').bind(token, JSON.stringify(valor), Math.round(caduca)).run();
    },
    async leer(token) { if (!claveOk(token)) return null; const f = await db.prepare('select json from series_tokens where token = ?').bind(token).first(); return f ? JSON.parse(f.json) : null; },
    async tomar(token) {
      if (!claveOk(token)) return null;
      const f = await db.prepare('select json from series_tokens where token = ?').bind(token).first(); if (!f) return null;
      const r = await db.prepare('delete from series_tokens where token = ?').bind(token).run();
      return r.meta?.changes ? JSON.parse(f.json) : null;
    },
    async limpiar(t = ahora()) { await db.prepare('delete from series_tokens where caduca <= ?').bind(Math.round(t)).run(); },
  };
}
