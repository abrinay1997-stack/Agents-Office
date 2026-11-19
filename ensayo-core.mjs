// VAN-05 · el ENSAYO de una rutina: saber qué haría, sin que salga nada. Puro: ni reloj propio, ni archivos, ni imports.
// Dos cosas distintas, y conviene no confundirlas:
//   1) «¿Qué haría hoy?» (`vistaPrevia`): GRATIS y sin llamar a ningún modelo. Si le toca hoy y a qué hora, quién la
//      lleva, qué conectores LEE y cuáles ENVIARÍAN, si espera tu OK, cómo le fue las últimas veces y cuánto suele
//      costar. Es lo que se mira antes de encender una rutina nueva.
//   2) El ensayo de verdad lo corre la oficina (`serve.mjs`) con la política «nunca» y como borrador: el agente lee y
//      escribe su entrega, pero NADA sale (ni enviar, ni publicar, ni pagar, ni borrar) y no gasta en un motor de pago
//      del Estudio. La llamada al modelo sí cuesta, y por eso la cifra de aquí se enseña ANTES de pulsar.
// El ensayo NO consume el turno de la rutina: su reloj no se mueve (`advance` no se llama).

/** La mediana, no el promedio: una corrida rara no debe mentir sobre lo que suele costar. */
export function mediana(ns) {
  const xs = (ns || []).filter((n) => typeof n === 'number' && isFinite(n) && n >= 0).sort((a, b) => a - b);
  if (!xs.length) return null;
  const m = xs.length >> 1;
  return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2;
}

/** @param {any[]} lines @param {string} taskId */
const usdDe = (lines, taskId) => (lines || []).reduce((s, l) => (l && l.task === taskId ? s + (+l.usd || 0) : s), 0);

/**
 * Lo que esta rutina ya hizo: una entrada por tarea suya, de la más nueva a la más vieja.
 * @param {any[]} tasks la lista de tareas
 * @param {any[]} lines el libro de costos
 * @param {string} rutinaId
 * @param {{ max?: number }} [opciones]
 * @returns {{ task: string, at: number, titulo: string, estado: string, ok: boolean, usd: number, ensayo: boolean }[]}
 */
export function corridasDe(tasks, lines, rutinaId, { max = 5 } = {}) {
  return (tasks || [])
    .filter((t) => t && t.routine === rutinaId)
    .sort((a, b) => (b.createdAt || b.due || 0) - (a.createdAt || a.due || 0))
    .slice(0, max)
    .map((t) => ({ task: t.id, at: t.createdAt || t.due || 0, titulo: String(t.title || ''), estado: String(t.state || ''), ok: t.state === 'done' && !t.error, usd: Math.round(usdDe(lines, t.id) * 1e6) / 1e6, ensayo: !!t.ensayo }));
}

/**
 * Cuánto costaría una corrida. Primero lo que costó ESTA rutina; si nunca corrió, lo que cuesta una tarea de ESE
 * agente; si tampoco, lo que cuesta una tarea cualquiera de la oficina. Sin nada que mirar, `null`: no se inventa.
 * Los ensayos no cuentan para la estimación (corren en borrador y suelen costar menos que la corrida de verdad).
 * @param {any[]} tasks
 * @param {any[]} lines
 * @param {{ rutina?: string|null, agente?: string|null }} [quien]
 * @returns {{ usd: number|null, de: 'rutina'|'agente'|'oficina'|null, n: number }}
 */
export function estimadoDe(tasks, lines, { rutina = null, agente = null } = {}) {
  const hechas = (tasks || []).filter((t) => t && !t.ensayo);
  const conCosto = (ts) => ts.filter((t) => usdDe(lines, t.id) > 0);
  const costoDe = (ts) => mediana(conCosto(ts).map((t) => usdDe(lines, t.id)));
  if (rutina) { const ts = hechas.filter((t) => t.routine === rutina), u = costoDe(ts); if (u !== null) return { usd: u, de: 'rutina', n: conCosto(ts).length }; }
  if (agente) { const ts = hechas.filter((t) => t.agent === agente), u = costoDe(ts); if (u !== null) return { usd: u, de: 'agente', n: conCosto(ts).length }; }
  const u = costoDe(hechas);
  return u !== null ? { usd: u, de: 'oficina', n: conCosto(hechas).length } : { usd: null, de: null, n: 0 };
}

/**
 * Las horas a las que esta rutina correría hoy (su `nextAt` y las que vengan después antes de medianoche).
 * `siguiente(t)` es el calculador del horario (el `nextRun` de routines-core), inyectado para que esto siga siendo puro.
 * @param {{ nextAt?: number|null, paused?: boolean }} rutina
 * @param {(t: number) => number|null} siguiente
 * @param {number} ahora
 * @returns {number[]}
 */
export function horasDeHoy(rutina, siguiente, ahora) {
  if (!rutina || rutina.paused) return [];
  const fin = new Date(ahora); fin.setHours(23, 59, 59, 999);
  const tope = fin.getTime();
  /** @type {number[]} */ const out = [];
  let t = rutina.nextAt || null;
  for (let i = 0; i < 48 && t && t <= tope; i++) { out.push(t); const n = siguiente(t); if (!n || n <= t) break; t = n; }
  return out;
}

/** @param {number} t @param {string|null} zona */
const hora = (t, zona) => new Date(t).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit', hour12: false, ...(zona ? { timeZone: zona } : {}) }); // la oficina habla en 24 horas (y «11:58 a. m..» se leía mal)
/** @param {number} n */
const dinero = (n) => `US$${(Math.round(n * 100) / 100).toFixed(2)}`;
/** @param {number} t @param {string|null} zona @param {Record<string, any>} [mas] */
const dia = (t, zona, mas = {}) => new Date(t).toLocaleDateString('es-PA', { ...mas, ...(zona ? { timeZone: zona } : {}) });

/**
 * «¿Qué haría hoy?»: el objeto que enseña la pantalla y el texto corto que lee una persona (o Dimitri).
 * No llama a ningún modelo y no gasta: solo mira el horario, el roster, las tareas y el libro de costos.
 * @param {{ rutina: any, ahora: number, siguiente: (t: number) => number|null, agente?: any, tasks?: any[], lines?: any[], lee?: string[], envian?: string[], zona?: string|null }} e
 */
export function vistaPrevia({ rutina, ahora, siguiente, agente = null, tasks = [], lines = [], lee = [], envian = [], zona = null }) {
  const hoy = horasDeHoy(rutina, siguiente, ahora);
  const corridas = corridasDe(tasks, lines, rutina.id);
  const costo = estimadoDe(tasks, lines, { rutina: rutina.id, agente: (agente && agente.id) || rutina.agent || null });
  const quien = (agente && agente.name) || rutina.agent || '—';
  const partes = [];
  if (rutina.paused) partes.push('Está en pausa: hoy no haría nada.');
  else if (rutina.terminada) partes.push('Ya cumplió su cuenta de ejecuciones: no vuelve a correr.');
  else if (hoy.length) partes.push(`Hoy correría ${hoy.length === 1 ? `a las ${hora(hoy[0], zona)}` : `${hoy.length} veces: ${hoy.map((t) => hora(t, zona)).join(', ')}`}.`);
  else partes.push(rutina.nextAt ? `Hoy no le toca; la próxima es el ${dia(rutina.nextAt, zona, { weekday: 'long', day: 'numeric', month: 'long' })} a las ${hora(rutina.nextAt, zona)}.` : 'No tiene próxima ejecución.');
  partes.push(`La lleva ${quien}${rutina.team ? ' con todo su departamento' : ''}, y ${rutina.needsOk === false ? 'su resultado NO espera tu OK (así que debería solo leer e informar)' : 'su resultado espera tu OK antes de que salga nada'}.`);
  partes.push(lee.length || envian.length ? `Conectores: lee ${lee.length ? lee.join(', ') : 'nada'}${envian.length ? `; podría enviar por ${envian.join(', ')} (en un ensayo, no)` : '; ninguno de los suyos envía'}.` : 'Conectores: ninguno de los suyos está conectado, así que solo puede escribir.');
  partes.push(costo.usd === null ? 'Nunca ha corrido, así que no sé lo que cuesta.' : `Suele costar ${dinero(costo.usd)} por vuelta (${costo.de === 'rutina' ? `la mediana de sus ${costo.n} corridas` : costo.de === 'agente' ? `la mediana de ${quien}, porque esta rutina aún no ha corrido` : 'la mediana de la oficina, porque ni la rutina ni el agente tienen historial'}).`);
  if (corridas.length) { const u = corridas[0]; partes.push(`La última vez (${dia(u.at, zona)}) ${u.ensayo ? 'fue un ensayo y ' : ''}${u.ok ? 'terminó bien' : u.estado === 'waiting' ? 'quedó esperando tu OK' : `quedó en «${u.estado || 'sin estado'}»`}.`); }
  return { rutina: rutina.id, titulo: String(rutina.title || ''), hoy, proxima: rutina.nextAt || null, pausada: !!rutina.paused, terminada: !!rutina.terminada, agente: rutina.agent || null, agenteNombre: quien, equipo: !!rutina.team, needsOk: rutina.needsOk !== false, lee, envian, costo, corridas, texto: partes.join(' ') };
}
