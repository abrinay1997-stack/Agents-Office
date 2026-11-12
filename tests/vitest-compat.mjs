// Lo justo de vitest (describe, it, expect) sobre node:test, para correr TAL CUAL los tests que se portan del calendario
// de Juancito Ads (scripts/portar-metodo.mjs). No es vitest: solo las comparaciones que esos tests usan.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';

const ASIM = Symbol('asimetrico');
const asim = (nombre, prueba) => ({ [ASIM]: true, nombre, prueba });
const esAsim = (x) => Boolean(x && x[ASIM]);

/** Igualdad como la de vitest `toEqual`: recursiva, sin mirar prototipos, `undefined` = ausente, con comparadores asimétricos. */
function igual(a, b) {
  if (esAsim(b)) return b.prueba(a);
  if (esAsim(a)) return a.prueba(b);
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => igual(x, b[i]));
  if (a instanceof Date || b instanceof Date || a instanceof Map || a instanceof Set || a instanceof RegExp) return isDeepStrictEqual(a, b);
  const ka = Object.keys(a).filter((k) => a[k] !== undefined), kb = Object.keys(b).filter((k) => b[k] !== undefined);
  return ka.length === kb.length && ka.every((k) => Object.hasOwn(b, k) && igual(a[k], b[k]));
}

/** `toMatchObject`: lo esperado es un subconjunto (en objetos); las listas, del mismo largo y elemento a elemento. */
function contiene(real, esperado) {
  if (esAsim(esperado)) return esperado.prueba(real);
  if (typeof esperado !== 'object' || esperado === null) return igual(real, esperado);
  if (typeof real !== 'object' || real === null) return false;
  if (Array.isArray(esperado)) return Array.isArray(real) && real.length === esperado.length && esperado.every((x, i) => contiene(real[i], x));
  return Object.keys(esperado).every((k) => (esperado[k] === undefined ? real[k] === undefined : k in real && contiene(real[k], esperado[k])));
}

const ver = (x) => { try { return JSON.stringify(x, (_, v) => (esAsim(v) ? `<${v.nombre}>` : typeof v === 'number' && !Number.isFinite(v) ? String(v) : v))?.slice(0, 600); } catch { return String(x); } };

function comparadores(real, negado) {
  const que = (pasa, mensaje) => { if (Boolean(pasa) === negado) assert.fail(`${negado ? 'NO se esperaba: ' : ''}${mensaje}`); };
  return {
    toBe: (e) => que(Object.is(real, e), `${ver(real)} sea ${ver(e)}`),
    toEqual: (e) => que(igual(real, e), `${ver(real)} igual a ${ver(e)}`),
    toStrictEqual: (e) => que(igual(real, e), `${ver(real)} igual a ${ver(e)}`),
    toMatchObject: (e) => que(contiene(real, e), `${ver(real)} contenga ${ver(e)}`),
    toBeCloseTo: (e, digitos = 2) => que(Math.abs(e - real) < 10 ** -digitos / 2, `${real} cerca de ${e} (${digitos} decimales)`),
    toMatch: (e) => que(e instanceof RegExp ? e.test(String(real)) : String(real).includes(e), `${ver(real)} case con ${e}`),
    toContain: (e) => que(typeof real === 'string' ? real.includes(e) : [...(real || [])].some((x) => Object.is(x, e)), `${ver(real)} contenga ${ver(e)}`),
    toContainEqual: (e) => que([...(real || [])].some((x) => igual(x, e)), `${ver(real)} contenga ${ver(e)}`),
    toHaveLength: (n) => que(real?.length === n, `largo ${real?.length} sea ${n}`),
    toBeNull: () => que(real === null, `${ver(real)} sea null`),
    toBeUndefined: () => que(real === undefined, `${ver(real)} sea undefined`),
    toBeDefined: () => que(real !== undefined, 'esté definido'),
    toBeTruthy: () => que(Boolean(real), `${ver(real)} sea verdadero`),
    toBeFalsy: () => que(!real, `${ver(real)} sea falso`),
    toBeNaN: () => que(Number.isNaN(real), `${ver(real)} sea NaN`),
    toBeGreaterThan: (n) => que(real > n, `${real} > ${n}`),
    toBeGreaterThanOrEqual: (n) => que(real >= n, `${real} >= ${n}`),
    toBeLessThan: (n) => que(real < n, `${real} < ${n}`),
    toBeLessThanOrEqual: (n) => que(real <= n, `${real} <= ${n}`),
    toThrow: (e) => { let lanzo = null; try { real(); } catch (x) { lanzo = x; } que(lanzo && (!e || (e instanceof RegExp ? e.test(lanzo.message) : String(lanzo.message).includes(e))), 'lance un error'); },
  };
}

export function expect(real) {
  return { ...comparadores(real, false), not: comparadores(real, true) };
}
expect.arrayContaining = (lista) => asim('arrayContaining', (r) => Array.isArray(r) && lista.every((x) => r.some((y) => igual(y, x))));
expect.objectContaining = (o) => asim('objectContaining', (r) => contiene(r, o));
expect.stringContaining = (s) => asim('stringContaining', (r) => typeof r === 'string' && r.includes(s));
expect.stringMatching = (re) => asim('stringMatching', (r) => typeof r === 'string' && (re instanceof RegExp ? re.test(r) : r.includes(re)));
expect.closeTo = (n, digitos = 2) => asim('closeTo', (r) => typeof r === 'number' && Math.abs(n - r) < 10 ** -digitos / 2);
expect.any = (C) => asim('any', (r) => (C === Number ? typeof r === 'number' : C === String ? typeof r === 'string' : C === Boolean ? typeof r === 'boolean' : r instanceof C));
expect.anything = () => asim('anything', (r) => r !== null && r !== undefined);

export { describe, it };
export const test = it;
