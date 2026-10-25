// Los tokens de un solo uso del dinero y los candados «solo uno a la vez», en D1 (migración 0030). Un Worker no recuerda nada entre
// peticiones, y justo aquí la memoria importa: el segundo clic de un gasto tiene que encontrar el token del primero, y UN SOLO segundo clic
// puede llevárselo.
//   tipo 'conf'    — la confirmación de un gasto (2 min; atada a tipo + id + valor por quien la usa)
//   tipo 'desh'    — DESHACER de anuncios (pausar / bajar presupuesto)
//   tipo 'bandeja' — DESHACER de ocultar / mostrar un comentario
// La interfaz es la de `tokensEnMemoria()` de anuncios/acciones.mjs (poner · leer · tomar · quitar · limpiar · cuenta), asíncrona.

const TIPOS = new Set(['conf', 'desh', 'bandeja']);
const ok = (t) => { if (!TIPOS.has(t)) throw new Error(`tipo de token desconocido: ${t}`); return t; };
const claveOk = (k) => typeof k === 'string' && /^[A-Za-z0-9_-]{6,80}$/.test(k);

export function tokensD1(db, { ahora = () => Date.now() } = {}) {
  return {
    async poner(tipo, token, valor, caduca) {
      ok(tipo); if (!claveOk(token)) throw new Error('token no válido');
      await db.prepare('insert or replace into anuncios_tokens (token, tipo, json, caduca) values (?,?,?,?)').bind(token, tipo, JSON.stringify(valor), Math.round(caduca)).run();
    },
    async leer(tipo, token) {
      ok(tipo); if (!claveOk(token)) return null;
      const f = await db.prepare('select json from anuncios_tokens where token = ? and tipo = ?').bind(token, tipo).first();
      return f ? JSON.parse(f.json) : null; // como en memoria: quien lo usa mira su propio vencimiento y lo dice en palabras
    },
    /** Lo lee y lo quita; solo una petición lo consigue (el DELETE cambia una fila para una sola). El vencimiento lo mira quien lo usa (y `limpiar` borra lo caducado). */
    async tomar(tipo, token) {
      ok(tipo); if (!claveOk(token)) return null;
      const f = await db.prepare('select json from anuncios_tokens where token = ? and tipo = ?').bind(token, tipo).first();
      if (!f) return null;
      const r = await db.prepare('delete from anuncios_tokens where token = ? and tipo = ?').bind(token, tipo).run();
      if (!r.meta?.changes) return null; // otra petición se lo llevó entre medias
      return JSON.parse(f.json);
    },
    async quitar(tipo, token) { ok(tipo); await db.prepare('delete from anuncios_tokens where token = ? and tipo = ?').bind(String(token), tipo).run(); },
    async limpiar(t = ahora()) { await db.prepare('delete from anuncios_tokens where caduca <= ?').bind(Math.round(t)).run(); },
    async cuenta() {
      const { results } = await db.prepare('select tipo, count(*) n from anuncios_tokens where caduca > ? group by tipo').bind(ahora()).all();
      const n = Object.fromEntries(results.map((r) => [r.tipo, r.n]));
      return { confirmaciones: n.conf || 0, deshaceres: n.desh || 0 };
    },
  };
}

/**
 * Un candado con caducidad. `tomar` devuelve true si es tuyo: nadie lo tenía, o el que lo tenía se pasó de `hasta`. Para que una acción
 * sobre la cuenta publicitaria, una creación en Meta o una respuesta a un cliente no corran dos veces a la vez (una petición y el cron,
 * dos pestañas). `soltar` solo suelta el tuyo.
 */
export function candados(db, { ahora = () => Date.now() } = {}) {
  return {
    async tomar(clave, ms, quien = '') {
      const t = ahora();
      const r = await db.prepare('insert or ignore into anuncios_candados (clave, hasta, quien) values (?,?,?)').bind(clave, t + ms, quien).run();
      if (r.meta?.changes) return true;
      const v = await db.prepare('update anuncios_candados set hasta = ?, quien = ? where clave = ? and hasta <= ?').bind(t + ms, quien, clave, t).run();
      return Boolean(v.meta?.changes);
    },
    /** El latido: el dueño del candado lo alarga mientras sigue trabajando (así el candado puede ser corto y morir pronto si el Worker muere). */
    async renovar(clave, ms, quien = '') { const r = await db.prepare('update anuncios_candados set hasta = ? where clave = ? and quien = ?').bind(ahora() + ms, clave, quien).run(); return Boolean(r.meta?.changes); },
    async soltar(clave, quien = '') { await db.prepare('delete from anuncios_candados where clave = ? and quien = ?').bind(clave, quien).run(); },
    async quien(clave) { const f = await db.prepare('select quien, hasta from anuncios_candados where clave = ?').bind(clave).first(); return f && f.hasta > ahora() ? f.quien : null; },
  };
}

/**
 * Un tope de peticiones por minuto, en D1 (el Worker no recuerda entre peticiones). Cuenta ESTA petición y dice si cabe.
 * @returns {Promise<{ ok: boolean, n: number }>}
 */
export async function tasaPorMinuto(db, clave, max, { ahora = () => Date.now() } = {}) {
  const ventana = Math.floor(ahora() / 60e3);
  await db.prepare('delete from anuncios_tasa where ventana < ?').bind(ventana - 5).run();
  // una ventana por (clave, minuto): la clave cabe en el entero porque solo hay un tope hoy; si hubiera más, se separan por prefijo
  const f = await db.prepare('insert into anuncios_tasa (ventana, n) values (?, 1) on conflict (ventana) do update set n = n + 1 returning n').bind(ventana).first();
  return { ok: Number(f?.n ?? 1) <= max, n: Number(f?.n ?? 1), clave };
}
