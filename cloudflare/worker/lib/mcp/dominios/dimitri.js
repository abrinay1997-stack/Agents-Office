// DIMITRI por el conector remoto (P5): las conversaciones PROPIAS de la persona del token. Cada cuenta tiene su sala y nadie lee la de otra (la oficina ya lo garantiza: las rutas /api/sub/* contestan con la
// sala de la sesión, y el conector corre como la persona del token). Dos herramientas:
//   · `dimitri_chats` (lectura): listar (el historial), actual (la conversación de ahora) y leer (una archivada).
//   · `dimitri_chats_cambiar` (oficina): renombrar una archivada y empezar una conversación nueva (la de ahora se ARCHIVA, no se borra).
// NUNCA por MCP: borrar conversaciones (es de la persona, en su historial), abrir una archivada como la de ahora (cambia su pantalla), restaurar, enviar a los jefes, lanzar generaciones, ops de Dimitri
// (para eso está `hacer`/`hablar_con_dimitri` de la Capa 1), el resumen semanal. Cada una está en `EXCLUSIONES` con su motivo.
import { registrarHerramienta } from '../registro.js';
import { limpiarSecretos } from '../../secretos.js';
import { conIdempotencia } from '../capa1/idempotencia.js';
import { restringir } from '../capa1/restringir.js';
import { ID_CONVERSACION, corta, dia, paginar, cabecera, sanear, AVISO_TERCEROS } from '../agentes/ayudas.js';

export const ACCIONES_LEE = Object.freeze(['listar', 'actual', 'leer']);
export const ACCIONES_CAMBIA = Object.freeze(['renombrar', 'nueva']);
export const EXCLUSIONES = Object.freeze({
  'borrar una conversación': 'Borrar es para siempre y es de la persona dueña del chat, en su historial; por MCP solo se archiva («nueva»).',
  'abrir una archivada como la de ahora': 'Cambia lo que esa persona ve en su pantalla; se lee con «leer» sin mover nada.',
  'restaurar la conversación archivada': 'Es el DESHACER de «Nueva conversación» en la página.',
  'la sala de otra cuenta': 'Cada cuenta ve solo la suya: el conector corre como la persona del token y la oficina no abre otra sala.',
  'enviar a los jefes, generar y ops de Dimitri': 'Mandan trabajo o gastan: pasan por la tarjeta y el clic de la oficina. Lo que sí se puede está en `hablar_con_dimitri` y `hacer`.',
});
export const RUTAS = Object.freeze(['GET /api/sub', 'GET /api/sub/conversaciones', 'GET /api/sub/conversaciones/:id', 'POST /api/sub/renombrar', 'POST /api/sub/clear']);

const FALLO = (n, e) => { console.error(`[mcp:dimitri] ${n}:`, e?.message ?? e); return { texto: `No se pudo: ${limpiarSecretos(String(e?.message || e)).replace(/\s+/g, ' ').slice(0, 300)}`, esError: true }; };
const conOficina = async (ctx, permitidas) => { const { crearOficinaMcp } = await import('../capa1/oficina.js'); return restringir(await crearOficinaMcp({ env: ctx.env, db: ctx.db, usuario: ctx.usuario, ahoraMs: ctx.ahoraMs }), permitidas); };
const idem = (ctx, herramienta, fn) => conIdempotencia(ctx.db, { conexionId: ctx.conexion.id, herramienta, clave: ctx.claveIdempotencia, ms: ctx.ahoraMs, fn });
const quien = (m) => (m.who === 'user' ? (m.por ? `${corta(m.por, 30)}` : 'Tú') : 'Dimitri');
const titulo = (x) => `«${corta(x, 80)}»`;
const mensajes = (l, n = 30) => l.slice(-n).map((m) => `${dia(m.at)} · ${quien(m)}: ${corta(m.text, 700)}`).join('\n');

registrarHerramienta({ dominio: 'dimitri',
  nombre: 'dimitri_chats', titulo: 'Dimitri: tus conversaciones',
  descripcion: 'Lee TUS conversaciones con Dimitri (cada cuenta tiene la suya; nunca se ve la de otra persona). Solo lee. `accion`: listar (la de ahora y las archivadas, con su id y título) · actual (los últimos mensajes de la de ahora)'
    + ' · leer (una archivada por `id`). Los mensajes largos se acortan.',
  esquema: { type: 'object', additionalProperties: false, required: ['accion'], properties: {
    accion: { type: 'string', enum: [...ACCIONES_LEE] }, id: { type: 'string', maxLength: 30, description: 'leer: el id de una conversación de «listar».' }, limite: { type: 'integer', minimum: 1, maximum: 50 }, cursor: { type: 'string', maxLength: 200 } } },
  alcance: 'lectura', soloLectura: true,
  ejecutar: async (ctx, a) => {
    const r = await leer(ctx, a); return r.texto ? { ...r, texto: sanear(r.texto) + `\n${AVISO_TERCEROS}` } : r; // fila por fila
  },
});
async function leer(ctx, a) {
    try {
      const office = await conOficina(ctx, ['GET']);
      if (a.accion === 'listar') {
        const r = await office('/api/sub/conversaciones'), p = paginar(r.lista || [], a.cursor, a.limite || 25);
        return { texto: [r.actual ? `Ahora: ${r.actual.n} mensajes · ${titulo(r.actual.titulo)} (último ${dia(r.actual.at)})` : 'Ahora: conversación vacía.', cabecera('Archivadas', p),
          ...p.pagina.map((x) => `${x.id} · ${dia(x.at)} · ${x.n} mensajes · ${titulo(x.titulo)}`)].join('\n'), siguiente: p.siguiente };
      }
      if (a.accion === 'actual') { const r = await office('/api/sub'); const l = r.messages || []; return { texto: l.length ? `Conversación de ahora (${l.length} mensajes; los últimos):\n${mensajes(l, a.limite || 20)}` : 'La conversación de ahora está vacía.' }; }
      if (a.accion === 'leer') {
        if (!ID_CONVERSACION.test(String(a.id || ''))) return { texto: 'falta `id`: el de una conversación de «listar».', esError: true };
        let c; try { c = await office(`/api/sub/conversaciones/${a.id}`); } catch { return { texto: 'esa conversación no está en TU historial.', esError: true }; }
        const l = c.messages || [], p = paginar(l, a.cursor, a.limite || 30);
        return { texto: `${titulo(c.titulo)} (${dia(c.at)}, ${l.length} mensajes)\n${p.pagina.map((m) => `${dia(m.at)} · ${quien(m)}: ${corta(m.text, 700)}`).join('\n')}`, siguiente: p.siguiente };
      }
      return { texto: `la acción «${corta(a.accion, 30)}» no existe.`, esError: true };
    } catch (e) { return FALLO('dimitri_chats', e); }
}

registrarHerramienta({ dominio: 'dimitri',
  nombre: 'dimitri_chats_cambiar', titulo: 'Dimitri: renombrar o empezar una conversación nueva',
  descripcion: 'Ordena TUS conversaciones con Dimitri (alcance «oficina»). `accion`: renombrar (una archivada: `id` y `titulo`, ≤ 80 letras) · nueva (empieza una conversación nueva: la de ahora se ARCHIVA, no se borra; sigue en el historial). No borra nada.',
  esquema: { type: 'object', additionalProperties: false, required: ['accion'], properties: {
    accion: { type: 'string', enum: [...ACCIONES_CAMBIA] }, id: { type: 'string', maxLength: 30 }, titulo: { type: 'string', maxLength: 80 } } },
  alcance: 'oficina', soloLectura: false, destructiva: false, idempotente: false,
  ejecutar: async (ctx, a) => {
    try {
      if (a.accion === 'renombrar') {
        if (!ID_CONVERSACION.test(String(a.id || '')) || !String(a.titulo || '').trim()) return { texto: 'renombrar necesita `id` (de «listar») y `titulo`.', esError: true };
        const office = await conOficina(ctx, ['GET', 'POST /api/sub/renombrar']);
        return await idem(ctx, 'dimitri_chats_cambiar', async () => {
          try { await office('/api/sub/renombrar', { id: a.id, titulo: a.titulo }); } catch { throw new Error('esa conversación no está en TU historial, o el título está vacío'); }
          return { texto: `Listo: «${corta(a.titulo, 80)}».` };
        });
      }
      if (a.accion === 'nueva') {
        const office = await conOficina(ctx, ['GET', 'POST /api/sub/clear']);
        return await idem(ctx, 'dimitri_chats_cambiar', async () => {
          const r = await office('/api/sub/clear', {});
          return { texto: r.archived ? 'Listo: la conversación de antes quedó archivada (sigue en tu historial) y empiezas una nueva.' : 'Ya estabas en una conversación vacía: no había nada que archivar.' };
        });
      }
      return { texto: `la acción «${corta(a.accion, 30)}» no existe.`, esError: true };
    } catch (e) { return FALLO('dimitri_chats_cambiar', e); }
  },
});
