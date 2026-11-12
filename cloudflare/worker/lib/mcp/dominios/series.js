// DOMINIO «SERIES» del conector remoto (P5, carril 5): las series de imágenes (storyboards, carruseles del mes) en la nube — leer escaletas, estado y libro de gasto, y dejar una PROPUESTA.
//  · `series` (lectura): listar, ver una serie (su escaleta y el estado de cada plano) y su libro de gasto. Solo GET. Apagadas (`dimitri.seriesNube`), la oficina contesta 501 y aquí se dice en palabras.
//  · `series_cambiar` (oficina): `proponer` arma la propuesta (con `guardar: true` la deja «prevista») y `tanda` añade planos a una serie prevista. NO gasta, no reserva, no llama a ningún motor y no toca la bomba.
//  · REGLA DEL DINERO: por MCP nunca se presupuesta para generar, se genera, se continúa, se autoriza, se pausa/cancela una serie viva ni se resuelve un paso «incierto»: son rutas de GASTO o de contabilidad del libro y las da
//    el dueño con su clic y su token de un solo uso en la oficina. Lo que se deja fuera está en `EXCLUSIONES_SERIES` y lo vigila el test.
import { registrarHerramienta } from '../registro.js';
import { clip, conOficina, fallo, pide, ID_SERIE } from '../estudio-dom/comun.js';
import { conIdempotencia } from '../capa1/idempotencia.js';

export const ACCIONES_SERIES = Object.freeze(['listar', 'ver', 'libro']);
export const ACCIONES_SERIES_CAMBIAR = Object.freeze(['proponer', 'tanda']);
export const EXCLUSIONES_SERIES = Object.freeze({
  generar: 'POST /api/series/<id>/presupuesto, /generar y /continuar: «GENERAR SERIE» autoriza gasto con un token de un solo uso atado a la cifra; el segundo paso es de una persona (y la bomba solo corre con lo autorizado).',
  pausar_cancelar: 'POST /api/series/<id>/pausar y /cancelar: tocan una serie VIVA (la bomba); se hacen en la oficina junto a la cifra que se lleva gastada.',
  resolver_incierto: 'POST /api/series/<id>/resolver y el «resolver» de las líneas huérfanas del libro: decidir si un paso en duda se cobró es contabilidad del dinero, con dos clics y su token.',
  huerfanas: 'GET /api/series/libro/huerfanas: las líneas del libro sin serie solo sirven para resolverlas (excluido arriba); se miran en la oficina.',
});
export const RUTAS = Object.freeze(['GET /api/series', 'GET /api/series/:id', 'GET /api/series/:id/libro', 'POST /api/series/proponer', 'POST /api/series/:id/tanda']);

const OBJETOS_PLANO = { type: 'object', additionalProperties: true };
const ESQUEMA_LEER = {
  type: 'object', additionalProperties: false, required: ['accion'],
  properties: {
    accion: { type: 'string', enum: [...ACCIONES_SERIES], description: 'listar (las series y su estado) · ver (una serie: su escaleta plano a plano) · libro (las líneas de gasto de esa serie).' },
    id: { type: 'string', maxLength: 60, description: 'ver y libro: el id de la serie (de la acción listar).' },
  },
};
const ESQUEMA_CAMBIAR = {
  type: 'object', additionalProperties: false, required: ['accion'],
  properties: {
    accion: { type: 'string', enum: [...ACCIONES_SERIES_CAMBIAR], description: 'proponer (arma la propuesta; con guardar:true queda «prevista») · tanda (añade 1 a 8 planos a una serie prevista).' },
    id: { type: 'string', maxLength: 60, description: 'tanda: el id de la serie prevista.' },
    brief: {
      type: 'object', additionalProperties: false, description: 'proponer: de qué va la serie.',
      properties: { titulo: { type: 'string', maxLength: 200 }, objetivo: { type: 'string', maxLength: 800 }, publico: { type: 'string', maxLength: 400 }, formato: { type: 'string', maxLength: 80 }, restricciones: { type: 'string', maxLength: 800 } },
    },
    planos: { type: 'array', maxItems: 40, items: OBJETOS_PLANO, description: 'proponer (hasta 40) y tanda (hasta 8): los planos { prompt, … } como los pide la oficina; cada uno se valida allí.' },
    guardar: { type: 'boolean', description: 'proponer: true la deja guardada como «prevista» (no gasta). Sin él, solo se calcula y se enseña.' },
  },
};

const lineaSerie = (s) => `- ${s.id} · ${s.estado} · «${clip(s.titulo || s.brief?.titulo, 80)}» · ${s.progreso?.total ?? (Array.isArray(s.planos) ? s.planos.length : s.escaleta?.length ?? '?')} planos${s.progreso ? ` (${s.progreso.listos ?? 0} listos)` : ''}`;
const json = (v, n = 14000) => { try { const t = JSON.stringify(v) ?? ''; return t.length > n ? `${t.slice(0, n)} … (recortado: la serie es más larga)` : t; } catch { return ''; } };

async function leer(ctx, a) {
  const o = await conOficina(ctx, ['GET']);
  if (a.accion === 'listar') { const r = await o('/api/series'); const l = Array.isArray(r.series) ? r.series : []; return { texto: l.length ? [`Series (${l.length}):`, ...l.slice(0, 60).map(lineaSerie)].join('\n') : 'No hay series.' }; }
  if (!ID_SERIE.test(String(a.id ?? ''))) return pide('Falta «id»: el de la serie (acción listar).');
  if (a.accion === 'ver') return { texto: `Serie ${a.id}:\n${json((await o(`/api/series/${a.id}`)).serie)}` };
  return { texto: `Libro de gasto de la serie ${a.id}:\n${json((await o(`/api/series/${a.id}/libro`)).lineas)}` };
}
const apagadas = (e) => (/501|apagad|series en la nube/i.test(String(e?.message)) ? { texto: 'Las series en la nube están apagadas (dimitri.seriesNube): un administrador las enciende en la oficina.', esError: true } : null);

registrarHerramienta({
  nombre: 'series', titulo: 'Series de imágenes', alcance: 'lectura', soloLectura: true, esquema: ESQUEMA_LEER,
  descripcion: 'Mira las series de imágenes del Estudio (storyboards y carruseles): la lista, una serie con su escaleta plano a plano y su libro de gasto. Solo lee: no genera, no reserva y no gasta. Generar una serie lo autoriza el dueño en la oficina, con la cifra a la vista.',
  ejecutar: async (ctx, a) => { try { return await leer(ctx, a); } catch (e) { return apagadas(e) || fallo('series', e); } },
});

registrarHerramienta({
  nombre: 'series_cambiar', titulo: 'Proponer una serie', alcance: 'oficina', soloLectura: false, destructiva: false, idempotente: false, esquema: ESQUEMA_CAMBIAR,
  descripcion: 'Arma la PROPUESTA de una serie de imágenes (su escaleta y su costo estimado) y, si lo pides, la deja guardada como «prevista»; también añade planos a una serie prevista. No gasta ni genera nada: poner una serie a generar es del dueño, en la oficina, con su confirmación.',
  ejecutar: async (ctx, a) => {
    try {
      const idem = (fn) => conIdempotencia(ctx.db, { conexionId: ctx.conexion.id, herramienta: 'series_cambiar', clave: ctx.claveIdempotencia, ms: ctx.ahoraMs, fn });
      if (a.accion === 'proponer') {
        if (!Array.isArray(a.planos) || !a.planos.length) return pide('Falta «planos»: la lista de planos de la serie.');
        const o = await conOficina(ctx, ['POST /api/series/proponer']);
        return await idem(async () => ({ texto: `Propuesta de serie:\n${json(await o('/api/series/proponer', { brief: a.brief, planos: a.planos, guardar: a.guardar === true }))}\nNada se generó ni se gastó.` }));
      }
      if (!ID_SERIE.test(String(a.id ?? '')) || !Array.isArray(a.planos) || !a.planos.length || a.planos.length > 8) return pide('Falta «id» (una serie prevista) y «planos» (de 1 a 8).');
      const o = await conOficina(ctx, [`POST /api/series/${a.id}/tanda`]);
      return await idem(async () => ({ texto: `Tanda añadida a la serie ${a.id}:\n${json(await o(`/api/series/${a.id}/tanda`, { planos: a.planos }))}\nNada se generó ni se gastó.` }));
    } catch (e) { return apagadas(e) || fallo('series_cambiar', e); }
  },
});
