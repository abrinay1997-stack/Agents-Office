// Arma, para UNA petición (o una vuelta del cron), todo lo que Contenido necesita: los ajustes, las piezas, la cola, los conductores, Analíticas y el controlador de rutas
// (contenido/rutas-nucleo.mjs, el mismo de la oficina local). Un Worker no recuerda nada entre peticiones, así que esto se vuelve a armar cada vez, y lo que cuesta
// (leer los ajustes, las cuentas de Meta, la agenda de Instagram) se hace una sola vez y solo si hace falta.
//
// Tope de llamadas: un Worker del plan gratuito puede hacer ~50 llamadas externas y ~50 consultas a D1 por invocación (el de pago, 1.000). Todo lo que habla con Meta
// pasa por un contador (`llamadas`) y las vueltas se cortan con `puedeSeguir()` antes de pasarse; lo que falta sigue en la próxima. `CONTENIDO_MAX_LLAMADAS` lo cambia.
import { crearControlador } from '../../../../contenido/rutas-nucleo.mjs';
import { crearMejorHoraNucleo } from '../../../../contenido/mejor-hora-core.mjs';
import { informeDelMes } from '../../../../contenido/informe.mjs';
import { resumenAnaliticas } from '../../../../contenido/resumen-analiticas.mjs';
import { emparejar } from '../../../../src/contenido-publicadas.js';
import { listaCuentas, porDefecto as porDefectoCuentas, motivoNoPublica } from '../../../../src/contenido-cuentas.js';
import { leerConfig } from './config.js';
import { crearAlmacenD1, medidaDeR2, medioExisteEnR2 } from './piezas.js';
import { crearProgramadorD1, crearColaD1, tomarCandado, soltarCandado, candadoVigente } from './cola.js';
import { publica } from '../../../../contenido/programador-core.mjs';
import { crearConductoresD1, CLAVES } from './conductores.js';
import { crearAnaliticasD1 } from './analiticas.js';
import { crearGuardadosD1, crearPlantillasD1 } from './textos.js';
import { crearMejorar } from './redaccion.js';
import { aprenderDeLoPublicado, llevarIndicadoresMeta, indicadoresEstado } from './aprender.js';
import { describirZona } from '../zona.js';
import { leerDoc, mutarDoc } from '../almacen.js';
import { emitirAviso } from '../avisos.js';
import { crearPresupuesto } from './presupuesto.js';

/** Un aviso para el dueño (la lista `notices`, la misma forma que data/notices.json: lo último 200; el mismo problema se dice una vez cada 6 horas). */
export function avisarD1(db, ahora = Date.now) {
  return (kind, text, { level = 'info', task = null, key = null } = {}) => {
    const p = emitirAviso(db, { kind, level, text, task, key }, { ahora: ahora(), destino: 'doc', maxTexto: 600, largoId: 8 }).catch(() => {});
    return p;
  };
}
/** Una línea de la auditoría (lo que se entregó, adoptó o falló): sin tokens, sin textos de piezas. */
export const auditarD1 = (db, ahora = Date.now) => a => db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(new Date(ahora()).toISOString(), 'contenido', 'sistema', JSON.stringify(a)).run().catch(() => {});

export async function crearServicio({ env, db, ahora = Date.now, fetchFn = (...a) => fetch(...a), inyectados = {}, config: configDada = null, presupuesto = null, waitUntil = null } = {}) {
  const config = configDada || await leerConfig(db), cfg = () => config;
  const pres = presupuesto || crearPresupuesto(env); // llamadas externas, sentencias de D1 y operaciones de R2 de esta invocación (ver presupuesto.js)
  const contado = (...a) => { pres.externa(); return fetchFn(...a); };
  const puedeSeguir = pres.puedeSeguir;
  const pendientes = [];
  const avisar = avisarD1(db, ahora), auditarFila = auditarD1(db, ahora);
  const aviso = (t, o) => { pendientes.push(avisar('contenido', t, o)); };
  const auditar = a => { pendientes.push(auditarFila(a)); };

  let cambioMeta = false;
  const cond = crearConductoresD1({ env, db, fetchFn: contado, ahora, config: cfg, avisar: aviso, alCambiar: () => { cambioMeta = true; }, puedeSeguir, inyectados });
  await cond.cargar(); // las cuentas de Meta, su freno y la agenda de Instagram (3 lecturas)
  const cuentasMeta = () => { try { return cond.meta.estado().cuentas || []; } catch { return []; } };
  const almacen = crearAlmacenD1({
    db, ahora, medioExiste: inyectados.medioExiste || medioExisteEnR2(env.MEDIA), medida: inyectados.medida || medidaDeR2(env.MEDIA),
    cuentasPorDefecto: () => porDefectoCuentas(cuentasMeta(), config.metaPagina || ''),
    validarCuenta: id => { const l = cuentasMeta(); if (!l.length) return ''; return motivoNoPublica(l.find(x => x.id === id)); },
  });
  const programadorInterno = crearProgramadorD1({ db, almacen, conductor: cond.actual, porId: cond.porId, modo: () => config.modo, horasAntes: () => config.entregarHorasAntes, avisar: aviso, auditar, ahora, puedeSeguir, maxAcciones: pres.topeAcciones });
  const analit = crearAnaliticasD1({ db, bucket: env.MEDIA, meta: cond.meta, fetchFn: contado, ahora, puedeSeguir });
  const mejorHora = crearMejorHoraNucleo({ metricool: cond.metricool, metricas: analit, cache: { leer: async () => (await leerDoc(db, CLAVES.mejoresHoras, null)).valor, guardar: d => mutarDoc(db, CLAVES.mejoresHoras, {}, () => d) }, ahora });
  const mejorar = crearMejorar({ env, db, config: cfg, fetchFn });
  const guardados = crearGuardadosD1({ db, ahora }), plantillas = crearPlantillasD1({ db, ahora });

  const publicadas = async () => ({ ...(await analit.leer({ dias: 120 })), conectado: cond.meta.configurado() });
  /** La cola de una vez como búsqueda síncrona (para el informe, que pregunta por cada pieza). */
  const salidas = async () => { const e = (await crearColaD1(db).leer()).entradas; return id => publica(e[id]) || null; };
  async function informe(mes, { guardar = false, cuenta = '' } = {}) {
    const [y, mm] = mes.split('-').map(Number), hasta = `${mes}-${String(new Date(y, mm, 0).getDate()).padStart(2, '0')}`, cuentas = cond.meta.estado().cuentas || [];
    const r = informeDelMes({ mes, cuentas, cuenta, piezas: await almacen.listar({ desde: `${mes}-01`, hasta }), salidaDe: await salidas(), analiticas: await analit.leer({ dias: 180 }), bandeja: [], hora: await mejorHora.horas(config.redes) });
    if (!guardar) return r;
    const una = cuentas.find(c => c.id === r.cuenta), sufijo = una ? ' ' + String(una.usuario || una.nombre || una.externoId).replace(/[^\p{L}\p{N}._-]+/gu, '-').slice(0, 40) : '';
    const nombre = `${mes} redes${sufijo}`, texto = `---\ntipo: informe\nmes: ${mes}\n${una ? `cuenta: ${una.id}\n` : ''}creado: ${new Date(ahora()).toISOString()}\n---\n${r.texto}`;
    await db.prepare(`insert into notas (nombre, grupo, oficina, texto, bytes, actualizado, tarea) values (?,?,1,?,?,?,null)
      on conflict (nombre) do update set texto = excluded.texto, bytes = excluded.bytes, actualizado = excluded.actualizado`).bind(nombre, 'Agents Office', texto, new TextEncoder().encode(texto).length, ahora()).run();
    return { ...r, nota: `Agents Office/informes/${nombre}.md` };
  }
  async function analiticasTexto(dias, redes, cuenta = '') {
    return resumenAnaliticas(await analit.leer({ dias: Math.max(90, dias * 2) }), { dias, cuenta, cuentas: cond.meta.estado().cuentas || [], hora: await mejorHora.horas(redes) });
  }

  /**
   * UNA vuelta de la cola: entregar lo aprobado, el pulso de Meta (programar en Facebook, preparar y publicar en Instagram a su hora) y, si Meta publicó o falló algo, mirar la cola otra vez.
   * Tiene el candado «vuelta» (dos invocaciones a la vez no entregan ni publican dos veces); lo que se leyó antes de tenerlo se vuelve a leer.
   */
  async function vuelta({ pulso = true, solo = '' } = {}) {
    if (config.modo === 'apagado') return { ok: true, apagado: true, tick: { at: ahora(), acciones: 0, error: '' } };
    const dueno = 'vuelta:' + crypto.randomUUID();
    if (!(await tomarCandado(db, 'vuelta', dueno, 5 * 60e3, ahora))) return { ok: false, ocupada: true, tick: { at: ahora(), acciones: 0, error: 'otra vuelta está trabajando; esta espera a la próxima' } };
    try {
      await cond.cargar(); // con el candado en la mano: lo de Meta y la agenda se leen de nuevo (otra vuelta pudo cambiarlos)
      const tick = await programadorInterno.tick({ solo });
      let cambios = 0;
      if (pulso && config.modo === 'real') {
        const r = await cond.conductores.meta.pulso().catch(e => ({ cambios: 0, error: e.message }));
        cambios = r?.cambios || 0;
        if (cambioMeta) { cambioMeta = false; await programadorInterno.refrescar('meta'); }
      }
      return { ok: true, tick, cambios };
    } finally { await soltarCandado(db, 'vuelta', dueno).catch(() => {}); }
  }
  const programador = { ...programadorInterno, async tick(o = {}) { const r = await vuelta({ solo: o?.solo || '' }); return r.tick; } }; // lo que llama la página ("Entregar ya") pasa por el candado

  const controlador = crearControlador({
    almacen, notice: aviso, programador, metricool: cond.metricool, conductorMeta: () => (config.conductor === 'meta' ? cond.conductores.meta : null),
    mejorHora, informe, guardados, mejorar: mejorar.mejorar, publicadas, plantillas, analiticasTexto, quienLlena: mejorar.quien, ahora,
    cuentas: () => listaCuentas({ cuentas: cuentasMeta(), metaPagina: config.metaPagina || '', conductor: cond.actual().id }),
    ajustes: () => ({ publicarYa: config.publicarYa === true, departamentos: config.departamentos, modo: config.modo, conductor: cond.actual().id, zona: describirZona(config.zona, ahora()), redes: config.redes }),
    // Con ctx.waitUntil la respuesta sale ya y lo demás sigue detrás (y al terminar vacía lo pendiente); sin él (pruebas), se espera antes de contestar, en `vaciar()`.
    segundoPlano: p => { const q = Promise.resolve(p).catch(() => {}); if (!(waitUntil && waitUntil(q.then(() => vaciar())))) pendientes.push(q); },
    ...(inyectados.controlador || {}),
  });

  /** Lo que se hace tras una foto buena de Analíticas: los indicadores del dueño y aprender de lo publicado. */
  async function despuesDeFoto() {
    const d = await analit.leer({ dias: 180 });
    await llevarIndicadoresMeta({ db, serie: d.serie, publicaciones: d.publicaciones, ahora });
    const piezas = await almacen.listar({}), sal = await salidas(), ps = piezas.map(p => ({ ...p, salida: sal(p.id) }));
    const r = d.publicaciones?.length ? emparejar(ps, d.publicaciones) : { porPieza: {} };
    return aprenderDeLoPublicado({ db, piezas: ps, porPieza: r.porPieza, ahora });
  }

  async function vaciar() { await cond.vaciar(); await Promise.all(pendientes.splice(0)); }

  return {
    config, ahora, almacen, programador, vuelta, analit, mejorHora, guardados, plantillas, controlador, conductores: cond, indicadoresEstado: () => indicadoresEstado(db), despuesDeFoto,
    cambioMeta: () => cambioMeta, llamadas: () => pres.llamadas, consultas: () => pres.consultas, presupuesto: pres, puedeSeguir,
    /** Termina bien lo que quedó pendiente: lo que Meta anotó (freno, cuentas), los avisos y la auditoría. */
    vaciar,
  };
}
