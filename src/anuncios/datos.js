// Los DATOS de la vista Anuncios: servida, lee /api/anuncios y pide «Actualizar» con /api/anuncios/sincronizar; en la demo (file://)
// o con «Ver con datos de ejemplo», los de src/anuncios/demo.js, en memoria y rotulados.
// Fase A2 (9 oct 2026): las acciones. Servida: POST /api/anuncios/accion { tipo, id, valor?, fin?, inicio?, confirmacion? } y
// POST /api/anuncios/deshacer { token } (la página no manda `por`: es el dueño). En el ejemplo, la demo con las mismas reglas.
// Las dos contestan lo mismo: el cuerpo con su `status` dentro (200, 403, 409, 422…), sin lanzar: la vista decide qué enseñar.
// Fase A3 (9 oct 2026): los BORRADORES de campaña. Servida: /api/anuncios/borradores (GET, POST), …/<id> (PATCH, DELETE), …/<id>/validar,
// …/<id>/crear (202 y se sondea la lista), …/<id>/vista-previa?formato=, …/<id>/mejorar; y la galería del Estudio (/api/media). En el
// ejemplo, src/anuncios/demo-borradores.js con las mismas respuestas. Como las acciones: `status` dentro, sin lanzar.
import { crearDemo } from './demo.js';
import { crearDemoBorradores } from './demo-borradores.js';
import { crearDemoSugerencias } from './demo-sugerencias.js';
// Fase A5 (9 oct 2026): las SUGERENCIAS. Servida: GET /api/anuncios/sugerencias → { items, cpaObjetivo, sinObjetivo, umbrales? },
// POST …/<id>/aplicar (→ { ok, hecho, deshacer } · { confirmar } si gasta · { ok, borrador } · { ok, tarea }), …/<id>/descartar y
// …/<id>/posponer { dias }. El «Sí» de una que gasta va por /api/anuncios/accion con `sugerencia: <id>`. En el ejemplo,
// src/anuncios/demo-sugerencias.js, que aplica con la demo de la A2 (las mismas reglas del dinero).

export function crearDatos({ servida }) {
  const demo = crearDemo(); // vive mientras la página esté abierta: lo que haces en el ejemplo se queda hasta recargar
  const demoB = crearDemoBorradores({ demo, topes: demo.topes });
  const demoS = crearDemoSugerencias({ demo, demoB });
  const llamar = async (ruta, metodo = 'GET', cuerpo) => {
    try {
      const r = await fetch(ruta, metodo === 'GET' ? undefined : { method: metodo, headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo || {}) });
      const j = await r.json().catch(() => ({}));
      return { ...j, status: r.status, ...(r.ok || j.motivo ? {} : { motivo: typeof j.error === 'string' && j.error.length > 12 ? j.error : `La oficina contestó ${r.status}.` }) };
    } catch { return { status: 0, error: 'red', motivo: 'No se pudo hablar con la oficina: revisa que siga abierta y vuelve a intentarlo.' }; }
  };
  const B = '/api/anuncios/borradores', idR = id => B + '/' + encodeURIComponent(id);
  const pedir = async (ruta, o) => {
    const r = await fetch(ruta, o); const j = await r.json().catch(() => ({}));
    if (!r.ok && r.status !== 409) throw new Error(j.error || `La oficina contestó ${r.status}.`);
    return { status: r.status, j };
  };
  const enviar = async (ruta, cuerpo) => {
    try {
      const r = await fetch(ruta, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
      const j = await r.json().catch(() => ({}));
      return { ...j, status: r.status, ...(r.ok || j.motivo ? {} : { motivo: j.error || `La oficina contestó ${r.status}.` }) };
    } catch { return { status: 0, error: 'red', motivo: 'No se pudo hablar con la oficina: revisa que siga abierta y vuelve a intentarlo.' }; }
  };
  const ej = ejemplo => !servida || ejemplo;
  return {
    demo: !servida,
    async leer(rango, { ejemplo = false } = {}) {
      if (ej(ejemplo)) return demo.vista(rango);
      return (await pedir(`/api/anuncios?rango=${encodeURIComponent(rango)}&abierto=1`)).j;
    },
    /** → 'leyendo' (202) · 'ya' (409, ya estaba leyendo) · 'ejemplo' */
    async sincronizar({ ejemplo = false } = {}) {
      if (ej(ejemplo)) return 'ejemplo';
      const { status } = await pedir('/api/anuncios/sincronizar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      return status === 409 ? 'ya' : 'leyendo';
    },
    async historial({ ejemplo = false } = {}) {
      if (ej(ejemplo)) return demo.historial().items;
      return (await pedir('/api/anuncios/historial')).j.items || [];
    },
    /** Una acción (primer o segundo clic) → { status, ok?, hecho?, deshacer?, confirmar?, aviso?, error?, motivo?, … } */
    async accion(cuerpo, { ejemplo = false } = {}) {
      const b = Object.fromEntries(Object.entries(cuerpo).filter(([, v]) => v != null && v !== ''));
      if (!ej(ejemplo)) return enviar('/api/anuncios/accion', b);
      const r = demo.accion(b); if (b.sugerencia) demoS.alConfirmar(b.sugerencia, r);
      return r;
    },
    async deshacer(token, { ejemplo = false } = {}) {
      if (!ej(ejemplo)) return enviar('/api/anuncios/deshacer', { token });
      const r = demo.deshacer({ token }); if (r.ok) demoS.alDeshacer(token);
      return r;
    },
    /* ---- A5: las sugerencias ---- */
    sugerencias: ({ ejemplo = false } = {}) => (ej(ejemplo) ? demoS.lista() : llamar('/api/anuncios/sugerencias')),
    aplicarSugerencia: (id, { ejemplo = false } = {}) => (ej(ejemplo) ? demoS.aplicar(id) : llamar(`/api/anuncios/sugerencias/${encodeURIComponent(id)}/aplicar`, 'POST')),
    descartarSugerencia: (id, { ejemplo = false } = {}) => (ej(ejemplo) ? demoS.descartar(id) : llamar(`/api/anuncios/sugerencias/${encodeURIComponent(id)}/descartar`, 'POST')),
    posponerSugerencia: (id, dias = 3, { ejemplo = false } = {}) => (ej(ejemplo) ? demoS.posponer(id, dias) : llamar(`/api/anuncios/sugerencias/${encodeURIComponent(id)}/posponer`, 'POST', { dias })),
    /* ---- A3: los borradores ---- */
    borradores: ({ ejemplo = false } = {}) => (ej(ejemplo) ? demoB.lista() : llamar(B)),
    nuevoBorrador: (cuerpo, { ejemplo = false } = {}) => (ej(ejemplo) ? demoB.crear(cuerpo) : llamar(B, 'POST', cuerpo)),
    guardarBorrador: (id, cambios, { ejemplo = false } = {}) => (ej(ejemplo) ? demoB.cambiar(id, cambios) : llamar(idR(id), 'PATCH', cambios)),
    borrarBorrador: (id, { ejemplo = false } = {}) => (ej(ejemplo) ? demoB.borrar(id) : llamar(idR(id), 'DELETE')),
    validarBorrador: (id, { ejemplo = false } = {}) => (ej(ejemplo) ? demoB.validar(id) : llamar(idR(id) + '/validar', 'POST')),
    crearEnMeta: (id, { ejemplo = false } = {}) => (ej(ejemplo) ? demoB.crearEnMeta(id) : llamar(idR(id) + '/crear', 'POST')),
    vistaPreviaMeta: (id, formato, { ejemplo = false } = {}) => (ej(ejemplo) ? demoB.vistaPrevia(id, formato) : llamar(`${idR(id)}/vista-previa?formato=${encodeURIComponent(formato)}`)),
    mejorarBorrador: (id, cuerpo, { ejemplo = false } = {}) => (ej(ejemplo) ? demoB.mejorar(id, cuerpo) : llamar(idR(id) + '/mejorar', 'POST', cuerpo)),
    /** La galería del Estudio (imágenes y videos): → { items: [{ file, kind, w, h, prompt }], next, total } */
    galeria: ({ q = '', before = '' } = {}, { ejemplo = false } = {}) => (ej(ejemplo) ? demoB.galeria({ q }) : llamar(`/api/media?kind=image,video&n=60${q ? '&q=' + encodeURIComponent(q) : ''}${before ? '&before=' + encodeURIComponent(before) : ''}`)),
  };
}
