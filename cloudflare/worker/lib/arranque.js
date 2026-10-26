// «Preparar desde mi web» (serve.mjs → companyBootstrap), en la nube. El jefe de Operaciones lee la web de la empresa (esta vez DE VERDAD: el Worker la trae, con protección SSRF, ver arranque-web.mjs)
// y lo que cuenta el dueño, y arma una PROPUESTA: las notas de 00-Empresa (perfil, oferta, voz, faq, clientes, contexto-marketing), las instrucciones de cada jefe y las cifras.
// NADA se escribe hasta que el dueño la revisa (arranque-core.mjs explica cómo se compara con lo que el Cerebro ya tiene): aquí se guarda la propuesta, se aplica lo que el dueño decide y se deshace.
import { pickJSON } from '../../../sub-core.mjs';
import { injectionIn } from '../../../safety.mjs';
import { leerWeb, textoParaModelo, urlSegura } from '../../../arranque-web.mjs';
import { sistemaArranque, pedidoArranque, armarPropuesta, planDeAplicar, NOTAS, GRUPO } from '../../../arranque-core.mjs';
import { guardarNotas } from './cerebro.js';
import { guardarAgente } from './tareas/roster.js';
import { leerDoc, guardarDoc, mutarDoc, guardarFila, leerFila, borrarFila } from './almacen.js';
import { limpiarCifras, leerCifras, leerPorConfirmar } from './negocio.js';
import { avisar } from './avisos.js';
import { preguntar } from './dimitri/modelo.js';
import { limpiarSecretos } from './secretos.js';

export { NOTAS, GRUPO };
export const DOC_PROPUESTA = 'arranque.propuesta', DOC_ESTADO = 'arranque.estado', DOC_APLICADAS = 'arranque.aplicadas', COLECCION_RESPALDOS = 'notas-respaldo';
const MAX_POR_HORA = 6, EN_MARCHA_MS = 6 * 60 * 1000, GUARDADAS = 3;

/** ¿Se puede empezar otra lectura? Una a la vez y como mucho MAX_POR_HORA por hora (cada una cuesta una llamada al modelo). → { ok } o { ok:false, motivo } */
export async function pedirTurno(db, ahora = Date.now()) {
  let r = { ok: true };
  await mutarDoc(db, DOC_ESTADO, { corriendo: 0, recientes: [] }, (d) => {
    const recientes = (d.recientes || []).filter((t) => ahora - t < 3600e3);
    if (d.corriendo && ahora - d.corriendo < EN_MARCHA_MS) { r = { ok: false, motivo: 'Ya estoy leyendo una web: espera a que termine (unos minutos).' }; return { ...d, recientes }; }
    if (recientes.length >= MAX_POR_HORA) { r = { ok: false, motivo: `Ya leí ${MAX_POR_HORA} veces en la última hora (cada lectura gasta una llamada al modelo): prueba más tarde.` }; return { ...d, recientes }; }
    return { corriendo: ahora, recientes: [...recientes, ahora], ultimoError: null };
  });
  return r;
}
const soltarTurno = (db, error = null) => mutarDoc(db, DOC_ESTADO, { corriendo: 0, recientes: [] }, (d) => ({ ...d, corriendo: 0, ultimoError: error }));

export async function estadoLectura(db, ahora = Date.now()) {
  const e = (await leerDoc(db, DOC_ESTADO, { corriendo: 0 })).valor;
  return { corriendo: !!e.corriendo && ahora - e.corriendo < EN_MARCHA_MS, error: e.ultimoError || null };
}
export const leerPropuesta = async (db) => (await leerDoc(db, DOC_PROPUESTA, null)).valor;

async function notasActuales(db) {
  const { results } = await db.prepare("select nombre, grupo, texto, actualizado from notas where oficina = 0 and nombre not like '%.backup-%'").all();
  return results;
}
const lideresDe = (C) => Object.fromEntries(Object.keys(C.depts).map((d) => { const L = C.lider(d); return [d, L ? { id: L.id, nombre: L.name, brief: L.brief || '' } : null]; }).filter(([, v]) => v));

/** Lee la web y lo que cuenta el dueño, pregunta al modelo y GUARDA LA PROPUESTA (no toca el Cerebro). → { propuesta } o { error } */
export async function prepararEmpresa({ env, db, cfg, C, url, about, fetchFn }) {
  const hoy = Date.now();
  try {
    await avisar(db, { kind: 'onboard', text: url ? `Leyendo ${url} y lo que me contaste para preparar la propuesta… tarda un momento. Todavía no cambio nada.` : 'Leyendo lo que me contaste para preparar la propuesta… tarda un momento. Todavía no cambio nada.' });
    let web = null; const avisos = [];
    if (url) {
      web = await leerWeb(url, { fetchFn: env.__pruebas?.fetchWeb || fetchFn || ((...a) => fetch(...a)) });
      if (!web.ok) { if (!about) { const motivo = limpiarSecretos(web.motivo || 'No pude leer la web.'); await soltarTurno(db, motivo); await avisar(db, { kind: 'onboard', level: 'error', text: motivo }); return { error: motivo }; } avisos.push({ nivel: 'medio', texto: `${web.motivo} Usé solo lo que me contaste.` }); web = null; }
    }
    const { text } = await preguntar({ env, db, cfg, fetchFn }, sistemaArranque(cfg.name || 'PanaClaw'), pedidoArranque(url, about, web ? textoParaModelo(web.paginas) : ''), { maxTokens: 6000, tipo: 'arranque', model: 'sonnet' });
    const j = pickJSON(text).j || {};
    const propuesta = armarPropuesta({ j, url, about, web, notasActuales: await notasActuales(db), lideres: lideresDe(C), cifrasActuales: await leerCifras(db), porConfirmar: await leerPorConfirmar(db), ahora: hoy });
    propuesta.avisos.unshift(...avisos);
    const orden = injectionIn(JSON.stringify(j)); // lo que escribió el modelo también se mira: si trae órdenes escondidas, el dueño lo ve antes de aplicar nada
    if (orden) propuesta.avisos.unshift({ nivel: 'alto', texto: `Lo que salió trae órdenes escondidas para un asistente (${orden}). Revísalo con cuidado y no apliques lo que no reconozcas.` });
    if (!propuesta.notas.length) { await soltarTurno(db, 'sin notas'); await avisar(db, { kind: 'onboard', level: 'warn', text: 'No saqué nada que proponer: la web casi no tenía texto o lo que contaste era muy poco. Cuéntame más en «Lo que la web no dice».' }); return { error: 'sin notas' }; }
    await guardarDoc(db, DOC_PROPUESTA, propuesta);
    await soltarTurno(db, null);
    const r = propuesta.resumen;
    await avisar(db, { kind: 'onboard', level: r.conflictos ? 'warn' : 'info', text: `Listo: leí ${web ? web.paginas.length + ' página(s) de tu web' : 'lo que me contaste'} y preparé ${r.notas} nota(s) (${r.nuevas} nuevas, ${r.distintas} distintas de las que ya tienes${r.conflictos ? `, ${r.conflictos} dato(s) en conflicto con tu Cerebro` : ''}). No cambié nada: revísalas en Ajustes → Preparar desde mi web → «Revisar lo que leí».` });
    return { propuesta };
  } catch (e) {
    const m = limpiarSecretos(String(e?.message || e)).slice(0, 200);
    await soltarTurno(db, m).catch(() => {});
    await avisar(db, { kind: 'onboard', level: 'error', text: 'No pude preparar la propuesta: ' + m });
    return { error: m };
  }
}

/** Aplica lo que el dueño decidió. Idempotente: una propuesta aplicada no se aplica dos veces. → { ok, escritas, respaldadas, porConfirmar, briefs, saltadas } o { error, status } */
export async function aplicarPropuesta(db, { id, decisiones = {}, quien = '', C, ahora = Date.now() }) {
  const prop = await leerPropuesta(db);
  if (!prop || (id && prop.id !== id)) return { error: 'Esa propuesta ya no está: vuelve a leer la web.', status: 404 };
  if (prop.estado === 'aplicada') return { error: 'Esa propuesta ya se aplicó. Si te equivocaste, usa «Deshacer».', status: 409 };
  if (prop.estado === 'descartada') return { error: 'Esa propuesta se descartó.', status: 409 };
  const actuales = await notasActuales(db), lideres = lideresDe(C);
  const plan = planDeAplicar(prop, decisiones, { notasActuales: actuales, lideres, ahora });
  const respaldos = [];
  for (const r of plan.respaldar) { await guardarFila(db, COLECCION_RESPALDOS, r.como, { nombre: r.nombre, grupo: r.grupo, texto: r.texto, at: ahora, motivo: 'reemplazada por «Preparar desde mi web»' }, ahora); respaldos.push(r.como); }
  const nuevas = plan.escribir.filter((n) => !actuales.some((a) => a.nombre === n.nombre)).map((n) => n.nombre);
  if (plan.escribir.length) await guardarNotas(db, plan.escribir.map((n) => ({ nombre: n.nombre, grupo: n.grupo, oficina: 0, texto: n.texto, actualizado: ahora, tarea: null })));
  let briefs = 0;
  for (const b of plan.briefs) { const r = await guardarAgente(db, b.id, { brief: b.texto }); if (!r.problems?.length) briefs++; }
  const pend = limpiarCifras([...plan.porConfirmar, ...plan.cifras].map((c) => ({ ...c, note: c.note || 'desde la web: confírmalo' })));
  let porConfirmar = 0;
  if (pend.length) await mutarDoc(db, 'cifras.porconfirmar', { items: [] }, (d) => { const cur = Array.isArray(d.items) ? d.items : []; for (const c of pend) { const i = cur.findIndex((x) => x.name.toLowerCase() === c.name.toLowerCase()); if (i >= 0) cur[i] = c; else { cur.push(c); porConfirmar++; } } return { items: cur }; });
  const registro = { id: prop.id, at: ahora, por: quien, escritas: plan.escribir.map((n) => n.nombre), nuevas, respaldos, briefs: plan.briefs.map((b) => b.id), porConfirmar: pend.map((c) => c.name) };
  await mutarDoc(db, DOC_APLICADAS, { lista: [] }, (d) => ({ lista: [registro, ...(d.lista || [])].slice(0, GUARDADAS) }));
  await guardarDoc(db, DOC_PROPUESTA, { ...prop, estado: 'aplicada', aplicada: { at: ahora, por: quien, escritas: registro.escritas, saltadas: plan.saltadas } });
  await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(new Date(ahora).toISOString(), 'arranque', quien, JSON.stringify({ propuesta: prop.id, escritas: registro.escritas.length, respaldadas: respaldos.length, porConfirmar: pend.length, briefs })).run().catch(() => {});
  await avisar(db, { kind: 'onboard', text: `Apliqué lo que decidiste: ${plan.escribir.length} nota(s) escritas${respaldos.length ? ` (${respaldos.length} anterior(es) quedaron respaldadas)` : ''}, ${briefs} jefe(s) con instrucciones nuevas y ${pend.length} cifra(s) esperando tu confirmación. Puedes deshacerlo.` });
  return { ok: true, escritas: registro.escritas, respaldadas: respaldos.length, porConfirmar: pend.length, briefs, saltadas: plan.saltadas };
}

/** Deshace la última aplicación: las notas nuevas se quitan, las reemplazadas vuelven. Las instrucciones y las cifras ya dichas se quedan (son del dueño). */
export async function deshacerAplicacion(db, { id, quien = '', ahora = Date.now() }) {
  const lista = (await leerDoc(db, DOC_APLICADAS, { lista: [] })).valor.lista || [];
  const reg = lista.find((r) => r.id === id) || (!id ? lista[0] : null);
  if (!reg) return { error: 'No hay nada que deshacer.', status: 404 };
  if (reg.deshecha) return { error: 'Eso ya se deshizo.', status: 409 };
  let vueltas = 0;
  for (const como of reg.respaldos || []) {
    const r = await leerFila(db, COLECCION_RESPALDOS, como); if (!r) continue;
    await guardarNotas(db, [{ nombre: r.nombre, grupo: r.grupo, oficina: 0, texto: r.texto, actualizado: ahora, tarea: null }]); vueltas++;
  }
  for (const n of reg.nuevas || []) await db.prepare('delete from notas where nombre = ? and oficina = 0').bind(n).run();
  await mutarDoc(db, DOC_APLICADAS, { lista: [] }, (d) => ({ lista: (d.lista || []).map((r) => (r.id === reg.id ? { ...r, deshecha: ahora } : r)) }));
  const prop = (await leerDoc(db, DOC_PROPUESTA, null)).valor; if (prop && prop.id === reg.id) await guardarDoc(db, DOC_PROPUESTA, { ...prop, estado: 'lista', aplicada: null });
  await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(new Date(ahora).toISOString(), 'arranque-deshacer', quien, JSON.stringify({ propuesta: reg.id, vueltas, quitadas: (reg.nuevas || []).length })).run().catch(() => {});
  return { ok: true, restauradas: vueltas, quitadas: (reg.nuevas || []).length };
}

export async function descartarPropuesta(db, { id }) {
  const prop = await leerPropuesta(db);
  if (!prop || (id && prop.id !== id)) return { error: 'Esa propuesta ya no está.', status: 404 };
  if (prop.estado === 'aplicada') return { error: 'Esa propuesta ya se aplicó.', status: 409 };
  await guardarDoc(db, DOC_PROPUESTA, { ...prop, estado: 'descartada' });
  return { ok: true };
}
export { urlSegura, borrarFila };

/** Las notas que «Preparar desde mi web» reemplazó se pueden recuperar 30 días (Deshacer); después se borran. Corre cada hora (modulos/restablecer.js). → cuántas se borraron */
export async function podarRespaldosDeNotas(db, ahora = Date.now()) {
  const r = await db.prepare("delete from filas where rowid in (select rowid from filas where coleccion = ? and orden < ? limit 500)").bind(COLECCION_RESPALDOS, ahora - 30 * 864e5).run();
  return r.meta?.changes ?? 0;
}
