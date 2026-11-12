// La puerta de `office(ruta, cuerpo?, método?)` para las herramientas de TAREAS y RUTINAS del conector (P5, carril 2): como capa1/restringir.js, pero con plantillas con `:id`,
// porque aquí las rutas llevan el id de la tarea o de la rutina. Una herramienta solo puede pedirle a la oficina lo que declara: «GET» (cualquier GET) o «POST /api/tareas/:id/delegar» (método + ruta exacta).
// Puro: sin imports salvo `rutaOk` (la misma regla de caracteres de capa1).
import { rutaOk } from '../capa1/restringir.js';

export const ID = /^[A-Za-z0-9_-]{3,40}$/;
const compilar = (p) => new RegExp('^' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:id/g, '[A-Za-z0-9_-]{3,40}') + '$');

/** → un `office` que rechaza lo que no está en `permitidas`. */
export function restringirRutas(office, permitidas) {
  const sueltos = new Set(permitidas.filter((p) => !p.includes(' '))), pl = permitidas.filter((p) => p.includes(' ')).map((p) => { const [m, r] = p.split(' '); return { m, re: compilar(r) }; });
  return async function officeRestringido(ruta, cuerpo, metodo) {
    const m = String(metodo || (cuerpo ? 'POST' : 'GET')).toUpperCase();
    const r = rutaOk(ruta); if (!r.ok) throw new Error(`ruta no permitida: ${r.motivo}`);
    const camino = ruta.split('?')[0];
    if (!(sueltos.has(m) || pl.some((x) => x.m === m && x.re.test(camino)))) throw new Error(`esta herramienta no puede hacer ${m} ${camino.slice(0, 80)}`);
    return office(ruta, cuerpo, metodo);
  };
}
