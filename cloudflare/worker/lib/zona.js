// La hora de la oficina en el Worker — UNA sola implementación para todas las fases (tareas, rutinas, Contenido…).
//
// Las reglas de la oficina (tareas/, rutinas, Contenido) se escribieron para una computadora: «el viernes a las 9:00» es el reloj de ESA máquina, y el código lo
// lee con `new Date('2026-10-30T09:00:00')` (sin zona = hora local), `getHours()`, `getDay()`, `setDate()`… Un Worker corre siempre en UTC: sin más, las 9:00 de
// Panamá serían las 4:00 de la madrugada. Como esas reglas son puras y se comparten con la oficina local, no se copian ni se tocan.
//
// DOS formas de usarla (la misma clase por debajo):
//   1. Reloj explícito, sin tocar nada global: desfaseMin · componentes · instanteDe · instanteDeTexto · describirZona · zonaValida · crearDateDeZona(zona).
//   2. Parche global: instalarZona(zona) pone UNA vez la clase en lugar de `Date` (lo hace lib/rutas.js al entrar una petición y al correr el cron; los módulos no lo
//      llaman). conZona(zona, fn) lo pone solo mientras `fn` trabaja (cuenta las entradas: entra la primera, sale la última; si ya había un parche, lo respeta).
//
// Qué cambia: new Date('AAAA-MM-DDTHH:MM[:SS]') o 'AAAA-MM-DD HH:MM' (sin zona), new Date(y, m, d, h, mi…), Date.parse de esos mismos textos, los get*/set* «locales»
// y toLocale*String (en la zona). Qué NO cambia: Date.now(), getTime(), toISOString(), los getUTC*, new Date(ms), 'AAAA-MM-DD' (UTC, como en JS) y las fechas con zona
// explícita (…Z, …+05:00). `Date()` llamado como función y `x instanceof Date` siguen funcionando (el global es un Proxy de la clase).
const Real = globalThis.Date;
export const ZONA_POR_DEFECTO = 'America/Panama';
export { Real as DateReal };

export function zonaValida(z) { if (typeof z !== 'string' || !z || z.length > 60) return false; try { new Intl.DateTimeFormat('en-US', { timeZone: z }); return true; } catch { return false; } }

const ESTADO = { zona: ZONA_POR_DEFECTO, instalada: false };
const formateadores = new Map();
function partesEn(zona, ms) {
  let f = formateadores.get(zona);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: zona, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    formateadores.set(zona, f);
  }
  const p = {}; for (const x of f.formatToParts(new Real(ms))) if (x.type !== 'literal') p[x.type] = Number(x.value);
  return p;
}
/** Minutos que la zona va por delante de UTC en ese instante (Panamá: −300). */
export function desfaseMin(zona, ms) {
  const s = Math.floor(ms / 1000) * 1000, p = partesEn(zona, s);
  return Math.round((Real.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - s) / 60000);
}
/** Lo mismo en milisegundos y con la zona instalada por defecto (la API que usaba el módulo de tareas). */
export const desfase = (ms, zona = ESTADO.zona) => desfaseMin(zona, ms) * 60000;
/** Los componentes de ese instante en la zona. */
export function componentes(zona, ms) {
  const p = partesEn(zona, ms), dow = new Real(Real.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  return { y: p.year, mo: p.month - 1, d: p.day, h: p.hour, mi: p.minute, s: p.second, ms: ((ms % 1000) + 1000) % 1000, dow };
}
/** El instante en que la zona marca esos componentes (los meses y días fuera de rango ruedan, como en Date). */
export function instanteDe(zona, y, mo, d = 1, h = 0, mi = 0, s = 0, ms = 0) {
  const comoUtc = Real.UTC(y, mo, d, h, mi, s, ms);
  let t = comoUtc - desfaseMin(zona, comoUtc) * 60000;
  const off2 = desfaseMin(zona, t); if (off2 !== desfaseMin(zona, comoUtc)) t = comoUtc - off2 * 60000; // cerca de un cambio de hora
  return t;
}
const SIN_ZONA = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3})\d*)?)?$/;
/** 'AAAA-MM-DDTHH:MM[:SS[.mmm]]' o 'AAAA-MM-DD HH:MM' (sin zona) → el instante en esa zona; null si el texto es de otra forma. */
export const instanteDeTexto = (zona, t) => { const m = SIN_ZONA.exec(String(t)); return m ? instanteDe(zona, +m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0), +((m[7] || '0').padEnd(3, '0'))) : null; };

/** La clase `Date` de la oficina. `zona` es un nombre IANA o una función que lo da (para el parche global, que puede cambiar de zona). */
export function crearDateDeZona(zona = ZONA_POR_DEFECTO) {
  const Z = () => (typeof zona === 'function' ? zona() : zona);
  const NaN_ = Real.NaN;
  class DateOficina extends Real {
    constructor(...a) {
      if (a.length === 1 && typeof a[0] === 'string') { const t = instanteDeTexto(Z(), a[0]); super(t ?? a[0]); }
      else if (a.length >= 2) { const [y, mo, d, h, mi, s, ms] = a.map(Number); super(instanteDe(Z(), y < 100 && y >= 0 ? 1900 + y : y, mo, d ?? 1, h ?? 0, mi ?? 0, s ?? 0, ms ?? 0)); }
      else super(...a);
    }
    static [Symbol.hasInstance](x) { return x instanceof Real; } // un Date de antes del cambio sigue siendo un Date
    static parse(t) { const x = instanteDeTexto(Z(), t); return x ?? Real.parse(t); }
    get _c() { return componentes(Z(), this.getTime()); }
    getFullYear() { return Number.isNaN(this.getTime()) ? NaN_ : this._c.y; }
    getMonth() { return Number.isNaN(this.getTime()) ? NaN_ : this._c.mo; }
    getDate() { return Number.isNaN(this.getTime()) ? NaN_ : this._c.d; }
    getDay() { return Number.isNaN(this.getTime()) ? NaN_ : this._c.dow; }
    getHours() { return Number.isNaN(this.getTime()) ? NaN_ : this._c.h; }
    getMinutes() { return Number.isNaN(this.getTime()) ? NaN_ : this._c.mi; }
    getSeconds() { return Number.isNaN(this.getTime()) ? NaN_ : this._c.s; }
    getMilliseconds() { return Number.isNaN(this.getTime()) ? NaN_ : this._c.ms; }
    getTimezoneOffset() { return -desfaseMin(Z(), this.getTime()); }
    _poner(cambios) { const n = { ...this._c, ...cambios }; const t = instanteDe(Z(), n.y, n.mo, n.d, n.h, n.mi, n.s, n.ms); this.setTime(t); return t; }
    setFullYear(y, mo, d) { return this._poner({ y, ...(mo !== undefined ? { mo } : {}), ...(d !== undefined ? { d } : {}) }); }
    setMonth(mo, d) { return this._poner({ mo, ...(d !== undefined ? { d } : {}) }); }
    setDate(d) { return this._poner({ d }); }
    setHours(h, mi, s, ms) { return this._poner({ h, ...(mi !== undefined ? { mi } : {}), ...(s !== undefined ? { s } : {}), ...(ms !== undefined ? { ms } : {}) }); }
    setMinutes(mi, s, ms) { return this._poner({ mi, ...(s !== undefined ? { s } : {}), ...(ms !== undefined ? { ms } : {}) }); }
    setSeconds(s, ms) { return this._poner({ s, ...(ms !== undefined ? { ms } : {}) }); }
    setMilliseconds(ms) { return this._poner({ ms }); }
    toLocaleString(l, o) { return super.toLocaleString(l, { timeZone: Z(), ...o }); }
    toLocaleDateString(l, o) { return super.toLocaleDateString(l, { timeZone: Z(), ...o }); }
    toLocaleTimeString(l, o) { return super.toLocaleTimeString(l, { timeZone: Z(), ...o }); }
  }
  return DateOficina;
}

/** Envuelve la clase en un Proxy para que `Date()` sin `new` siga dando el texto de la fecha (una clase lanzaría TypeError). */
function comoGlobal(Clase) {
  const P = new Proxy(function Date() {}, {
    apply: () => Real(),
    construct: (_, args, nt) => Reflect.construct(Clase, args, nt === P ? Clase : nt),
    get: (_, k) => (k === '__zonaOficina' ? true : Reflect.get(Clase, k)),
    has: (_, k) => k in Clase,
    getPrototypeOf: () => Reflect.getPrototypeOf(Clase),
  });
  return P;
}

/* ---- el parche global permanente (lib/rutas.js lo instala una vez) ---- */
export const zonaActual = () => ESTADO.zona;
export function instalarZona(zona = ZONA_POR_DEFECTO) {
  if (!zonaValida(zona)) zona = ZONA_POR_DEFECTO; // una zona que no existe no tumba nada
  ESTADO.zona = zona;
  if (ESTADO.instalada || globalThis.Date.__zonaOficina) return zona;
  globalThis.Date = comoGlobal(crearDateDeZona(() => ESTADO.zona));
  ESTADO.instalada = true;
  return zona;
}
/** Para las pruebas: vuelve a dejar el Date de siempre. */
export function quitarZona() { if (ESTADO.instalada) { globalThis.Date = Real; ESTADO.instalada = false; } }

/* ---- el parche acotado ---- */
let profundidad = 0, previo = null;
/** Ejecuta `fn` con el reloj de la oficina como `Date` global. Se puede anidar y repetir en paralelo: lo de antes vuelve cuando sale el último. */
export async function conZona(zona, fn) {
  const valida = zonaValida(zona) ? zona : ZONA_POR_DEFECTO;
  if (profundidad === 0) { previo = globalThis.Date; if (!previo.__zonaOficina) globalThis.Date = comoGlobal(crearDateDeZona(valida)); }
  profundidad++;
  try { return await fn(); }
  finally { profundidad--; if (profundidad === 0) { globalThis.Date = previo; previo = null; } }
}

/** { nombre, utc: 'UTC−05:00' } ahora mismo: lo que Contenido enseña junto a las horas. */
export function describirZona(zona = ZONA_POR_DEFECTO, ms = Real.now()) {
  const z = zonaValida(zona) ? zona : ZONA_POR_DEFECTO, m = desfaseMin(z, ms);
  return { nombre: z, utc: `UTC${m < 0 ? '−' : '+'}${String(Math.floor(Math.abs(m) / 60)).padStart(2, '0')}:${String(Math.abs(m) % 60).padStart(2, '0')}` };
}
