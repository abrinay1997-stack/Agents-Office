// Agents Office (6 oct 2026, plan M1) — el PROGRAMADOR: lleva lo aprobado al conductor (simulacro, Metricool) con su fecha y su hora,
// y luego mira qué pasó. La oficina decide; el conductor publica. Un tick por minuto (serve.mjs).
//
// Los candados (los tres, siempre):
//   1. la pieza está APROBADA por el dueño y no cambió después (su huella es la aprobada);
//   2. el modo lo deja: `apagado` no entrega nada; `simulacro` entrega al simulacro; `real`, al conductor elegido;
//   3. el conductor está listo (en `real`, con su key).
// Y además: nunca antes de un minuto tras aprobarla (para deshacer), ni antes de `entregarHorasAntes` horas de su salida (hasta entonces se
// edita sin límites), ni si su hora ya pasó o falta tan poco que no da tiempo (eso es «Vencida», con aviso).
//
// DOBLE TESTIGO (principio 4 de la propuesta): lo entregado se apunta en la cola (data/contenido/cola.json) Y en la cabecera de la nota
// (`entregada`). Si la cola se pierde, la nota impide entregar otra vez lo mismo: se adopta lo que ya está en el conductor.
//
// Si una pieza entregada se cambia o se devuelve (pierde el OK), se RETIRA del conductor; cuando se vuelva a aprobar, se entrega la nueva.
//   planear(piezas, entradas, opts) → [{ tipo, id, pieza? }]          (puro, con tests)
//   crearProgramador({ almacen, archivo, conductor, modo, horasAntes, avisar, auditar, ahora })
//     → { tick, estado, salidaDe, reintentar, cancelar, entregarYa, comprobar }
import fs from 'node:fs';
import path from 'node:path';
import { entregasDe, estadoGeneral } from './entrega.mjs';

export const GRACIA_MS = 60e3;            // tras aprobar, un minuto para deshacer antes de entregar
export const MARGEN_MS = 3 * 60e3;        // a menos de 3 minutos de su hora, ya no se entrega (no daría tiempo)
export const COMPROBAR_CADA_MS = 10 * 60e3;
export const COMPROBAR_HASTA_MS = 3 * 864e5; // después de 3 días sin noticias, se deja de preguntar
const ESPERAS = [60e3, 5 * 60e3, 15 * 60e3]; // reintentos de un fallo pasajero
const VIVAS = ['espera', 'entregando', 'en_red'];

const momentoDe = p => { const e = entregasDe(p); return e.length ? Math.min(...e.map(x => x.momento)) : NaN; };
const aprobadaVigente = p => p && p.estado === 'aprobada' && p.aprobada && !p.cambiadaTrasAprobar && p.fecha && p.hora;

/** Qué hay que hacer ahora, sin tocar nada. */
export function planear(piezas = [], entradas = {}, { ahora = Date.now(), horasAntes = 24 } = {}) {
  const acciones = [], vistas = new Set();
  for (const p of piezas) {
    if (!aprobadaVigente(p)) continue;
    vistas.add(p.id);
    const e = entradas[p.id], h = p.aprobada.huella, momento = momentoDe(p);
    if (!Number.isFinite(momento)) continue;
    if (e && ['publicada', 'parcial'].includes(e.estado)) continue; // lo que ya salió no se vuelve a publicar nunca: para repetirla, «Duplicar»
    if (e && VIVAS.includes(e.estado) && e.huella !== h) { acciones.push({ tipo: 'retirar', id: p.id, motivo: 'cambio' }); continue; } // la entregada era otra versión
    const reaprobada = e && !VIVAS.includes(e.estado) && Date.parse(p.aprobada.cuando || 0) > (e.historial?.at(-1)?.at || 0); // cancelada o fallida, y aprobada otra vez después
    if (!e || e.huella !== h || reaprobada) { acciones.push({ tipo: 'encolar', id: p.id, pieza: p }); continue; }
    if (e.estado === 'espera') {
      const listaDesde = Math.max(e.entregarDesde || 0, Date.parse(p.aprobada.cuando || 0) + GRACIA_MS, e.siguienteIntento || 0);
      if (momento - ahora < MARGEN_MS) acciones.push({ tipo: 'vencer', id: p.id });
      else if (ahora >= listaDesde) acciones.push({ tipo: 'entregar', id: p.id, pieza: p });
    }
  }
  for (const [id, e] of Object.entries(entradas)) {
    if (!vistas.has(id) && VIVAS.includes(e.estado)) { acciones.push({ tipo: e.remoto && Object.keys(e.remoto).length ? 'retirar' : 'soltar', id, motivo: 'sin-ok' }); continue; }
    if (e.estado === 'en_red' && ahora >= e.momento && ahora - (e.comprobadoAt || 0) >= COMPROBAR_CADA_MS && ahora < e.momento + COMPROBAR_HASTA_MS) acciones.push({ tipo: 'comprobar', id });
  }
  return acciones;
}

const leerJSON = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) ?? def; } catch { return def; } };
const escribirJSON = (f, d) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(d, null, 1)); fs.renameSync(f + '.tmp', f); };
const textoError = e => String(e?.message || e || 'error').slice(0, 400);

export function crearProgramador({ almacen, archivo, conductor, modo = () => 'simulacro', horasAntes = () => 24, avisar = () => {}, auditar = () => {}, ahora = Date.now }) {
  let enMarcha = null, ultimo = { at: 0, acciones: 0, error: '' };
  const leer = () => leerJSON(archivo, { entradas: {} });
  const guardar = d => escribirJSON(archivo, d);
  const titulo = p => p?.titulo || String(p?.texto || '').split('\n')[0].slice(0, 60) || 'sin título';
  const mover = (e, estado, extra = {}) => Object.assign(e, { estado, ...extra, historial: [...(e.historial || []).slice(-19), { at: ahora(), estado, ...(extra.error ? { error: extra.error } : {}) }] });

  async function entregar(d, p) {
    const e = d.entradas[p.id], c = conductor();
    const listo = c.listo(); if (!listo.ok) { if (e.error !== listo.motivo) { e.error = listo.motivo; avisar(`No puedo entregar «${titulo(p)}»: ${listo.motivo}`, { key: 'conductor-no-listo', level: 'warn' }); } return; }
    // doble testigo: si la nota ya dice que esta versión está en este conductor, se adopta (no se entrega otra vez)
    if (p.entregada && p.entregada.huella === e.huella && p.entregada.conductor === c.id && p.entregada.remoto) {
      mover(e, 'en_red', { conductor: c.id, remoto: p.entregada.remoto, error: '' }); auditar({ que: 'adoptada', pieza: p.id, conductor: c.id }); return;
    }
    mover(e, 'entregando', { conductor: c.id }); guardar(d);
    try {
      for (const en of entregasDe(p)) {
        if (e.remoto?.[en.clave]) continue; // ya entregada en un intento anterior: no se repite
        const r = await c.programar(en);
        e.remoto = { ...(e.remoto || {}), [en.clave]: { id: r.id, uuid: r.uuid || '', zona: r.zona || '', momento: en.momento, redes: en.redes, variante: en.variante } };
        for (const [red, s] of Object.entries(r.redes || {})) e.redes[en.variante === 'historia' ? `${red}·historia` : red] = s;
        guardar(d); // cada entrega se apunta en cuanto existe: un fallo después no la pierde
      }
      mover(e, 'en_red', { error: '', intentos: 0, entregadaAt: ahora() }); guardar(d);
      almacen.marcarEntregada(p.id, { conductor: c.id, huella: e.huella, remoto: e.remoto, cuando: new Date(ahora()).toJSON() });
      auditar({ que: 'entregada', pieza: p.id, conductor: c.id, redes: p.redes, momento: e.momento });
      if (c.id !== 'simulacro') avisar(`«${titulo(p)}» quedó programada en ${c.nombre} para ${new Date(e.momento).toLocaleString('es')}.`, { key: 'entregada-' + p.id });
    } catch (err) {
      e.intentos = (e.intentos || 0) + 1;
      const pasajero = err?.transitorio !== false && (err?.transitorio || err?.estado === 0 || err?.estado === 429 || err?.estado >= 500);
      if (pasajero && e.intentos <= ESPERAS.length) mover(e, 'espera', { error: textoError(err), siguienteIntento: ahora() + ESPERAS[e.intentos - 1] });
      else { mover(e, 'fallo', { error: textoError(err) }); avisar(`No se pudo programar «${titulo(p)}» en ${c.nombre}: ${textoError(err)}`, { key: 'fallo-' + p.id, level: 'error' }); }
      auditar({ que: 'fallo-entrega', pieza: p.id, conductor: c.id, error: textoError(err) });
      guardar(d);
    }
  }

  async function retirar(d, id, motivo) {
    const e = d.entradas[id]; if (!e) return;
    const c = conductor(), mismo = e.conductor === c.id ? c : null;
    try {
      if (e.remoto && Object.keys(e.remoto).length) {
        if (!mismo) throw new Error(`se entregó con ${e.conductor} y ahora el conductor es ${c.id}: quítala allí a mano`);
        for (const r of Object.values(e.remoto)) await mismo.retirar(r);
      }
      mover(e, 'cancelada', { remoto: {}, error: '' }); guardar(d);
      almacen.marcarEntregada(id, null);
      auditar({ que: 'retirada', pieza: id, conductor: e.conductor, motivo });
    } catch (err) {
      mover(e, 'fallo', { error: `No se pudo quitar de ${e.conductor}: ${textoError(err)}. Quítala allí a mano.` }); guardar(d);
      avisar(`Una pieza cambió o perdió tu OK, pero no se pudo quitar de ${e.conductor}: quítala allí a mano. (${textoError(err)})`, { key: 'retirar-' + id, level: 'error' });
    }
  }

  async function comprobar(d, id) {
    const e = d.entradas[id], c = conductor(); if (!e) return;
    e.comprobadoAt = ahora();
    if (e.conductor !== c.id) { guardar(d); return; }
    try {
      for (const r of Object.values(e.remoto || {})) {
        const s = await c.estado(r); if (!s) continue;
        for (const [red, x] of Object.entries(s.redes || {})) e.redes[r.variante === 'historia' ? `${red}·historia` : red] = x;
      }
      const g = estadoGeneral(e.redes), antes = e.estado;
      if (g !== 'en_red') mover(e, g, { publicadaAt: ahora() });
      guardar(d);
      if (antes !== e.estado) {
        const p = almacen.leer(id);
        if (g === 'publicada') avisar(`Publicada: «${titulo(p)}»${c.id === 'simulacro' ? ' (simulacro: no salió de verdad)' : ''}.`, { key: 'publicada-' + id });
        else avisar(`«${titulo(p)}» ${g === 'parcial' ? 'salió solo en algunas redes' : 'no se pudo publicar'}: ${Object.entries(e.redes).filter(([, x]) => x.estado === 'fallo').map(([r, x]) => `${r}${x.detalle ? ' (' + x.detalle + ')' : ''}`).join(', ')}.`, { key: 'publica-mal-' + id, level: 'error' });
        auditar({ que: g, pieza: id, conductor: c.id });
      }
    } catch (err) { e.error = textoError(err); guardar(d); }
  }

  /** Una vuelta: planea con lo que hay y hace cada acción, una tras otra. Nunca dos vueltas a la vez. */
  async function tick() {
    if (enMarcha) return enMarcha;
    enMarcha = (async () => {
      const m = modo(); if (m === 'apagado') { ultimo = { at: ahora(), acciones: 0, error: '' }; return ultimo; }
      const d = leer(); d.entradas ||= {};
      const desde = new Date(ahora() - 3 * 864e5); const ymd = `${desde.getFullYear()}-${String(desde.getMonth() + 1).padStart(2, '0')}-${String(desde.getDate()).padStart(2, '0')}`;
      const piezas = almacen.listar({ desde: ymd });
      const conocidas = new Map(piezas.map(p => [p.id, p]));
      for (const id of Object.keys(d.entradas)) if (!conocidas.has(id)) { const p = almacen.leer(id); if (p) conocidas.set(id, p); }
      const acciones = planear([...conocidas.values()], d.entradas, { ahora: ahora(), horasAntes: horasAntes() });
      try {
        for (const a of acciones) {
          if (a.tipo === 'encolar') {
            const p = a.pieza, momento = momentoDe(p), previa = d.entradas[p.id];
            d.entradas[p.id] = mover({ pieza: p.id, huella: p.aprobada.huella, momento, entregarDesde: momento - horasAntes() * 3600e3, redes: {}, remoto: {}, intentos: 0, error: '', historial: previa?.historial || [] }, 'espera');
            guardar(d);
          } else if (a.tipo === 'entregar') await entregar(d, a.pieza);
          else if (a.tipo === 'vencer') { const e = d.entradas[a.id]; mover(e, 'fallo', { error: 'No se entregó a tiempo: su hora pasó (o falta muy poco) y la oficina no pudo dejarla programada. Cámbiale el día y vuelve a aprobarla.' }); guardar(d); avisar(`«${titulo(almacen.leer(a.id))}» no se entregó a tiempo: cámbiale el día.`, { key: 'vencida-' + a.id, level: 'warn' }); }
          else if (a.tipo === 'retirar') await retirar(d, a.id, a.motivo);
          else if (a.tipo === 'soltar') { delete d.entradas[a.id]; guardar(d); }
          else if (a.tipo === 'comprobar') await comprobar(d, a.id);
        }
        // lo terminado hace más de 60 días se olvida (la nota y la auditoría lo conservan)
        for (const [id, e] of Object.entries(d.entradas)) if (!VIVAS.includes(e.estado) && ahora() - (e.historial?.at(-1)?.at || 0) > 60 * 864e5) delete d.entradas[id];
        guardar(d);
        ultimo = { at: ahora(), acciones: acciones.length, error: '' };
      } catch (err) { ultimo = { at: ahora(), acciones: acciones.length, error: textoError(err) }; }
      return ultimo;
    })().finally(() => { enMarcha = null; });
    return enMarcha;
  }

  const publica = e => e && ({ estado: e.estado, conductor: e.conductor || '', momento: e.momento, entregarDesde: e.entregarDesde, redes: e.redes || {}, error: e.error || '', intentos: e.intentos || 0, siguienteIntento: e.siguienteIntento || 0, entregadaAt: e.entregadaAt || 0, historial: (e.historial || []).slice(-8) });
  return {
    tick,
    salidaDe: id => publica(leer().entradas?.[id]) || null,
    estado() {
      const d = leer(), c = conductor(), entradas = Object.values(d.entradas || {});
      const cuenta = Object.fromEntries(['espera', 'entregando', 'en_red', 'publicada', 'parcial', 'fallo', 'cancelada'].map(k => [k, entradas.filter(e => e.estado === k).length]));
      return { modo: modo(), conductor: { id: c.id, nombre: c.nombre, ...c.listo() }, horasAntes: horasAntes(), cuenta, ultimo, entradas: Object.fromEntries(Object.entries(d.entradas || {}).map(([k, e]) => [k, publica(e)])) };
    },
    /** Volver a intentar lo que falló (desde el principio de su espera). */
    reintentar(id) {
      const d = leer(), e = d.entradas?.[id]; if (!e) return { error: 'esa pieza no está en la cola' };
      if (e.estado !== 'fallo') return { error: 'no falló: no hay nada que reintentar' };
      if (Object.values(e.redes || {}).some(x => x.estado === 'publicada')) return { error: 'ya salió en alguna red: para repetirla solo donde falló, duplícala con esas redes' };
      if (e.momento - ahora() < MARGEN_MS) return { error: 'su hora ya pasó: cámbiale el día y vuelve a aprobarla' };
      if (Object.values(e.redes || {}).some(x => x.estado === 'fallo')) return { error: 'el conductor la recibió y falló al publicar: cámbiale el día (o lo que falló) y vuelve a aprobarla' };
      mover(e, 'espera', { error: '', intentos: 0, siguienteIntento: 0 }); guardar(d); return { ok: true }; // lo ya entregado en un intento anterior (otra variante) no se repite
    },
    /** Entregar ya, sin esperar a `entregarHorasAntes` (desde ese momento, cambiarla depende de lo que deje el conductor). */
    entregarYa(id) { const d = leer(), e = d.entradas?.[id]; if (!e) return { error: 'esa pieza no está en la cola: apruébala primero' }; if (e.estado !== 'espera') return { error: 'ya no está esperando' }; e.entregarDesde = 0; guardar(d); return { ok: true }; },
    /** Quitar una pieza de la cola: se le quita el OK (vuelve a revisión) y el próximo tick la retira del conductor. */
    cancelar(id) { const r = almacen.devolver(id, 'revision'); return r.error ? r : { ok: true, pieza: r.pieza }; },
  };
}
