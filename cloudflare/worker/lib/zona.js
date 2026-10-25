// La hora de la oficina en el Worker.
//
// Las reglas de Contenido (y las de rutinas, tareas…) se escribieron para una computadora: «el viernes a las 9:00» es el reloj de ESA máquina, y el código
// lo lee con `new Date('2026-10-30T09:00:00')` (sin zona = hora local), `getHours()`, `getDay()`, `setDate()`… Un Worker corre siempre en UTC: sin más, las 9:00 de
// Panamá serían las 4:00 de la madrugada. Como esas reglas son puras y se comparten con la oficina local, no se copian ni se tocan: aquí está el reloj de la
// oficina como una subclase de `Date` que se pone en lugar del `Date` global MIENTRAS el módulo trabaja (`conZona`), y se quita al terminar.
//
//   · `new Date('AAAA-MM-DDTHH:MM[:SS]')` (sin zona) y `new Date(y, m, d, h, mi…)` → esa hora EN LA ZONA de la oficina.
//   · getFullYear/getMonth/getDate/getDay/getHours/getMinutes/getSeconds/getMilliseconds y sus set* → en la zona de la oficina.
//   · lo demás (`Date.now()`, `getTime()`, `toISOString()`, los getUTC*, `new Date('AAAA-MM-DD')`, `new Date(ms)`) no cambia: instantes y UTC siguen siendo UTC.
// La zona sale de `contenido.zona` (un nombre IANA, por defecto America/Panama) y se calcula con Intl, así que sirve también con cambio de hora de verano.
//
// Varias peticiones a la vez comparten el mismo `Date` global: el cambio se cuenta (entra la primera, sale la última) para que nadie quede con el reloj
// equivocado. Un código que no pregunta por la hora local no nota la diferencia.
const DateOriginal = globalThis.Date;
export const ZONA_POR_DEFECTO = 'America/Panama';

const formateadores = new Map();
function partesEn(zona, ms) {
  let f = formateadores.get(zona);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: zona, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    formateadores.set(zona, f);
  }
  const p = {}; for (const x of f.formatToParts(new DateOriginal(ms))) if (x.type !== 'literal') p[x.type] = Number(x.value);
  return p;
}
/** Minutos que la zona va por delante de UTC en ese instante (Panamá: −300). */
export function desfaseMin(zona, ms) {
  const p = partesEn(zona, Math.floor(ms / 1000) * 1000);
  const comoUtc = DateOriginal.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((comoUtc - Math.floor(ms / 1000) * 1000) / 60000);
}
/** Los componentes de ese instante en la zona. */
export function componentes(zona, ms) {
  const p = partesEn(zona, ms), dow = new DateOriginal(DateOriginal.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  return { y: p.year, mo: p.month - 1, d: p.day, h: p.hour, mi: p.minute, s: p.second, ms: ((ms % 1000) + 1000) % 1000, dow };
}
/** El instante en que la zona marca esos componentes (los meses y días fuera de rango ruedan, como en Date). */
export function instanteDe(zona, y, mo, d = 1, h = 0, mi = 0, s = 0, ms = 0) {
  const comoUtc = DateOriginal.UTC(y, mo, d, h, mi, s, ms);
  let t = comoUtc - desfaseMin(zona, comoUtc) * 60000;
  const off2 = desfaseMin(zona, t); if (off2 !== desfaseMin(zona, comoUtc)) t = comoUtc - off2 * 60000; // cerca de un cambio de hora
  return t;
}

const SIN_ZONA = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3})\d*)?)?$/;
export const instanteDeTexto = (zona, t) => { const m = SIN_ZONA.exec(String(t)); return m ? instanteDe(zona, +m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0), +((m[7] || '0').padEnd(3, '0'))) : null; };

/** Crea la clase `Date` de la oficina para esa zona. */
export function crearDateDeZona(zona = ZONA_POR_DEFECTO) {
  const NaN_ = DateOriginal.NaN;
  class DateOficina extends DateOriginal {
    constructor(...a) {
      if (a.length === 1 && typeof a[0] === 'string') { const t = instanteDeTexto(zona, a[0]); super(t ?? a[0]); }
      else if (a.length >= 2) { const [y, mo, d, h, mi, s, ms] = a.map(Number); super(instanteDe(zona, y < 100 && y >= 0 ? 1900 + y : y, mo, d ?? 1, h ?? 0, mi ?? 0, s ?? 0, ms ?? 0)); }
      else super(...a);
    }
    static [Symbol.hasInstance](x) { return x instanceof DateOriginal; } // un Date de antes del cambio sigue siendo un Date
    static parse(t) { const x = instanteDeTexto(zona, t); return x ?? DateOriginal.parse(t); }
    get _c() { return componentes(zona, this.getTime()); }
    getFullYear() { return Number.isNaN(this.getTime()) ? NaN_ : this._c.y; }
    getMonth() { return Number.isNaN(this.getTime()) ? NaN_ : this._c.mo; }
    getDate() { return Number.isNaN(this.getTime()) ? NaN_ : this._c.d; }
    getDay() { return Number.isNaN(this.getTime()) ? NaN_ : this._c.dow; }
    getHours() { return Number.isNaN(this.getTime()) ? NaN_ : this._c.h; }
    getMinutes() { return Number.isNaN(this.getTime()) ? NaN_ : this._c.mi; }
    getSeconds() { return Number.isNaN(this.getTime()) ? NaN_ : this._c.s; }
    getMilliseconds() { return Number.isNaN(this.getTime()) ? NaN_ : this._c.ms; }
    getTimezoneOffset() { return -desfaseMin(zona, this.getTime()); }
    _poner(cambios) { const c = this._c, n = { ...c, ...cambios }; const t = instanteDe(zona, n.y, n.mo, n.d, n.h, n.mi, n.s, n.ms); this.setTime(t); return t; }
    setFullYear(y, mo, d) { return this._poner({ y, ...(mo !== undefined ? { mo } : {}), ...(d !== undefined ? { d } : {}) }); }
    setMonth(mo, d) { return this._poner({ mo, ...(d !== undefined ? { d } : {}) }); }
    setDate(d) { return this._poner({ d }); }
    setHours(h, mi, s, ms) { return this._poner({ h, ...(mi !== undefined ? { mi } : {}), ...(s !== undefined ? { s } : {}), ...(ms !== undefined ? { ms } : {}) }); }
    setMinutes(mi, s, ms) { return this._poner({ mi, ...(s !== undefined ? { s } : {}), ...(ms !== undefined ? { ms } : {}) }); }
    setSeconds(s, ms) { return this._poner({ s, ...(ms !== undefined ? { ms } : {}) }); }
    setMilliseconds(ms) { return this._poner({ ms }); }
    toLocaleString(l, o) { return super.toLocaleString(l, { timeZone: zona, ...o }); }
    toLocaleDateString(l, o) { return super.toLocaleDateString(l, { timeZone: zona, ...o }); }
    toLocaleTimeString(l, o) { return super.toLocaleTimeString(l, { timeZone: zona, ...o }); }
  }
  return DateOficina;
}

let profundidad = 0;
/** Ejecuta `fn` con el reloj de la oficina como `Date` global. Se puede anidar y repetir en paralelo: el `Date` de verdad vuelve cuando sale el último. */
export async function conZona(zona, fn) {
  const valida = zonaValida(zona) ? zona : ZONA_POR_DEFECTO;
  if (profundidad === 0) globalThis.Date = crearDateDeZona(valida);
  profundidad++;
  try { return await fn(); }
  finally { profundidad--; if (profundidad === 0) globalThis.Date = DateOriginal; }
}

export function zonaValida(z) { if (typeof z !== 'string' || !z || z.length > 60) return false; try { new Intl.DateTimeFormat('en-US', { timeZone: z }); return true; } catch { return false; } }

/** { nombre, utc: 'UTC−05:00' } ahora mismo: lo que Contenido enseña junto a las horas. */
export function describirZona(zona = ZONA_POR_DEFECTO, ms = DateOriginal.now()) {
  const z = zonaValida(zona) ? zona : ZONA_POR_DEFECTO, m = desfaseMin(z, ms);
  return { nombre: z, utc: `UTC${m < 0 ? '−' : '+'}${String(Math.floor(Math.abs(m) / 60)).padStart(2, '0')}:${String(Math.abs(m) % 60).padStart(2, '0')}` };
}
