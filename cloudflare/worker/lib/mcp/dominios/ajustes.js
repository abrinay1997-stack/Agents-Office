// AJUSTES de la empresa por el conector MCP (P5, carril «empresa»): leer los ajustes (sin secretos), las cifras, los modelos por función, los avisos, los disparadores, Telegram, el chat (solo si está
// encendido) y el rastro de auditoría; y cambiar SOLO lo que la lista blanca de `empresa/datos.js` permite: ajustes no sensibles, un indicador, una cifra (con confirmación), el modelo de una función,
// marcar avisos y pausar o habilitar un disparador. Los TOPES de gasto están en costos.js. Nunca un secreto (ni leído ni escrito), nunca personas, candados, restablecer ni flags de gasto (empresa/datos.js → EXCLUIDO).
import { registrarHerramienta } from '../registro.js';
import { conOficina, fallo, rechazo, idem, limpio, sinSecretos, correoCorto, cifra, lineas } from '../empresa/comun.js';
import { AJUSTES_PERMITIDOS, PATH_DE_TOPE, CAMPOS_OCULTOS, motivoFuera } from '../empresa/datos.js';

export const RUTAS = Object.freeze([
  'GET /api/settings', 'POST /api/settings', 'GET /api/cifras', 'POST /api/cifras', 'GET /api/modelos', 'PUT /api/modelos', 'GET /api/notificaciones/config', 'GET /api/status', 'POST /api/notices/read',
  'GET /api/triggers', 'PUT /api/triggers', 'GET /api/settings/telegram', 'GET /api/chat/config', 'POST /api/business/value',
]);
export const LEE = ['valores', 'cifras', 'modelos', 'avisos', 'disparadores', 'telegram', 'chat', 'auditoria'];
export const CAMBIA = ['poner', 'cifra', 'kpi_anotar', 'modelo', 'avisos_leidos', 'pausar_disparador', 'habilitar_disparador'];

const fmt = (v) => (v === undefined || v === null || v === '' ? 'sin dato' : Array.isArray(v) ? (v.length ? v.map((x) => limpio(typeof x === 'object' ? JSON.stringify(x) : x, 40)).join(', ') : '(vacía)') : typeof v === 'object' ? limpio(JSON.stringify(v), 100) : typeof v === 'boolean' ? (v ? 'sí' : 'no') : limpio(v, 100));

/* ---------- leer ---------- */
async function valores(office, grupo) {
  const s = await office('/api/settings');
  const grupos = (s.groups || []).filter(([id]) => !grupo || id === grupo);
  if (!grupos.length) return `No hay un grupo «${limpio(grupo, 30)}». Los grupos: ${(s.groups || []).map(([id]) => id).join(', ')}.`;
  const out = [];
  for (const [id, titulo] of grupos) {
    out.push(`## ${titulo} (${id})`);
    for (const f of (s.fields || []).filter((x) => x.group === id)) {
      const v = s.values?.[f.path];
      const dato = CAMPOS_OCULTOS.includes(f.path) ? (f.path === 'team.people' ? `${Array.isArray(v) ? v.length : 0} personas` : v ? 'puesto' : 'vacío') : fmt(v);
      const quien = f.path in PATH_DE_TOPE ? 'tope: topes_cambiar' : AJUSTES_PERMITIDOS.includes(f.path) ? 'cambia: ajustes_cambiar' : 'solo en la oficina';
      out.push(`- ${f.path} — ${limpio(f.label, 70)}: ${dato} [${quien}]`);
    }
  }
  return out.join('\n');
}
async function cifras(office) {
  const c = await office('/api/cifras');
  const items = Array.isArray(c.items) ? c.items : [];
  return [items.length ? `Cifras de la empresa (${items.length}) — los agentes las usan tal cual:\n${items.map((x) => `- ${limpio(x.name, 60)}: ${limpio(x.value, 60)}${x.unit ? ' ' + limpio(x.unit, 16) : ''}`).join('\n')}` : 'No hay cifras guardadas todavía.',
    Array.isArray(c.porConfirmar) && c.porConfirmar.length ? `${c.porConfirmar.length} por confirmar (propuestas que esperan al dueño).` : ''].filter(Boolean).join('\n');
}
async function modelos(office) {
  const m = await office('/api/modelos'), a = m.ajustes || {};
  const par = (o) => Object.entries(o || {}).map(([k, v]) => `${limpio(k, 30)} → ${limpio(v, 60)}`);
  const activos = (m.activos || []).map((x) => `${limpio(x.id, 50)} (${limpio(x.proveedor, 20)})`);
  return [`Modelo de la oficina: ${a.oficina ? limpio(a.oficina, 60) : 'el de siempre (Claude Sonnet)'}`, `Por función: ${par(a.funciones).join(' · ') || 'ninguna'}`, `Por departamento: ${par(a.departamentos).join(' · ') || 'ninguno'}`,
    `Por agente: ${par(a.agentes).join(' · ') || 'ninguno'}`, `Modelos con llave puesta (${activos.length}): ${lineas(activos, 20).join(', ') || 'ninguno'}`].join('\n');
}
async function avisos(office) {
  const [c, e] = await Promise.all([office('/api/notificaciones/config').catch(() => null), office('/api/status').catch(() => null)]);
  return [c ? `Notificaciones por persona: ${c.activo ? 'encendidas' : 'apagadas'}.${c.lecturaVeResultados === false ? ' Las cuentas de lectura no ven avisos de agentes.' : ''}` : 'Notificaciones: no pude leerlas.',
    e ? `Avisos de la oficina sin leer: ${Number.isFinite(+e.unread) ? +e.unread : 'sin dato'}. Semáforo: ${limpio(e.overall, 20) || 'sin dato'}.` : ''].filter(Boolean).join('\n');
}
async function disparadores(office) {
  const t = await office('/api/triggers'), lista = Array.isArray(t.triggers) ? t.triggers : [];
  const lin = lista.map((x) => `- ${limpio(x.id, 40)} · ${limpio(x.source, 20)} → ${limpio(x.dept, 20)}${x.agent ? '/' + limpio(x.agent, 20) : ''}: ${limpio(x.title || x.text, 70)} · ${x.paused ? 'PAUSADO' : 'vivo'} · hasta ${cifra(x.perHour)}/h${x.needsOk === false ? ' · sin OK' : ''}`);
  return [`Disparadores (${lista.length}); el webhook ${t.token ? 'tiene su secreto puesto' : 'NO tiene secreto: no acepta eventos'}.`, ...lineas(lin, 40), ...(Array.isArray(t.problems) && t.problems.length ? [`Problemas: ${t.problems.slice(0, 5).map((p) => limpio(p, 100)).join(' · ')}`] : [])].join('\n');
}
async function telegram(office) {
  const t = await office('/api/settings/telegram');
  const ap = Object.entries(t.approvers || {}).map(([k, v]) => `${limpio(k, 20)}: ${Array.isArray(v) ? v.length : 0} persona(s)`);
  return `Telegram ${t.on ? 'conectado' : 'sin conectar'} · ${t.owners ?? 0} dueño(s) · ${Object.keys(t.registrados || {}).length} persona(s) registrada(s) · secreto del webhook ${t.webhookSecreto ? 'puesto' : 'sin poner'}. Aprueban por departamento — ${ap.join(' · ') || 'nadie más'}. (Los ids de Telegram no se muestran.)`;
}
async function chat(office) {
  const c = await office('/api/chat/config');
  return `El chat interno del equipo está ${c.activo ? 'ENCENDIDO' : 'apagado'}. Es privado: por este conector no se lee ni se escribe ningún mensaje.`;
}
/** El rastro reciente de auditoría: quién, cuándo y qué tipo; el detalle solo con valores cortos y sin texto de mensajes ni secretos. */
async function auditoria(ctx, limite) {
  const n = Math.max(1, Math.min(60, Math.round(+limite || 30)));
  const { results } = await ctx.db.prepare('select at, tipo, quien, detalle from auditoria order by rowid desc limit ?').bind(n).all();
  const SOLO = /^(accion|evento|op|id|nombre|campo|antes|despues|herramienta|alcance|permitida|capa|rol|para|ok)$/;
  const lin = (results || []).map((f) => {
    let d = {}; try { d = JSON.parse(f.detalle || '{}'); } catch { d = {}; }
    const det = Object.entries(sinSecretos(d && typeof d === 'object' ? d : {})).filter(([k, v]) => SOLO.test(k) && ['string', 'number', 'boolean'].includes(typeof v)).map(([k, v]) => `${k}=${limpio(v, 40)}`).join(' ');
    const cuando = typeof f.at === 'number' ? new Date(f.at).toISOString() : limpio(f.at, 30);
    return `- ${cuando.slice(0, 19)} · ${limpio(f.tipo, 24)} · ${correoCorto(f.quien) || limpio(f.quien, 24)}${det ? ' · ' + det : ''}`;
  });
  return lin.length ? `Rastro de auditoría (los ${lin.length} últimos; sin contenido de mensajes):\n${lin.join('\n')}` : 'Todavía no hay nada en el rastro de auditoría.';
}

registrarHerramienta({
  nombre: 'ajustes',
  titulo: 'Ajustes de la empresa',
  descripcion: 'Lee cómo está configurada la oficina, sin secretos. accion: valores (todos los ajustes con su valor; `grupo` opcional: general, seguridad, aprobaciones, costos, estudio, contenido, anuncios, avisos, conectores, calidad, equipo) · cifras (las de la empresa) · modelos (qué IA corre cada función) · avisos (notificaciones y semáforo) · disparadores · telegram (estado, sin ids) · chat (solo si está encendido) · auditoria (quién cambió qué, reciente). Cada ajuste dice con qué herramienta se cambia.',
  esquema: { type: 'object', additionalProperties: false, required: ['accion'], properties: {
    accion: { type: 'string', enum: LEE }, grupo: { type: 'string', maxLength: 30, description: 'Solo con accion «valores».' }, limite: { type: 'integer', minimum: 1, maximum: 60, description: 'Solo con «auditoria» (30 por defecto).' } } },
  alcance: 'lectura', soloLectura: true,
  ejecutar: async (ctx, a) => {
    try {
      if (a.accion === 'auditoria') return { texto: await auditoria(ctx, a.limite) };
      const office = await conOficina(ctx, ['GET']);
      const f = { valores: () => valores(office, a.grupo), cifras, modelos, avisos, disparadores, telegram, chat }[a.accion];
      return { texto: await (a.accion === 'valores' ? f() : f(office)) };
    } catch (e) { return fallo('ajustes', e); }
  },
});

/* ---------- cambiar ---------- */
const VALOR = { type: ['string', 'number', 'boolean', 'array'], items: { type: 'string', maxLength: 80 }, maxItems: 30, maxLength: 400, description: 'El valor nuevo (texto, número, sí/no o lista de textos según el ajuste).' };
async function poner(office, a) {
  const campo = String(a.campo || '');
  if (campo in PATH_DE_TOPE) return rechazo(`«${campo}» es un tope de gasto: se cambia con «topes_cambiar» (así queda claro el antes y el después).`);
  if (!AJUSTES_PERMITIDOS.includes(campo)) return rechazo(`«${limpio(campo, 60)}» no se cambia desde aquí: ${motivoFuera(campo) || 'no es un ajuste de esta oficina'}.`);
  if (a.valor === undefined) return rechazo('falta «valor».');
  const antes = (await office('/api/settings')).values?.[campo];
  const r = await office('/api/settings', { changes: { [campo]: a.valor } });
  if (r.errors?.length) return rechazo(`No se guardó: ${r.errors.map((e) => limpio(e, 160)).join(' · ')}`);
  const despues = (await office('/api/settings')).values?.[campo];
  return { texto: `${campo}: antes ${fmt(antes)} → ahora ${fmt(despues)}.` };
}
async function cifraPoner(office, a) {
  if (a.confirmado !== true) return rechazo('Cambiar una cifra de la empresa cambia lo que usan TODOS los agentes (precios, comisiones…). Repite con confirmado: true cuando la persona lo haya pedido de forma explícita; aquí te dejo la cifra actual para que la veas: ' + (await cifras(office)).slice(0, 1500));
  const nombre = limpio(a.nombre, 80), v = limpio(a.valor, 120);
  if (!nombre || a.valor === undefined) return rechazo('faltan «nombre» y «valor».');
  const items = (await office('/api/cifras')).items || [], i = items.findIndex((x) => String(x.name).toLowerCase() === nombre.toLowerCase());
  const antes = i >= 0 ? `${items[i].value}${items[i].unit ? ' ' + items[i].unit : ''}` : 'no existía';
  const nueva = { ...(i >= 0 ? items[i] : {}), name: i >= 0 ? items[i].name : nombre, value: v, ...(a.unidad !== undefined ? { unit: limpio(a.unidad, 16) } : {}) };
  const lista = i >= 0 ? items.map((x, k) => (k === i ? nueva : x)) : [...items, nueva];
  if (lista.length > 60) return rechazo('Ya hay 60 cifras: quita alguna en la oficina antes de añadir otra.');
  await office('/api/cifras', { items: lista });
  return { texto: `Cifra «${nombre}»: antes ${limpio(antes, 80)} → ahora ${v}${nueva.unit ? ' ' + nueva.unit : ''}. La usan todos los agentes desde la próxima tarea.` };
}
async function kpi(office, a) {
  const id = String(a.id || ''), v = Number(a.valor);
  if (!id || !Number.isFinite(v)) return rechazo('faltan «id» del indicador y «valor» (un número).');
  const r = await office('/api/business/value', { id, value: v });
  return { texto: r.error ? `No se anotó: ${limpio(r.error, 160)}` : `Anotado ${v} en el indicador «${limpio(id, 40)}».`, ...(r.error ? { esError: true } : {}) };
}
async function modelo(office, a) {
  const ambito = a.ambito, clave = String(a.clave || ''), id = String(a.modelo ?? '');
  if (!['oficina', 'funcion', 'departamento', 'agente'].includes(ambito)) return rechazo('«ambito» es oficina, funcion, departamento o agente.');
  if (ambito !== 'oficina' && !clave) return rechazo(`falta «clave» (la ${ambito}).`);
  const aj = (await office('/api/modelos')).ajustes || {}, nuevo = JSON.parse(JSON.stringify(aj)), tabla = { funcion: 'funciones', departamento: 'departamentos', agente: 'agentes' }[ambito];
  const antes = ambito === 'oficina' ? aj.oficina : aj[tabla]?.[clave];
  if (ambito === 'oficina') nuevo.oficina = id; else { nuevo[tabla] = { ...(nuevo[tabla] || {}) }; if (id) nuevo[tabla][clave] = id; else delete nuevo[tabla][clave]; }
  const r = await office('/api/modelos', { ajustes: nuevo }, 'PUT');
  return { texto: `${ambito}${clave ? ' «' + limpio(clave, 30) + '»' : ''}: antes ${limpio(antes, 60) || 'el modelo por defecto'} → ahora ${id ? limpio(id, 60) : 'el modelo por defecto'}. ${limpio(r.cuando || 'Vale desde la próxima tarea.', 120)}` };
}
async function disparador(office, a, pausar) {
  const id = String(a.id || '');
  const t = (await office('/api/triggers')).triggers || [], x = t.find((y) => y.id === id);
  if (!x) return rechazo(`No hay un disparador «${limpio(id, 40)}». Mira los que hay con ajustes → disparadores.`);
  if (!!x.paused === pausar) return { texto: `El disparador «${id}» ya estaba ${pausar ? 'pausado' : 'vivo'}: no cambié nada.` };
  await office('/api/triggers', { triggers: t.map((y) => (y.id === id ? { ...y, paused: pausar } : y)) }, 'PUT');
  return { texto: `Disparador «${id}»: ${pausar ? 'pausado (ya no crea tareas)' : 'vivo otra vez (vuelve a crear tareas cuando llegue un evento)'}.` };
}
const PERMITE = { poner: 'POST /api/settings', cifra: 'POST /api/cifras', kpi_anotar: 'POST /api/business/value', modelo: 'PUT /api/modelos', avisos_leidos: 'POST /api/notices/read', pausar_disparador: 'PUT /api/triggers', habilitar_disparador: 'PUT /api/triggers' };

registrarHerramienta({
  nombre: 'ajustes_cambiar',
  titulo: 'Cambiar ajustes de la empresa',
  descripcion: 'Cambia lo que se puede cambiar sin riesgo. accion: poner (`campo` + `valor`: solo los ajustes de la lista blanca — nombre, plazos de aprobación, redes, avisos de Telegram, revisión del jefe…; devuelve antes → ahora; los topes de gasto van con topes_cambiar) · cifra (`nombre` + `valor` + `unidad`?; pide `confirmado: true` porque la usan todos los agentes) · kpi_anotar (`id` + número) · modelo (`ambito` oficina|funcion|departamento|agente, `clave`, `modelo`; vacío = el por defecto) · avisos_leidos · pausar_disparador / habilitar_disparador (`id`). Nunca secretos, personas, candados de seguridad ni interruptores de gasto: lee `ajustes` para ver qué es qué.',
  esquema: { type: 'object', additionalProperties: false, required: ['accion'], properties: {
    accion: { type: 'string', enum: CAMBIA }, campo: { type: 'string', maxLength: 60 }, valor: VALOR, nombre: { type: 'string', maxLength: 80, description: 'Nombre de la cifra.' }, unidad: { type: 'string', maxLength: 16 },
    id: { type: 'string', maxLength: 60, description: 'Id del indicador o del disparador.' }, ambito: { type: 'string', enum: ['oficina', 'funcion', 'departamento', 'agente'] }, clave: { type: 'string', maxLength: 40 },
    modelo: { type: 'string', maxLength: 64, description: 'Id de un modelo del catálogo; vacío = quitar el cambio.' }, confirmado: { type: 'boolean', description: 'Solo para «cifra»: la persona lo pidió de forma explícita.' } } },
  alcance: 'oficina', soloLectura: false, destructiva: true, idempotente: true,
  ejecutar: async (ctx, a) => {
    try {
      const hacer = async () => {
        const office = await conOficina(ctx, ['GET', PERMITE[a.accion]]);
        const f = { poner, cifra: cifraPoner, kpi_anotar: kpi, modelo, avisos_leidos: async (o) => { await o('/api/notices/read', {}); return { texto: 'Avisos marcados como leídos.' }; },
          pausar_disparador: (o, x) => disparador(o, x, true), habilitar_disparador: (o, x) => disparador(o, x, false) }[a.accion];
        return f(office, a);
      };
      return await idem(ctx, 'ajustes_cambiar', hacer);
    } catch (e) { return fallo('ajustes_cambiar', e); }
  },
});
