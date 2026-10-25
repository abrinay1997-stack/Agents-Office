// Los conectores activos con su acceso resuelto: lo único que ve un cliente MCP. El token guardado desde la página se descifra AQUÍ, en memoria, y se cuelga de la fila como una
// propiedad NO enumerable (`_token`): si alguien copia la fila con `{...fila}`, la guarda con JSON.stringify o la imprime, el token no va con ella.
import { descifrar } from './cifrado.js';

const SQL = `select c.*, x.auth_tipo, x.cabecera, x.token_cifrado, x.plantilla, x.etiqueta from conectores c left join conectores_extra x on x.nombre = c.nombre`;

export async function conAcceso(fila, env) {
  const f = { ...fila };
  if (f.token_cifrado && !f.secreto) {
    const t = await descifrar(env, f.token_cifrado, f.nombre);
    Object.defineProperty(f, '_token', { value: t, enumerable: false });
  }
  return f;
}
/** → las filas de la tabla `conectores` activas (o todas) con `auth_tipo`, `cabecera`, `plantilla` y `_token` (descifrado, solo en memoria). */
export async function conectoresActivos(db, env, { todos = false } = {}) {
  const { results } = await db.prepare(`${SQL}${todos ? '' : ' where c.activo = 1'} order by c.nombre`).all();
  return Promise.all(results.map((r) => conAcceso(r, env)));
}
/** Las mismas filas SIN descifrar (para listar): ningún token pasa por aquí. */
export async function conectoresListados(db) {
  const { results } = await db.prepare(`${SQL} order by c.nombre`).all();
  return results;
}
