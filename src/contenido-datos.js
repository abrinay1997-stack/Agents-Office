// Agents Office V4.7 (30 sep 2026) — de dónde salen las piezas de contenido para la pantalla.
// Con la oficina corriendo (`npm start`) hablan con /api/contenido/*; en la demo (el archivo abierto con doble clic, sin servidor) viven en la memoria
// de la página, con las mismas reglas, para que se pueda probar todo sin escribir nada en disco. Las dos devuelven lo mismo:
//   list({ desde, hasta, sinFecha }) → { piezas, resumen }   ·   create(datos) · patch(id, datos) · approve(id) · back(id, estado) · remove(id)
// Cada pieza trae `revision: { errores, avisos, arreglos }` (las reglas de cada red, portadas de Juancito Ads en contenido-reglas.js).
import { revisarPublicacion, postDePieza } from './contenido-reglas.js';

const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const PUBLICABLES = ['fecha', 'hora', 'formato', 'redes', 'medios', 'texto', 'hashtags', 'hashtagsEnComentario', 'comentario', 'textoFacebook', 'historias', 'historiaTambien'];
const huella = p => JSON.stringify(PUBLICABLES.map(k => p[k] ?? null));
const revisar = p => { const r = revisarPublicacion(postDePieza(p), p.redes); return { errores: r.errores, avisos: r.avisos, arreglos: r.arreglos }; };
const conRevision = p => ({ ...p, cambiadaTrasAprobar: p.estado === 'aprobada' && !!p.aprobada && p.aprobada.huella !== huella(p), revision: revisar(p) });

/** Las piezas de la demo: unos días alrededor de hoy, con lo que hace falta para ver cada estado y cada aviso. */
function piezasDemo() {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const dia = n => { const d = new Date(hoy); d.setDate(d.getDate() + n); return ymd(d); };
  const base = { titulo: '', fecha: '', hora: '', formato: 'post', redes: ['instagram', 'facebook'], estado: 'borrador', responsable: '', medios: [], historiaTambien: false, historias: [], texto: '', comentario: '', hashtags: '', hashtagsEnComentario: false, textoFacebook: '', notas: '', origen: 'dueno', tarea: '', creada: new Date().toISOString(), actualizada: new Date().toISOString(), aprobada: null };
  let n = 0; const mk = o => ({ ...base, id: `p-demo-${++n}`, ...o });
  const ok = p => ({ ...p, estado: 'aprobada', aprobada: { cuando: new Date().toISOString(), huella: huella(p), por: 'Demo' } });
  return [
    ok(mk({ titulo: 'Examen visual gratis', fecha: dia(1), hora: '09:00', formato: 'carrusel', texto: 'Agenda tu examen visual gratis y sal con tus lentes en 40 minutos. ✦', hashtags: '#optica #gafas', medios: ['demo/a.jpg', 'demo/b.jpg'] })),
    mk({ titulo: 'Kit de limpieza de regalo', fecha: dia(2), hora: '12:30', formato: 'post', estado: 'revision', texto: 'Por la compra de tus lentes, elige tu regalo: kit de limpieza, antipho o regalo sorpresa.', medios: ['demo/c.jpg'], origen: 'agente:newt' }),
    mk({ titulo: 'Reel: así se prueba un lente', fecha: dia(3), hora: '18:00', formato: 'reel', texto: 'Mira cómo probamos tus lentes paso a paso.', origen: 'agente:newt' }),
    mk({ titulo: 'Gafas de sol de regalo', fecha: dia(5), formato: 'post', texto: 'Gafas de sol GRATIS por la compra de tus lentes.', medios: ['demo/d.jpg'], origen: 'agente:newt' }),
    mk({ titulo: 'Historia: horario de la semana', fecha: dia(4), hora: '08:00', formato: 'historia', redes: ['instagram'], medios: ['demo/e.jpg'], estado: 'revision' }),
    mk({ titulo: 'Idea: testimonios de clientes', estado: 'idea', texto: 'Tres clientes cuentan cómo cambió su día ver bien.', redes: ['instagram'] }),
    mk({ titulo: 'Idea: mitos de la vista', estado: 'idea', redes: ['instagram', 'facebook'] }),
  ];
}

export function crearDatos({ served, now = () => new Date() }) {
  let demo = null;
  const mem = () => (demo ||= piezasDemo());
  const enRango = (p, { desde, hasta, sinFecha }) => (p.fecha ? (!desde || p.fecha >= desde) && (!hasta || p.fecha <= hasta) : !!sinFecha || (!desde && !hasta));
  const orden = (a, b) => (a.fecha || '9999').localeCompare(b.fecha || '9999') || (a.hora || '99').localeCompare(b.hora || '99') || a.creada.localeCompare(b.creada);
  const resumenDe = todas => { const h = ymd(now()), e7 = new Date(now()); e7.setDate(e7.getDate() + 7); return { total: todas.length, revisar: todas.filter(p => p.estado === 'revision').length, borradores: todas.filter(p => p.estado === 'borrador' || p.estado === 'idea').length, aprobadas: todas.filter(p => p.estado === 'aprobada').length, cambiadas: todas.filter(p => p.cambiadaTrasAprobar).length, sinFecha: todas.filter(p => !p.fecha).length, proximas7: todas.filter(p => p.fecha && p.fecha >= h && p.fecha <= ymd(e7)).length }; };

  async function http(method, path, body) {
    const r = await fetch(path, { method, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || `la oficina respondió ${r.status}`); e.errores = j.errores; e.status = r.status; throw e; }
    return j;
  }
  const falla = (msg, extra = {}) => Object.assign(new Error(msg), extra);

  if (served) return {
    live: true,
    list: async ({ desde = '', hasta = '', sinFecha = false } = {}) => { const q = new URLSearchParams(); if (desde) q.set('desde', desde); if (hasta) q.set('hasta', hasta); if (sinFecha) q.set('sin_fecha', '1'); return http('GET', '/api/contenido?' + q); },
    create: async d => (await http('POST', '/api/contenido/piezas', d)).pieza,
    patch: async (id, d) => http('PATCH', `/api/contenido/piezas/${encodeURIComponent(id)}`, d),
    approve: async id => http('POST', `/api/contenido/piezas/${encodeURIComponent(id)}/aprobar`, {}),
    back: async (id, estado) => (await http('POST', `/api/contenido/piezas/${encodeURIComponent(id)}/devolver`, { estado })).pieza,
    remove: async id => http('DELETE', `/api/contenido/piezas/${encodeURIComponent(id)}`),
    resumen: async () => http('GET', '/api/contenido/resumen'),
  };

  /* ---------- la demo: lo mismo, en la memoria de la página ---------- */
  const uid = () => 'p-demo-' + Math.random().toString(36).slice(2, 8);
  const limpiar = d => { const o = { ...d }; for (const k of ['id', 'creada', 'aprobada', 'revision', 'cambiadaTrasAprobar']) delete o[k]; return o; };
  return {
    live: false,
    list: async ({ desde = '', hasta = '', sinFecha = false } = {}) => { const todas = mem().map(conRevision); return { piezas: todas.filter(p => enRango(p, { desde, hasta, sinFecha })).sort(orden), resumen: resumenDe(todas), ajustes: {} }; },
    create: async d => {
      if (d.estado === 'aprobada') throw falla('una pieza no nace aprobada: apruébala después, con «Aprobar»');
      const p = { titulo: '', fecha: '', hora: '', formato: 'post', redes: ['instagram'], estado: 'borrador', responsable: '', medios: [], historiaTambien: false, historias: [], texto: '', comentario: '', hashtags: '', hashtagsEnComentario: false, textoFacebook: '', notas: '', origen: 'dueno', tarea: '', ...limpiar(d), id: uid(), creada: new Date().toISOString(), actualizada: new Date().toISOString(), aprobada: null };
      mem().push(p); return conRevision(p);
    },
    patch: async (id, d) => {
      const i = mem().findIndex(p => p.id === id); if (i < 0) throw falla('esa pieza ya no existe', { status: 404 });
      const previa = mem()[i]; if (d.estado === 'aprobada' && previa.estado !== 'aprobada') throw falla('para aprobar una pieza usa «Aprobar»: revisa antes que pueda salir');
      const p = { ...previa, ...limpiar(d), actualizada: new Date().toISOString() }; let soltada = false;
      if (previa.estado === 'aprobada' && p.estado === 'aprobada' && huella(p) !== previa.aprobada?.huella) { p.estado = 'revision'; p.aprobada = null; soltada = true; }
      if (p.estado !== 'aprobada') p.aprobada = null;
      mem()[i] = p; return { ok: true, pieza: conRevision(p), soltada };
    },
    approve: async id => {
      const p = mem().find(x => x.id === id); if (!p) throw falla('esa pieza ya no existe', { status: 404 });
      if (!p.fecha) throw falla('ponle un día antes de aprobarla', { errores: ['Sin día'] });
      const r = revisar(p); if (r.errores.length) throw falla('todavía no puede salir: ' + r.errores[0], { errores: r.errores, status: 409 });
      p.estado = 'aprobada'; p.aprobada = { cuando: new Date().toISOString(), huella: huella(p), por: 'Demo' }; return { ok: true, pieza: conRevision(p), avisos: r.avisos };
    },
    back: async (id, estado = 'revision') => { const p = mem().find(x => x.id === id); if (!p) throw falla('esa pieza ya no existe', { status: 404 }); p.estado = ['idea', 'borrador', 'revision'].includes(estado) ? estado : 'revision'; p.aprobada = null; return conRevision(p); },
    remove: async id => { demo = mem().filter(p => p.id !== id); return { ok: true }; },
    resumen: async () => resumenDe(mem().map(conRevision)),
  };
}
