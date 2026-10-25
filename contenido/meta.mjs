// ============================================================
// Agents Office V4.7 (F2) — el cliente de la Graph API de Meta (Facebook e Instagram). SOLO LECTURA.
//
// PORTADO de Juancito Ads — juanarrietabusiness-pixel/CALENDARIOS-MARKETING-APP, worker/lib/meta.js (30 sep 2026): el cliente
// de `graph()`, `ErrorMeta` y las frases de `mensajeMeta`, que ya vivieron un año de errores reales de Meta. Lo que NO viene:
// el OAuth con inicio de sesión, la cifra de tokens en D1 y el cambio de token de corta por larga duración. Esta oficina corre en
// una computadora, no en un servidor con una web pública a la que Meta pueda volver: entra con un TOKEN DE USUARIO DEL SISTEMA
// (Business Manager → Usuarios del sistema), que no caduca y se pone una vez.
//
// EL TOKEN
//   · `META_ACCESS_TOKEN` — variable de entorno de Windows, como las llaves del Estudio. NUNCA se escribe en un archivo, ni en
//     `data/`, ni en un aviso, ni en un error: `sinToken()` lo quita de cualquier texto que salga de aquí.
//   · `META_APP_SECRET` (opcional) — si la app de Meta exige «prueba del secreto», cada llamada lleva `appsecret_proof`.
//   · `META_GRAPH_VERSION` (opcional) — para no depender de que esta versión no se retire.
//   · `META_GRAPH_HOST` (solo para pruebas) — otra dirección en lugar de graph.facebook.com; `npm run check` la apunta a un Graph de mentira.
// Los tokens de cada PÁGINA (los que piden las métricas de Facebook) se piden con el de usuario y viven solo en memoria.
//
// NADA DE ESTO SE HA PROBADO CONTRA META desde la máquina donde se escribió (no había token ni salida a graph.facebook.com):
// los tests usan un `fetch` de mentira que habla como Graph. Lo primero con un token de verdad es «Comprobar conexión».
//
// 8 oct 2026 (F3, publicar directo): `enviar()` (POST, también con un archivo), `borrar()` y `subirReanudable()` (los videos de Instagram
// van a rupload.facebook.com sin necesitar una dirección pública). En ellas el token viaja en la cabecera `Authorization`, nunca en la
// dirección. Los nombres de rutas y parámetros se comprobaron contra el SDK oficial de Meta (facebook_business 26.0.2, generado de la
// especificación de la Graph API) y contra ig-publish (deegitech, MIT, notas de octubre de 2026). Ver contenido/meta-publicar.mjs.
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { renombrar } from '../fs-seguro.mjs'; // 9 oct 2026: renombrar con reintento (Windows: EPERM/EBUSY al pisar un archivo abierto)
import { crearMetaNucleo } from './meta-nucleo.mjs';
// Todo lo puro (versiones, permisos, el freno, ErrorMeta, mensajeMeta…) vive en meta-nucleo.mjs y se re-exporta tal cual.
export * from './meta-nucleo.mjs';

const escribirJSON = (f, datos) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(datos, null, 1)); renombrar(f + '.tmp', f); };
const leerJSON = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) ?? def; } catch { return def; } };

/**
 * El cliente. Todo lo que depende del mundo (variables de entorno, red, reloj, dónde guardar) se inyecta, para que los tests
 * le den un Graph de mentira y una carpeta temporal.
 */
export function crearMeta({ env = process.env, fetchFn = (...a) => fetch(...a), dir, ahora = () => Date.now() } = {}) {
  const archivo = path.join(dir || '.', 'cuentas.json');
  return crearMetaNucleo({ env, fetchFn, ahora, almacen: { leer: () => leerJSON(archivo, { cuentas: [], token: null, sincronizadaAt: null, error: null }), escribir: d => escribirJSON(archivo, d) } });
}
