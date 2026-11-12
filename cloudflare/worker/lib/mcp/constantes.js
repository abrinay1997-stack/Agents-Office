// Constantes puras del conector MCP (sin imports: las usan tokens.js —que lib/equipo.js y lib/sesion.js importan— y config.js).

/** De menos a más poder. `lectura` mira; `oficina` escribe sin gastar; `gasto` además puede PREPARAR un gasto (el segundo paso es siempre de una persona: lib/mcp/registro.js). */
export const ALCANCES = Object.freeze(['lectura', 'oficina', 'gasto']);
export const ALCANCE_POR_DEFECTO = 'lectura';
export const nivelDe = (a) => ALCANCES.indexOf(a);

export const VIDA_ACCESO_MS = 60 * 60 * 1000;              // el testigo de acceso vale 1 hora
export const VIDA_RENOVACION_MS = 30 * 24 * 3600 * 1000;   // el de renovación, 30 días desde la última vez que se rotó
export const VIDA_MAX_FAMILIA_MS = 180 * 24 * 3600 * 1000; // y una conexión no vive más de 180 días sin que una persona la vuelva a aprobar
export const VIDA_CODIGO_MS = 60 * 1000;                   // el código de autorización vale un minuto
export const TOPE_SALIDA = 20_000;                          // caracteres que devuelve una herramienta como máximo
export const TOPE_CUERPO_MCP = 64_000;                      // bytes de una petición JSON-RPC
export const TOPE_CUERPO_OAUTH = 8_000;                     // bytes del registro, del token y del formulario de permiso
export const MAX_REGISTROS_HORA = 60;                       // clientes nuevos por hora, en total
export const MAX_REGISTROS_MINUTO_IP = 10;
export const MAX_REGISTROS_HORA_IP = 10;                    // y ninguna IP puede gastar más de esto del cupo global: un solo origen no lo agota
export const MAX_ESCRITURAS_MINUTO = 30;                    // escrituras por conexión
export const MAX_ESCRITURAS_DIA = 500;

