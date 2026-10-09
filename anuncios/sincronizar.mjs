// ============================================================
// Agents Office — Anuncios de Meta, Fase A1 (8 oct 2026): traer de Meta lo que pinta el panel, con calma.
//
// Lo que trae (anuncios/meta-ads.mjs, solo lectura): la cuenta, las campañas, los conjuntos (con su aprendizaje), los anuncios (con
// su revisión y sus problemas) y los creativos, en UN lote; las cifras diarias por anuncio; y el alcance de cada rango aparte (las
// personas únicas no se suman día a día).
//
// Dónde lo deja (data/anuncios/, que no viaja por GitHub; nunca un token):
//   cuenta.json              la última estructura, con `sincronizadaAt`
//   cifras/AAAA-MM-DD.json   las filas de cada día (se reescriben: Meta corrige resultados durante días por la atribución)
//   alcance.json             el alcance de hoy, 7 días, 30 días y el mes, por nivel
//   estado.json              cuándo se leyó cada cosa, el último error
//   avisados.json            qué avisos ya se dieron (un anuncio rechazado se avisa UNA vez, no cada sondeo)
//   historial.jsonl          los cambios hechos desde la oficina (A2: los apunta anuncios/acciones.mjs con `anotar`)
//
// El ritmo (plan §4.1), multiplicado por `meta.uso().ritmo` (1, 2 desde el 75 % de la cuota, 4 desde el 90 %):
//   estructura cada 15 min con el panel abierto, 60 si no · cada 10 min mientras algo esté «en revisión» · cifras de lo activo
//   (hoy y ayer) cada hora · los últimos 37 días cada noche desde las 6:00 (el plan dice 28; 37 cubren la vista de 30 días y la
//   tendencia de 7 contra 7). Sin token o sin cuenta, no se llama a Meta. Con Meta pidiendo esperar (el freno), tampoco.
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { mensajeMeta } from '../contenido/meta.mjs';
import { idCuenta } from './meta-ads.mjs';
import { armarVista, fechaEn, horaEn, sumarDias, diasEntre, rangos, RANGOS, estadoTexto, cuentaEstado } from './modelo.mjs';

export const DIAS_NOCHE = 37, DIAS_GUARDADOS = 60, HORA_NOCHE = 6;
export const MIN = { estructuraAbierto: 15, estructura: 60, revision: 10, cifras: 60 };
export const PANEL_ABIERTO_MS = 3 * 60e3; // la página pide /api/anuncios?abierto=1 cada pocos segundos con el panel a la vista
const EN_REVISION = new Set(['PENDING_REVIEW', 'IN_PROCESS']);

const escribirJSON = (f, datos) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(datos)); fs.renameSync(f + '.tmp', f); };
const leerJSON = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) ?? def; } catch { return def; } };
const num = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/**
 * @param {object} o
 * @param {object} o.meta      contenido/meta.mjs (configurado, estado, uso)
 * @param {object} o.ads       anuncios/meta-ads.mjs
 * @param {string} o.dir       data/anuncios
 * @param {Function} o.ajustes () → cfg.anuncios (se lee cada vez: Ajustes lo cambia en caliente)
 * @param {object} o.defaults  { topeDiario, topeMensual, topeCampana } de settings.mjs → FIELDS
 * @param {Function} o.avisar  (texto, { level, key }) → notice() de serve.mjs (y de ahí a Telegram)
 */
export function crearSincronizador({ meta, ads, dir, ajustes = () => ({}), defaults = {}, ahora = () => Date.now(), avisar = () => {} }) {
  const F = { cuenta: path.join(dir, 'cuenta.json'), alcance: path.join(dir, 'alcance.json'), estado: path.join(dir, 'estado.json'), avisados: path.join(dir, 'avisados.json'), historial: path.join(dir, 'historial.jsonl'), cifras: path.join(dir, 'cifras') };
  let enMarcha = null, panelAt = 0;

  const aj = () => ajustes() || {};
  const cuenta = () => idCuenta(aj().cuenta);
  const topes = () => { const a = aj(), t = k => num(a[k]) ?? num(defaults[k]); return { diario: t('topeDiario'), mensual: t('topeMensual'), campana: t('topeCampana') }; };
  const guardado = () => leerJSON(F.cuenta, null);
  const estado = () => leerJSON(F.estado, {});
  const zona = () => guardado()?.cuenta?.timezone_name || null; // la de la cuenta (Meta cuenta los días en ella); sin leerla, la de la máquina
  const hoy = () => fechaEn(zona(), ahora());

  /** ¿Se puede leer? { ok, motivo } — el motivo, en palabras y con qué hacer. */
  function listo() {
    if (!meta.configurado()) return { ok: false, motivo: 'Meta no está conectada: falta la variable META_ACCESS_TOKEN (mira docs/conectar-meta.md).' };
    if (!cuenta()) return { ok: false, motivo: 'Falta la cuenta publicitaria: ponla en Ajustes → Anuncios → «Cuenta publicitaria de Meta» (act_…).' };
    const p = meta.estado()?.token?.permisos;
    if (Array.isArray(p) && !p.includes('ads_read') && !p.includes('ads_management')) return { ok: false, motivo: 'Al token le falta el permiso ads_read (o ads_management): genéralo de nuevo en Business Manager con la cuenta publicitaria asignada al usuario del sistema.' };
    return { ok: true, motivo: '' };
  }

  function escribirDias(desde, hasta, filas) {
    const porDia = new Map(diasEntre(desde, hasta).map(d => [d, []]));
    for (const f of filas) if (porDia.has(f.date_start)) porDia.get(f.date_start).push(f);
    const at = new Date(ahora()).toJSON();
    for (const [fecha, l] of porDia) escribirJSON(path.join(F.cifras, `${fecha}.json`), { fecha, filas: l, at });
    // lo de hace más de DIAS_GUARDADOS días se va (la copia diaria de data/ lo conserva 14 días más)
    const limite = sumarDias(hasta, -DIAS_GUARDADOS);
    try { for (const f of fs.readdirSync(F.cifras)) if (/^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f.slice(0, 10) < limite) fs.rmSync(path.join(F.cifras, f), { force: true }); } catch { /* sin carpeta */ }
  }
  function filasDesde(desde, hasta) {
    const out = [];
    for (const d of diasEntre(desde, hasta)) out.push(...(leerJSON(path.join(F.cifras, `${d}.json`), null)?.filas ?? []));
    return out;
  }

  /** La vista del panel para un rango (el contrato de /api/anuncios, sin lo de la conexión: lo pone rutas.mjs). */
  function vista(rango = '7d') {
    const h = hoy(), r = RANGOS.includes(rango) ? rango : '7d';
    return armarVista({ guardado: guardado(), filas: filasDesde(sumarDias(h, -DIAS_NOCHE + 1), h), alcances: leerJSON(F.alcance, {}), rango: r, hoy: h, topes: topes(), hayCifras: Boolean(estado().cifrasAt) });
  }

  // ------------------------------------------------------------ los avisos (una vez cada uno)
  function revisarAvisos() {
    const av = leerJSON(F.avisados, {}), vivos = new Set(), v = vista('hoy'), g = guardado();
    const una = (clave, texto, level) => { vivos.add(clave); if (av[clave]) return; av[clave] = new Date(ahora()).toJSON(); avisar(texto, { level, key: 'anuncios-' + clave }); };
    for (const c of v.campanas) for (const s of c.conjuntos) for (const a of s.anuncios) {
      if (a.estado === 'DISAPPROVED') una(`rechazado:${a.id}`, `📣 Meta rechazó el anuncio «${a.nombre}» (id ${a.id}, campaña «${c.nombre}»)${a.revision.length ? `: ${a.revision.join('; ')}` : '.'} Míralo en Anuncios (J).`, 'warn');
      if (a.estado === 'WITH_ISSUES') una(`problemas:${a.id}`, `📣 El anuncio «${a.nombre}» (id ${a.id}) tiene problemas y no se entrega${a.problemas.length ? `: ${a.problemas.join('; ')}` : '.'} Míralo en Anuncios (J).`, 'warn');
    }
    const st = num(g?.cuenta?.account_status), ce = cuentaEstado(st);
    if (st !== null && ce.nivel !== 'ok') una(`cuenta:${st}`, `📣 La cuenta publicitaria ${cuenta()} está: ${ce.texto.toLowerCase()}. Meta no entrega anuncios hasta que se arregle (Administrador de anuncios → Facturación).`, 'warn');
    const t = topes().diario, gh = v.gasto.hoy, dia = hoy();
    if (gh !== null && t !== null && (t > 0 ? gh > 0.9 * t : gh > 0)) una(`tope:${dia}`, `📣 El gasto de anuncios de hoy va en US$${gh.toFixed(2)}, más del 90 % del tope diario (US$${t.toFixed(2)}). Revisa Anuncios (J).`, 'warn');
    // un anuncio que dejó de estar rechazado (o la cuenta que se arregló) se puede volver a avisar si recae; los topes de otros días se olvidan
    for (const k of Object.keys(av)) if (!vivos.has(k) && (!k.startsWith('tope:') || k !== `tope:${dia}`)) delete av[k];
    escribirJSON(F.avisados, av);
  }

  // ------------------------------------------------------------ una lectura
  /**
   * Lee de Meta. `cifras: false` = solo la estructura (lo «en revisión», el panel abierto). Solo una a la vez: pedirla con otra en
   * marcha devuelve la misma. Un fallo no borra lo ya sabido: se apunta el motivo y lo de antes sigue en pantalla.
   */
  function sincronizar({ cifras = true, noche = false } = {}) {
    if (enMarcha) return enMarcha;
    const l = listo(); if (!l.ok) return Promise.resolve({ ok: false, motivo: l.motivo });
    const act = cuenta();
    enMarcha = (async () => {
      const st = estado();
      try {
        const e = await ads.estructura(act);
        escribirJSON(F.cuenta, { ...e, sincronizadaAt: new Date(ahora()).toJSON() });
        st.estructuraAt = ahora();
        if (cifras) {
          const h = hoy(), completo = noche || !st.cifrasAt, desde = completo ? sumarDias(h, -DIAS_NOCHE + 1) : sumarDias(h, -1);
          escribirDias(desde, h, await ads.cifrasDiarias(act, desde, h, { pixel: Boolean(String(aj().pixel || '').trim()) }));
          const R = rangos(h); escribirJSON(F.alcance, { at: new Date(ahora()).toJSON(), rangos: await ads.alcances(act, Object.fromEntries(RANGOS.map(k => [k, R[k]]))) });
          st.cifrasAt = ahora(); if (completo) st.nocheDia = h;
        }
        st.error = null; st.errorAt = null; st.sondeoAt = ahora();
        if (!fs.existsSync(F.historial)) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(F.historial, ''); }
        escribirJSON(F.estado, st);
        try { revisarAvisos(); } catch (err) { console.warn('anuncios (avisos):', err.message); }
        return { ok: true };
      } catch (err) {
        st.error = mensajeMeta(err).slice(0, 400); st.errorAt = ahora(); st.sondeoAt = ahora();
        escribirJSON(F.estado, st);
        return { ok: false, error: st.error };
      } finally { enMarcha = null; }
    })();
    return enMarcha;
  }

  /** Cada cuánto toca cada cosa ahora mismo (en minutos), con el freno de Meta ya aplicado. */
  function sondeo() {
    const ritmo = meta.uso?.().ritmo || 1, abierto = ahora() - panelAt < PANEL_ABIERTO_MS, st = estado();
    const enRevision = (guardado()?.anuncios || []).some(a => EN_REVISION.has(a.effective_status));
    const estructuraMin = (enRevision ? Math.min(MIN.revision, abierto ? MIN.estructuraAbierto : MIN.estructura) : abierto ? MIN.estructuraAbierto : MIN.estructura) * ritmo;
    const cifrasMin = MIN.cifras * ritmo;
    const prox = (at, m) => (at ? new Date(at + m * 60e3).toJSON() : null);
    return { ritmo, abierto, enRevision, estructuraMin, cifrasMin, proximaEstructura: prox(st.estructuraAt, estructuraMin), proximasCifras: prox(st.cifrasAt, cifrasMin), noche: st.nocheDia || null };
  }

  /** El reloj (serve.mjs lo llama cada minuto): decide si toca leer algo y lo lee. Nunca dos a la vez; nunca con Meta pidiendo esperar. */
  async function tick() {
    try {
      if (enMarcha || !listo().ok || meta.uso?.().frenadoHasta) return null;
      const s = sondeo(), st = estado(), t = ahora();
      const noche = horaEn(zona(), t) >= HORA_NOCHE && st.nocheDia !== hoy();
      const tocaCifras = !st.cifrasAt || t - st.cifrasAt >= s.cifrasMin * 60e3 || noche;
      const tocaEstructura = !st.estructuraAt || t - st.estructuraAt >= s.estructuraMin * 60e3;
      // tras un fallo, se espera al menos el ritmo de la estructura antes de volver a intentar
      if (st.errorAt && t - st.errorAt < s.estructuraMin * 60e3 && !noche) return null;
      if (tocaCifras) return await sincronizar({ cifras: true, noche });
      if (tocaEstructura) return await sincronizar({ cifras: false });
      return null;
    } catch (e) { console.warn('anuncios:', e.message); return null; }
  }

  /** Lo de la conexión, para la vista y para Estado: si se puede leer, la última lectura, el último error. */
  function conexion() {
    const l = listo(), st = estado(), g = guardado();
    return { configurado: l.ok, motivo: l.motivo, sincronizadaAt: g?.sincronizadaAt || null, cifrasAt: st.cifrasAt ? new Date(st.cifrasAt).toJSON() : null, sondeoAt: st.sondeoAt ? new Date(st.sondeoAt).toJSON() : null, error: st.error || null, sincronizando: Boolean(enMarcha) };
  }

  // ------------------------------------------------------------ A2 (9 oct 2026): lo que cambia anuncios/acciones.mjs

  const LISTA = { campana: 'campanas', conjunto: 'conjuntos', anuncio: 'anuncios' };
  /** Pone en cuenta.json un objeto recién leído de Meta (tras un cambio), sin esperar a la próxima lectura. Nunca un token: es lo de Graph. */
  function ponerObjeto(nivel, datos) {
    const k = LISTA[nivel], g = guardado(); if (!k || !g || !datos?.id) return false;
    const l = (g[k] ||= []), i = l.findIndex(x => x.id === datos.id);
    if (i >= 0) l[i] = { ...l[i], ...datos }; else l.push(datos);
    escribirJSON(F.cuenta, g); return true;
  }
  /** Una línea más en historial.jsonl: { at, quien, que, objeto: { id, nivel, nombre }, antes, despues, … }. */
  function anotar(e) { fs.mkdirSync(dir, { recursive: true }); fs.appendFileSync(F.historial, JSON.stringify({ at: new Date(ahora()).toJSON(), ...e }) + '\n'); }

  const historial = () => { try { return fs.readFileSync(F.historial, 'utf8').split('\n').filter(Boolean).map(x => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean).slice(-500).reverse(); } catch { return []; } };

  return { listo, sincronizar, tick, vista, sondeo, conexion, topes, historial, ponerObjeto, anotar, hoy, enMarcha: () => Boolean(enMarcha), abierto: () => { panelAt = ahora(); }, cuenta, estadoTexto };
}
