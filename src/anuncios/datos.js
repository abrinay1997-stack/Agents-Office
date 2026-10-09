// Los DATOS de la vista Anuncios: servida, lee /api/anuncios y pide «Actualizar» con /api/anuncios/sincronizar; en la demo (file://)
// o con «Ver con datos de ejemplo», los de src/anuncios/demo.js, en memoria y rotulados.
// Fase A2 (9 oct 2026): las acciones. Servida: POST /api/anuncios/accion { tipo, id, valor?, fin?, inicio?, confirmacion? } y
// POST /api/anuncios/deshacer { token } (la página no manda `por`: es el dueño). En el ejemplo, la demo con las mismas reglas.
// Las dos contestan lo mismo: el cuerpo con su `status` dentro (200, 403, 409, 422…), sin lanzar: la vista decide qué enseñar.
import { crearDemo } from './demo.js';

export function crearDatos({ servida }) {
  const demo = crearDemo(); // vive mientras la página esté abierta: lo que haces en el ejemplo se queda hasta recargar
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
      return ej(ejemplo) ? demo.accion(b) : enviar('/api/anuncios/accion', b);
    },
    async deshacer(token, { ejemplo = false } = {}) {
      return ej(ejemplo) ? demo.deshacer({ token }) : enviar('/api/anuncios/deshacer', { token });
    },
  };
}
