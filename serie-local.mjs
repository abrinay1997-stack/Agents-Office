// Agents Office (29 oct 2026) — Fase 11.3 (carril K), oficina local: la ruta que PROPONE una serie. Todo inyectado, sin red.
//   POST /api/series/proponer  { brief, planos }  → la propuesta (serie-propuesta-core.armarPropuesta). NO gasta, NO genera, NO guarda.
// Apagada con `dimitri.series` (por defecto). GENERAR SERIE (token + hash + tope) llega en otro PR; hasta entonces esta ruta no puede gastar porque no tiene con qué.
import { armarPropuesta, resumenPropuesta, preciosDeCifras } from './serie-propuesta-core.mjs';

export function crearSeries({ biblia, capsDe, existeRef, precioPlano, cifras = () => ({}), activo = () => false, id = () => 'serie-' + Date.now().toString(36), config = null, modeloUnico = () => null }) {
  const err = (estado, error, extra = {}) => ({ estado, cuerpo: { error, ...extra } });
  function proponer({ brief, planos, por = 'dueno' } = {}) {
    if (por !== 'dueno') return err(403, 'Proponer una serie es del dueño (o de Dimitri con su clic).');
    if (!activo()) return err(409, 'Las series están apagadas (office.config.json → dimitri.series).');
    const r = armarPropuesta({ brief, planos, biblia: biblia.leer(), hojas: biblia.hojas(), ctx: { id: id(), capsDe, existeRef, precioPlano, preciosPermitidos: preciosDeCifras(cifras()), config, modeloUnico: modeloUnico() } });
    if (!r.ok) return err(r.codigo === 'sin_biblia' ? 409 : 422, r.motivo, { codigo: r.codigo, problemas: r.problemas });
    return { estado: 200, cuerpo: { ...r, resumen: resumenPropuesta(r), nota: 'Es una PROPUESTA: no se generó ni se gastó nada. GENERAR SERIE es el clic del dueño.' } };
  }
  async function ruta(metodo, pathname, { cuerpo = {}, agente = false } = {}) {
    if (pathname === '/api/series/proponer' && metodo === 'POST') return proponer({ brief: cuerpo.brief, planos: cuerpo.planos, por: agente ? 'agente' : 'dueno' });
    return null;
  }
  return { proponer, ruta };
}
