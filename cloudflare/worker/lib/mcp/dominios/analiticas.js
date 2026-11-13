// DOMINIO `analiticas` del conector remoto (P5, carril anuncios): cómo van las redes, solo lectura. Una herramienta (alcance lectura, solo GET):
// resumen (total por red y una línea por cuenta) · cuenta (una cuenta sola) · mejor_hora · informe del mes · estado (conexión con Meta, última foto, indicadores).
// Usa las mismas lecturas que los agentes (contenido-tools.mjs) sobre las mismas rutas: nada se duplica.
import { registrarHerramienta } from '../registro.js';
import { conOficina, fallo, sanear, paginar } from '../anuncios/comun.js';
import { crearLlamador } from '../../../../../contenido-tools.mjs';

export const RUTAS = Object.freeze(['GET /api/contenido/analiticas', 'GET /api/contenido/analiticas/resumen', 'GET /api/contenido/mejor-hora', 'GET /api/contenido/informe', 'GET /api/contenido']);
export const ACCIONES = Object.freeze(['resumen', 'cuenta', 'mejor_hora', 'informe', 'estado']);
export const PERMITIDAS = Object.freeze(['GET /api/contenido/analiticas', 'GET /api/contenido/analiticas/resumen', 'GET /api/contenido/mejor-hora', 'GET /api/contenido/informe', 'GET /api/contenido']);

registrarHerramienta({ dominio: 'analiticas',
  nombre: 'analiticas', titulo: 'Analíticas de las redes (leer)', alcance: 'lectura', soloLectura: true,
  descripcion: 'LEE cómo van las redes; no cambia nada. `accion`: resumen (total por red y una línea por cada cuenta, para compararlas; `dias` 7–90, por defecto 30) · cuenta (una sola, por `cuenta`) · mejor_hora (`redes`, `fecha`) · '
    + 'informe (del `mes`) · estado (Meta conectada, última foto, indicadores). Cita las cifras tal cual; no inventes las que falten.',
  esquema: { type: 'object', additionalProperties: false, required: ['accion'], properties: {
    accion: { type: 'string', enum: [...ACCIONES] },
    dias: { type: 'integer', minimum: 7, maximum: 90 },
    cuenta: { type: 'string', maxLength: 120 },
    redes: { type: 'array', maxItems: 9, items: { type: 'string', maxLength: 20 } },
    fecha: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    mes: { type: 'string', pattern: '^\\d{4}-\\d{2}$' },
    cursor: { type: 'string', maxLength: 200, description: 'El `siguiente` anterior.' },
  } },
  ejecutar: async (ctx, a) => {
    try {
      const office = await conOficina(ctx, PERMITIDAS), llamar = crearLlamador({ office });
      let t;
      if (a.accion === 'resumen') t = await llamar('ver_analiticas', { dias: a.dias });
      else if (a.accion === 'cuenta') t = await llamar('ver_analiticas', { dias: a.dias, cuenta: String(a.cuenta || '').trim() || fallaTexto('cuenta necesita la `cuenta` (@usuario, nombre o id).') });
      else if (a.accion === 'mejor_hora') t = await llamar('ver_mejor_hora', { redes: a.redes, fecha: a.fecha });
      else if (a.accion === 'informe') t = await llamar('ver_informe_mes', { mes: a.mes });
      else if (a.accion === 'estado') t = await estado(office);
      else fallaTexto('esa acción no existe');
      return paginar(sanear(t), a.cursor);
    } catch (e) { return fallo('analiticas', e); }
  },
});
function fallaTexto(m) { throw new Error(m); }

/** La conexión con Meta y la última foto, en palabras: nunca la serie entera ni nada que parezca un secreto. */
async function estado(office) {
  const r = await office('/api/contenido/analiticas?dias=7'), m = r.meta || {};
  const cuentas = (m.cuentas || []).slice(0, 20).map((c) => `${c.red || '?'}: ${String(c.usuario ? '@' + c.usuario : c.nombre || c.id).slice(0, 60)} (${String(c.id).slice(0, 40)})`);
  return `Meta: ${m.configurado ? 'conectada' : 'sin conectar'}. Cuentas: ${cuentas.length ? cuentas.join(' · ') : 'ninguna conocida'}. Última foto: ${String(r.ultimaFoto?.at ?? r.ultimaFoto ?? 'ninguna').slice(0, 40)} (hoy: ${String(r.hoy || '?').slice(0, 10)}). `
    + `Cuentas pendientes de foto: ${Number(r.pendientes) || 0}${r.actualizando ? ' · actualizando ahora' : ''}. Indicadores: ${JSON.stringify(r.indicadores ?? {}).slice(0, 500)}.`;
}
