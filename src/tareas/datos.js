// La vista Tareas (plan T2, 6 oct 2026) — sus DATOS. Con la oficina (servida): la API de verdad (/api/tasks, /api/tareas/*).
// En la demo (file://): una oficina de ejemplo en memoria, con las MISMAS reglas puras (tareas/*.mjs), rotulada como ejemplo.
// Una sola cara para las dos: la vista no sabe cuál tiene.
import { leerCampos, normalizarPasos, crearTarea, PRIORIDADES } from '../../tareas/modelo.mjs';
import { puede } from '../../tareas/estados.mjs';
import { ciclo, limpiar } from '../../tareas/dependencias.mjs';
import { colocar } from '../../tareas/orden.mjs';
import { progresoProyecto } from '../../tareas/progreso.mjs';
import { resumenTareas } from '../../tareas/resumen.mjs';
import { demoTareas, demoCatalogo } from './demo.js';
import { iniciar as iniciarCrono, parar as pararCrono } from '../../tareas/cronometro.mjs';
import { DUENO, esDelDueno, puedeTomar, puedeDelegar, dia } from '../../tareas/dueno.mjs';

async function pedir(metodo, ruta, cuerpo) {
  const r = await fetch(ruta, { method: metodo, headers: cuerpo ? { 'content-type': 'application/json' } : undefined, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `la oficina respondió ${r.status}`); return j;
}

export function crearDatos({ servida, agentes = [] }) {
  if (servida) return {
    demo: false,
    lista: () => pedir('GET', '/api/tasks?light=1'),
    catalogo: () => pedir('GET', '/api/tareas/catalogo'),
    detalle: id => pedir('GET', `/api/tareas/${id}`),
    crear: c => pedir('POST', '/api/tasks', c),
    organizar: (id, c) => pedir('POST', `/api/tareas/${id}/organizar`, c),
    editar: (id, c) => pedir('PATCH', `/api/tasks/${id}`, c),
    estado: (id, a) => pedir('POST', `/api/tareas/${id}/estado`, { a }),
    paso: (id, paso, hecho) => pedir('POST', `/api/tareas/${id}/paso`, { paso, hecho }),
    orden: (id, ids) => pedir('POST', '/api/tareas/orden', { id, ids }),
    lote: (ids, accion, valor) => pedir('POST', '/api/tareas/lote', { ids, accion, valor }),
    deshacerLote: antes => pedir('POST', '/api/tareas/lote/deshacer', { antes }),
    resumen: dias => pedir('GET', `/api/tareas/resumen?dias=${dias}`),
    cronometro: (id, accion) => pedir('POST', `/api/tareas/${id}/cronometro`, { accion }),
    webhooks: () => pedir('GET', '/api/tareas/webhooks'), encenderWebhook: id => pedir('POST', `/api/tareas/webhooks/${encodeURIComponent(id)}/encender`, {}),
    proyecto: { crear: c => pedir('POST', '/api/tareas/proyectos', c), cambiar: (id, c) => pedir('PATCH', `/api/tareas/proyectos/${id}`, c), borrar: id => pedir('DELETE', `/api/tareas/proyectos/${id}`), restaurar: (proyecto, tareas) => pedir('POST', '/api/tareas/proyectos/restaurar', { proyecto, tareas }) },
    etiqueta: { crear: c => pedir('POST', '/api/tareas/etiquetas', c), cambiar: (id, c) => pedir('PATCH', `/api/tareas/etiquetas/${id}`, c), borrar: id => pedir('DELETE', `/api/tareas/etiquetas/${id}`) },
    accion: {
      aprobar: id => pedir('POST', `/api/tasks/${id}/approve`, {}),
      deshacerAprobar: id => pedir('POST', `/api/tasks/${id}/undo`, {}),
      devolver: (id, feedback) => pedir('POST', `/api/tasks/${id}/reject`, { feedback }),
      ejecutar: id => pedir('POST', `/api/tasks/${id}/run`, {}),
      detener: id => pedir('POST', `/api/tasks/${id}/stop`, {}),
      repetir: id => pedir('POST', `/api/tasks/${id}/repeat`, {}),
      archivar: (id, archived = true) => pedir('POST', `/api/tasks/${id}/archive`, { archived }),
      borrar: id => pedir('DELETE', `/api/tasks/${id}`),
      comentar: (id, text) => pedir('POST', `/api/tasks/${id}/comment`, { text }),
      persona: (id, person) => pedir('POST', `/api/tasks/${id}/person`, { person: person || '' }),
    },
    mias: { // plan D (7 oct 2026): las tareas del dueño
      crear: c => pedir('POST', '/api/tareas/mias', c).then(r => r.tarea),
      tomar: (id, extra = {}) => pedir('POST', `/api/tareas/${id}/tomar`, typeof extra === 'string' ? { nota: extra } : extra),
      delegar: (id, c) => pedir('POST', `/api/tareas/${id}/delegar`, c),
      empezar: (id, empezar = true) => pedir('POST', `/api/tareas/${id}/empezar`, { empezar }),
    },
  };

  // ---- la demo: todo en memoria, con las mismas reglas ----
  const T = demoTareas(agentes), C = demoCatalogo(), bit = new Map();
  const anotar = (id, l) => { if (!bit.has(id)) bit.set(id, []); bit.get(id).push({ t: Date.now(), por: 'dueno', ...l }); };
  const una = id => { const t = T.find(x => x.id === id); if (!t) throw new Error('esa tarea ya no existe'); return t; };
  const copia = x => JSON.parse(JSON.stringify(x));
  let n = 100;
  return {
    demo: true,
    lista: async () => copia(T),
    catalogo: async () => ({ proyectos: C.proyectos.map(p => ({ ...p, progreso: progresoProyecto(p, T) })), etiquetas: copia(C.etiquetas), colores: ['azul', 'verde', 'ambar', 'rojo', 'violeta', 'cian', 'rosa', 'gris'], prioridades: PRIORIDADES }),
    detalle: async id => { const t = una(id); const porId = new Map(T.map(x => [x.id, x])); return { tarea: copia(t), bloquean: (t.bloqueadaPor || []).map(i => porId.get(i)).filter(d => d && d.state !== 'done').map(d => ({ id: d.id, title: d.title, state: d.state })), siguientes: T.filter(x => (x.bloqueadaPor || []).includes(id)).map(d => ({ id: d.id, title: d.title, state: d.state })), bitacora: bit.get(id) || [{ t: t.addedAt, tipo: 'creada', por: 'dueno', estado: t.state }] }; },
    async crear(c) {
      const a = agentes.find(x => x.dept === c.dept && x.lead) || agentes.find(x => x.dept === c.dept) || agentes[0];
      const r = leerCampos(c); if (r.error) throw new Error(r.error);
      const t = crearTarea({ dept: c.dept, agent: a.id, text: c.text, title: c.title, state: c.idea ? 'idea' : 'next', dueAt: c.at || undefined, ...r.campos, plan: ['Leer lo que hay', 'Hacerlo', 'Revisarlo'] }, { id: () => 'demo' + ++n });
      T.push(t); anotar(t.id, { tipo: 'creada', estado: t.state }); return copia(t);
    },
    async organizar(id, c) {
      const t = una(id); const r = leerCampos(c, { existeProyecto: p => C.proyectos.some(x => x.id === p), existeEtiqueta: e => C.etiquetas.some(x => x.id === e) }); if (r.error) throw new Error(r.error);
      if (r.campos.bloqueadaPor) { r.campos.bloqueadaPor = limpiar(T, id, r.campos.bloqueadaPor); if (ciclo(T, id, r.campos.bloqueadaPor)) throw new Error('eso haría un círculo: dos tareas esperándose'); }
      if (r.campos.pasos) r.campos.pasos = normalizarPasos(r.campos.pasos, t.pasos);
      for (const [k, v] of Object.entries(r.campos)) { if (v === null || (Array.isArray(v) && !v.length)) delete t[k]; else t[k] = v; anotar(id, { tipo: 'campo', campo: k, despues: v }); }
      return { tarea: copia(t) };
    },
    async editar(id, c) { const t = una(id); if (c.text !== undefined) { t.text = c.text; if (!esDelDueno(t) && c.text) t.title = c.text.slice(0, 90); } if (c.title) t.title = c.title; if (c.dept !== undefined && esDelDueno(t)) { if (c.dept) t.dept = c.dept; else delete t.dept; } if (c.agent) { t.agent = c.agent; t.dept = agentes.find(a => a.id === c.agent)?.dept || t.dept; } if (c.at === null) { delete t.dueAt; t.state = 'next'; } else if (c.at) { t.dueAt = c.at; t.state = 'scheduled'; } return copia(t); },
    async estado(id, a) { const t = una(id); const p = puede(t.state, a, 'dueno'); if (!p.ok) throw new Error(p.motivo); const antes = t.state; t.state = a; if (a === 'done') { t.doneAt = Date.now(); if (esDelDueno(t)) { delete t.empezada; pararCrono(t, DUENO); t.result = t.result || 'Hecha por ti.'; } else t.result = t.result || 'Marcada como hecha, sin ejecutarla.'; } if (a === 'next') { delete t.doneAt; if (t.result === 'Hecha por ti.') delete t.result; } anotar(id, { tipo: 'estado', de: antes, a }); return { tarea: copia(t), antes }; },
    async paso(id, paso, hecho) { const t = una(id); const s = (t.pasos || []).find(x => x.id === paso); if (!s) throw new Error('ese paso no está'); s.hecho = hecho; anotar(id, { tipo: 'paso', accion: hecho ? 'hecho' : 'desmarcado', texto: s.texto }); return { pasos: copia(t.pasos) }; },
    async orden(id, ids) { const vista = ids.map(x => T.find(t => t.id === x)).filter(Boolean); for (const [k, o] of Object.entries(colocar(vista, id, ids.indexOf(id)))) { const t = T.find(x => x.id === k); if (t) t.orden = o; } return { ok: true }; },
    async lote(ids, accion, valor) {
      const antes = [], hechas = [];
      for (const t of T) { if (!ids.includes(t.id)) continue; antes.push({ id: t.id, prioridad: t.prioridad, etiquetas: t.etiquetas, proyecto: t.proyecto, limite: t.limite, archived: t.archived, state: t.state });
        if (accion === 'prioridad') t.prioridad = valor; else if (accion === 'etiquetar') t.etiquetas = [...new Set([...(t.etiquetas || []), valor])]; else if (accion === 'proyecto') { if (valor) t.proyecto = valor; else delete t.proyecto; } else if (accion === 'limite') { if (valor) t.limite = valor; else delete t.limite; } else if (accion === 'archivar' && t.state === 'done') t.archived = true; else if (accion === 'pedir' && t.state === 'idea') t.state = 'next'; else { antes.pop(); continue; }
        hechas.push(t.id); }
      return { ok: true, hechas, saltadas: ids.filter(x => !hechas.includes(x)), antes };
    },
    async deshacerLote(antes) { for (const f of antes) { const t = T.find(x => x.id === f.id); if (!t) continue; for (const k of ['prioridad', 'etiquetas', 'proyecto', 'limite', 'archived']) { if (f[k] == null) delete t[k]; else t[k] = f[k]; } if (f.state === 'idea') t.state = 'idea'; } return { ok: true }; },
    async cronometro(id, accion) { const t = una(id); if (accion === 'iniciar') iniciarCrono(T, id, 'Tú'); else pararCrono(t, 'Tú'); return { ok: true }; },
    webhooks: async () => ({ destinos: [], historial: [], apagados: {} }), encenderWebhook: async () => ({ ok: true }),
    resumen: async dias => resumenTareas({ tareas: T, lineas: [], desde: Date.now() - dias * 864e5, nombre: id => agentes.find(a => a.id === id)?.name || id }),
    proyecto: {
      async crear(c) { if (!String(c.nombre || '').trim()) throw new Error('el proyecto necesita un nombre'); const p = { id: 'pr-demo' + ++n, nombre: String(c.nombre).trim(), color: c.color || 'azul', estado: 'activo', ...(c.limite ? { limite: c.limite } : {}), ...(c.objetivo ? { objetivo: c.objetivo } : {}) }; C.proyectos.push(p); return { proyecto: p }; },
      async cambiar(id, c) { const p = C.proyectos.find(x => x.id === id); Object.assign(p, c); return { proyecto: p }; },
      async borrar(id) { const p = C.proyectos.find(x => x.id === id); C.proyectos.splice(C.proyectos.indexOf(p), 1); const tareas = T.filter(t => t.proyecto === id).map(t => { delete t.proyecto; return t.id; }); return { ok: true, proyecto: p, tareas }; },
      async restaurar(p, tareas) { C.proyectos.push(p); for (const t of T) if (tareas.includes(t.id)) t.proyecto = p.id; return { proyecto: p }; },
    },
    etiqueta: {
      async crear(c) { const nombre = String(c.nombre || '').replace(/^#/, '').trim(); const ya = C.etiquetas.find(e => e.nombre.toLowerCase() === nombre.toLowerCase()); if (ya) return { etiqueta: ya }; const e = { id: 'e-' + nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-'), nombre, color: c.color || ['azul', 'verde', 'ambar', 'violeta', 'cian', 'rosa'][C.etiquetas.length % 6] }; C.etiquetas.push(e); return { etiqueta: e }; },
      async cambiar(id, c) { const e = C.etiquetas.find(x => x.id === id); Object.assign(e, c); return { etiqueta: e }; },
      async borrar(id) { C.etiquetas.splice(C.etiquetas.findIndex(x => x.id === id), 1); for (const t of T) if (t.etiquetas) t.etiquetas = t.etiquetas.filter(x => x !== id); return { ok: true }; },
    },
    accion: {
      async aprobar(id) { const t = una(id); t.state = 'done'; t.doneAt = Date.now(); t.approved = true; return { ok: true }; },
      async deshacerAprobar(id) { const t = una(id); t.state = 'waiting'; delete t.approved; return { ok: true }; },
      async devolver(id) { const t = una(id); t.state = 'doing'; return { ok: true }; },
      async ejecutar(id) { const t = una(id); t.state = 'doing'; t.startedAt = Date.now(); return { ok: true }; },
      async detener(id) { const t = una(id); Object.assign(t, { state: 'done', error: true, stopped: true, doneAt: Date.now(), result: 'Detenida por ti antes de terminar.' }); return { ok: true }; },
      async repetir(id) { const s = una(id); const t = crearTarea({ ...s, text: s.text, plan: s.plan }, { id: () => 'demo' + ++n }); T.push(t); return t; },
      async archivar(id, archived = true) { una(id).archived = archived; return { ok: true }; },
      async borrar(id) { T.splice(T.findIndex(x => x.id === id), 1); return { ok: true }; },
      async comentar(id, text) { const t = una(id); (t.comments ||= []).push({ at: Date.now(), by: 'Tú', text }); return { ok: true, comments: t.comments }; },
      async persona(id, person) { const t = una(id); if (person) t.person = person; else delete t.person; return { ok: true }; },
    },
    mias: { // plan D: las mismas reglas (tareas/dueno.mjs), en memoria
      async crear(c) { const r = leerCampos(c); if (r.error) throw new Error(r.error); const title = String(c.title || c.texto || '').trim(); if (!title) throw new Error('escribe qué tienes que hacer'); const extra = { ...r.campos }; if (!extra.limite && c.at) { const d = new Date(c.at); extra.limite = `${dia(c.at)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; } const t = crearTarea({ person: DUENO, title, text: c.notas || '', dept: c.dept || undefined, ...extra }, { id: () => 'demo' + ++n }); T.push(t); anotar(t.id, { tipo: 'creada', estado: t.state }); return copia(t); },
      async tomar(id, extra = {}) { const t = una(id); const p = puedeTomar(t); if (!p.ok) throw new Error(p.motivo); const antes = t.state; Object.assign(t, { person: DUENO, deAgente: t.agent, tomada: { at: Date.now(), estado: antes }, state: 'next' }); delete t.agent; if (antes === 'waiting') t.borradorAgente = t.draft || t.result; delete t.dueAt; delete t.error; if (extra.deshacer) { delete t.tomada; delete t.delegada; if (extra.deAgente) t.deAgente = extra.deAgente; else delete t.deAgente; } anotar(id, { tipo: 'campo', campo: 'person', despues: DUENO }); return { ok: true, tarea: copia(t), antes }; },
      async delegar(id, c) {
        const t = una(id); const p = puedeDelegar(t); if (!p.ok) throw new Error(p.motivo); pararCrono(t, DUENO); delete t.empezada;
        if (c.a === 'persona') { Object.assign(t, { person: c.persona, delegada: { at: Date.now(), a: 'persona:' + c.persona, nota: c.nota } }); return { ok: true, tarea: copia(t), a: c.persona }; }
        const dept = c.dept || t.dept, ag = agentes.find(a => a.id === c.agente && a.dept === dept) || agentes.find(a => a.id === t.deAgente && a.dept === dept) || agentes.find(a => a.dept === dept && a.lead);
        if (!ag) throw new Error('elige el departamento que la hará');
        delete t.person; Object.assign(t, { dept, agent: ag.id, state: 'next', delegada: { at: Date.now(), a: 'agente:' + ag.id, nota: c.nota } }); if (!(t.pasos || []).length) t.pasos = normalizarPasos(['Leer lo que hay', 'Hacerlo', 'Revisarlo']);
        if (c.deshacer) { for (const k of ['delegada', 'deAgente', 'tomada', 'borradorAgente']) delete t[k]; if (c.estado === 'idea') t.state = 'idea'; else if (c.estado === 'scheduled' && c.dueAt > Date.now()) { t.state = 'scheduled'; t.dueAt = c.dueAt; } }
        return { ok: true, tarea: copia(t), a: ag.id };
      },
      async empezar(id, empezar = true) { const t = una(id); if (!esDelDueno(t)) throw new Error('solo empiezas una tarea tuya'); if (empezar) { if (t.state === 'idea') t.state = 'next'; t.empezada = t.empezada || Date.now(); iniciarCrono(T, id, DUENO); } else { delete t.empezada; pararCrono(t, DUENO); } return { ok: true, tarea: copia(t) }; },
    },
  };
}
