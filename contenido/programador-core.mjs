// (NÚCLEO del programador, sin disco: lo usa contenido/programador.mjs —cola en un archivo, almacén de piezas en notas— y el Worker de Cloudflare —cola y piezas en D1—.)
// Lo único que cambia entre los dos es DÓNDE se guarda la cola (`cola.leer()` / `cola.guardar(d)`) y de dónde salen las piezas (`almacen`): ambos pueden ser
// síncronos o promesas (aquí se esperan los dos). Los candados, las esperas y lo de «nunca dos veces» son los mismos, porque es el mismo código.
import { entregasDe, estadoGeneral } from './entrega.mjs';

export const GRACIA_MS = 60e3;            // tras aprobar, un minuto para deshacer antes de entregar
export const MARGEN_MS = 3 * 60e3;        // a menos de 3 minutos de su hora, ya no se entrega (no daría tiempo)
export const COMPROBAR_CADA_MS = 10 * 60e3;
export const COMPROBAR_HASTA_MS = 3 * 864e5; // después de 3 días sin noticias, se deja de preguntar
export const YA_VENTANA_MS = 30 * 60e3;  // «Publicar ahora» (CON-04): se salta la gracia y el margen solo durante estos minutos desde su OK; pasados, vale la regla de siempre
const ESPERAS = [60e3, 5 * 60e3, 15 * 60e3]; // reintentos de un fallo pasajero
const VIVAS = ['espera', 'entregando', 'en_red'];
export const ENTREGANDO_MAX_MS = 10 * 60e3; // M1: una entrega no tarda tanto; si pasa, no se sabe si el conductor la recibió
export const INCIERTO = 'No se sabe si el conductor llegó a recibirla (la respuesta no quedó apuntada): míralo allí y, si no está, cámbiale la hora y vuelve a aprobarla. No la repito sola porque podría salir dos veces.';

const momentoDe = p => { const e = entregasDe(p); return e.length ? Math.min(...e.map(x => x.momento)) : NaN; };
/** «Publicar ahora»: SOLO lo dice el OK guardado en la pieza (`aprobada.ya`), que escribe la ruta publicar-ya del dueño; ni una petición ni una entrada de la cola lo activan (B02). */
export const esYa = (p, ahora) => p?.aprobada?.ya === true && ahora - Date.parse(p.aprobada.cuando || 0) <= YA_VENTANA_MS;
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
      const ya = esYa(p, ahora); // B02: sin minuto de gracia (no se deshace) ni margen de 3 min (su hora es el minuto en curso)
      const listaDesde = Math.max(e.entregarDesde || 0, ya ? 0 : Date.parse(p.aprobada.cuando || 0) + GRACIA_MS, e.siguienteIntento || 0);
      if (!ya && momento - ahora < MARGEN_MS) acciones.push({ tipo: 'vencer', id: p.id });
      else if (ahora >= listaDesde) acciones.push({ tipo: 'entregar', id: p.id, pieza: p });
    }
  }
  for (const [id, e] of Object.entries(entradas)) {
    if (e.estado === 'entregando' && ahora - (e.historial?.at(-1)?.at || 0) > ENTREGANDO_MAX_MS) { acciones.push({ tipo: 'atascada', id }); continue; } // M1: nunca se reintenta sola
    if (!vistas.has(id) && VIVAS.includes(e.estado)) { acciones.push({ tipo: e.remoto && Object.keys(e.remoto).length ? 'retirar' : 'soltar', id, motivo: 'sin-ok' }); continue; }
    if (e.estado === 'en_red' && ahora >= e.momento && ahora - (e.comprobadoAt || 0) >= COMPROBAR_CADA_MS && ahora < e.momento + COMPROBAR_HASTA_MS) acciones.push({ tipo: 'comprobar', id });
  }
  return acciones;
}

export const ESTADOS_COLA = ['espera', 'entregando', 'en_red', 'publicada', 'parcial', 'fallo', 'cancelada'];
const textoError = e => String(e?.message || e || 'error').slice(0, 400);
export const moverEntrada = (e, estado, extra = {}, ahora = Date.now) => Object.assign(e, { estado, ...extra, historial: [...(e.historial || []).slice(-19), { at: ahora(), estado, ...(extra.error ? { error: extra.error } : {}) }] });

/** Lo que se enseña de una entrada de la cola (sin los ids internos del conductor). */
export const publica = e => e && ({ estado: e.estado, conductor: e.conductor || '', momento: e.momento, entregarDesde: e.entregarDesde, redes: e.redes || {}, error: e.error || '', intentos: e.intentos || 0, siguienteIntento: e.siguienteIntento || 0, entregadaAt: e.entregadaAt || 0, historial: (e.historial || []).slice(-8) });

/** «Volver a intentar» lo que falló: cambia la entrada `e` (la deja en espera) o dice por qué no. → { ok } | { error } */
export function reintentarEntrada(e, ahora) {
  if (!e) return { error: 'esa pieza no está en la cola' };
  if (e.estado !== 'fallo') return { error: 'no falló: no hay nada que reintentar' };
  if (e.incierto) return { error: 'no se sabe si el conductor la recibió: míralo allí; si no está, cámbiale la hora y vuelve a aprobarla (repetirla sola podría publicarla dos veces)' };
  if (Object.values(e.redes || {}).some(x => x.estado === 'publicada')) return { error: 'ya salió en alguna red: para repetirla solo donde falló, duplícala con esas redes' };
  if (e.momento - ahora < MARGEN_MS) return { error: 'su hora ya pasó: cámbiale el día y vuelve a aprobarla' };
  if (Object.values(e.redes || {}).some(x => x.estado === 'fallo')) return { error: 'el conductor la recibió y falló al publicar: cámbiale el día (o lo que falló) y vuelve a aprobarla' };
  moverEntrada(e, 'espera', { error: '', intentos: 0, siguienteIntento: 0 }, () => ahora); return { ok: true }; // lo ya entregado en un intento anterior (otra variante) no se repite
}
/** «Entregar ya»: sin esperar a `entregarHorasAntes`. → { ok } | { error } */
export function entregarYaEntrada(e) { if (!e) return { error: 'esa pieza no está en la cola: apruébala primero' }; if (e.estado !== 'espera') return { error: 'ya no está esperando' }; e.entregarDesde = 0; return { ok: true }; }
/** El estado general de la cola que ve la página. `conductor` es el actual; `ultimo` el resultado de la última vuelta. */
export function estadoDeCola({ d, c, modo, horasAntes, ultimo }) {
  const entradas = Object.values(d.entradas || {});
  const cuenta = Object.fromEntries(ESTADOS_COLA.map(k => [k, entradas.filter(e => e.estado === k).length]));
  return { modo, conductor: { id: c.id, nombre: c.nombre, ...c.listo(), ...(c.cuota ? { cuota: c.cuota() } : {}) }, horasAntes, cuenta, ultimo, entradas: Object.fromEntries(Object.entries(d.entradas || {}).map(([k, e]) => [k, publica(e)])) };
}

export function crearNucleoProgramador({ almacen, cola, conductor, porId = null, modo = () => 'simulacro', horasAntes = () => 24, avisar = () => {}, auditar = () => {}, ahora = Date.now, puedeSeguir = () => true, maxAcciones = Infinity }) {
  let enMarcha = null, ultimo = { at: 0, acciones: 0, error: '' };
  const mirarYa = new Set(); // conductores que avisaron de un cambio: lo suyo en la red se mira en el próximo tick, sin esperar
  const leer = () => cola.leer();
  const guardar = d => cola.guardar(d);
  const titulo = p => p?.titulo || String(p?.texto || '').split('\n')[0].slice(0, 60) || 'sin título';
  const mover = (e, estado, extra = {}) => moverEntrada(e, estado, extra, ahora);

  async function entregar(d, p) {
    const e = d.entradas[p.id], c = conductor();
    const listo = c.listo(); if (!listo.ok) { if (e.error !== listo.motivo) { e.error = listo.motivo; avisar(`No puedo entregar «${titulo(p)}»: ${listo.motivo}`, { key: 'conductor-no-listo', level: 'warn' }); } return; }
    // doble testigo: si la nota ya dice que esta versión está en este conductor, se adopta (no se entrega otra vez)
    if (p.entregada && p.entregada.huella === e.huella && p.entregada.conductor === c.id && p.entregada.remoto) {
      mover(e, 'en_red', { conductor: c.id, remoto: p.entregada.remoto, error: '' }); auditar({ que: 'adoptada', pieza: p.id, conductor: c.id }); return;
    }
    mover(e, 'entregando', { conductor: c.id, incierto: false }); await guardar(d);
    try {
      for (const en of entregasDe(p)) {
        if (e.remoto?.[en.clave]) continue; // ya entregada en un intento anterior: no se repite
        // A1: apuntar (y ESPERAR) que se va a mandar, ANTES de mandar. Si el intento quedó apuntado y no su respuesta, esa entrega NO se repite.
        if (e.intentando?.[en.clave]) throw Object.assign(new Error(INCIERTO), { incierto: true });
        e.intentando = { ...(e.intentando || {}), [en.clave]: ahora() };
        try { await guardar(d); } catch (g) { delete e.intentando[en.clave]; throw Object.assign(g instanceof Error ? g : new Error(String(g)), { transitorio: true }); } // no se mandó nada: se puede reintentar
        const r = await c.programar(en);
        e.remoto = { ...(e.remoto || {}), [en.clave]: { id: r.id, uuid: r.uuid || '', zona: r.zona || '', momento: en.momento, redes: en.redes, variante: en.variante } };
        delete e.intentando[en.clave];
        for (const [red, s] of Object.entries(r.redes || {})) e.redes[en.variante === 'historia' ? `${red}·historia` : red] = s;
        let apuntado = false; for (let i = 0; i < 3 && !apuntado; i++) { try { await guardar(d); apuntado = true; } catch { /* otro intento */ } } // cada entrega se apunta en cuanto existe
        if (!apuntado) { e.intentando[en.clave] = ahora(); throw Object.assign(new Error('La recibió el conductor pero no pude apuntarlo.'), { incierto: true }); }
      }
      mover(e, 'en_red', { error: '', intentos: 0, entregadaAt: ahora() }); await guardar(d);
      await almacen.marcarEntregada(p.id, { conductor: c.id, huella: e.huella, remoto: e.remoto, cuando: new Date(ahora()).toJSON() });
      auditar({ que: 'entregada', pieza: p.id, conductor: c.id, redes: p.redes, momento: e.momento });
      const locales = Object.entries(e.redes || {}).filter(([, x]) => x?.local && x.estado === 'en_red').map(([r]) => r.split('·')[0]); // F3: Instagram con Meta directo
      if (c.id !== 'simulacro') avisar(locales.length
        ? `«${titulo(p)}» está lista para el ${new Date(e.momento).toLocaleString('es')}: ${[...new Set(locales)].map(r => r[0].toUpperCase() + r.slice(1)).join(' y ')} sale desde esta computadora a esa hora (déjala encendida con la oficina abierta)${Object.values(e.redes).some(x => x?.estado === 'en_red' && !x.local) ? '; lo demás quedó programado en ' + c.nombre : ''}.`
        : `«${titulo(p)}» quedó programada en ${c.nombre} para ${new Date(e.momento).toLocaleString('es')}.`, { key: 'entregada-' + p.id });
    } catch (err) {
      e.intentos = (e.intentos || 0) + 1;
      if (err?.incierto) { // no se sabe si el conductor la recibió: nunca se repite sola
        mover(e, 'fallo', { error: INCIERTO, incierto: true });
        avisar(`«${titulo(p)}»: no se sabe si ${c.nombre} la recibió. Míralo allí antes de volver a aprobarla.`, { key: 'fallo-' + p.id, level: 'error' });
        auditar({ que: 'fallo-entrega', pieza: p.id, conductor: c.id, error: 'incierto' });
        try { await guardar(d); } catch { /* el testigo ya quedó apuntado antes */ }
        return;
      }
      e.intentando = {}; // fallo seguro (se dijo con todas sus letras): no quedó nada mandado
      const pasajero = err?.transitorio !== false && (err?.transitorio || err?.estado === 0 || err?.estado === 429 || err?.estado >= 500);
      if (pasajero && e.intentos <= ESPERAS.length) mover(e, 'espera', { error: textoError(err), siguienteIntento: ahora() + ESPERAS[e.intentos - 1] });
      else { mover(e, 'fallo', { error: textoError(err) }); avisar(`No se pudo programar «${titulo(p)}» en ${c.nombre}: ${textoError(err)}`, { key: 'fallo-' + p.id, level: 'error' }); }
      auditar({ que: 'fallo-entrega', pieza: p.id, conductor: c.id, error: textoError(err) });
      await guardar(d);
    }
  }

  async function retirar(d, id, motivo) {
    const e = d.entradas[id]; if (!e) return;
    const c = conductor(), mismo = (porId && e.conductor && porId(e.conductor)) || (e.conductor === c.id ? c : null); // F3: se retira con el que la entregó, aunque hoy se publique con otro
    try {
      if (e.remoto && Object.keys(e.remoto).length) {
        if (!mismo) throw new Error(`se entregó con ${e.conductor} y ahora el conductor es ${c.id}: quítala allí a mano`);
        for (const r of Object.values(e.remoto)) await mismo.retirar(r);
      }
      mover(e, 'cancelada', { remoto: {}, error: '' }); await guardar(d);
      await almacen.marcarEntregada(id, null);
      auditar({ que: 'retirada', pieza: id, conductor: e.conductor, motivo });
    } catch (err) {
      mover(e, 'fallo', { error: `No se pudo quitar de ${e.conductor}: ${textoError(err)}. Quítala allí a mano.` }); await guardar(d);
      avisar(`Una pieza cambió o perdió tu OK, pero no se pudo quitar de ${e.conductor}: quítala allí a mano. (${textoError(err)})`, { key: 'retirar-' + id, level: 'error' });
    }
  }

  async function comprobar(d, id) {
    const e = d.entradas[id]; if (!e) return;
    const c = (porId && e.conductor && porId(e.conductor)) || conductor();
    e.comprobadoAt = ahora();
    if (e.conductor !== c.id) { await guardar(d); return; }
    try {
      for (const r of Object.values(e.remoto || {})) {
        const s = await c.estado(r); if (!s) continue;
        for (const [red, x] of Object.entries(s.redes || {})) e.redes[r.variante === 'historia' ? `${red}·historia` : red] = x;
      }
      const g = estadoGeneral(e.redes), antes = e.estado;
      if (g !== 'en_red') mover(e, g, { publicadaAt: ahora() });
      await guardar(d);
      if (antes !== e.estado) {
        const p = await almacen.leer(id);
        if (g === 'publicada') avisar(`Publicada: «${titulo(p)}»${c.id === 'simulacro' ? ' (simulacro: no salió de verdad)' : ''}.`, { key: 'publicada-' + id });
        else avisar(`«${titulo(p)}» ${g === 'parcial' ? 'salió solo en algunas redes' : 'no se pudo publicar'}: ${Object.entries(e.redes).filter(([, x]) => x.estado === 'fallo').map(([r, x]) => `${r}${x.detalle ? ' (' + x.detalle + ')' : ''}`).join(', ')}.`, { key: 'publica-mal-' + id, level: 'error' });
        auditar({ que: g, pieza: id, conductor: c.id });
      }
    } catch (err) { e.error = textoError(err); await guardar(d); }
  }

  /** Una vuelta: planea con lo que hay y hace cada acción, una tras otra. Nunca dos vueltas a la vez. */
  async function tick({ solo = '' } = {}) {
    if (enMarcha) return enMarcha; // (una vuelta en marcha ya verá la pieza: «solo» es para no tocar las demás)
    enMarcha = (async () => {
      const m = modo(); if (m === 'apagado') { ultimo = { at: ahora(), acciones: 0, error: '' }; return ultimo; }
      const d = await leer(); d.entradas ||= {};
      const desde = new Date(ahora() - 3 * 864e5); const ymd = `${desde.getFullYear()}-${String(desde.getMonth() + 1).padStart(2, '0')}-${String(desde.getDate()).padStart(2, '0')}`;
      const piezas = await almacen.listar({ desde: ymd });
      const conocidas = new Map(piezas.map(p => [p.id, p]));
      for (const id of Object.keys(d.entradas)) if (!conocidas.has(id)) { const p = await almacen.leer(id); if (p) conocidas.set(id, p); }
      const acciones = planear([...conocidas.values()], d.entradas, { ahora: ahora(), horasAntes: horasAntes() }).filter(a => !solo || a.id === solo);
      if (mirarYa.size) { // un conductor avisó: lo suyo que está en la red se mira ahora (aunque no haya llegado su hora ni pasado 10 min)
        for (const [id, e] of Object.entries(d.entradas)) if (e.estado === 'en_red' && mirarYa.has(e.conductor) && !acciones.some(a => a.id === id && a.tipo === 'comprobar')) acciones.push({ tipo: 'comprobar', id });
        mirarYa.clear();
      }
      try {
        let hechas = 0;
        for (const a of acciones) {
          if (!puedeSeguir() || hechas >= maxAcciones) break; // M2: tope de acciones por vuelta; lo que falta sigue en la próxima
          hechas++; // el Worker corta la vuelta antes de pasarse de sus llamadas; lo que falta sigue en la próxima
          if (a.tipo === 'encolar') {
            const p = a.pieza, momento = momentoDe(p), previa = d.entradas[p.id];
            d.entradas[p.id] = mover({ pieza: p.id, huella: p.aprobada.huella, momento, entregarDesde: momento - horasAntes() * 3600e3, redes: {}, remoto: {}, intentos: 0, error: '', historial: previa?.historial || [] }, 'espera');
            await guardar(d);
            if (esYa(p, ahora())) await entregar(d, p); // «Publicar ahora»: en la misma vuelta, sin esperar a la siguiente
          } else if (a.tipo === 'entregar') await entregar(d, a.pieza);
          else if (a.tipo === 'vencer') { const e = d.entradas[a.id]; mover(e, 'fallo', { error: 'No se entregó a tiempo: su hora pasó (o falta muy poco) y la oficina no pudo dejarla programada. Cámbiale el día y vuelve a aprobarla.' }); await guardar(d); avisar(`«${titulo(await almacen.leer(a.id))}» no se entregó a tiempo: cámbiale el día.`, { key: 'vencida-' + a.id, level: 'warn' }); }
          else if (a.tipo === 'atascada') { const e = d.entradas[a.id]; mover(e, 'fallo', { error: INCIERTO, incierto: true }); await guardar(d); avisar(`«${titulo(await almacen.leer(a.id))}» se quedó entregándose y no se sabe si el conductor la recibió: míralo allí.`, { key: 'atascada-' + a.id, level: 'error' }); auditar({ que: 'atascada', pieza: a.id }); }
          else if (a.tipo === 'retirar') await retirar(d, a.id, a.motivo);
          else if (a.tipo === 'soltar') { delete d.entradas[a.id]; await guardar(d); }
          else if (a.tipo === 'comprobar') await comprobar(d, a.id);
        }
        // lo terminado hace más de 60 días se olvida (la nota y la auditoría lo conservan)
        for (const [id, e] of Object.entries(d.entradas)) if (!VIVAS.includes(e.estado) && ahora() - (e.historial?.at(-1)?.at || 0) > 60 * 864e5) delete d.entradas[id];
        await guardar(d);
        ultimo = { at: ahora(), acciones: acciones.length, error: '' };
      } catch (err) { ultimo = { at: ahora(), acciones: acciones.length, error: textoError(err) }; }
      return ultimo;
    })().finally(() => { enMarcha = null; });
    return enMarcha;
  }

  /** «Publicar ahora» sobre algo ya entregado (B05): primero se RETIRA del conductor; si no se puede, no se publica (saldría dos veces). → { ok } | { error } en palabras. */
  async function retirarAhora(id) {
    await (enMarcha || Promise.resolve()).catch(() => {});
    const d = await leer(), e = d.entradas?.[id]; if (!e) return { ok: true };
    if (e.estado === 'entregando') return { error: 'se está entregando en este momento: espera unos segundos y vuelve a pulsar' };
    if (['publicada', 'parcial'].includes(e.estado)) return { error: 'ya salió: no se puede volver a publicar la misma pieza; para repetirla, duplícala' };
    if (e.incierto) return { error: INCIERTO };
    if (!VIVAS.includes(e.estado) && !Object.keys(e.remoto || {}).length) return { ok: true }; // cancelada o fallida y sin nada en el conductor
    await retirar(d, id, 'publicar-ya');
    const f = d.entradas[id];
    if (f?.estado === 'cancelada') return { ok: true };
    return { error: `quita antes la programada en ${e.conductor || 'el conductor'} (${f?.error || 'no se pudo retirar'})` };
  }

  return {
    tick, retirarAhora,
    /** Un conductor avisa de que algo salió o falló: se mira ya (en un tick, en fila con los demás: nunca dos a la vez). */
    refrescar(conductorId) { mirarYa.add(conductorId); return (enMarcha || Promise.resolve()).then(() => tick()); },
    ultimo: () => ultimo,
  };
}
