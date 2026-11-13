// DOMINIO «ESTUDIO» del conector remoto (P5, carril 5): ver la galería con detalle y ordenarla. La capa 1 (dominios/capa1.js) ya sirve buscar_en_galeria, estado_trabajo y las 6 de gasto que solo PREPARAN: aquí no se repiten.
//  · `galeria` (lectura): listar, ver una pieza, carpetas, papelera, trabajos, presets (y sus versiones), lotes, voces y topes. Solo GET: no crea, no empuja ni toca ningún trabajo (se lee `/api/media?catalog=1`, no `/api/media/jobs`).
//  · `galeria_cambiar` (oficina): crear y renombrar carpetas, mover archivos y mandarlos a la papelera / recuperarlos, con DESHACER. Nunca borra un archivo, ni una carpeta, ni vacía la papelera.
//  · REGLA DEL DINERO: nada de aquí genera, anima, varía, edita con IA, inicia un lote, resuelve un «incierto» ni crea voces. Lo que se deja fuera está en `EXCLUSIONES` (cambios.js) con su motivo y lo vigila el test.
import { registrarHerramienta } from '../registro.js';
import { clip, conOficina, fallo, pide, rutaDeArchivo, ID_CARPETA, ID_LOTE, ID_PRESET } from '../estudio-dom/comun.js';
import { listaGaleria, fichaItem, listaCarpetas, listaPapelera, listaTrabajos, listaPresets, listaLotes, fichaLote, listaVoces, textoLimites } from '../estudio-dom/lectura.js';
import { preparar, deshacer, ACCIONES_CAMBIAR, MAX_ARCHIVOS } from '../estudio-dom/cambios.js';
import { conIdempotencia } from '../capa1/idempotencia.js';

export { EXCLUSIONES } from '../estudio-dom/cambios.js';
export const ACCIONES_LEER = Object.freeze(['listar', 'ver', 'carpetas', 'papelera', 'trabajos', 'presets', 'lotes', 'voces', 'limites']);
/** Las rutas /api/ que este dominio cubre (para el test de cobertura de la P7). */
export const RUTAS = Object.freeze([
  'GET /api/media', 'GET /api/media/item/:id', 'GET /api/media/folders', 'GET /api/media/trash', 'GET /api/media/presets', 'GET /api/media/presets/:id/versiones', 'GET /api/media/lotes', 'GET /api/media/lotes/:id', 'GET /api/voces', 'GET /api/media/limites',
  'POST /api/media/folders', 'PATCH /api/media/folders/:id', 'POST /api/media/move', 'DELETE /api/media/item/:id', 'POST /api/media/restore',
]);

const FILTROS = ['all', 'fav', 'you', 'agent', 'video', 'up', 'voice', 'music', 'none'];
const ESQUEMA_LEER = {
  type: 'object', additionalProperties: false, required: ['accion'],
  properties: {
    accion: { type: 'string', enum: [...ACCIONES_LEER], description: 'listar (la galería, de lo más nuevo a lo más viejo) · ver (la ficha de un archivo) · carpetas · papelera · trabajos (en curso e historial) · ' +
      'presets (el banco; con `id`, sus versiones) · lotes (con `id`, uno) · voces · limites (topes del Estudio).' },
    q: { type: 'string', maxLength: 120, description: 'listar y presets: texto que buscar (prompt, modelo, agente, tarea).' },
    filtro: { type: 'string', enum: FILTROS, description: 'listar: all, fav (favoritas), you (las tuyas), agent (de agentes), video, up (subidas), voice, music, none (sin carpeta).' },
    carpeta: { type: 'string', maxLength: 30, description: 'listar: el id de una carpeta (c…), «none» o «all».' },
    tipo: { type: 'string', enum: ['image', 'video', 'audio'], description: 'listar: solo ese tipo.' },
    n: { type: 'integer', minimum: 1, maximum: 50, description: 'listar: cuántos (por defecto 25).' },
    cursor: { type: 'string', maxLength: 200, description: 'listar: el cursor «siguiente» de la página anterior.' },
    archivo: { type: 'string', maxLength: 300, description: 'ver: el id del archivo («2031-01/nombre.png»).' },
    id: { type: 'string', maxLength: 40, description: 'presets: el id de un preset (sus versiones) · lotes: el id de un lote (L…).' },
    medio: { type: 'string', enum: ['image', 'video', 'music', 'audio'], description: 'presets: de qué medio.' },
  },
};
const DESC_LEER = 'Mira el Estudio (imágenes, videos, audios): la galería con su detalle, una ficha (prompt, modelo, versiones), carpetas, papelera, trabajos, el banco de presets, lotes, voces y topes. Solo lee: no genera nada ni gasta. ' +
  'Los archivos se dan por id y enlace (/media/…, con sesión en la oficina), no por bytes. Para el estado de un trabajo concreto usa estado_trabajo; para buscar por significado, buscar_en_galeria.';

async function leer(ctx, a) {
  const accion = a.accion;
  const o = await conOficina(ctx, ['GET']);
  if (accion === 'listar') {
    const p = new URLSearchParams({ n: String(Math.min(50, Math.max(1, Math.round(+a.n || 25)))), filter: FILTROS.includes(a.filtro) ? a.filtro : 'all' });
    if (a.q) p.set('q', String(a.q).slice(0, 120)); if (a.carpeta) p.set('folder', String(a.carpeta).slice(0, 30)); if (a.tipo) p.set('kind', a.tipo); if (a.cursor) p.set('before', a.cursor);
    const pg = await o(`/api/media?${p}`);
    return { texto: listaGaleria(pg), ...(pg.next && pg.next.length <= 200 ? { siguiente: pg.next } : {}) };
  }
  if (accion === 'ver') {
    const ruta = rutaDeArchivo(a.archivo); if (!ruta) return pide('Falta «archivo»: el id de la galería («2031-01/nombre.png»).');
    return { texto: fichaItem(await o(`/api/media/item/${ruta}`)) };
  }
  if (accion === 'carpetas') return { texto: listaCarpetas((await o('/api/media?n=1')).folders) };
  if (accion === 'papelera') return { texto: listaPapelera(await o('/api/media/trash')) };
  if (accion === 'trabajos') { const c = await o('/api/media?n=1&catalog=1'); return { texto: listaTrabajos(c.jobs, c.budget) }; } // el catálogo trae los trabajos SIN empujarlos (la lista de /jobs sí los empuja)
  if (accion === 'presets') {
    if (a.id !== undefined && a.id !== '') {
      if (!ID_PRESET.test(String(a.id))) return pide('«id» no es el de un preset.');
      const v = (await o(`/api/media/presets/${a.id}/versiones`)).versiones;
      const cuales = (Array.isArray(v) ? v : []).slice(0, 20).map((x) => clip(typeof x === 'string' ? x : x?.at || x?.nombre || JSON.stringify(x), 40)).join(' · ');
      return { texto: cuales ? `Versiones del preset ${a.id}: ${cuales}` : `El preset ${a.id} no tiene versiones guardadas.` };
    }
    const p = new URLSearchParams(); if (a.q) p.set('q', String(a.q).slice(0, 120)); if (a.medio) p.set('medio', a.medio);
    return { texto: listaPresets(await o(`/api/media/presets${String(p) ? `?${p}` : ''}`)) };
  }
  if (accion === 'lotes') {
    if (a.id !== undefined && a.id !== '') { if (!ID_LOTE.test(String(a.id))) return pide('«id» no es el de un lote (L…).'); return { texto: fichaLote((await o(`/api/media/lotes/${a.id}`)).lote) }; }
    return { texto: listaLotes(await o('/api/media/lotes')) };
  }
  if (accion === 'voces') return { texto: listaVoces(await o('/api/voces')) };
  if (accion === 'limites') return { texto: textoLimites(await o('/api/media/limites')) };
  return pide('acción desconocida');
}

registrarHerramienta({ dominio: 'estudio',
  nombre: 'galeria', titulo: 'Galería del Estudio', descripcion: DESC_LEER, esquema: ESQUEMA_LEER, alcance: 'lectura', soloLectura: true,
  ejecutar: async (ctx, a) => { try { return await leer(ctx, a); } catch (e) { return fallo('galeria', e); } },
});

const ESQUEMA_CAMBIAR = {
  type: 'object', additionalProperties: false, required: ['accion'],
  properties: {
    accion: { type: 'string', enum: [...ACCIONES_CAMBIAR], description: 'carpeta_crear · carpeta_renombrar · mover (archivos a una carpeta o a «sin carpeta») · papelera_mandar (30 días, se recupera) · papelera_restaurar · deshacer (con la clave de la acción anterior).' },
    nombre: { type: 'string', maxLength: 60, description: 'carpeta_crear y carpeta_renombrar: el nombre.' },
    carpeta: { type: ['string', 'null'], maxLength: 30, description: 'carpeta_renombrar: el id (c…) · mover: la carpeta de destino, o null para «sin carpeta».' },
    archivos: { type: 'array', maxItems: MAX_ARCHIVOS, items: { type: 'string', maxLength: 300 }, description: `mover: los ids de archivo (hasta ${MAX_ARCHIVOS}).` },
    archivo: { type: 'string', maxLength: 300, description: 'papelera_mandar y papelera_restaurar: el id del archivo.' },
    deshacer: { type: 'string', maxLength: 40, description: 'deshacer: la clave que dio mover, carpeta_renombrar o papelera_mandar (vale 10 minutos).' },
  },
};
const DESC_CAMBIAR = 'Ordena el Estudio sin gastar ni borrar nada: crea y renombra carpetas, mueve archivos de carpeta y manda a la papelera (30 días) o recupera. Mover, renombrar y mandar a la papelera dan una clave para DESHACER 10 minutos. ' +
  'No genera, no edita con IA, no borra carpetas ni archivos para siempre, no vacía la papelera: eso lo hace una persona en la oficina. Un archivo usado por una pieza de Contenido no se manda a la papelera.';

registrarHerramienta({ dominio: 'estudio',
  nombre: 'galeria_cambiar', titulo: 'Ordenar el Estudio', descripcion: DESC_CAMBIAR, esquema: ESQUEMA_CAMBIAR, alcance: 'oficina', soloLectura: false, destructiva: true, idempotente: false,
  ejecutar: async (ctx, a) => {
    try {
      if (a.accion === 'deshacer') return await deshacer(ctx, a.deshacer);
      const p = preparar(a.accion, a, ctx); if (p.error) return pide(p.error);
      const hacerla = async () => ({ texto: await p.hacer(await conOficina(ctx, p.permitidas)) });
      return await conIdempotencia(ctx.db, { conexionId: ctx.conexion.id, herramienta: 'galeria_cambiar', clave: ctx.claveIdempotencia, ms: ctx.ahoraMs, fn: hacerla });
    } catch (e) { return fallo('galeria_cambiar', e); }
  },
});
