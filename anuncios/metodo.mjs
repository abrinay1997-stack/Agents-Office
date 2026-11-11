// El MÉTODO DE CAMPAÑAS en la oficina (11 nov 2026): dónde se guarda y qué rutas tiene. Lo puro, en anuncios/metodo-core.mjs.
//
//   data/anuncios/metodo.json      { negocio, etapas, umbrales, tasaCierre, revisadaAt, actualizado }  (no viaja; en la nube, el espejo de D1)
//   data/anuncios/revision3q.json  la última lectura por ventanas de Meta { at, hoy, filas, leidoCon, recortado }
//
// RUTAS (las despacha anuncios/rutas.mjs; iguales en la oficina local y en el Worker):
//   GET  /api/anuncios/metodo                      → { negocio: ficha, texto }  (la ficha calculada: objetivo, equilibrio, número mágico, ciclo)
//   PUT  /api/anuncios/metodo/negocio { negocio, antes? } → { ok, negocio: ficha } · SOLO el dueño (403) · 409 si otra persona guardó (`antes`)
//   GET  /api/anuncios/metodo/revision[?fresco=1&costo=] → la revisión 3Q { …, texto } · sin Meta: 200 { configurado: false, motivo, texto }
//   PUT  /api/anuncios/metodo/etapas { id: etapa|'' }     → { ok, etapas } (la etapa de una campaña cuyo nombre no la dice) · dueño y Dimitri
//   PUT  /api/anuncios/metodo/manual { umbrales?, tasaCierre? } → { ok, umbrales, tasaCierre } · SOLO el dueño
//   GET  /api/anuncios/metodo/ciclo[?tipo=&destino=&cuenta=] → { ciclo, texto } (sin parámetros, el del negocio guardado)
//   POST /api/anuncios/metodo/simular { modo?, entradas } → { ok, escenarios, texto } (no guarda ni gasta: es una cuenta)
//   GET  /api/anuncios/metodo/texto?que=negocio|revision|ciclo → { texto }  (Dimitri, los agentes y el asistente)
//
// NADA de aquí cambia Meta ni gasta: leer, calcular y guardar los números de la empresa. Un agente (`por: 'agente'`) solo lee.
import fs from 'node:fs';
import path from 'node:path';
import { renombrar } from '../fs-seguro.mjs';
import { quienDe } from './acciones.mjs';
import { limpiarNegocio, limpiarEtapas, limpiarUmbrales3q, armarRevision, textoRevision, fichaNegocio, textoNegocio, textoCiclo, textoSimulacion, lecturaDe, ventanasDe,
  filasDeDiarias, cambiosDelHistorial, cicloDe, ETAPAS_REVISION, TASA_CIERRE_DEFECTO, CAMPOS_SIMULADOR } from './metodo-core.mjs';
import { formatoMoneda } from '../metodo/meta-cifras.mjs';
import { modoSimuladorDe } from '../metodo/numeros-negocio.mjs';
import { sumarDias } from './modelo.mjs';

export const LECTURA_VALE_MS = 3 * 3600e3; // la lectura por ventanas se reusa 3 h (× el ritmo del freno de Meta)
export const FRESCO_MINIMO_MS = 10 * 60e3; // «léelo ahora» como mucho cada 10 min: la cuota de Meta es del negocio entero

const leerJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) ?? d; } catch { return d; } };
function escribirJSON(f, v) { fs.mkdirSync(path.dirname(f), { recursive: true }); const tmp = `${f}.tmp-${process.pid}`; fs.writeFileSync(tmp, JSON.stringify(v)); renombrar(tmp, f); }

/**
 * @param {object} o
 * @param {string} o.dir   data/anuncios
 * @param {object} o.sync  el sincronizador (listo, hoy, filas, historial, cuenta)
 * @param {object} o.ads   meta-ads (ventanas3q)
 * @param {object} [o.meta] el cliente de Meta (uso().ritmo)
 * @param {Function} [o.empresa] () → el nombre de la empresa
 */
export function crearMetodo({ dir, sync, ads, meta = null, empresa = () => '', ahora = () => Date.now() }) {
  const F = { metodo: path.join(dir, 'metodo.json'), lectura: path.join(dir, 'revision3q.json'), cuenta: path.join(dir, 'cuenta.json') };
  let leyendo = null;
  const estado = () => { const e = leerJSON(F.metodo, {}); return e && typeof e === 'object' ? e : {}; };
  const guardado = () => leerJSON(F.cuenta, null);
  const tasa = (e = estado()) => (Number(e.tasaCierre) > 0 && Number(e.tasaCierre) <= 100 ? Number(e.tasaCierre) : undefined);
  const moneda = () => guardado()?.cuenta?.currency || 'USD';
  const diarias30 = () => { const h = sync.hoy(); return sync.filas(sumarDias(h, -30), sumarDias(h, -1)); };

  /** Las filas por ventana: la lectura guardada si es de hoy; si no, las diarias sumadas. */
  function filasActuales() {
    const l = leerJSON(F.lectura, null), h = sync.hoy();
    if (l?.filas?.campaign && l.hoy === h) return { lectura: l, filas: l.filas };
    return { lectura: null, filas: filasDeDiarias(diarias30(), ventanasDe(h)) };
  }

  /** Lee de Meta las tres ventanas (UN lote). Una sola lectura a la vez; si falla, la revisión sigue con lo diario y dice por qué. */
  async function leerVentanas({ fresco = false } = {}) {
    const l = sync.listo(); if (!l.ok) return { ok: false, motivo: l.motivo };
    const previa = leerJSON(F.lectura, null), h = sync.hoy(), ritmo = Number(meta?.uso?.()?.ritmo) || 1;
    const edad = previa?.at ? ahora() - Date.parse(previa.at) : Infinity;
    if (previa?.hoy === h && edad < (fresco ? FRESCO_MINIMO_MS : LECTURA_VALE_MS * ritmo)) return { ok: true, lectura: previa, reusada: true };
    if (leyendo) return leyendo;
    leyendo = (async () => {
      try {
        const r = await ads.ventanas3q(sync.cuenta?.() || guardado()?.cuenta?.id, ventanasDe(h));
        const nueva = { at: new Date(ahora()).toJSON(), hoy: h, ...r };
        escribirJSON(F.lectura, nueva);
        return { ok: true, lectura: nueva };
      } catch (e) { return { ok: false, motivo: String(e?.message || e).slice(0, 300) }; } finally { leyendo = null; }
    })();
    return leyendo;
  }

  /** La ficha de números del negocio, calculada con lo real de 30 días si se sabe. */
  function negocio() {
    const e = estado(), { filas } = filasActuales();
    return fichaNegocio(e.negocio || {}, { lectura: lecturaDe(filas.campaign?.[30] ?? []), tasaDefecto: tasa(e), moneda: moneda() });
  }

  /** Guarda los números (limpios). `antes`: el `actualizado` que leyó quien guarda; si otra persona guardó entremedias, 409. */
  function guardarNegocio(nuevo, { antes = undefined, por = '' } = {}) {
    const e = estado();
    if (antes !== undefined && (e.negocio?.actualizado || null) !== (antes || null)) return { status: 409, cuerpo: { error: 'otra persona guardó los números mientras los editabas: vuelve a abrirlos', motivo: 'conflicto' } };
    const n = limpiarNegocio({ ...nuevo, actualizado: new Date(ahora()).toJSON(), por });
    escribirJSON(F.metodo, { ...e, negocio: n, actualizado: n.actualizado });
    return { status: 200, cuerpo: { ok: true, negocio: negocio() } };
  }

  function guardarEtapas(cambios = {}) {
    const e = estado(), et = { ...limpiarEtapas(e.etapas) };
    for (const [id, etapa] of Object.entries(cambios || {}).slice(0, 50)) { if (!/^\d{1,30}$/.test(id)) continue; if (ETAPAS_REVISION.some((x) => x.id === etapa)) et[id] = etapa; else delete et[id]; }
    escribirJSON(F.metodo, { ...e, etapas: et });
    return et;
  }

  function guardarManual({ umbrales = undefined, tasaCierre = undefined } = {}) {
    const e = estado(), sig = { ...e };
    if (umbrales !== undefined) sig.umbrales = limpiarUmbrales3q(umbrales);
    if (tasaCierre !== undefined) { const t = Number(String(tasaCierre).replace(',', '.')); if (t > 0 && t <= 100) sig.tasaCierre = Math.round(t * 100) / 100; else delete sig.tasaCierre; }
    escribirJSON(F.metodo, sig);
    return { umbrales: limpiarUmbrales3q(sig.umbrales), tasaCierre: sig.tasaCierre ?? TASA_CIERRE_DEFECTO };
  }

  /** La revisión 3Q. `leer`: intenta la lectura por ventanas (si no, usa la guardada o lo diario). `marcar`: apunta que el dueño la miró. */
  async function revision({ leer = true, fresco = false, costoMax = 0, marcar = false } = {}) {
    const g = guardado(), l = sync.listo();
    if (!g?.cuenta) return { configurado: false, motivo: l.ok ? 'Todavía no se ha leído la cuenta publicitaria: abre Anuncios y pulsa «Leer de Meta».' : l.motivo, campanas: [] };
    let aviso = '';
    if (leer && l.ok) { const r = await leerVentanas({ fresco }); if (!r.ok) aviso = `No se pudo leer de Meta ahora (${r.motivo}).`; }
    const e = estado(), { lectura } = filasActuales(), h = sync.hoy();
    const r = armarRevision({ guardado: g, lectura, diarias: lectura ? [] : diarias30(), hoy: h, negocio: e.negocio || {}, etapas: e.etapas || {}, umbrales: e.umbrales || {},
      tasaDefecto: tasa(e), cambios: cambiosDelHistorial(sync.historial()), costoMax, empresa: empresa() });
    if (marcar) escribirJSON(F.metodo, { ...estado(), revisadaAt: new Date(ahora()).toJSON() });
    return { configurado: true, ...r, revisadaAntes: e.revisadaAt || null, avisoLectura: [r.avisoLectura, aviso].filter(Boolean).join(' ') };
  }

  /** Lo que leen Dimitri, los agentes y el asistente. No llama a Meta salvo que la lectura esté vieja (y entonces, un lote). */
  async function texto(que = 'negocio', o = {}) {
    if (que === 'revision') { const r = await revision(o); return r.configurado ? textoRevision(r) : `Revisión 3Q: ${r.motivo}`; }
    const f = negocio();
    if (que === 'ciclo') return textoCiclo(o.tipo || o.destino ? cicloDe(o.tipo || f.negocio.tipo, o.destino || f.negocio.destino, { cuenta: o.cuenta || f.negocio.cuenta }) : f.ciclo);
    return textoNegocio(f);
  }

  /** UNA línea para el resumen de anuncios que Dimitri lleva siempre delante (sin llamar a Meta). */
  function linea() {
    const f = negocio(), m = f.magico, d = (v) => (m.unidad === 'veces' ? String(Math.round(v * 100) / 100).replace('.', ',') : formatoMoneda(v, f.moneda));
    if (m.objetivo === null && m.equilibrio === null) return 'Método de campañas: faltan los números del negocio (ticket, costos, % de la venta que se invierte), así que no hay número mágico y cada campaña solo se compara con su propio mes. El dueño los guarda en Anuncios → Método.';
    const partes = [m.objetivo !== null ? `objetivo ${d(m.objetivo)}` : '', m.equilibrio !== null ? `equilibrio ${d(m.equilibrio)}` : '', m.real !== null ? `real de 30 días ${d(m.real)}` : ''].filter(Boolean);
    return `Método de campañas · número mágico (${m.metrica.toLowerCase()}): ${partes.join(' · ')}.${m.alarma ? ' ALARMA: ' + m.textoAlarma : ''} Qué hacer con cada campaña: la revisión 3Q.`;
  }

  /** Una cuenta del simulador. Sin `entradas`, las que la cuenta hizo en 30 días (lo que haya). */
  function simulacion({ modo = '', entradas = null } = {}) {
    const f = negocio(), m = modo || modoSimuladorDe(f.negocio.destino);
    return textoSimulacion(m, { ...(m === f.simulador.modo ? f.simulador.entradas : {}), ...(entradas || {}) }, f.moneda);
  }

  /** /api/anuncios/metodo[/…]. → true si la atendió. */
  async function rutas(req, res, url, { json, body }) {
    const p = url.pathname, M = req.method;
    if (p !== '/api/anuncios/metodo' && !p.startsWith('/api/anuncios/metodo/')) return false;
    const sub = p.slice('/api/anuncios/metodo'.length).replace(/^\//, '');
    const b = M === 'GET' ? {} : await body(req).catch(() => ({}));
    const quien = quienDe(b?.por ?? url.searchParams.get('por') ?? undefined);
    const no = (code, error) => (json(res, code, { error, motivo: error }), true);
    if (quien === 'otro') return no(403, 'quién pide no se reconoce');
    if (M === 'GET') {
      if (!sub) { const f = negocio(); return json(res, 200, { negocio: f, texto: textoNegocio(f), etapas: limpiarEtapas(estado().etapas), manual: guardarManualLeer() }), true; }
      if (sub === 'revision') {
        const r = await revision({ fresco: url.searchParams.get('fresco') === '1' && quien !== 'agente', costoMax: Number(url.searchParams.get('costo')) || 0, marcar: url.searchParams.get('marcar') === '1' && quien === 'dueno' });
        return json(res, 200, { ...r, texto: r.configurado ? textoRevision(r) : `Revisión 3Q: ${r.motivo}` }), true;
      }
      if (sub === 'ciclo') {
        const q = url.searchParams, f = negocio(), n = f.negocio;
        const c = q.get('tipo') || q.get('destino') ? cicloDe(q.get('tipo') || n.tipo, q.get('destino') || n.destino, { cuenta: q.get('cuenta') || n.cuenta }) : f.ciclo;
        return json(res, 200, { ciclo: c, texto: textoCiclo(c) }), true;
      }
      if (sub === 'simular') { // leerlo por GET (Dimitri y los agentes): ?modo=&gasto=&cpm=&frecuencia=&ctrUnico=&pctConversion=…
        const q = url.searchParams, entradas = Object.fromEntries(Object.keys(CAMPOS_SIMULADOR).filter((k) => q.get(k)).map((k) => [k, q.get(k)]));
        return json(res, 200, simulacion({ modo: q.get('modo') || '', entradas })), true;
      }
      if (sub === 'texto') { const q = url.searchParams; return json(res, 200, { texto: await texto(q.get('que') || 'negocio', { tipo: q.get('tipo') || '', destino: q.get('destino') || '', cuenta: q.get('cuenta') || '', leer: true }) }), true; }
      return no(404, 'no existe');
    }
    if (quien === 'agente') return no(403, 'los agentes leen los números y la revisión; guardarlos es del dueño');
    if (M === 'POST' && sub === 'simular') { const r = simulacion({ modo: String(b?.modo || ''), entradas: b?.entradas && typeof b.entradas === 'object' ? b.entradas : null }); return json(res, 200, r), true; }
    if (M === 'PUT' && sub === 'etapas') { if (quien !== 'dueno' && quien !== 'dimitri') return no(403, 'la etapa de una campaña la escoge el dueño'); return json(res, 200, { ok: true, etapas: guardarEtapas(b?.etapas || b) }), true; }
    if (quien !== 'dueno') return no(403, 'los números del negocio los guarda el dueño (Dimitri puede proponerlos con una tarjeta)');
    if (M === 'PUT' && sub === 'negocio') { const r = guardarNegocio(b?.negocio || {}, { antes: b?.antes, por: String(b?.nombre || '').slice(0, 80) }); return json(res, r.status, r.cuerpo), true; }
    if (M === 'PUT' && sub === 'manual') return json(res, 200, { ok: true, ...guardarManual({ umbrales: b?.umbrales, tasaCierre: b?.tasaCierre }) }), true;
    return no(405, 'método no admitido');
  }
  const guardarManualLeer = () => { const e = estado(); return { umbrales: limpiarUmbrales3q(e.umbrales), tasaCierre: e.tasaCierre ?? TASA_CIERRE_DEFECTO }; };

  return { linea, negocio, guardarNegocio, guardarEtapas, guardarManual, revision, texto, simulacion, leerVentanas, rutas, estado };
}
