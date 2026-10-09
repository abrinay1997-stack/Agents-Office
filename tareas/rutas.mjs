// Agents Office (6 oct 2026, planes T1–T4) — /api/tareas/*: organizar una tarea (prioridad, etiquetas, fecha límite, proyecto,
// estimación, bloqueos, orden, pasos), su bitácora, proyectos y etiquetas, la agenda, acciones sobre varias, y lo que un agente
// puede hacer con SU tarea (marcar pasos, anotar, pedir un bloqueo, proponer trabajo, registrar lo hecho). Las rutas de siempre
// (/api/tasks: crear, ejecutar, aprobar…) siguen en serve.mjs. Toda puerta pasa por las mismas reglas: estados.puede y
// permisos.revisar; un agente nunca aprueba, nunca cambia la fecha límite ni la prioridad, y solo toca la tarea que tiene.
import { leerCampos, normalizarPasos, limiteValido, PRIORIDADES } from './modelo.mjs';
import { puede, visible } from './estados.mjs';
import { revisar, puedeMarcarPaso } from './permisos.mjs';
import { ciclo, limpiar, desbloqueadas, pendientes, siguientes } from './dependencias.mjs';
import { colocar } from './orden.mjs';
import { agenda, agendaTexto } from './agenda.mjs';
import { progresoProyecto } from './progreso.mjs';
import { COLORES, ESTADOS_PROYECTO } from './catalogo.mjs';
import { resumenTareas } from './resumen.mjs';
import { iniciar as iniciarCrono, parar as pararCrono, activo as activoCrono } from './cronometro.mjs';
import { DUENO, esDelDueno, dia } from './dueno.mjs';

const ID = /^[a-z0-9]{4,24}$/i;
const MAX_NOTAS = 60;

export function crearRutasTareas({ alm, cat, json, body, webhooks = null, pump = () => {}, agentes = [], depts = {}, leadOf = () => null, avisar = () => {}, altaTarea, nombre = id => id, ahora = () => Date.now() }) {
  const agente = id => agentes.find(a => a.id === id);
  // quién llama: un agente (su MCP manda por: 'agente' y su id), Dimitri, Telegram (cabecera) o el dueño (la página)
  function quien(req, b = {}) {
    if (b.por === 'agente') return agente(b.agente) ? { rol: 'agente', id: b.agente, por: 'agente:' + b.agente } : { error: 'agente desconocido' };
    if (b.por === 'dimitri') return { rol: 'dimitri', por: 'dimitri' };
    if (b.por === 'jefe' && agente(b.agente)?.lead) return { rol: 'jefe', id: b.agente, por: 'jefe:' + b.agente };
    if (req.headers['x-office-by']) return { rol: 'telegram', por: 'telegram:' + String(req.headers['x-office-by']).slice(0, 40) };
    return { rol: 'dueno', por: 'dueno' };
  }
  const catalogo = () => {
    const tareas = alm.load(), t0 = ahora();
    return { proyectos: cat.proyectos().map(p => ({ ...p, progreso: progresoProyecto(p, tareas, t0) })), etiquetas: cat.etiquetas(), colores: COLORES, estadosProyecto: ESTADOS_PROYECTO, prioridades: PRIORIDADES };
  };

  // organizar: los campos de T1 sobre una tarea, en cualquier estado que lo permita
  function organizar(id, b, q) {
    const r0 = leerCampos(b, { existeProyecto: p => !!cat.proyecto(p), existeEtiqueta: e => cat.etiquetas().some(x => x.id === e) });
    if (r0.error) return { status: 400, error: r0.error };
    const c = r0.campos; const claves = Object.keys(c); if (!claves.length) return { status: 400, error: 'no hay nada que cambiar' };
    let desbloquea = false;
    const r = alm.cambiar(id, (t, lista) => {
      const p = revisar(t, claves, q.rol); if (!p.ok) return { error: p.motivo, status: 403 };
      if (c.bloqueadaPor) {
        const l = limpiar(lista, t.id, c.bloqueadaPor), ci = l.length && ciclo(lista, t.id, l);
        if (ci) return { error: `eso haría un círculo: ${ci.map(x => `«${lista.find(y => y.id === x)?.title || x}»`).join(' espera a ')}`, status: 409 };
        c.bloqueadaPor = l; desbloquea = (t.bloqueadaPor || []).length > l.length;
      }
      if (c.pasos) c.pasos = normalizarPasos(c.pasos, t.pasos).map(s => (s.por === 'dueno' && q.rol !== 'dueno' ? { ...s, por: q.por } : s));
      for (const [k, v] of Object.entries(c)) { if (v === null || (Array.isArray(v) && !v.length)) delete t[k]; else t[k] = v; }
    }, { por: q.por });
    if (r.error) return { status: r.status || 400, error: r.error };
    if (desbloquea || c.prioridad || c.orden !== undefined || c.limite !== undefined) setImmediate(pump);
    return { tarea: r.tarea };
  }

  function cambiarEstado(id, a, q) {
    let antes = null;
    const r = alm.cambiar(id, t => {
      antes = t.state;
      const p = puede(t.state, a, q.rol === 'telegram' ? 'telegram' : q.rol); if (!p.ok) return { error: p.motivo, status: p.codigo === 'permiso' ? 403 : 409 };
      if (t.routine && a === 'idea') return { error: 'una ejecución de rutina no vuelve a ideas', status: 409 };
      if (a === 'done' && esDelDueno(t)) { pararCrono(t, DUENO, ahora()); delete t.empezada; Object.assign(t, { doneAt: ahora(), manual: true, hechaPor: q.rol === 'telegram' ? q.por : DUENO, ...(t.result ? {} : { result: 'Hecha por ti.' }) }); } // plan D: la hizo él
      else if (a === 'done') Object.assign(t, { doneAt: ahora(), result: t.result || 'Marcada como hecha, sin ejecutarla.', manual: true });
      if (a === 'next') { t.addedAt = ahora(); delete t.dueAt; delete t.doneAt; delete t.error; if (t.hechaPor) { delete t.hechaPor; delete t.manual; if (t.result === 'Hecha por ti.') delete t.result; } }
      t.state = a;
    }, { por: q.por });
    if (r.error) return { status: r.status || 400, error: r.error };
    if (a === 'next') setImmediate(pump);
    return { tarea: r.tarea, antes };
  }

  rutas.organizar = organizar; rutas.cambiarEstado = cambiarEstado; // 9 oct 2026: el mismo camino para las ops de Dimitri y del asistente (serve.mjs → runOp)
  return rutas;
  async function rutas(req, res, url) {
    const p = url.pathname; if (!p.startsWith('/api/tareas')) return false;
    const m = p.match(/^\/api\/tareas\/([a-z0-9]{4,24})(?:\/(bitacora|organizar|paso|nota|bloqueo|estado|cronometro))?$/i);
    try {
      if (p === '/api/tareas/catalogo' && req.method === 'GET') return json(res, 200, catalogo()), true;
      if (p === '/api/tareas/agenda' && req.method === 'GET') {
        const sp = url.searchParams, a = agenda(alm.load(), { ahora: ahora(), agente: sp.get('agente') || null, dept: sp.get('dept') || null, dias: Math.min(30, +sp.get('dias') || 7) });
        const pl = l => l.map(t => ({ id: t.id, title: t.title, agent: t.agent, dept: t.dept, person: t.person || null, state: t.state, prioridad: t.prioridad, limite: t.limite || null, dueAt: t.dueAt || null, pasos: t.pasos ? [t.pasos.filter(x => x.hecho).length, t.pasos.length] : null }));
        return json(res, 200, { ...Object.fromEntries(['esperanOk', 'hoy', 'vencidas', 'enCurso', 'bloqueadas', 'proximas', 'recientes'].map(k => [k, pl(a[k])])), texto: agendaTexto(a, { nombre }) }), true;
      }
      if (p === '/api/tareas/cronometro' && req.method === 'GET') { const a = activoCrono(alm.load(), String(url.searchParams.get('quien') || 'Tú')); return json(res, 200, { activo: a ? { id: a.tarea.id, title: a.tarea.title, desde: a.desde } : null }), true; }
      if (p === '/api/tareas/webhooks' && req.method === 'GET') return json(res, 200, webhooks ? webhooks.estado() : { destinos: [], historial: [], apagados: {} }), true;
      { const wm = p.match(/^\/api\/tareas\/webhooks\/([a-z0-9_-]{1,40})\/encender$/i); if (wm && req.method === 'POST') { if (quien(req, {}).rol !== 'dueno') return json(res, 403, { error: 'solo el dueño' }), true; webhooks?.encender(wm[1]); return json(res, 200, { ok: true }), true; } }
      if (p === '/api/tareas/resumen' && req.method === 'GET') {
        const dias = Math.max(7, Math.min(180, +url.searchParams.get('dias') || 30)), desde = ahora() - dias * 864e5;
        return json(res, 200, resumenTareas({ tareas: alm.load(), lineas: alm.bitacoraDesde(desde, { tipos: ['estado', 'creada'] }), desde, ahora: ahora(), nombre, depts })), true;
      }
      /* ---- proyectos y etiquetas (solo el dueño y Dimitri los crean; un agente los ve) ---- */
      if (p === '/api/tareas/proyectos' && req.method === 'POST') { const b = await body(req); const q = quien(req, b); if (q.rol === 'agente') return json(res, 403, { error: 'un agente no crea proyectos' }), true; const r = cat.crearProyecto(b); return json(res, r.error ? 400 : 200, r), true; }
      if (p === '/api/tareas/proyectos/restaurar' && req.method === 'POST') { // DESHACER de borrar: el proyecto y sus tareas
        const b = await body(req); const r = cat.restaurarProyecto(b.proyecto); if (r.error) return json(res, 409, r), true;
        const ids = new Set(Array.isArray(b.tareas) ? b.tareas : []); if (ids.size) { const l = alm.load(); for (const t of l) if (ids.has(t.id)) t.proyecto = r.proyecto.id; alm.save(l, { por: 'dueno', motivo: 'deshacer' }); }
        return json(res, 200, r), true;
      }
      { const pm = p.match(/^\/api\/tareas\/proyectos\/(pr-[a-z0-9-]{1,40})$/);
        if (pm && req.method === 'PATCH') { const b = await body(req); if (quien(req, b).rol === 'agente') return json(res, 403, { error: 'un agente no cambia proyectos' }), true; const r = cat.cambiarProyecto(pm[1], b); return json(res, r.error ? r.status || 400 : 200, r), true; }
        if (pm && req.method === 'DELETE') { // sus tareas se quedan (sin proyecto); DESHACER las vuelve a juntar
          const r = cat.borrarProyecto(pm[1]); if (r.error) return json(res, r.status || 400, r), true;
          const l = alm.load(), suyas = l.filter(t => t.proyecto === pm[1]); for (const t of suyas) delete t.proyecto; if (suyas.length) alm.save(l, { por: 'dueno' });
          return json(res, 200, { ok: true, proyecto: r.proyecto, tareas: suyas.map(t => t.id) }), true;
        }
      }
      if (p === '/api/tareas/etiquetas' && req.method === 'POST') { const b = await body(req); const q = quien(req, b); if (q.rol === 'agente') return json(res, 403, { error: 'un agente usa las etiquetas que hay; no las crea' }), true; const r = cat.crearEtiqueta(b); return json(res, r.error ? 400 : 200, r), true; }
      { const em = p.match(/^\/api\/tareas\/etiquetas\/(e-[a-z0-9-]{1,40})$/);
        if (em && req.method === 'PATCH') { const r = cat.cambiarEtiqueta(em[1], await body(req)); return json(res, r.error ? r.status || 400 : 200, r), true; }
        if (em && req.method === 'DELETE') { const r = cat.borrarEtiqueta(em[1]); if (r.error) return json(res, r.status || 400, r), true; const l = alm.load(); let n = 0; for (const t of l) if (t.etiquetas?.includes(em[1])) { t.etiquetas = t.etiquetas.filter(x => x !== em[1]); if (!t.etiquetas.length) delete t.etiquetas; n++; } if (n) alm.save(l, { por: 'dueno' }); return json(res, 200, { ok: true, tareas: n }), true; }
      }
      /* ---- el orden manual (arrastrar) ---- */
      if (p === '/api/tareas/orden' && req.method === 'POST') {
        const b = await body(req); const q = quien(req, b); if (q.rol === 'agente') return json(res, 403, { error: 'un agente no reordena la cola' }), true;
        const ids = Array.isArray(b.ids) ? b.ids.map(String) : []; if (!ids.includes(String(b.id))) return json(res, 400, { error: 'falta la tarea en la lista' }), true;
        const l = alm.load(), porId = new Map(l.map(t => [t.id, t])), vista = ids.map(x => porId.get(x)).filter(Boolean);
        const nuevos = colocar(vista, String(b.id), ids.indexOf(String(b.id)));
        for (const [x, o] of Object.entries(nuevos)) if (porId.get(x)) porId.get(x).orden = o;
        alm.save(l, { por: q.por }); setImmediate(pump); return json(res, 200, { ok: true, orden: nuevos }), true;
      }
      /* ---- varias a la vez (la selección de la Lista); devuelve cómo deshacerlo ---- */
      if (p === '/api/tareas/lote' && req.method === 'POST') {
        const b = await body(req); const q = quien(req, b); if (q.rol !== 'dueno') return json(res, 403, { error: 'solo el dueño cambia varias a la vez' }), true;
        const ids = new Set((Array.isArray(b.ids) ? b.ids : []).map(String).slice(0, 200)); if (!ids.size) return json(res, 400, { error: 'no hay tareas elegidas' }), true;
        const acc = String(b.accion || ''), v = b.valor;
        const l = alm.load(), antes = [], hechas = [], saltadas = [];
        for (const t of l) {
          if (!ids.has(t.id)) continue;
          const foto = { id: t.id, prioridad: t.prioridad, etiquetas: t.etiquetas, proyecto: t.proyecto, limite: t.limite, archived: t.archived, archivedAt: t.archivedAt, state: t.state };
          let ok = true;
          if (acc === 'prioridad' && PRIORIDADES.includes(v) && t.state !== 'done') t.prioridad = v;
          else if (acc === 'etiquetar' && cat.etiquetas().some(e => e.id === v)) { t.etiquetas = [...new Set([...(t.etiquetas || []), v])].slice(0, 8); }
          else if (acc === 'quitar_etiqueta') { t.etiquetas = (t.etiquetas || []).filter(x => x !== v); if (!t.etiquetas.length) delete t.etiquetas; }
          else if (acc === 'proyecto' && (v === null || cat.proyecto(v))) { if (v) t.proyecto = v; else delete t.proyecto; }
          else if (acc === 'limite' && (v === null || limiteValido(v)) && t.state !== 'done') { if (v) t.limite = limiteValido(v); else delete t.limite; }
          else if (acc === 'archivar' && t.state === 'done') { t.archived = true; t.archivedAt = ahora(); }
          else if (acc === 'pedir' && t.state === 'idea') { t.state = 'next'; t.addedAt = ahora(); }
          else ok = false;
          (ok ? hechas : saltadas).push(t.id); if (ok) antes.push(foto);
        }
        if (hechas.length) { alm.save(l, { por: q.por, motivo: 'varias: ' + acc }); setImmediate(pump); }
        return json(res, 200, { ok: true, hechas, saltadas, antes }), true;
      }
      if (p === '/api/tareas/lote/deshacer' && req.method === 'POST') {
        const b = await body(req); const fotos = new Map((Array.isArray(b.antes) ? b.antes : []).map(f => [String(f.id), f])); const l = alm.load(); let n = 0;
        for (const t of l) { const f = fotos.get(t.id); if (!f) continue; for (const k of ['prioridad', 'etiquetas', 'proyecto', 'limite', 'archived', 'archivedAt']) { if (f[k] === undefined || f[k] === null) delete t[k]; else t[k] = f[k]; } if (f.state === 'idea' && t.state === 'next') t.state = 'idea'; n++; }
        if (n) alm.save(l, { por: 'dueno', motivo: 'deshacer' }); return json(res, 200, { ok: true, n }), true;
      }
      /* ---- lo que un AGENTE propone o registra (nace idea o hecha; nunca en cola) ---- */
      if (p === '/api/tareas/borrador' && req.method === 'POST') { // crear_borrador_tarea: trabajo para otro departamento → una IDEA que el dueño o el jefe pide
        const b = await body(req); const q = quien(req, b);
        const dept = String(b.dept || ''); if (!depts[dept] || dept === 'brain') return json(res, 400, { error: 'departamento desconocido' }), true;
        const texto = String(b.texto || '').trim().slice(0, 4000); if (!texto) return json(res, 400, { error: 'di qué hay que hacer' }), true;
        const lead = leadOf(dept);
        const t = altaTarea({ dept, agent: lead?.id, title: String(b.titulo || texto).slice(0, 90), text: texto, why: String(b.porque || '').slice(0, 300), by: q.rol === 'agente' ? 'agente' : q.rol, agenteOrigen: q.id, state: 'idea',
          prioridad: PRIORIDADES.includes(b.prioridad) && q.rol !== 'agente' ? b.prioridad : 'media', limite: q.rol === 'agente' ? undefined : b.limite, proyecto: b.proyecto && cat.proyecto(b.proyecto) ? b.proyecto : undefined }, { por: q.por, arrancar: false });
        if (q.rol === 'agente') avisar('idea', `${nombre(q.id)} propone a ${depts[dept]?.name || dept}: «${t.title}». Está en Tareas → Ideas; pídela si te sirve.`, { task: t.id });
        return json(res, 200, { ok: true, tarea: { id: t.id, title: t.title, state: t.state } }), true;
      }
      if (p === '/api/tareas/registro' && req.method === 'POST') { // registrar_trabajo: algo hecho fuera de una tarea, que quede contado
        const b = await body(req); const q = quien(req, b); const a = q.rol === 'agente' ? agente(q.id) : null;
        const texto = String(b.texto || '').trim().slice(0, 8000); if (!texto) return json(res, 400, { error: 'di qué hiciste' }), true;
        const dept = a ? a.department : depts[b.dept] ? b.dept : null; if (!dept) return json(res, 400, { error: 'departamento desconocido' }), true;
        const t = altaTarea({ dept, agent: a ? a.id : leadOf(dept)?.id, title: String(b.titulo || texto.split('\n')[0]).slice(0, 90), text: texto, by: q.rol === 'agente' ? 'agente' : 'you', agenteOrigen: q.id, proyecto: b.proyecto && cat.proyecto(b.proyecto) ? b.proyecto : undefined }, { por: q.por, arrancar: false });
        alm.cambiar(t.id, x => { Object.assign(x, { state: 'done', doneAt: ahora(), result: texto, registro: true }); }, { por: q.por });
        return json(res, 200, { ok: true, tarea: { id: t.id, title: t.title } }), true;
      }
      if (!m) return false;
      const id = m[1], accion = m[2] || '';
      if (!accion && req.method === 'GET') {
        const l = alm.load(), t = l.find(x => x.id === id); if (!t) return json(res, 404, { error: 'esa tarea ya no existe' }), true;
        return json(res, 200, { tarea: t, visible: visible(t, new Map(l.map(x => [x.id, x]))), bloquean: pendientes(l, t).map(d => ({ id: d.id, title: d.title, state: d.state })), siguientes: siguientes(l, t).map(d => ({ id: d.id, title: d.title, state: d.state })), bitacora: alm.bitacora(id) }), true;
      }
      if (accion === 'bitacora' && req.method === 'GET') return json(res, 200, { lineas: alm.bitacora(id) }), true;
      if (req.method !== 'POST') return false;
      const b = await body(req); const q = quien(req, b); if (q.error) return json(res, 400, q), true;
      if (accion === 'organizar') { const r = organizar(id, b, q); return json(res, r.status || 200, r), true; }
      if (accion === 'estado') {
        if (q.rol === 'agente') return json(res, 403, { error: 'un agente no cambia el estado de una tarea: entrega su trabajo' }), true;
        const r = cambiarEstado(id, String(b.a || ''), q); return json(res, r.status || 200, r), true;
      }
      if (accion === 'cronometro') { // plan T6: el tiempo de una persona (uno activo por persona: empezar otro para el anterior)
        if (q.rol === 'agente') return json(res, 403, { error: 'los agentes miden su tiempo solos' }), true;
        const quienEs = q.rol === 'telegram' ? q.por.slice(9) || 'Tú' : String(b.quien || 'Tú').slice(0, 60);
        const l = alm.load(); let r;
        if (b.accion === 'iniciar') { r = iniciarCrono(l, id, quienEs, ahora()); if (r.error) return json(res, 409, r), true; }
        else { const t = l.find(x => x.id === id); if (!t) return json(res, 404, { error: 'esa tarea ya no existe' }), true; r = { paradas: pararCrono(t, quienEs, ahora()) ? [id] : [] }; }
        alm.save(l, { por: q.por }); return json(res, 200, { ok: true, ...r, activo: (({ tarea, desde } = {}) => tarea ? { id: tarea.id, title: tarea.title, desde } : null)(activoCrono(l, quienEs) || {}) }), true;
      }
      if (accion === 'paso') { // marcar un paso (el agente: solo de su tarea en curso)
        const r = alm.cambiar(id, t => {
          if (q.rol === 'agente' && !puedeMarcarPaso(t, q.id)) return { error: 'solo marcas los pasos de la tarea que tienes en curso', status: 403 };
          const s = (t.pasos || []).find(x => x.id === b.paso || x.texto === b.paso); if (!s) return { error: 'ese paso no está en la tarea', status: 404 };
          s.hecho = b.hecho !== false; s.por = q.por; if (s.hecho) s.at = ahora(); else delete s.at;
          if (b.nota) (t.notas ||= []).push({ at: ahora(), por: q.por, texto: String(b.nota).slice(0, 600) }), t.notas.splice(0, Math.max(0, t.notas.length - MAX_NOTAS));
        }, { por: q.por });
        return json(res, r.error ? r.status || 400 : 200, r.error ? r : { ok: true, pasos: r.tarea.pasos }), true;
      }
      if (accion === 'nota') { // la bitácora de trabajo: «encontré X», «esperé por Y». Solo se añade
        const texto = String(b.texto || '').trim().slice(0, 600); if (!texto) return json(res, 400, { error: 'la nota está vacía' }), true;
        const r = alm.cambiar(id, t => { if (q.rol === 'agente' && !puedeMarcarPaso(t, q.id)) return { error: 'solo anotas en la tarea que tienes en curso', status: 403 }; (t.notas ||= []).push({ at: ahora(), por: q.por, texto }); t.notas.splice(0, Math.max(0, t.notas.length - MAX_NOTAS)); }, { por: q.por });
        return json(res, r.error ? r.status || 400 : 200, r.error ? r : { ok: true }), true;
      }
      if (accion === 'bloqueo') { // pedir_bloqueo: «no puedo seguir sin X». Con una tarea que existe, se bloquea por ella; con un texto, nace una tarea PARA EL DUEÑO
        const l0 = alm.load(), t0 = l0.find(x => x.id === id); if (!t0) return json(res, 404, { error: 'esa tarea ya no existe' }), true;
        if (q.rol === 'agente' && !puedeMarcarPaso(t0, q.id)) return json(res, 403, { error: 'solo pides un bloqueo en la tarea que tienes en curso' }), true;
        const porque = String(b.porque || b.texto || '').trim().slice(0, 400); if (!porque) return json(res, 400, { error: 'di qué te falta' }), true;
        let dep = b.tarea ? l0.find(x => x.id === String(b.tarea)) : null;
        if (b.tarea && !dep) return json(res, 404, { error: 'esa tarea no existe: usa ver_tareas para el id, o describe lo que falta' }), true;
        if (dep && ciclo(l0, id, [dep.id])) return json(res, 409, { error: 'esa tarea ya espera a esta: sería un círculo' }), true;
        if (!dep) dep = altaTarea({ dept: t0.dept, deAgente: t0.agent, title: `Para ti: ${String(b.texto || porque).slice(0, 80)}`, text: `${nombre(t0.agent)} necesita esto para seguir con «${t0.title}»:\n${porque}\n\nCuando lo tengas, márcala hecha (o pon el dato en el Cerebro) y la tarea sigue sola.`, by: 'agente', agenteOrigen: q.id, person: 'Tú', prioridad: 'alta', limite: dia(ahora()), proyecto: t0.proyecto }, { por: q.por, arrancar: false }); // en su Hoy: un agente espera
        alm.cambiar(id, t => { t.bloqueadaPor = [...new Set([...(t.bloqueadaPor || []), dep.id])]; t.pidioBloqueo = { at: ahora(), por: q.por, porque, tarea: dep.id }; (t.notas ||= []).push({ at: ahora(), por: q.por, texto: 'Bloqueada: ' + porque }); }, { por: q.por });
        avisar('bloqueo', `${nombre(t0.agent)} se bloqueó en «${t0.title}»: ${porque}${dep.person === 'Tú' ? ' — te dejé la tarea «' + dep.title + '» en Hoy.' : ''}`, { level: 'warn', task: id });
        return json(res, 200, { ok: true, bloqueadaPor: dep.id, para: dep.person === 'Tú' ? 'el dueño' : nombre(dep.agent) }), true;
      }
      return false;
    } catch (e) { return json(res, 500, { error: e.message }), true; }
  };
}

// el despachador de dependencias (§5.D): al terminar bien una tarea, las que la esperaban y ya no esperan a nadie siguen solas
export function despachadorDependencias({ bus, alm, pump, avisar = () => {}, nombre = id => id }) {
  bus.on('tarea.estado', ({ tarea, a }) => {
    if (a !== 'done') return;
    const l = alm.load(), libres = desbloqueadas(l, tarea.id);
    if (!libres.length) return;
    alm.anotar(libres.map(t => ({ t: Date.now(), tarea: t.id, por: 'oficina', tipo: 'desbloqueada', por_tarea: tarea.id })));
    for (const t of libres) if (t.state === 'next' && !t.person) avisar('desbloqueada', `«${t.title}» ya no espera a nadie: ${nombre(t.agent)} la empieza.`, { task: t.id });
    setImmediate(pump);
  });
}
