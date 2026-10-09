// Los DATOS de la vista Anuncios (Fase A1): servida, lee /api/anuncios (solo lectura) y pide «Actualizar» con /api/anuncios/sincronizar;
// en la demo (file://) o con «Ver con datos de ejemplo», los de src/anuncios/demo.js, en memoria y rotulados.
import { datosDeEjemplo, historialDeEjemplo } from './demo.js';

export function crearDatos({ servida }) {
  const pedir = async (ruta, o) => {
    const r = await fetch(ruta, o); const j = await r.json().catch(() => ({}));
    if (!r.ok && r.status !== 409) throw new Error(j.error || `La oficina contestó ${r.status}.`);
    return { status: r.status, j };
  };
  return {
    demo: !servida,
    async leer(rango, { ejemplo = false } = {}) {
      if (!servida || ejemplo) return datosDeEjemplo(rango);
      return (await pedir(`/api/anuncios?rango=${encodeURIComponent(rango)}&abierto=1`)).j;
    },
    /** → 'leyendo' (202) · 'ya' (409, ya estaba leyendo) · 'ejemplo' */
    async sincronizar({ ejemplo = false } = {}) {
      if (!servida || ejemplo) return 'ejemplo';
      const { status } = await pedir('/api/anuncios/sincronizar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      return status === 409 ? 'ya' : 'leyendo';
    },
    async historial({ ejemplo = false } = {}) {
      if (!servida || ejemplo) return historialDeEjemplo().items;
      return (await pedir('/api/anuncios/historial')).j.items || [];
    },
  };
}
