// La puerta de `office(ruta)` para las herramientas del conector (revisión #2, D4): `office` corre EN PROCESO como administrador y sin lista blanca, así que aquí se le pone una:
//  · la ruta empieza por /api/ y no trae `..`, `%2e`, `%2f`, `%5c`, `//` ni `\` (ni controles): nada de escaparse a otra ruta con un truco de la dirección;
//  · el método está permitido PARA ESA HERRAMIENTA: una lectura solo GET; una escritura, solo los POST/PATCH exactos que usa.
// Puro: sin imports.
const MALA = /(\.\.|%2e|%2f|%5c|\/\/|\\|[\u0000-\u001f\u007f])/i;

/** → { ok: true } | { ok: false, motivo } */
export function rutaOk(ruta) {
  if (typeof ruta !== 'string' || !ruta.startsWith('/api/')) return { ok: false, motivo: 'solo se llega a rutas /api/ de la oficina' };
  const camino = ruta.split('?')[0];
  if (MALA.test(camino)) return { ok: false, motivo: 'la ruta trae caracteres no permitidos' };
  return { ok: true };
}

/** `permitidas`: 'GET' (cualquier ruta por GET) o 'POST /api/tasks' (método + ruta exacta, sin la consulta). → un `office` que rechaza lo demás. */
export function restringir(office, permitidas) {
  const sueltos = new Set(permitidas.filter((p) => !p.includes(' '))), exactos = new Set(permitidas.filter((p) => p.includes(' ')));
  return async function officeRestringido(ruta, cuerpo, metodo) {
    const m = String(metodo || (cuerpo ? 'POST' : 'GET')).toUpperCase();
    const r = rutaOk(ruta); if (!r.ok) throw new Error(`ruta no permitida: ${r.motivo}`);
    if (!(sueltos.has(m) || exactos.has(`${m} ${ruta.split('?')[0]}`))) throw new Error(`esta herramienta no puede hacer ${m} ${ruta.split('?')[0].slice(0, 80)}`);
    return office(ruta, cuerpo, metodo);
  };
}
