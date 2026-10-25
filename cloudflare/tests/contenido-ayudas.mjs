// Ayudas para los tests de Contenido en la nube (no es un test: el glob de tests es *.test.mjs).
//  · un R2 de mentira (head/get/put con una Map), con la galería del Estudio: `2026-10/foto.jpg` y su registro `.json`;
//  · el Meta de mentira de la raíz (tests/meta-stand.mjs) como `fetch` inyectado, nunca la red;
//  · un reloj que se mueve, para probar lo que pasa «a su hora».
import { manejar } from '../worker/lib/rutas.js';
import { crearD1, sembrar, envDePrueba, pedir } from './d1-memoria.mjs';
import { crearMetaStand } from '../../tests/meta-stand.mjs';
import { PERMISOS_LECTURA, PERMISOS_PUBLICAR } from '../../contenido/meta-nucleo.mjs';

export function crearR2() {
  const m = new Map();
  const objeto = (k, v) => ({ key: k, size: v.cuerpo.length, etag: v.etag, uploaded: new Date(), body: new Blob([v.cuerpo]).stream(), arrayBuffer: async () => v.cuerpo.buffer.slice(v.cuerpo.byteOffset, v.cuerpo.byteOffset + v.cuerpo.byteLength), text: async () => new TextDecoder().decode(v.cuerpo), httpMetadata: v.meta });
  return {
    _m: m,
    async head(k) { const v = m.get(k); return v ? objeto(k, v) : null; },
    async get(k) { const v = m.get(k); return v ? objeto(k, v) : null; },
    async put(k, valor, opciones = {}) { const cuerpo = typeof valor === 'string' ? new TextEncoder().encode(valor) : new Uint8Array(valor); m.set(k, { cuerpo, etag: 'e' + m.size + ':' + cuerpo.length, meta: opciones.httpMetadata }); },
    async delete(k) { m.delete(k); },
  };
}
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...Array(40).fill(7)]);
/** Sube al R2 una imagen del Estudio con su registro (.json) como lo guarda la galería local. */
export async function subirImagen(r2, id, { ancho = 1080, alto = 1350 } = {}) {
  await r2.put(id, JPEG, { httpMetadata: { contentType: 'image/jpeg' } });
  await r2.put(id.replace(/\.[^.]+$/, '.json'), JSON.stringify({ kind: 'image', w: ancho, h: alto, settings: { aspectRatio: '4:5' } }));
}

export const TOKEN = 'EAAG-TOKEN-DE-USUARIO-NUBE-0123456789'; // secrets-ok: un token de mentira para el Graph de mentira
export const TOKEN_PAGINA = 'EAAG-TOKEN-DE-PAGINA-NUBE-9876543210'; // secrets-ok: idem

/** Un entorno de la nube con D1, R2 y el Graph de mentira. `reloj` se mueve con `ir(ms)`. */
export async function montar({ rol = 'admin', permisos, meta = true, graph = {}, env: extra = {} } = {}) {
  const d1 = crearD1(), usuario = await sembrar(d1, { rol }), r2 = crearR2();
  let reloj = Date.now();
  const stand = crearMetaStand({ token: TOKEN, tokenPagina: TOKEN_PAGINA, rupload: 'https://rupload.test', permisos: permisos || [...PERMISOS_LECTURA, ...PERMISOS_PUBLICAR], ...graph });
  stand.st.reloj = reloj;
  const env = envDePrueba(d1, { MEDIA: r2, AO_FETCH: stand.fetchFn, AO_AHORA: () => reloj, ...(meta ? { META_ACCESS_TOKEN: TOKEN, META_GRAPH_HOST: 'https://graph.test', META_RUPLOAD_HOST: 'https://rupload.test' } : {}), ...extra });
  const r = await pedir(manejar, env, '/api/acceso', { metodo: 'POST', cuerpo: { email: usuario.email, contrasena: usuario.clave } });
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const api = async (ruta, { metodo = 'GET', cuerpo, cookie: ck = cookie } = {}) => { const res = await pedir(manejar, env, ruta, { metodo, cuerpo, cookie: ck }); const t = await res.text(); let datos; try { datos = JSON.parse(t); } catch { datos = t; } return { status: res.status, datos, headers: res.headers }; };
  return { d1, env, r2, stand, api, usuario, cookie, get reloj() { return reloj; }, ir: ms => { reloj = ms; stand.st.reloj = ms; }, avanzar: ms => { reloj += ms; stand.st.reloj = reloj; } };
}
/** AAAA-MM-DD y HH:MM, en hora de Panamá (la zona de la oficina por defecto), de un instante. */
export function enPanama(ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)).filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}
