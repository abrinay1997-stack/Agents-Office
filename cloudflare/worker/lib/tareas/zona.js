// La hora de la oficina en un Worker. La oficina local piensa en la hora de la computadora del dueño («lunes a las 9», «hoy», «el 15 de cada mes»);
// un Worker siempre corre en UTC. Todo el código de tareas/ y de rutinas (src/when.js…) usa los métodos «locales» de Date (getHours, setDate,
// new Date(y, m, d, h, mi)…), que sirven tal cual si Date piensa en la zona del dueño. En vez de reescribir ese código —que es el mismo que usa la
// oficina local y está probado—, este módulo instala UNA vez una subclase de Date cuya hora «local» es la de la zona (por defecto America/Panama).
// Solo cambia lo «local»: getTime(), toISOString(), Date.now() y las fechas con zona explícita (…Z, …+05:00) son las de siempre.
// OJO: «hora local» aquí también afecta a new Date('AAAA-MM-DDTHH:MM') (sin zona), que JS lee como local.

const Real = globalThis.Date;
const ESTADO = { zona: 'America/Panama', instalada: false };
const formateadores = new Map();
const cacheOffset = new Map();

function formateador(zona) {
  let f = formateadores.get(zona);
  if (!f) { f = new Intl.DateTimeFormat('en-US', { timeZone: zona, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }); formateadores.set(zona, f); }
  return f;
}
/** Minutos... en ms: cuánto se adelanta la hora de la zona respecto a UTC en el instante `ms` (Panamá: −5 h = −18.000.000). */
export function desfase(ms, zona = ESTADO.zona) {
  const k = zona + '|' + Math.floor(ms / 900000);
  let v = cacheOffset.get(k);
  if (v === undefined) {
    const p = Object.fromEntries(formateador(zona).formatToParts(new Real(ms)).map(x => [x.type, +x.value]));
    v = Real.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
    if (cacheOffset.size > 2000) cacheOffset.clear();
    cacheOffset.set(k, v);
  }
  return v;
}
/** Una «hora de reloj» (como si fuera UTC) → el instante real en la zona. */
const deReloj = (relojMs, zona = ESTADO.zona) => { const o1 = desfase(relojMs - desfase(relojMs, zona), zona); return relojMs - o1; };

const SIN_ZONA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

export function instalarZona(zona = 'America/Panama') {
  try { formateador(zona).format(0); } catch { zona = 'America/Panama'; } // una zona que no existe no tumba nada
  ESTADO.zona = zona;
  if (ESTADO.instalada || globalThis.Date.__zonaOficina) return zona;
  class ZDate extends Real {
    constructor(...a) {
      if (a.length === 0) super(Real.now());
      else if (a.length === 1) {
        const v = a[0];
        if (typeof v === 'string' && SIN_ZONA.test(v)) super(deReloj(Real.parse(v + 'Z')));
        else super(v);
      } else {
        const [y, m, d = 1, h = 0, mi = 0, s = 0, ms = 0] = a;
        super(deReloj(Real.UTC(y, m, d, h, mi, s, ms)));
      }
    }
    #reloj() { return new Real(this.getTime() + desfase(this.getTime())); }
    getFullYear() { return this.#reloj().getUTCFullYear(); }
    getMonth() { return this.#reloj().getUTCMonth(); }
    getDate() { return this.#reloj().getUTCDate(); }
    getDay() { return this.#reloj().getUTCDay(); }
    getHours() { return this.#reloj().getUTCHours(); }
    getMinutes() { return this.#reloj().getUTCMinutes(); }
    getSeconds() { return this.#reloj().getUTCSeconds(); }
    getMilliseconds() { return this.#reloj().getUTCMilliseconds(); }
    getTimezoneOffset() { return -desfase(this.getTime()) / 60000; }
    #poner(metodo, ...args) { const r = this.#reloj(); r[metodo](...args); const t = deReloj(r.getTime()); this.setTime(t); return t; }
    setFullYear(...a) { return this.#poner('setUTCFullYear', ...a); }
    setMonth(...a) { return this.#poner('setUTCMonth', ...a); }
    setDate(...a) { return this.#poner('setUTCDate', ...a); }
    setHours(...a) { return this.#poner('setUTCHours', ...a); }
    setMinutes(...a) { return this.#poner('setUTCMinutes', ...a); }
    setSeconds(...a) { return this.#poner('setUTCSeconds', ...a); }
    setMilliseconds(...a) { return this.#poner('setUTCMilliseconds', ...a); }
    toLocaleString(l, o) { return super.toLocaleString(l, { timeZone: ESTADO.zona, ...o }); }
    toLocaleDateString(l, o) { return super.toLocaleDateString(l, { timeZone: ESTADO.zona, ...o }); }
    toLocaleTimeString(l, o) { return super.toLocaleTimeString(l, { timeZone: ESTADO.zona, ...o }); }
  }
  Object.defineProperty(ZDate, '__zonaOficina', { value: true });
  globalThis.Date = ZDate;
  ESTADO.instalada = true;
  return zona;
}

export const zonaActual = () => ESTADO.zona;
/** Para las pruebas: vuelve a dejar el Date de siempre. */
export function quitarZona() { if (ESTADO.instalada) { globalThis.Date = Real; ESTADO.instalada = false; } }
export { Real as DateReal };
