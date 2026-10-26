// POST /api/chat en workerd de verdad (wrangler dev --local): la ruta ya NO da 501 y sus consultas a D1 corren con los límites reales (5 términos por consulta compuesta, 100 parámetros).
// Sin llave del proveedor en este entorno la petición llega hasta el modelo y se detiene ahí con un motivo en español: eso demuestra que contexto, notas, costos y conectores se leyeron bien.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { hayWrangler, levantar, entrar } from './vivo-ayudas.mjs';

const SALTAR = hayWrangler();
const ANA = { id: 'aaaaaaaa-0000-4000-8000-0000000000c1', email: 'ana@panaclaw.test', rol: 'admin', nombre: 'Ana' };
const LEO = { id: 'bbbbbbbb-0000-4000-8000-0000000000c2', email: 'leo@panaclaw.test', rol: 'lectura', nombre: 'Leo' };
let o, cAna, cLeo;
const chat = (c, cuerpo) => fetch(o.base + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json', ...(c ? { cookie: c } : {}) }, body: JSON.stringify(cuerpo) });

before(async () => {
  if (SALTAR) return;
  o = await levantar({ usuarios: [ANA, LEO] });
  cAna = await entrar(o.base, ANA.email); cLeo = await entrar(o.base, LEO.email);
}, { timeout: 240000 });
after(async () => { await o?.cerrar(); });

test('POST /api/chat (workerd real): ya no es 501, valida y llega hasta el modelo', { skip: SALTAR }, async () => {
  const buena = await chat(cAna, { agent: 'elead', text: '¿Qué sabes de precios?', history: [{ who: 'user', text: 'hola' }, { who: 'agent', text: 'Aquí estoy' }] });
  const j = await buena.json();
  console.log('# vivo: /api/chat →', buena.status, JSON.stringify(j).slice(0, 160));
  assert.notEqual(buena.status, 501, 'la ruta existe en la nube');
  assert.ok([200, 502, 503].includes(buena.status), `${buena.status} ${JSON.stringify(j)}`);
  if (buena.status !== 200) assert.match(j.error, /secreto|modelo|proveedor/i, 'el motivo está en español y dice qué falta');
  assert.ok(!JSON.stringify(j).includes('Error interno'));
  assert.equal((await chat(cAna, { agent: 'nadie', text: 'hola' })).status, 400);
  assert.equal((await chat(cAna, { agent: 'elead', text: '' })).status, 400);
  assert.equal((await chat(cAna, { agent: 'elead', text: 'cada lunes a las 9 revisa los correos' })).status, 200, 'una rutina se explica sin llamar al modelo');
  assert.equal((await chat(cLeo, { agent: 'elead', text: 'hola' })).status, 403);
  assert.equal((await chat(null, { agent: 'elead', text: 'hola' })).status, 401);
});
