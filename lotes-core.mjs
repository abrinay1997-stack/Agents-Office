// Agents Office — el lote del Estudio: lo PURO (sin archivos, sin red, sin media.mjs). Lo comparten la oficina local (lotes.mjs, que añade el motor con archivos y la bomba)
// y la nube (cloudflare/worker/lib/estudio/lotes.js: D1 y el cron). La máquina de estados, los umbrales del OK del dueño, el CSV, el ZIP y los nombres por SKU viven aquí una sola vez.
// Cubierto por tests/lotes-*.test.mjs y cloudflare/tests/lotes-nube.test.mjs.
export const ESTADOS = ['previsto', 'espera_ok', 'muestra', 'corriendo', 'pausado', 'hecho', 'cancelado'];
export const ESTADOS_FILA = ['en_cola', 'editando', 'verificando', 'lista', 'revisar', 'aprobada', 'fallo', 'omitida'];
export const TERMINAL = new Set(['lista', 'revisar', 'aprobada', 'fallo', 'omitida']);
export const ACTIVOS = new Set(['muestra', 'corriendo']);
/** La máquina de estados del lote: estado → acción → estado siguiente ('*' = a donde estaba antes de la pausa). */
export const TRANSICIONES = Object.freeze({
  previsto: { probar: 'muestra', iniciar: 'corriendo', cancelar: 'cancelado' },
  espera_ok: { autorizar: 'previsto', cancelar: 'cancelado' },
  muestra: { pausar: 'pausado', cancelar: 'cancelado' },
  corriendo: { pausar: 'pausado', cancelar: 'cancelado' },
  pausado: { reanudar: '*', continuar: 'corriendo', iniciar: 'corriendo', probar: 'muestra', cancelar: 'cancelado' },
  hecho: {},
  cancelado: {},
});
export const ACCION_ES = { probar: 'probar con unas pocas', iniciar: 'empezar', continuar: 'seguir', pausar: 'pausar', reanudar: 'reanudar', cancelar: 'cancelar', autorizar: 'autorizar' };
const ESTADO_ES = { previsto: 'previsto', espera_ok: 'esperando tu OK', muestra: 'probando', corriendo: 'en marcha', pausado: 'pausado', hecho: 'terminado', cancelado: 'cancelado' };
export const DEFAULTS = Object.freeze({ max: 100, agenteSinOk: 10, agenteUsd: 2, url: false, concurrencia: 2, muestra: 3, muestraDesde: 10, intervalo: 5000, retries: { max: 2, backoff: [60, 300, 900] } });
export const FIEL = 'If unsure, leave the product untouched.';

export const e409 = msg => Object.assign(new Error(msg), { status: 409 });
export const e400 = msg => Object.assign(new Error(msg), { status: 400 });
export const e404 = msg => Object.assign(new Error(msg), { status: 404 });
/** El estado al que lleva `accion` desde el estado del lote, o un 409 en palabras. Puro. */
export function transicion(lote, accion) {
  const t = TRANSICIONES[lote?.estado] || {};
  const sig = t[accion];
  if (!sig) throw e409(`no se puede ${ACCION_ES[accion] || accion} un lote ${ESTADO_ES[lote?.estado] || lote?.estado}`);
  if (accion === 'probar' && lote.muestraHecha) throw e409('la muestra ya se hizo: sigue con el resto o cambia la receta');
  return sig === '*' ? (lote.reanudarA && ACTIVOS.has(lote.reanudarA) ? lote.reanudarA : 'corriendo') : sig;
}
/** §15.5: ¿un pedido de un agente necesita el OK del dueño? Suma lo que esa tarea, y ese agente hoy, ya pidieron (`previo`:
 *  fotos y US$ estimados de sus lotes y de aplicar_preset): partir el trabajo en pedidos pequeños no lo salta. La misma regla para
 *  crear_lote y aplicar_preset; agenteSinOk o agenteUsd en 0 = pedir siempre el OK. → null, o el porqué en palabras. Puro. */
export function pideOkAgente({ fotos = 0, usd: u = 0 } = {}, previo = {}, cfg = DEFAULTS) {
  const pf = Math.max(0, +previo.fotos || 0), pu = Math.max(0, +previo.usd || 0);
  const f = pf + Math.max(0, +fotos || 0), d = +(pu + Math.max(0, +u || 0)).toFixed(4);
  const sinOk = +(cfg.agenteSinOk ?? DEFAULTS.agenteSinOk), tope = +(cfg.agenteUsd ?? DEFAULTS.agenteUsd);
  const antes = pf || pu ? ` contando lo que ya pidió en esta tarea u hoy (${pf} foto${pf === 1 ? '' : 's'}, ${usd(pu)})` : '';
  if (f >= sinOk) return `Lo pidió un agente y llega a ${f} fotos${antes} (el tope sin tu OK es ${Math.max(0, sinOk - 1)}): espera tu OK.`;
  if (d >= tope) return `Lo pidió un agente y llega a ${usd(d)}${antes} (el tope sin tu OK es menos de ${usd(tope)}): espera tu OK.`;
  return null;
}
/** Cuántas de prueba por defecto: «Probar con 3» viene encendido a partir de 10 fotos (D11). Puro. */
export const muestraPorDefecto = (n, cfg = DEFAULTS) => (n >= (cfg.muestraDesde ?? 10) ? (cfg.muestra ?? 3) : 0);
const INTENSIDAD = ['suave', 'normal', 'fuerte'];
/** Un nivel más de intensidad (para «Reintentar más fuerte»). Puro. */
export const masFuerte = v => INTENSIDAD[Math.min(2, Math.max(0, INTENSIDAD.indexOf(v || 'normal')) + 1)];
/** Lo que se le pide de más al modelo según lo que falló la QA. Puro. */
export function refuerzoDe(checks = []) {
  const f = new Set((checks || []).filter(c => c && c.ok === false).map(c => c.id));
  const out = [];
  if (f.has('fondo-255')) out.push('The background must be pure white (#FFFFFF) everywhere outside the product.');
  if (f.has('ocupacion') || f.has('escena') || f.has('sin-recorte')) out.push('Keep the whole product inside the frame at exactly the size and position asked for; never crop it.');
  if (f.has('identidad') || f.has('delta-e')) out.push('Keep the product identical to the photo: same shape, colors and details.');
  return out.join(' ');
}
export const esCreditos = m => /cr[eé]ditos|saldo|billing|no es v[aá]lida o no tiene permiso|\b40[23]\b|quota/i.test(String(m || ''));
export const esPresupuesto = m => /presupuesto del (d[ií]a|mes)|tope diario/i.test(String(m || ''));
export const usd = v => 'US$' + (+v || 0).toFixed(2).replace('.', ',');
export const pct = v => `${Math.round((+v || 0) * 1000) / 10}`.replace('.', ',') + ' %';
export const limpio = (s, n = 200) => String(s ?? '').replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ').trim().slice(0, n);
export const fold = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
export const slug = s => fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'lote';
export const ID_RE = /^L[a-z0-9]{4,30}$/;
export const p2 = x => String(x).padStart(2, '0');
export const lid = () => 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** El resumen de un lote: cuántas filas hay en cada estado. Puro. */
export function cuentas(lote) {
  const c = Object.fromEntries(ESTADOS_FILA.map(e => [e, 0]));
  for (const f of lote.filas || []) c[f.estado] = (c[f.estado] || 0) + 1;
  const total = (lote.filas || []).length, hechas = (lote.filas || []).filter(f => TERMINAL.has(f.estado)).length;
  return { ...c, total, hechas, progreso: total ? +(hechas / total).toFixed(3) : 0 };
}
/** «37 listas, 2 para revisar, 1 falló». Puro. */
export function resumenEs(lote) {
  const c = cuentas(lote), l = [];
  const listas = c.lista + c.aprobada;
  l.push(`${listas} lista${listas === 1 ? '' : 's'}`);
  if (c.revisar) l.push(`${c.revisar} para revisar`);
  if (c.fallo) l.push(`${c.fallo} ${c.fallo === 1 ? 'falló' : 'fallaron'}`);
  if (c.omitida) l.push(`${c.omitida} omitida${c.omitida === 1 ? '' : 's'}`);
  return l.join(', ');
}

/* ---------- CSV y ZIP de salida ---------- */
/** Una celda de CSV: entre comillas si hace falta, y nunca una fórmula (=, +, -, @ al principio se neutralizan). */
export const celdaCsv = v => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
/** Los nombres por SKU: «CM-140_01.jpg», «CM-140_02.jpg»; sin SKU, «fila-012_01.jpg». Puro. */
export function nombresPorSku(filas) {
  const vistos = new Map();
  return filas.map(f => {
    const base = String(f.sku || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || `fila-${String(f.n).padStart(3, '0')}`;
    const k = (vistos.get(base.toLowerCase()) || 0) + 1; vistos.set(base.toLowerCase(), k);
    const ext = String(f.out || '').split('.').pop().toLowerCase().replace('jpeg', 'jpg') || 'jpg';
    return `${base}_${p2(k)}.${ext}`;
  });
}
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
/** [{ name, data }] → un .zip sin comprimir (las imágenes ya vienen comprimidas). */
export function zipDe(files, now = new Date()) {
  if (!(now.getFullYear() >= 1980)) now = new Date(1980, 0, 1); // el formato ZIP no tiene fechas anteriores a 1980
  const dt = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1), dd = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const parts = [], central = []; let off = 0;
  for (const f of files) {
    const nm = Buffer.from(f.name, 'utf8'), crc = crc32(f.data), sz = f.data.length;
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(0, 8); h.writeUInt16LE(dt, 10); h.writeUInt16LE(dd, 12); h.writeUInt32LE(crc, 14); h.writeUInt32LE(sz, 18); h.writeUInt32LE(sz, 22); h.writeUInt16LE(nm.length, 26); h.writeUInt16LE(0, 28);
    parts.push(h, nm, f.data);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(0, 10); c.writeUInt16LE(dt, 12); c.writeUInt16LE(dd, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(sz, 20); c.writeUInt32LE(sz, 24); c.writeUInt16LE(nm.length, 28); c.writeUInt32LE(off, 42);
    central.push(c, nm); off += 30 + nm.length + sz;
  }
  const cd = Buffer.concat(central), e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(files.length, 8); e.writeUInt16LE(files.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, e]);
}

