// Fase 6 — La regla del dinero: Dimitri NUNCA confirma un gasto de anuncios. Una op que gasta (activar, subir presupuesto) solo pide la cifra (primera llamada de Anuncios, que no cambia nada);
// el segundo clic es del dueño en Anuncios. Contra el Meta de mentira, nunca el de verdad.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { oficina6, dimitriDice } from './fase6-ayudas.mjs';
import { crearMetaStand, TOKEN_STAND, CUENTA_STAND } from '../../tests/meta-stand.mjs';
import { PERMISOS_LECTURA, PERMISOS_ANUNCIOS } from '../../contenido/meta.mjs';
import { prepararMeta } from './ayuda-meta.mjs';
import { usarFetchDePrueba } from '../worker/lib/anuncios-nube.js';
import { guardarDoc } from '../worker/lib/almacen.js';

test('Dimitri propone activar una campaña en pausa: queda por confirmar, la campaña sigue en pausa y nadie gastó nada; pausar sí se hace con un clic', async () => {
  const g = crearMetaStand({ permisos: [...PERMISOS_LECTURA, ...PERMISOS_ANUNCIOS] }), ids = await prepararMeta(g);
  usarFetchDePrueba(g.fetchFn);
  try {
    const o = await oficina6({ extraEnv: { META_ACCESS_TOKEN: TOKEN_STAND, META_GRAPH_HOST: 'https://graph.test' }, guion: [dimitriDice({ mode: 'plan', reply: 'Las dejo listas.', ops: [{ type: 'anuncio_activar', id: ids.combo }, { type: 'anuncio_pausar', id: ids.activa }] })] });
    await guardarDoc(o.d1, 'config-local', { anuncios: { cuenta: CUENTA_STAND, topeDiario: 30, topeMensual: 300, topeCampana: 150 }, contenido: { modo: 'simulacro' } });
    assert.equal((await o.admin('POST', '/api/anuncios/sincronizar', {})).status, 202);
    const r = await o.admin('POST', '/api/sub/chat', { text: 'activa Combo y pausa Mensajes' }); assert.equal(r.status, 200, r.texto);
    const m = r.j.messages.at(-1), hecho = await o.admin('POST', '/api/sub/ops', { msg: m.id, items: [{ k: 0, include: true }, { k: 1, include: true }] });
    assert.equal(hecho.status, 200, hecho.texto);
    const ops = hecho.j.message?.ops || hecho.j.ops || [];
    const act = ops.find((x) => x.type === 'anuncio_activar'), paus = ops.find((x) => x.type === 'anuncio_pausar');
    assert.equal(act?.state, 'confirmar', 'gastar queda esperando al dueño'); assert.ok(act.confirmar?.texto || act.confirmar?.token);
    assert.equal(g.st.campanas[ids.combo].status, 'PAUSED', 'Dimitri no activó nada');
    assert.equal(paus?.state, 'done'); assert.equal(g.st.campanas[ids.activa].status, 'PAUSED', 'bajar el gasto sí');
    const nada = g.llamadas.filter((l) => l.metodo === 'POST' && /ACTIVE/.test(JSON.stringify(l)) && !/validate_only/.test(JSON.stringify(l)) && JSON.stringify(l).includes(ids.combo));
    assert.equal(nada.length, 0);
    // el segundo clic es del dueño, en Anuncios: gasta, y la tarjeta de Dimitri queda hecha (no vuelve a pedir confirmación al recargar)
    const tok = act.confirmar.token; assert.ok(tok);
    const dos = await o.admin('POST', '/api/anuncios/accion', { tipo: 'activar', id: ids.combo, confirmacion: tok, sub: { msg: m.id, k: act.k } });
    assert.equal(dos.status, 200, dos.texto); assert.equal(g.st.campanas[ids.combo].status, 'ACTIVE');
    const despues = (await o.admin('GET', '/api/sub')).j.messages.find((x) => x.id === m.id).ops.find((x) => x.type === 'anuncio_activar');
    assert.equal(despues.state, 'done'); assert.equal(despues.confirmar, undefined);
  } finally { usarFetchDePrueba(null); }
});
