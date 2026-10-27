// Recalcular el mapa entero en workerd DE VERDAD (wrangler dev --local): el paquete del Worker trae d3-force (graph-core lo importa de forma dinámica y, si faltara, cae a un cálculo de reserva más lento y
// distinto), el cálculo corre dentro del Worker y la consulta a D1 respeta los límites reales. Lo que en Node se prueba con las 59 notas de fábrica (cerebro-mapa.test.mjs), aquí se prueba en el entorno que de verdad lo ejecuta.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { hayWrangler, levantar, entrar } from './vivo-ayudas.mjs';

const SALTAR = hayWrangler();
const ANA = { id: 'aaaaaaaa-0000-4000-8000-0000000000d1', email: 'ana@panaclaw.test', rol: 'admin', nombre: 'Ana' };
let o, cAna;
const api = (ruta, cuerpo, metodo = cuerpo ? 'POST' : 'GET') => fetch(o.base + ruta, { method: metodo, headers: { 'content-type': 'application/json', cookie: cAna }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });

before(async () => {
  if (SALTAR) return;
  o = await levantar({ usuarios: [ANA] }); cAna = await entrar(o.base, ANA.email);
}, { timeout: 240000 });
after(async () => { await o?.cerrar(); });

test('POST /api/brain/actualizar { paso: "mapa" } en workerd real: d3-force está en el paquete y el mapa sale coherente', { skip: SALTAR }, async () => {
  const N = 14;
  for (let i = 0; i < N; i++) {
    const r = await api('/api/note', { name: 'Nota ' + String(i).padStart(2, '0'), text: `Habla del tema ${i}.${i ? ` Ver [[Nota ${String(i - 1).padStart(2, '0')}]]` : ''}${i > 3 ? ` y [[Nota ${String(i % 4).padStart(2, '0')}]]` : ''}`, group: 'Notas' });
    assert.equal(r.status, 200, await r.text());
  }
  const estado = await (await api('/api/brain/actualizar')).json();
  assert.equal(estado.mapaCompleto.notas, N); assert.equal(estado.mapaCompleto.puede, true);
  const r = await api('/api/brain/actualizar', { paso: 'mapa' }), j = await r.json();
  console.log('# vivo: mapa entero →', r.status, JSON.stringify({ ...j, graph: undefined }));
  assert.equal(r.status, 200, JSON.stringify(j)); assert.equal(j.ok, true);
  assert.equal(j.motor, 'd3-force', 'd3-force viaja en el paquete del Worker (si no, el mapa saldría distinto al de la computadora)');
  assert.equal(j.graph.nodes.length, N); assert.ok(j.graph.links.length >= N - 1, 'las líneas de verdad: ' + j.graph.links.length);
  assert.ok(j.graph.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y) && Math.abs(n.x) < 1.5 && Math.abs(n.y) < 1.5), 'todas las neuronas con coordenadas');
  assert.equal(j.copia, false, 'no había mapa guardado: nada a lo que volver');
  const g2 = await (await api('/api/brain')).json(); assert.deepEqual(g2.nodes.map((n) => n.id), j.graph.nodes.map((n) => n.id), 'lo guardado es lo que se calculó');
  assert.equal((await api('/api/brain/actualizar', { paso: 'mapa-deshacer' })).status, 409);
  assert.ok(!JSON.stringify(j).includes('Error interno'));
});
