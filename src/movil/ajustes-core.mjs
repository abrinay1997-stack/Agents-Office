// Versión móvil (25 oct 2026) — LO PURO de Ajustes, Conectores, Costos, Negocio y Equipo en el teléfono: qué cambió en un formulario, cómo se
// dice el estado de un conector, el color de la barra del presupuesto, cómo se dibuja una tendencia. Sin DOM, para probarlo en node.
// Las definiciones de los campos NO están aquí: vienen del servidor (GET /api/settings → settings.FIELDS), la misma lista que usa escritorio.

/** ¿El valor que se leyó del formulario es el de antes? (la misma regla que escritorio: un número vacío conserva su valor por defecto,
 *  un interruptor sin tocar sigue sin escribirse, una lista vacía sigue sin escribirse). */
export function mismo(f, v, original) {
  const o = original ?? (f.type === 'checks' ? f.default : undefined);
  if (f.type === 'select' && o == null) return v === (f.options && f.options[0] ? f.options[0][0] : '');
  if (f.type === 'number') return v === '' || v == null || (o != null && +v === +o);
  if (f.type === 'bool') return o == null ? !v : !!o === !!v;
  if (Array.isArray(v)) return (o == null && !v.length) || JSON.stringify(v) === JSON.stringify(o);
  if (f.type === 'people') return JSON.stringify(v) === JSON.stringify(o || []) || (!o && !v.length);
  return String(v ?? '') === String(o ?? '');
}

/** Lo que cambió: { path: valor } solo con lo distinto de `values` (lo que tiene el servidor). `leidos`: { path: valor } del formulario. */
export function cambios(fields, values, leidos) {
  const out = {};
  for (const f of fields) {
    if (!(f.path in leidos)) continue;
    if (!mismo(f, leidos[f.path], values[f.path])) out[f.path] = leidos[f.path];
  }
  return out;
}

/** Texto de una lista de la caja de texto («uno por línea») → arreglo sin vacíos. */
export const lineas = s => String(s ?? '').split('\n').map(x => x.trim()).filter(Boolean);

/** El estado de un conector en palabras: color Y texto Y qué hacer (nunca solo color). → { txt, tono: 'ok'|'warn'|'bad'|'off', que } */
export function estadoConector(s) {
  if (s.denied) return { txt: 'Bloqueado para los agentes', tono: 'off', que: 'Está en la lista de bloqueados de Ajustes → Conectores.' };
  switch (s.status) {
    case 'connected': return { txt: 'Conectado', tono: 'ok', que: '' };
    case 'needs-auth': return { txt: 'Necesita autorización', tono: 'warn', que: s.detail || 'Falta entrar o guardar su token.' };
    case 'failed': return { txt: 'No conecta', tono: 'bad', que: s.detail || 'Probó y no respondió. Revisa su dirección y su token.' };
    case 'pending': return { txt: 'Conectando…', tono: 'warn', que: '' };
    case 'disabled': return { txt: 'Apagado', tono: 'off', que: 'Enciéndelo para que los agentes lo usen.' };
    default: return { txt: 'Sin estado', tono: 'off', que: '' };
  }
}
export const TONO_ORDEN = { bad: 0, warn: 1, ok: 2, off: 3 };

/** Un monograma estable para un conector sin icono: dos letras y un tono que no cambia entre visitas. */
export function monograma(nombre) {
  const limpio = String(nombre || '').replace(/^plugin:[^:]+:/i, '').replace(/^claude\.ai\s+/i, '').replace(/[^A-Za-z0-9 ]/g, ' ').trim();
  const p = limpio.split(/\s+/).filter(Boolean), ini = (p.length > 1 ? p[0][0] + p[1][0] : limpio.slice(0, 2)).toUpperCase() || '?';
  let h = 0; for (const c of limpio) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return { ini, tono: h % 360 };
}

/** Las herramientas de un conector separadas en las que leen y las que envían (kinds: { nombre: 'read'|'write' }). */
export function herramientasDe(s) {
  const k = s.kinds || {}, todas = s.tools || [];
  return { lee: todas.filter(t => k[t] === 'read' || k[t] === undefined && /^(get|list|search|read|find|fetch|view|ver|buscar|leer)/i.test(t)), envia: todas.filter(t => k[t] === 'write' || (k[t] === undefined && !/^(get|list|search|read|find|fetch|view|ver|buscar|leer)/i.test(t))) };
}

/** Dinero: US$ con los decimales que importan. */
export const usd = n => { n = +n || 0; return n >= 100 ? 'US$' + Math.round(n).toLocaleString('es-PA') : n >= 1 ? 'US$' + n.toFixed(2) : n > 0 ? 'US$' + n.toFixed(3) : 'US$0'; };
/** El nivel de la barra del presupuesto: ok · warn desde el 75 % · bad desde el 90 %. pct: 0–1+ */
export const nivelPresupuesto = pct => (pct >= 0.9 ? 'bad' : pct >= 0.75 ? 'warn' : 'ok');

/** Un valor de Negocio con su unidad. */
export function fmtKpi(v, unit) {
  if (v === null || v === undefined) return '—';
  const n = Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('es-PA') : (+(+v).toFixed(2)).toLocaleString('es-PA');
  return (unit === 'US$' || unit === '$' ? 'US$' : '') + n + (unit && unit !== 'US$' && unit !== '$' ? ' ' + unit : '');
}
/** El trazo (path d) de una tendencia en una caja de W×H; '' si no hay al menos dos puntos. */
export function trazo(series, W = 120, H = 32) {
  if (!series || series.length < 2) return '';
  const min = Math.min(...series), max = Math.max(...series), r = max - min || 1, x = i => 2 + i * (W - 4) / (series.length - 1), y = v => H - 4 - (v - min) / r * (H - 8);
  return series.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
}
/** El id sugerido para un indicador nuevo a partir de su nombre. */
export const idDe = n => String(n || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);

/** El rol en palabras. */
export const ROL = { admin: 'Administrador', editor: 'Editor', lectura: 'Solo lectura' };

/** Cuántas cosas necesitan atención en /api/status (ámbar o rojo). */
export const nAtencion = st => (st && st.checks ? st.checks.filter(c => c.state === 'bad' || c.state === 'warn').length : 0);

/** Decide si un modelo del selector avisa que no usa herramientas en una casilla que las necesita. */
export const avisoModelo = (catalogo, id, necesitaHerramientas) => { const m = id && catalogo.find(x => x.id === id); return m && necesitaHerramientas && !m.herramientas ? `${m.nombre} no usa herramientas: esa casilla solo podrá redactar.` : ''; };

/** Hace un id de conector (a-z, 0-9, guion; empieza con letra) a partir del nombre que se ve. */
export function slugConector(t, existentes = []) {
  let s = String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36);
  if (!/^[a-z]/.test(s)) s = 'c-' + s; if (s.length < 2) s = 'conector';
  let n = s, i = 2; while (existentes.includes(n)) n = s.slice(0, 36) + '-' + i++;
  return n;
}
