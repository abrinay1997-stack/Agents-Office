// Agents Office (7 oct 2026, plan D · docs/analisis-tareas-del-dueno-2026-10-07.md) — /api/tareas/* de las TAREAS DEL DUEÑO:
//   POST /api/tareas/mias                 una tarea para él (sin enrutador ni agente: es suya)
//   GET  /api/tareas/mias                 sus listas y cuántas hay (Telegram /mias, los agentes)
//   POST /api/tareas/<id>/tomar           «Lo hago yo»: se la quita a un agente (en cola, programada, idea, fallida o un borrador que espera OK)
//   POST /api/tareas/<id>/delegar         la pasa a un agente (el que elija, el que la tenía, o el que elija el enrutador) o a una persona
//   POST /api/tareas/<id>/empezar         la está haciendo (o la deja para luego); con su cronómetro
//   POST /api/tareas/sugerir              un AGENTE le sugiere algo al dueño: nace idea en su Bandeja; él la acepta o la descarta
// 26 oct 2026: «mía» es de QUIEN LLAMA. En la nube `yo()` devuelve la cuenta de la sesión ({ nombre, admin }) y una tarea mía es la que tiene
// `person: <mi nombre>` (los administradores también ven la del dueño, 'Tú'); en la oficina local `yo()` es null y todo es 'Tú', como siempre.
// `POST /api/tareas/mias { persona }` ASIGNA la tarea a otra cuenta (o persona del equipo) al crearla; `/delegar { a: 'persona' }` la pasa a una.
// Las reglas son las de siempre (tareas/estados.puede, tareas/permisos) más las de tareas/dueno.mjs. Un agente nunca toma, delega ni
// marca hecha una tarea del dueño: solo SUGIERE. Estas rutas van ANTES que las de tareas/rutas.mjs (que leería «mias» como un id).
import { leerCampos, pasosDe, PRIORIDADES, MAX } from './modelo.mjs';
import { puede } from './estados.mjs';
import { DUENO, esDelDueno, puedeTomar, puedeDelegar, deLista, cuentas, LISTAS, dia, resumenDueno } from './dueno.mjs';
import { nombresMios, miNombre } from './identidad.mjs';
import { iniciar as iniciarCrono, parar as pararCrono } from './cronometro.mjs';

const hhmm = ms => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const MAX_SUGERENCIAS = 5; // abiertas por agente: un agente no le llena la bandeja al dueño

export function crearRutasDueno({ alm, cat, json, body, yo = () => null, pump = () => {}, agentes = [], depts = {}, leadOf = () => null, avisar = () => {}, avisarPersona = () => {}, personas = () => [],
  altaTarea, nombre = id => id, enrutar = null, adivinarOk = () => true, exigeOk = () => false, ahora = () => Date.now() }) {
  const agente = id => agentes.find(a => a.id === id);
  const deptOk = k => !!depts[k] && k !== 'brain';
  function quien(req, b = {}) { // la misma lectura que tareas/rutas.mjs
    if (b.por === 'agente') return agente(b.agente) ? { rol: 'agente', id: b.agente, por: 'agente:' + b.agente } : { error: 'agente desconocido' };
    if (b.por === 'dimitri') return { rol: 'dimitri', por: 'dimitri' };
    if (req.headers['x-office-by']) return { rol: 'telegram', por: 'telegram:' + String(req.headers['x-office-by']).slice(0, 40) };
    return { rol: 'dueno', por: 'dueno', yo: yo() };
  }
  const yoDe = q => q.yo || null, nom = q => miNombre(yoDe(q)); // quién es «yo» en esta llamada, y cómo firma (su nombre, o «Tú»)
  const dice = q => (yoDe(q) ? nom(q) : 'El dueño'); // cómo se nombra en un aviso a otra persona
  const comentar = (t, texto, q) => { if (texto) (t.comments ||= []).push({ at: ahora(), by: q ? nom(q) : DUENO, text: texto }); };
  // una persona a la que asignar: de la lista de la oficina (las cuentas de la nube y Ajustes → Equipo), sin distinguir mayúsculas. → el nombre tal cual está allí, o null
  const personaDe = n => { const k = String(n ?? '').trim().toLowerCase(); return k ? personas().find(p => String(p).toLowerCase() === k) || null : null; };
  const ligera = t => ({ id: t.id, title: t.title, state: t.state, prioridad: t.prioridad, limite: t.limite || null, proyecto: t.proyecto || null, empezada: t.empezada || null, dept: t.dept || null, agent: t.agent || null, person: t.person || null, sugeridaPor: t.sugeridaPor || null, delegada: t.delegada || null, doneAt: t.doneAt || null });

  // una tarea para el dueño: lo que escribió (ya leído por tareas/rapida.mjs en la página) + los campos de T1.
  // Con `persona` (26 oct 2026) la tarea nace ASIGNADA a otra cuenta o persona del equipo: es de ella, y yo la sigo en Delegadas.
  function crear(b, q) {
    const r = leerCampos(b, { existeProyecto: p => !!cat.proyecto(p), existeEtiqueta: e => cat.etiquetas().some(x => x.id === e) });
    if (r.error) return { status: 400, error: r.error };
    const title = String(b.title || b.texto || '').trim().slice(0, MAX.titulo), text = String(b.notas ?? b.text ?? '').trim().slice(0, MAX.texto); // el título es lo que hay que hacer; las notas, el detalle
    if (!title) return { status: 400, error: 'escribe qué tienes que hacer' };
    let para = null; // a quién se la asigno (null = para mí)
    if (b.persona !== undefined && b.persona !== null && String(b.persona).trim() && String(b.persona).trim() !== 'yo') {
      const quien = personaDe(b.persona); if (!quien) return { status: 400, error: 'esa persona no está en la oficina: elige a alguien del equipo' };
      if (!nombresMios(yoDe(q)).includes(quien)) para = quien; // asignármela a mí mismo es «para mí»
    }
    const c = { ...r.campos }; for (const k of Object.keys(c)) if (c[k] === null) delete c[k];
    if (!c.limite && Number.isFinite(+b.at) && +b.at > 0) c.limite = `${dia(+b.at)}T${hhmm(+b.at)}`; // «el lunes a las 9»: para una tarea tuya, es la hora a la que la tienes
    const nota = String(b.nota || '').trim().slice(0, 600), por = nom(q);
    const t = altaTarea({ person: para || (q.rol === 'dueno' ? nom(q) : DUENO), dept: deptOk(b.dept) ? b.dept : undefined, title, text: text || '', by: q.rol === 'telegram' ? 'telegram' : q.rol === 'dimitri' ? 'sub' : 'you', ...c,
      ...(para ? { delegada: { at: ahora(), a: 'persona:' + para, por, ...(nota ? { nota } : {}) }, handoff: { at: ahora(), from: por, why: nota } } : {}),
      ...(b.empezar && !para ? { empezada: ahora() } : {}) }, { por: q.por, arrancar: false });
    if (para) { if (nota) alm.cambiar(t.id, x => { comentar(x, nota, q); }, { por: q.por }); avisarPersona(para, `👤 ${dice(q)} te asignó «${t.title}»${nota ? ': ' + nota : ''}.`); }
    else if (b.empezar) alm.cambiar(t.id, (x, l) => { iniciarCrono(l, x.id, nom(q), ahora()); }, { por: q.por });
    return { tarea: t, ...(para ? { a: para } : {}) };
  }

  // «Lo hago yo»: la tarea de un agente pasa a ser del dueño, con todo lo que tenía (el borrador, si esperaba su OK)
  function tomar(id, b, q) {
    let antes = null;
    const r = alm.cambiar(id, t => {
      const p = puedeTomar(t, yoDe(q)); if (!p.ok) return { error: p.motivo, status: 409 };
      antes = t.state;
      const pe = puede(t.state, 'next', 'dueno'); if (!pe.ok) return { error: pe.motivo, status: 409 };
      Object.assign(t, { person: nom(q), tomada: { at: ahora(), estado: antes + (t.error ? ':error' : '') } });
      if (t.agent) t.deAgente = t.agent; delete t.agent; // ya no es de ningún escritorio («Devolver a …» la vuelve a quien la tenía)
      if (antes === 'waiting') { t.borradorAgente = t.draft || t.result || ''; for (const k of ['waitingAt', 'ask', 'preview', 'risk', 'remindedAt']) delete t[k]; }
      if (antes === 'scheduled') { if (!t.limite && t.dueAt) { t.limite = `${dia(t.dueAt)}T${hhmm(t.dueAt)}`; t.tomada.limite = true; } delete t.dueAt; } // la hora a la que iba a correr es la hora a la que la tienes
      if (antes === 'done') { if (t.result) t.borradorAgente = t.partial || t.result; for (const k of ['error', 'errorKind', 'stopped', 'doneAt', 'result', 'attempts', 'lastError']) delete t[k]; }
      for (const k of ['retryAt', 'tomadaPor', 'handoff']) delete t[k];
      t.state = 'next'; t.addedAt = ahora();
      if (b.deshacer) { delete t.tomada; delete t.delegada; if (b.deAgente) t.deAgente = String(b.deAgente); else delete t.deAgente; } // DESHACER de «Delegar»: vuelve a tu lista como estaba
      comentar(t, String(b.nota || '').trim().slice(0, 600), q);
    }, { por: q.por });
    if (r.error) return { status: r.status || 400, error: r.error };
    setImmediate(pump);
    return { tarea: r.tarea, antes };
  }

  // la pasa a otro: a un agente (dept + agente, o el que la tenía, o el enrutador) o a una persona del equipo
  async function delegar(id, b, q) {
    const t0 = alm.load().find(x => x.id === id);
    const p = puedeDelegar(t0, yoDe(q)); if (!p.ok) return { status: t0 ? 409 : 404, error: p.motivo };
    const yoQ = yoDe(q), por = nom(q);
    const nota = String(b.nota || '').trim().slice(0, 600);
    if (b.a === 'persona') {
      const quien = personaDe(b.persona);
      if (!quien) return { status: 400, error: 'esa persona no está en la oficina: elige a alguien del equipo' };
      if (nombresMios(yoQ).includes(quien)) return { status: 400, error: 'esa eres tú: la tarea ya está en tu lista' };
      const r = alm.cambiar(id, (t, l) => {
        if (!esDelDueno(t, yoQ) || t.state === 'done') return { error: 'ya no es tuya o ya está hecha', status: 409 };
        pararCrono(t, por, ahora()); delete t.empezada;
        Object.assign(t, { person: quien, delegada: { at: ahora(), a: 'persona:' + quien, por, ...(nota ? { nota } : {}) }, handoff: { at: ahora(), from: por, why: nota } });
        if (t.state === 'idea') t.state = 'next';
        comentar(t, nota, q);
      }, { por: q.por });
      if (r.error) return { status: r.status || 400, error: r.error };
      avisarPersona(quien, `👤 ${dice(q)} te pasó «${r.tarea.title}»${nota ? ': ' + nota : ''}.`);
      return { tarea: r.tarea, a: quien };
    }
    const dept = deptOk(b.dept) ? b.dept : deptOk(t0.dept) ? t0.dept : null;
    if (!dept) return { status: 400, error: 'elige el departamento que la hará' };
    let ag = b.agente ? agente(b.agente) : null;
    if (b.agente && (!ag || ag.department !== dept)) return { status: 400, error: 'ese agente no es de ese departamento' };
    const texto = [t0.text || t0.title, nota ? `Nota del dueño al delegarla: ${nota}` : ''].filter(Boolean).join('\n\n');
    let plan = [], needsOk = null, como = 'elegido';
    if (!ag && t0.deAgente && agente(t0.deAgente)?.department === dept) { ag = agente(t0.deAgente); como = 'devuelta'; } // vuelve a quien la tenía
    if (!ag && enrutar) { try { const e = await enrutar(dept, texto); ag = agente(e.agent); plan = e.plan || []; needsOk = typeof e.needsOk === 'boolean' ? e.needsOk : null; como = 'enrutador'; } catch {} }
    if (!ag) { ag = leadOf(dept); como = 'jefe'; }
    if (!ag) return { status: 400, error: 'ese departamento no tiene a nadie' };
    const r = alm.cambiar(id, t => {
      if (!esDelDueno(t, yoQ) || t.state === 'done') return { error: 'ya no es tuya o ya está hecha', status: 409 };
      const tom = t.tomada;
      pararCrono(t, por, ahora());
      for (const k of ['person', 'empezada', 'tomada', 'handoff', 'sugeridaPor']) delete t[k];
      Object.assign(t, { dept, agent: ag.id, text: texto, state: 'next', addedAt: ahora(), delegada: { at: ahora(), a: 'agente:' + ag.id, como, por, ...(nota ? { nota } : {}) } });
      if (!(t.pasos || []).length && plan.length) t.pasos = pasosDe(plan, 'enrutador');
      t.needsOk = typeof b.needsOk === 'boolean' ? b.needsOk : typeof t.needsOk === 'boolean' ? t.needsOk : needsOk ?? adivinarOk(texto);
      if (exigeOk(texto)) t.needsOk = true; // un importe por encima del tope del dueño espera su OK siempre (V4.4, G9)
      comentar(t, nota, q);
      if (b.deshacer) { // DESHACER de «Lo hago yo»: vuelve al escritorio como estaba (su hora, si era una programada que aún no llegó)
        for (const k of ['delegada', 'deAgente', 'tomada', 'borradorAgente']) delete t[k];
        if (tom?.limite) delete t.limite; // la fecha que salió de su hora de arranque
        if (b.estado === 'idea') t.state = 'idea';
        else if (b.estado === 'scheduled' && +b.dueAt > ahora()) { t.state = 'scheduled'; t.dueAt = +b.dueAt; }
      }
    }, { por: q.por });
    if (r.error) return { status: r.status || 400, error: r.error };
    setImmediate(pump);
    return { tarea: r.tarea, a: ag.id, como };
  }

  // la está haciendo él (la columna «Haciendo» y su cronómetro) — o la deja para luego
  function empezar(id, b, q) {
    const r = alm.cambiar(id, (t, l) => {
      if (!esDelDueno(t, yoDe(q))) return { error: 'solo empiezas una tarea tuya', status: 409 };
      if (t.state === 'done') return { error: 'ya está hecha: reábrela primero', status: 409 };
      if (b.empezar === false) { delete t.empezada; pararCrono(t, nom(q), ahora()); return; }
      if (t.state === 'idea') t.state = 'next'; // empezar una sugerencia es aceptarla
      if (t.state === 'scheduled') { delete t.dueAt; t.state = 'next'; }
      t.empezada = t.empezada || ahora();
      if (b.crono !== false) iniciarCrono(l, t.id, nom(q), ahora());
    }, { por: q.por });
    return r.error ? { status: r.status || 400, error: r.error } : { tarea: r.tarea };
  }

  // un agente le deja una SUGERENCIA al dueño (una llamada, una decisión, algo que solo él puede hacer)
  function sugerir(b, q) {
    if (q.rol !== 'agente' && q.rol !== 'dimitri') return { status: 403, error: 'esto es para que un agente te sugiera algo; tú añade la tarea directamente' };
    const texto = String(b.texto || '').trim().slice(0, 2000); if (!texto) return { status: 400, error: 'di qué debería hacer el dueño' };
    const porque = String(b.porque || '').trim().slice(0, 400);
    const l = alm.load();
    if (q.rol === 'agente' && l.filter(t => t.sugeridaPor === q.id && t.state === 'idea' && !t.archived).length >= MAX_SUGERENCIAS) return { status: 429, error: `ya le dejaste ${MAX_SUGERENCIAS} sugerencias al dueño sin responder: espera a que las vea` };
    const a = q.rol === 'agente' ? agente(q.id) : null;
    const t = altaTarea({ person: DUENO, dept: a?.department, title: String(b.titulo || texto.split('\n')[0]).slice(0, MAX.titulo), text: texto + (porque ? `\n\nPor qué: ${porque}` : ''), why: porque, state: 'idea', by: q.rol === 'agente' ? 'agente' : 'sub', agenteOrigen: q.id, ...(a ? { sugeridaPor: a.id, deAgente: a.id } : {}), prioridad: PRIORIDADES.includes(b.prioridad) && b.prioridad !== 'alta' ? b.prioridad : 'media' }, { por: q.por, arrancar: false });
    avisar('sugerencia', `${a ? nombre(a.id) : 'Dimitri'} te sugiere: «${t.title}». Está en Tareas → Mías → Bandeja: acéptala o descártala.`, { task: t.id });
    return { tarea: t };
  }

  rutasDueno.tomar = tomar; rutasDueno.delegar = delegar; // 9 oct 2026: las ops de Dimitri y del asistente usan las mismas reglas (serve.mjs → runOp)
  return rutasDueno;
  async function rutasDueno(req, res, url) {
    const p = url.pathname; if (!p.startsWith('/api/tareas')) return false;
    try {
      if (p === '/api/tareas/mias' && req.method === 'GET') {
        const l = alm.load(), t0 = ahora(), desde = url.searchParams.get('desde'), hasta = url.searchParams.get('hasta'), yoQ = yo();
        if (/^\d{4}-\d{2}-\d{2}$/.test(desde || '') && /^\d{4}-\d{2}-\d{2}$/.test(hasta || '')) // el calendario: las tuyas que vencen en esos días
          return json(res, 200, { tareas: l.filter(t => esDelDueno(t, yoQ) && !t.archived && t.limite && String(t.limite).slice(0, 10) >= desde && String(t.limite).slice(0, 10) <= hasta).map(ligera) }), true;
        const listas = Object.fromEntries(LISTAS.map(x => { const r = deLista(l, x.k, { ahora: t0, yo: yoQ }); return [x.k, { pendientes: r.pendientes.map(ligera), hechas: r.hechas.length }]; }));
        return json(res, 200, { cuentas: cuentas(l, { ahora: t0, yo: yoQ }), listas, texto: resumenDueno(l, { ahora: t0, nombre, yo: yoQ }) }), true;
      }
      if (p === '/api/tareas/mias' && req.method === 'POST') {
        const b = await body(req); const q = quien(req, b); if (q.error) return json(res, 400, q), true;
        if (q.rol === 'agente') return json(res, 403, { error: 'un agente no le crea tareas al dueño: se las sugiere (sugerir_al_dueno)' }), true;
        const r = crear(b, q); return json(res, r.status || 200, r.error ? r : { ok: true, tarea: r.tarea, ...(r.a ? { a: r.a } : {}) }), true;
      }
      if (p === '/api/tareas/sugerir' && req.method === 'POST') { const b = await body(req); const q = quien(req, b); if (q.error) return json(res, 400, q), true; const r = sugerir(b, q); return json(res, r.status || 200, r.error ? r : { ok: true, tarea: { id: r.tarea.id, title: r.tarea.title, state: r.tarea.state } }), true; }
      const m = p.match(/^\/api\/tareas\/([a-z0-9]{4,24})\/(tomar|delegar|empezar)$/i);
      if (!m || req.method !== 'POST') return false;
      const b = await body(req); const q = quien(req, b); if (q.error) return json(res, 400, q), true;
      if (q.rol === 'agente' || q.rol === 'dimitri') return json(res, 403, { error: q.rol === 'agente' ? 'un agente no toma ni delega las tareas del dueño: se las sugiere' : 'eso lo decide el dueño' }), true;
      const r = m[2] === 'tomar' ? tomar(m[1], b, q) : m[2] === 'delegar' ? await delegar(m[1], b, q) : empezar(m[1], b, q);
      return json(res, r.status || 200, r.error ? r : { ok: true, ...r }), true;
    } catch (e) { return json(res, 500, { error: e.message }), true; }
  };
}
