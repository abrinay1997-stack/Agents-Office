// Las skills de los agentes, editables desde la nube (la oficina local las edita como carpetas). Reglas y topes: skills-core.mjs (compartido con la local); lógica: lib/skills-api.js.
//   GET    /api/skills                      → { skills: [{ name, description, agents, departments, everyone, files, size, problems }], total, tope }
//   GET    /api/skills/<nombre>             → { skill: { …, text, files, md } }
//   PUT    /api/skills/<nombre>             → crear o reemplazar ({ md } o { description, agents, departments, text }, files?, todos?, base?)  — solo administrador
//   DELETE /api/skills/<nombre>             → a la papelera (30 días)                                                                         — solo administrador
//   GET    /api/skills/papelera · POST /api/skills/papelera/restaurar { id }                                                                   — leer: cualquiera; restaurar: solo administrador
//   GET    /api/skills/<nombre>/versiones[?at=] · POST /api/skills/<nombre>/volver { at }                                                      — leer: cualquiera; volver: solo administrador
// Leer es de cualquier cuenta con sesión; escribir, solo de un administrador (un editor y una cuenta de lectura reciben 403 antes de mirar el cuerpo).
import { json, error, prohibido } from '../lib/respuesta.js';
import * as S from '../lib/skills-api.js';

export const nombre = 'skills';
export const grupos = ['skills'];

const responder = (r) => r.error ? json({ error: r.error, ...(r.errores ? { errores: r.errores } : {}) }, r.status || 400) : json(r);

export async function manejar(ctx) {
  const { req, db, ruta, usuario, url } = ctx;
  if (ruta !== '/api/skills' && !ruta.startsWith('/api/skills/')) return null;
  const escribe = req.method !== 'GET';
  if (escribe && (usuario.rol !== 'admin' || usuario.agente)) return prohibido('Solo un administrador cambia las skills de los agentes.');
  if (ruta === '/api/skills') return req.method === 'GET' ? json(await S.listar(db)) : error('GET', 405);
  const partes = ruta.slice('/api/skills/'.length).split('/');
  if (partes[0] === 'papelera' && (partes.length > 1 || req.method === 'GET')) { // (PUT/DELETE de «papelera» a secas cae abajo: el nombre está reservado y la validación lo explica)
    if (partes.length === 1) return json(await S.verPapelera(db));
    if (partes.length === 2 && partes[1] === 'restaurar' && req.method === 'POST') return responder(await S.restaurar(db, ((await ctx.cuerpo(req)) || {}).id, usuario));
    return error('No existe esa ruta.', 404);
  }
  const nom = partes[0];
  if (partes.length === 1) {
    if (req.method === 'GET') return responder(await S.leer(db, nom));
    if (req.method === 'PUT') return responder(await S.guardar(db, nom, await ctx.cuerpo(req), usuario));
    if (req.method === 'DELETE') return responder(await S.borrar(db, nom, usuario));
    return error('GET, PUT o DELETE', 405);
  }
  if (partes.length === 2 && partes[1] === 'versiones' && req.method === 'GET') { const at = url.searchParams.get('at'); return responder(await S.versiones(db, nom, at === null ? undefined : at)); }
  if (partes.length === 2 && partes[1] === 'volver' && req.method === 'POST') return responder(await S.volver(db, nom, ((await ctx.cuerpo(req)) || {}).at, usuario));
  return error('No existe esa ruta.', 404);
}
