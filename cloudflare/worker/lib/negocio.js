// Negocio en la nube (fase 6): los indicadores del dueño («Cómo va el negocio»), las cifras de la empresa y la voz de marca.
// La lógica es la de business.mjs (pura, la misma de la oficina local). Los datos: el doc `kpis` { defs, values } (el mismo que ya usa Anuncios para sus indicadores),
// el doc `cifras` { items } (el que leen los agentes antes de cada trabajo) y la nota `voice` del Cerebro (que leen todos).
import * as business from '../../../business.mjs';
import * as costsCore from '../../../costs-core.mjs';
import { leerDoc, mutarDoc } from './almacen.js';
import { cargarTareas } from './tareas/sesion.js';
import { guardarNotas } from './cerebro.js';

export const DOC_KPIS = 'kpis';
export const kpisVacios = () => ({ defs: [], values: {} });

export async function leerKpis(db) {
  const k = (await leerDoc(db, DOC_KPIS, null)).valor;
  return k && typeof k === 'object' ? { defs: Array.isArray(k.defs) ? k.defs : [], values: k.values && typeof k.values === 'object' ? k.values : {} } : kpisVacios();
}

/** Apunta un valor de un indicador que el dueño YA definió (un id desconocido no se inventa). → { ok, id, value } | { error } — la forma de serve.mjs → recordKpi. */
export async function registrarKpi(db, id, value, from, ahora = Date.now()) {
  let res = { error: `no hay un indicador «${id}»: créalo primero en «Cómo va el negocio»` };
  await mutarDoc(db, DOC_KPIS, kpisVacios(), (k) => {
    k.defs = Array.isArray(k.defs) ? k.defs : []; k.values = k.values && typeof k.values === 'object' ? k.values : {};
    if (!k.defs.some((d) => d.id === id)) { res = { error: `no hay un indicador «${id}»: créalo primero en «Cómo va el negocio»` }; return k; }
    const v = business.num(value);
    if (v === null) { res = { error: 'el valor tiene que ser un número' }; return k; }
    (k.values[id] ||= []).push({ t: ahora, v, from: String(from || '').slice(0, 120) });
    k.values[id] = k.values[id].slice(-400);
    res = { ok: true, id, value: v };
    return k;
  });
  return res;
}

/** Crea o cambia la definición de un indicador, o la quita (`{ remove: id }`). → { ok, def? } | { error } */
export async function cambiarKpi(db, b) {
  let res = { ok: true };
  if (b?.remove) { await mutarDoc(db, DOC_KPIS, kpisVacios(), (k) => ({ ...k, defs: (k.defs || []).filter((d) => d.id !== b.remove) })); return res; }
  const v = business.validateDef(b); if (v.error) return v;
  await mutarDoc(db, DOC_KPIS, kpisVacios(), (k) => {
    const defs = Array.isArray(k.defs) ? k.defs : [], i = defs.findIndex((d) => d.id === v.def.id);
    if (i >= 0) defs[i] = v.def; else defs.push(v.def);
    return { ...k, defs, values: k.values || {} };
  });
  return { ok: true, def: v.def };
}

/** GET /api/business: los indicadores con su tendencia, las cifras de la oficina esta semana y los que se sugieren. */
export async function panelNegocio(db, cfg, env) {
  const k = await leerKpis(db), tareas = await cargarTareas(db), c = costsCore.config(cfg.costs);
  return {
    kpis: k.defs.map((d) => business.summary(d, k.values[d.id] || [])),
    office: business.officeFigures(tareas, { hourly: c.hourlyRate, minutes: (t) => costsCore.minutesSaved(t, c) }),
    suggested: business.SUGGESTED.filter((x) => !k.defs.some((d) => d.id === x.id)),
    hookToken: String(env.AO_HOOK_TOKEN || '').length >= 16,
  };
}

/* ---------- las cifras de la empresa (serve.mjs → saveCifras): un precio o una comisión va aquí, nunca en una skill ---------- */
export async function leerCifras(db) { const v = (await leerDoc(db, 'cifras', { items: [] })).valor; return Array.isArray(v?.items) ? v.items : []; }
export const limpiarCifras = (items) => (Array.isArray(items) ? items : []).map((x) => ({ name: String(x?.name || '').trim().slice(0, 80), value: String(x?.value ?? '').trim().slice(0, 80), unit: String(x?.unit || '').trim().slice(0, 16), note: String(x?.note || '').trim().slice(0, 200), updated: /^\d{4}-\d{2}-\d{2}$/.test(String(x?.updated || '')) ? x.updated : new Date().toISOString().slice(0, 10) })).filter((x) => x.name && x.value).slice(0, 200);
export async function guardarCifras(db, items) {
  const limpias = limpiarCifras(items);
  await mutarDoc(db, 'cifras', { items: [] }, () => ({ items: limpias }));
  return limpias;
}

/* ---------- la voz de marca: la nota `voice` ---------- */
export async function leerVoz(db) { return (await db.prepare("select texto, grupo from notas where nombre = 'voice'").first()) || null; }
export async function guardarVoz(db, texto, ahora = Date.now()) {
  const actual = await leerVoz(db);
  await guardarNotas(db, [{ nombre: 'voice', grupo: actual?.grupo || '20-Brand', oficina: 0, texto: texto.slice(0, 20000) + '\n', actualizado: ahora, tarea: null }]);
}

/* ---------- cifras por confirmar (las que sugiere «Preparar desde mi web»): los agentes no las leen hasta que el dueño las confirma ---------- */
export async function leerPorConfirmar(db) { const v = (await leerDoc(db, 'cifras.porconfirmar', { items: [] })).valor; return Array.isArray(v?.items) ? v.items : []; }
/** Confirma (pasa a `cifras`) o descarta, por nombre. → { confirmadas, descartadas } */
export async function resolverPorConfirmar(db, nombres, confirmar) {
  const quiero = new Set((Array.isArray(nombres) ? nombres : []).map((n) => String(n).toLowerCase()));
  let tomadas = [];
  await mutarDoc(db, 'cifras.porconfirmar', { items: [] }, (d) => { const cur = Array.isArray(d.items) ? d.items : []; tomadas = cur.filter((c) => quiero.has(c.name.toLowerCase())); return { items: cur.filter((c) => !quiero.has(c.name.toLowerCase())) }; });
  if (confirmar && tomadas.length) await mutarDoc(db, 'cifras', { items: [] }, (d) => { const cur = Array.isArray(d.items) ? d.items : []; for (const c of tomadas) { const sin = { ...c, note: '' }; const i = cur.findIndex((x) => x.name.toLowerCase() === c.name.toLowerCase()); if (i >= 0) cur[i] = sin; else cur.push(sin); } return { items: cur }; });
  return confirmar ? { confirmadas: tomadas.length } : { descartadas: tomadas.length };
}
