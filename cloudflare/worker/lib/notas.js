// Las rutas para ESCRIBIR en el Cerebro (27 oct 2026), con la misma forma que la oficina local (serve.mjs):
//   POST /api/note {name, text, group?}                  → una nota nueva
//   PUT  /api/note {name, text, base?}                   → reemplaza el texto (base = el `modified` que leíste: si cambió, 409)
//   POST /api/note/append {name, text, section?}         → añade al final (o a una sección) sin tocar lo que decía
//   POST /api/note/trash {id} · GET /api/note/trash · POST /api/note/restore {file}   → la papelera de 30 días
// Escribir es de un administrador o un editor (un lector solo mira). Todas devuelven el mapa del Cerebro al día (`graph`) como las de la computadora, y quedan en `auditoria`.
import { json, error, prohibido } from './respuesta.js';
import * as cerebro from './cerebro.js';

const quien = (u) => String(u?.nombre || u?.email || 'alguien').slice(0, 80);
const puede = (u) => u?.rol === 'admin' || u?.rol === 'editor';

export async function manejarNotas({ req, db, usuario, ruta, cuerpo }) {
  const metodo = req.method;
  if (ruta === '/api/note/trash' && metodo === 'GET') return json(await cerebro.listarPapelera(db));
  if (!(ruta === '/api/note' || ruta === '/api/note/append' || ruta === '/api/note/trash' || ruta === '/api/note/restore') || metodo === 'GET') return null;
  if (!puede(usuario)) return prohibido('Escribir en el Cerebro es de un administrador o un editor.');
  const b = await cuerpo(req) || {};
  const sale = async (r, extra = {}) => (r.error ? json({ error: r.error, ...(r.modified ? { modified: r.modified } : {}) }, r.estado || 400) : json({ ok: true, ...extra, graph: await cerebro.leerGrafo(db) }));
  if (ruta === '/api/note' && metodo === 'POST') { const r = await cerebro.crearNota(db, { nombre: b.name, texto: b.text, grupo: b.group, por: quien(usuario) }); return sale(r, { name: r.nombre, modified: r.modified }); }
  if (ruta === '/api/note' && metodo === 'PUT') { const r = await cerebro.guardarNota(db, { nombre: b.name, texto: b.text, base: b.base ?? null, por: quien(usuario) }); return sale(r, { name: r.nombre, modified: r.modified }); }
  if (ruta === '/api/note/append' && metodo === 'POST') { const r = await cerebro.agregarANota(db, { nombre: b.name, texto: b.text, seccion: b.section, por: quien(usuario) }); return sale(r, { name: r.nombre, modified: r.modified }); }
  if (ruta === '/api/note/trash' && metodo === 'POST') { const r = await cerebro.mandarAPapelera(db, b.id, { por: quien(usuario) }); return sale(r, { trashed: r.id, name: r.nombre }); }
  if (ruta === '/api/note/restore' && metodo === 'POST') { const r = await cerebro.restaurarNota(db, b.file); return sale(r, { name: r.nombre }); }
  return null;
}
