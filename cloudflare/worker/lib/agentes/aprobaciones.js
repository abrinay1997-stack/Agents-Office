// Aprobaciones en la nube: serve.mjs → decideDraft, commitApproval, undoApproval, tickApprovals, draftFacts. Mismas reglas, mismas palabras y mismas formas de respuesta.
// Lo que cambia es QUIÉN ejecuta tras el OK: aquí no hay un proceso que arranque, así que aprobar deja la tarea en `doing` con `corrida: { modo: 'approve' }` y el reloj
// de cada minuto (ejecutor.js) la toma. SOLO un administrador aprueba, devuelve, edita el borrador o deshace (lo exige quien llama: tasks-api.js).
//
// Las funciones reciben una SESIÓN de tareas (`s.alm`, lib/tareas/sesion.js): el cambio y su comprobación van en la misma copia y se vuelcan con el candado de versión de cada
// tarea, así dos «aprobar» a la vez no ejecutan dos veces (el segundo ve `approving` y recibe 409).
import * as approvals from '../../../../approvals.mjs';
import { askLine } from '../../../../routines-core.mjs';
import { sha256 } from '../ids.js';

const diaLocal = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** serve.mjs → draftFacts: el riesgo y «lo que saldrá» de un borrador que espera el OK. */
export function draftFacts(t, apr) { const d = t.draft || t.result || ''; t.risk = approvals.risk(d, apr); t.preview = approvals.preview(d); }

/** Apunta quién aprobó, editó, devolvió o deshizo: en la tarea (task.approvals) y en el registro de auditoría. El apunte de la auditoría va en el MISMO lote de D1 que el cambio de la
 *  tarea (`s.extra`): si el cambio se repite por un choque con otra petición, no queda duplicado, y si no entra el cambio no entra el apunte. */
export async function registrar(db, s, id, accion, por, extra = {}) {
  let t = null;
  s.alm.cambiar(id, x => { (x.approvals ||= []).push(approvals.entry(accion, por, extra)); t = x; }, { por: 'oficina' });
  const ahora = Date.now();
  s.extra.push(db.prepare('insert into auditoria_agentes (t, dia, run, tarea, agente, dept, herramienta, fase, clase, decision, codigo, motivo, destinos) values (?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(ahora, diaLocal(ahora), null, id, t?.agent || null, t?.dept || null, 'approval', 'pre', 'approval', accion, null, extra.note ? String(extra.note).slice(0, 300) : null, '[]'));
}

/** La huella de lo que el dueño ve y aprueba: el borrador. El OK vale SOLO para esta huella; si el borrador cambia (otra versión, una edición), el OK se descarta. */
export const huellaDe = t => sha256(String(t?.draft || t?.result || ''));

/** Aprobar o devolver un borrador. verbo: 'approve' | 'reject'. → { status?, ok?, error?, id, state, sendAt?, undoSeconds? } (la misma respuesta que la local) */
export async function decidirBorrador({ s, db, id, verbo, nota = '', por = 'Tú', apr, ahora = () => Date.now() }) {
  const t0 = s.alm.load().find(x => x.id === id);
  if (!t0) return { status: 404, error: 'esa tarea ya no existe' };
  if (t0.state !== 'waiting') return { status: 400, error: 'esta tarea no está esperando tu visto bueno' };
  if (t0.approving) return { status: 409, error: 'ya está aprobada: se envía en unos segundos (puedes deshacerlo)' };
  const wait = verbo === 'reject' ? 0 : apr.undoSeconds;
  const huella = await huellaDe(t0);
  let res = null;
  s.alm.cambiar(id, t => {
    if (t.state !== 'waiting' || t.approving) { res = { status: 409, error: 'otra persona decidió esto al mismo tiempo' }; return false; }
    t.seenAt = t.seenAt || ahora();
    if (verbo === 'reject') { // devolver: el agente lo retoma con lo que pediste
      delete t.approving;
      Object.assign(t, { state: 'doing', startedAt: ahora(), rejected: true, tomadaPor: 'agente:' + t.agent, corrida: { modo: t.needsOk ? 'draft' : 'routine', feedback: nota || 'No es esto. Retrabájalo.', origen: 'reject' } });
      res = { ok: true, id, state: 'doing' };
    } else if (wait > 0) { // G7: unos segundos para arrepentirse, como el «Deshacer envío» de Gmail
      t.approving = { by: por, at: ahora(), sendAt: ahora() + wait * 1000, huella };
      res = { ok: true, id, state: 'waiting', sendAt: t.approving.sendAt, undoSeconds: wait };
    } else { // sin ventana: sale ya
      Object.assign(t, { state: 'doing', startedAt: ahora(), tomadaPor: 'agente:' + t.agent, corrida: { modo: 'approve', huella } });
      res = { ok: true, id, state: 'doing' };
    }
  }, { por: 'dueno' });
  if (res?.status) return res;
  const t1 = s.alm.load().find(x => x.id === id);
  if (verbo === 'reject') await registrar(db, s, id, 'reject', por, { note: nota.slice(0, 300) });
  else await registrar(db, s, id, 'approve', por, { risk: t1.risk, edited: !!t1.editedDraft });
  return res;
}

/** El OK ya no se puede deshacer: la tarea pasa a ejecutarse. (commitApproval) Solo si la tarea SIGUE esperando y su borrador es el mismo que el dueño aprobó (la huella);
 *  si no, el OK se descarta: lo que salga tiene que ser lo aprobado. → true si salió; false si no (y, si el OK estaba viciado, ya no queda). */
export async function cerrarAprobacion(s, id, ahora = Date.now()) {
  const t = s.alm.load().find(x => x.id === id);
  if (!t || !t.approving) return false;
  if (t.state !== 'waiting') { s.alm.cambiar(id, x => { delete x.approving; }, { por: 'oficina' }); return false; } // un OK de un borrador que ya no espera no vale nada
  const h = await huellaDe(t);
  if (!t.approving.huella || t.approving.huella !== h) { // el borrador cambió después del OK: el dueño aprobó OTRA cosa
    s.alm.cambiar(id, x => { delete x.approving; }, { por: 'oficina' });
    await registrar(s.db, s, id, 'void', 'la oficina', { note: 'El borrador cambió después de tu visto bueno: se descartó el OK y no se envió nada.' });
    s.avisar('approval-void', `«${t.title}» cambió después de tu visto bueno: se descartó el OK y no se envió nada. Revisa el borrador nuevo y vuelve a aprobarlo.`, { level: 'warn', task: id });
    return false;
  }
  s.alm.cambiar(id, x => { delete x.approving; Object.assign(x, { state: 'doing', startedAt: ahora, tomadaPor: 'agente:' + x.agent, corrida: { modo: 'approve', huella: h } }); }, { por: 'oficina' });
  return true;
}

export async function deshacerAprobacion({ s, db, id, por = 'Tú' }) {
  const t = s.alm.load().find(x => x.id === id);
  if (!t || !t.approving) return { status: 409, error: 'ya no se puede deshacer: el envío empezó' };
  s.alm.cambiar(id, x => { delete x.approving; }, { por: 'dueno' });
  await registrar(db, s, id, 'undo', por);
  return { ok: true, id, state: 'waiting' };
}

/** El dueño corrige el borrador a mano, sin otra ejecución. → { status, ... } */
export async function editarBorrador({ s, db, id, draft, por = 'Tú', apr }) {
  const t = s.alm.load().find(x => x.id === id);
  if (!t) return { status: 404, error: 'esa tarea ya no existe' };
  if (t.state !== 'waiting' || t.approving) return { status: 409, error: 'solo se edita un borrador que espera tu visto bueno' };
  const d = String(draft || '').trim(); if (!d) return { status: 400, error: 'el borrador quedó vacío' };
  let hecho; s.alm.cambiar(id, x => { x.draft = x.result = d.slice(0, 60000); x.editedDraft = true; draftFacts(x, apr); hecho = x; }, { por: 'dueno' });
  await registrar(db, s, id, 'edit', por);
  return { status: 200, ok: true, task: s.alm.load().find(x => x.id === id) };
}

/** El reloj: lo aprobado cuya ventana de «deshacer» pasó sale; los recordatorios y la caducidad (G4). */
export async function tickAprobaciones({ s, db, apr, ahora = Date.now() }) {
  let salieron = 0;
  for (const t of s.alm.load()) if (t.approving && t.approving.sendAt <= ahora && await cerrarAprobacion(s, t.id, ahora)) salieron++;
  const d = approvals.due(s.alm.load(), apr, ahora);
  for (const id of d.remind) {
    const t = s.alm.load().find(x => x.id === id); if (!t) continue;
    s.alm.cambiar(id, x => { x.remindedAt = ahora; }, { por: 'oficina' });
    s.avisar('remind', `«${t.title}» espera tu visto bueno desde hace ${Math.max(1, Math.round((ahora - (t.waitingAt || ahora)) / 3600e3))} h.`, { task: t.id });
  }
  for (const id of d.expire) {
    const t = s.alm.load().find(x => x.id === id); if (!t) continue;
    s.alm.cambiar(id, x => { delete x.approving; Object.assign(x, { state: 'done', doneAt: ahora, expired: true, result: `${x.draft || x.result || ''}\n\n---\n⌛ CADUCÓ: pasaron ${apr.expireAfterDays} días sin tu visto bueno y no se envió nada.` }); }, { por: 'oficina' });
    await registrar(db, s, id, 'expire', 'la oficina');
    s.avisar('expired', `«${t.title}» caducó sin tu visto bueno; no se envió nada.`, { task: t.id });
  }
  return { salieron, recordados: d.remind.length, caducados: d.expire.length };
}

export { askLine };
