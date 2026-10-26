// Las herramientas INTERNAS de un agente en la nube: lo que en la oficina local son los servidores MCP de la casa (tareas-mcp.mjs, contenido-mcp.mjs, estudio-mcp.mjs).
// Aquí no hay procesos ni HTTP a sí mismo: cada herramienta llama POR FUNCIÓN al módulo que ya está portado (tareas, contenido, estudio), con un `Request` sintético
// que entra por el mismo `manejar(ctx)` que usa la página, así las reglas de cada módulo (quién puede qué, los candados, la huella de lo aprobado) se aplican igual.
//  · Las de tareas y contenido son las MISMAS definiciones y el mismo texto que en local (`tareas-tools.mjs`, `contenido-tools.mjs`, extraídas de los MCP).
//  · Ninguna aprueba, programa ni publica (tests/contenido-mcp.test.mjs y tests/nube-agentes-herramientas.test.mjs lo vigilan).
//  · El Estudio gasta: un motor de pago solo corre en una ejecución APROBADA (aunque safety.mjs lo deje pasar antes del OK en local); la «Prueba» es gratis.
//  · La Biblioteca de habilidades (ver_habilidades, leer_habilidad: solo leen) se ofrece al agente que tiene habilidades (`habilidades: true`, lo decide el ejecutor).
//  · Lo que no está portado (anuncios, la bandeja, lotes y presets) no se ofrece, y `omitidas` dice por qué.
import { TOOLS as TOOLS_TAREAS, crearLlamador as llamadorTareas } from '../../../../tareas-tools.mjs';
import { TOOLS as TOOLS_CONTENIDO, crearLlamador as llamadorContenido } from '../../../../contenido-tools.mjs';
import { TOOLS as TOOLS_HABILIDADES, crearLlamador as llamadorHabilidades } from '../../../../habilidades-tools.mjs';
import { json, error, prohibido, cuerpo } from '../respuesta.js';
import { uuid, ahora } from '../ids.js';

/** Los departamentos que reciben las herramientas del Estudio y de Contenido (los de siempre; Ajustes → Estudio / Contenido los cambia en la local). */
export const DEPTS_ESTUDIO = ['marketing', 'delivery', 'sales', 'ops'];
export const DEPTS_CONTENIDO = ['marketing', 'delivery'];
const SIN_BANDEJA = new Set(['ver_bandeja', 'crear_borrador_respuesta', 'sugerir_ocultar_comentario']); // la Bandeja es de la fase 7

export const OMITIDAS = Object.freeze({
  anuncios: 'Anuncios de Meta todavía no está en la nube (fase 7).',
  bandeja: 'La Bandeja (responder comentarios y mensajes) es de la fase 7.',
  'estudio:lotes y presets': 'Los presets, los lotes y entender video o audio del Estudio todavía no están en la nube (fase 8b).',
});

/** `office(ruta, cuerpo?, método?)` → el JSON de la respuesta del módulo que posee esa ruta. Lanza Error(mensaje del módulo) si contesta con un error. */
export function crearOffice({ env, db, usuario, modulos }) {
  return async function office(pathname, datos, metodo) {
    const m = metodo || (datos ? 'POST' : 'GET');
    const url = new URL('https://oficina.interna' + pathname);
    const req = new Request(url, { method: m, headers: { 'content-type': 'application/json' }, body: datos !== undefined && datos !== null && m !== 'GET' ? JSON.stringify(datos) : undefined });
    const ctx = { req, env, db, usuario, url, ruta: url.pathname, json, error, prohibido, cuerpo, uuid, ahora, waitUntil: () => false };
    for (const mod of modulos) {
      const r = await mod.manejar(ctx); if (!r) continue;
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `la oficina respondió ${r.status}`);
      return j;
    }
    throw new Error('esa ruta todavía no está en la nube');
  };
}

const esquema = t => ({ type: 'object', properties: {}, ...(t.inputSchema || {}) });

/** Las del Estudio que sí existen en la nube. `gasto`: ¿esta ejecución puede gastar en un motor de pago? (solo la aprobada) */
function herramientasEstudio({ office, tarea, gasto }) {
  const defs = [
    { name: 'generar_imagen', description: 'Genera imágenes con el Estudio de la oficina y las guarda en la galería. Úsala cuando la tarea pida imágenes, visuales o piezas para redes. Escribe el prompt completo y concreto. Devuelve la imagen ya hecha (![…](/media/…)) o una línea ⏳ que pones TAL CUAL en tu entregable: la oficina la cambia por el archivo cuando termine. Los motores de pago solo corren en una ejecución aprobada por el dueño; antes, solo la tarjeta de «prueba».',
      inputSchema: { type: 'object', properties: { prompt: { type: 'string' }, cantidad: { type: 'number', description: '1 a 4.' }, modelo: { type: 'string', description: 'Un id de modelo del Estudio; sin él, el del dueño.' }, proporcion: { type: 'string', description: '1:1, 4:5, 9:16, 16:9…' } }, required: ['prompt'] } },
    { name: 'buscar_en_galeria', description: 'Busca en la galería del Estudio (lo generado y lo que subió el dueño: productos, logos, fotos) y devuelve ids para usar en un borrador o como referencia.',
      inputSchema: { type: 'object', properties: { buscar: { type: 'string' }, cantidad: { type: 'number', description: 'Hasta 30.' }, solo_subidas: { type: 'boolean' } } } },
    { name: 'estado_trabajo', description: 'Cómo va un trabajo del Estudio (el id que salió en una línea ⏳).',
      inputSchema: { type: 'object', properties: { trabajo: { type: 'string' } }, required: ['trabajo'] } },
    { name: 'estado_estudio', description: 'Qué motores y modelos tiene listos el dueño y cuánto queda del tope diario y del presupuesto. Consúltalo antes de un pedido grande.',
      inputSchema: { type: 'object', properties: {} } },
  ];
  async function llamar(nombre, a = {}) {
    if (nombre === 'generar_imagen') {
      const prompt = String(a.prompt || '').trim(); if (!prompt) throw new Error('falta el prompt');
      const pedido = { prompt, n: Math.min(4, Math.max(1, Math.round(+a.cantidad || 1))), kind: 'image', ...(a.modelo ? { model: String(a.modelo) } : {}), ...(a.proporcion ? { ratio: String(a.proporcion) } : {}), task: tarea || undefined, wait: 0 };
      if (!gasto) { // antes del OK: solo lo gratis. El módulo del Estudio lo hace cumplir también (un no-administrador solo pide «prueba»).
        const mod = await office('/api/media/models').catch(() => null);
        const modelo = (mod?.models || []).find(m => m.id === pedido.model) || (mod?.models || []).find(m => m.id === mod?.default?.image);
        if (modelo && modelo.engine !== 'prueba') pedido.model = (mod.models.find(m => m.engine === 'prueba' && m.kind === 'image') || {}).id;
      }
      let r;
      try { r = await office('/api/media/jobs', pedido); }
      catch (e) { if (!gasto) return `${e.message}\nEl gasto en motores de pago espera el OK del dueño: deja el prompt completo en tu entrega y se genera cuando lo apruebe.`; throw e; }
      const j = r.job;
      if (j?.state === 'done' && j.items?.length) return j.items.map(f => `![${prompt.slice(0, 60).replace(/[[\]()]/g, '')}](/media/${f.split('/').map(encodeURIComponent).join('/')})`).join('\n');
      return `⏳ Estudio: «${prompt.slice(0, 80)}» (trabajo ${j.id}). Pon esta línea tal cual en tu entregable: la oficina la cambia por el archivo cuando termine.${gasto ? '' : '\n(Sin el OK del dueño solo corre la tarjeta de prueba; el motor real se pide en la ejecución aprobada.)'}`;
    }
    if (nombre === 'buscar_en_galeria') {
      const n = Math.min(30, Math.max(1, +a.cantidad || 12));
      const p = await office(`/api/media?n=${n}${a.buscar ? '&q=' + encodeURIComponent(String(a.buscar).slice(0, 120)) : ''}${a.solo_subidas ? '&filter=up' : ''}`);
      const items = p.items || [];
      return items.length ? `${items.length} archivo(s):\n${items.map(it => `- ${it.file || it.id} · ${it.kind || ''} · «${String(it.prompt || '').slice(0, 80)}»`).join('\n')}` : 'No hay nada en la galería con eso.';
    }
    if (nombre === 'estado_trabajo') {
      const r = await office(`/api/media/jobs/${encodeURIComponent(String(a.trabajo || '').replace(/[^a-z0-9]/gi, ''))}`);
      const j = r.job; return `Trabajo ${j.id}: ${j.state}${j.error ? ' — ' + j.error : ''}${j.items?.length ? '\n' + j.items.map(f => `![](/media/${f})`).join('\n') : ''}`;
    }
    if (nombre === 'estado_estudio') {
      const m = await office('/api/media/models');
      const on = (m.models || []).filter(x => x.on);
      return `Modelos listos: ${on.map(x => x.id).join(', ') || 'ninguno'}. ${m.budget ? `Tope: ${JSON.stringify(m.budget).slice(0, 300)}` : ''}${gasto ? '' : '\nEsta ejecución no gasta en motores de pago (espera el OK del dueño).'}`;
    }
    throw new Error('herramienta desconocida: ' + nombre);
  }
  return { defs, llamar };
}

/**
 * Todo lo que un agente puede llamar además de los conectores MCP remotos.
 * → { defs: [{ nombre: 'mcp__servidor__herramienta', servidor, descripcion, esquema }], omitidas: [motivo], llamar(nombre, args) → texto }
 */
export function herramientasInternas({ env, db, agente, tarea, modulos, gasto = false, quien = null, deptsEstudio = DEPTS_ESTUDIO, deptsContenido = DEPTS_CONTENIDO, habilidades = false }) {
  const usuario = { id: 'agente:' + agente.id, email: `agente:${agente.id}`, rol: gasto ? 'admin' : 'editor', agente: agente.id }; // `agente`: el Estudio anota que lo pidió este agente (by: 'agent')
  // Con rol «admin» solo para el Estudio y solo en una ejecución aprobada: los demás módulos reciben siempre un editor (un agente nunca aprueba en Contenido).
  const office = crearOffice({ env, db, usuario: { ...usuario, rol: 'editor' }, modulos });
  const officeGasto = crearOffice({ env, db, usuario: { ...usuario, email: `agente:${agente.id} (OK de ${quien || 'el dueño'})`, rol: 'admin' }, modulos });
  const defs = [], rutas = new Map(), omitidas = [];
  const sumar = (servidor, lista, llamar) => { for (const t of lista) { const nombre = `mcp__${servidor}__${t.name}`; defs.push({ nombre, servidor, descripcion: t.description, esquema: esquema(t) }); rutas.set(nombre, { llamar, original: t.name }); } };

  sumar('tareas', TOOLS_TAREAS, llamadorTareas({ office, agente: agente.id, tarea }));
  if (habilidades) sumar('habilidades', TOOLS_HABILIDADES, llamadorHabilidades({ office, agente: agente.id })); // la Biblioteca: solo lee (el agente que tiene habilidades)
  if (deptsContenido.includes(agente.department)) sumar('contenido', TOOLS_CONTENIDO.filter(t => !SIN_BANDEJA.has(t.name)), llamadorContenido({ office, agente: agente.id, tarea }));
  if (deptsEstudio.includes(agente.department)) {
    const e = herramientasEstudio({ office: gasto ? officeGasto : office, tarea, gasto });
    sumar('estudio', e.defs, e.llamar);
    omitidas.push(OMITIDAS['estudio:lotes y presets']);
  }
  if (deptsContenido.includes(agente.department)) omitidas.push(OMITIDAS.bandeja);
  omitidas.push(OMITIDAS.anuncios);

  return {
    defs, omitidas,
    async llamar(nombre, args) {
      const r = rutas.get(nombre); if (!r) throw new Error('herramienta desconocida: ' + nombre);
      return String(await r.llamar(r.original, args && typeof args === 'object' ? args : {}));
    },
  };
}
