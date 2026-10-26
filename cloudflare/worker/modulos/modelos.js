// Ajustes → Modelos (25 oct 2026): el dueño intercambia modelos a voluntad y por función. SOLO un administrador lee o cambia esto (salvo /activos: qué modelos
// están en uso, sin llaves ni precios, para el icono junto al perfil). Ninguna ruta devuelve una llave: solo si está puesta.
//   GET  /api/modelos            el catálogo con precios y capacidades, las llaves (sí/no), las asignaciones y los agentes
//   PUT  /api/modelos            { ajustes } → se valida entera (modelos-core.mjs); el cambio queda en la auditoría
//   GET  /api/modelos/activos    [{ id, nombre, proveedor, llave }] — cualquier persona con sesión
//   POST /api/modelos/probar     { modelo, pedido? } → respuesta, tiempo, tokens y costo (máx. 300 tokens de salida)
//   POST /api/modelos/comparar   { a, b, pedido?, confirmar? } → sin confirmar, solo el costo máximo; con confirmar:true, las dos respuestas lado a lado
import { json, error, prohibido } from '../lib/respuesta.js';
import { leerDoc } from '../lib/almacen.js';
import { leerContexto } from '../lib/tareas/contexto.js';
import { leerModelos, guardarModelos, vistaCompleta, activos, probarModelo, costoMaximoComparar, pruebasEnLaHora, TOPE } from '../lib/modelos.js';
import { buscar, VACIO } from '../../../modelos-core.mjs';

export const nombre = 'modelos';
export const grupos = ['modelos'];

export async function manejar(ctx) {
  const { req, env, db, ruta, usuario } = ctx;
  if (!ruta.startsWith('/api/modelos')) return null;
  const metodo = req.method;
  if (ruta === '/api/modelos/activos' && metodo === 'GET') return json({ activos: activos(env, await leerModelos(db)).map(({ id, nombre, proveedor, llave, personalizado }) => ({ id, nombre, proveedor, llave, personalizado })) });
  if (usuario.rol !== 'admin') return prohibido('Solo un administrador elige o prueba los modelos de la oficina.');
  if (ruta === '/api/modelos' && metodo === 'GET') {
    const C = await leerContexto(db);
    return json(vistaCompleta({ env, ajustes: await leerModelos(db), cfgPrices: C.ajustes?.costs?.prices || {}, agentes: C.agents }));
  }
  if (ruta === '/api/modelos' && metodo === 'PUT') {
    const b = (await ctx.cuerpo(req)) || {};
    const antes = (await leerModelos(db)) || VACIO();
    const r = await guardarModelos(db, b.ajustes, { quien: usuario.email, antes });
    if (!r.ok) return json({ error: r.errores.join(' '), errores: r.errores }, 422);
    return json({ ok: true, ajustes: r.valor, cambios: r.cambios });
  }
  if (ruta === '/api/modelos/probar' && metodo === 'POST') {
    const b = (await ctx.cuerpo(req)) || {};
    if (await pruebasEnLaHora(db) >= TOPE) return error(`Ya hiciste ${TOPE} pruebas en esta hora. Espera un poco: cada una cuesta unos centavos.`, 429);
    const r = await probarModelo({ env, db, id: b.modelo, pedido: b.pedido, ajustes: await leerModelos(db), fetchFn: env.__pruebas?.fetch });
    return json(r, r.ok ? 200 : 502);
  }
  if (ruta === '/api/modelos/comparar' && metodo === 'POST') {
    const b = (await ctx.cuerpo(req)) || {}, aj = await leerModelos(db);
    if (!buscar(String(b.a), aj) || !buscar(String(b.b), aj)) return error('Elige dos modelos del catálogo.', 422);
    if (b.a === b.b) return error('Elige dos modelos distintos para compararlos.', 422);
    const C = await leerContexto(db), costo = costoMaximoComparar([b.a, b.b], b.pedido, aj, C.ajustes?.costs?.prices || {});
    if (b.confirmar !== true) return json({ confirmar: true, costoMaximo: costo.total, filas: costo.filas, sinPrecio: costo.sinPrecio, aviso: `Comparar gasta como mucho US$${costo.total.toFixed(4)}${costo.sinPrecio ? ' (uno no tiene precio conocido)' : ''}. Pulsa de nuevo para hacerlo.` });
    if (await pruebasEnLaHora(db) + 2 > TOPE) return error(`Ya hiciste muchas pruebas en esta hora (tope ${TOPE}). Espera un poco.`, 429);
    const [x, y] = await Promise.all([b.a, b.b].map((id) => probarModelo({ env, db, id, pedido: b.pedido, ajustes: aj, fetchFn: env.__pruebas?.fetch })));
    return json({ a: x, b: y, costoMaximo: costo.total });
  }
  return null;
}
