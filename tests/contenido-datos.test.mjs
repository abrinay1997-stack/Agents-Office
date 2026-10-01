// V4.7: la demo de Contenido (src/contenido-datos.js, sin servidor) tiene que decir lo mismo que la oficina real: las mismas reglas de aprobación.
import test from 'node:test';
import assert from 'node:assert/strict';
import { crearDatos } from '../src/contenido-datos.js';

const demo = () => crearDatos({ served: false });
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

test('la demo trae piezas en cada estado y en los próximos días, con su revisión', async () => {
  const d = demo(); const { piezas, resumen } = await d.list({});
  assert.equal(d.live, false);
  assert.deepEqual([...new Set(piezas.map(p => p.estado))].sort(), ['aprobada', 'borrador', 'idea', 'revision']);
  assert.ok(piezas.every(p => p.revision && Array.isArray(p.revision.errores)));
  assert.ok(piezas.some(p => !p.fecha), 'hay ideas sin día');
  assert.equal(resumen.total, piezas.length); assert.equal(resumen.revisar, piezas.filter(p => p.estado === 'revision').length);
  const hoy = ymd(new Date()); assert.equal(piezas.filter(p => p.fecha && p.fecha < hoy).length, 1, 'una sola del pasado: la aprobada que venció, para ver cómo se avisa');
});

test('listar por rango deja fuera lo de otros días y pide las ideas sin día aparte', async () => {
  const d = demo(); const todas = (await d.list({})).piezas; const con = todas.filter(p => p.fecha);
  const dia = con[0].fecha;
  const uno = (await d.list({ desde: dia, hasta: dia })).piezas; assert.ok(uno.length >= 1 && uno.every(p => p.fecha === dia));
  assert.ok((await d.list({ desde: dia, hasta: dia, sinFecha: true })).piezas.some(p => !p.fecha));
  assert.ok(!(await d.list({ desde: dia, hasta: dia })).piezas.some(p => !p.fecha));
});

test('no nace aprobada; aprobar exige día y que cumpla las reglas; la aprobada vuelve a revisión si cambia lo que sale', async () => {
  const d = demo();
  await assert.rejects(d.create({ estado: 'aprobada' }), /no nace aprobada/);
  const p = await d.create({ titulo: 'Nueva', fecha: ymd(new Date(Date.now() + 864e5)), hora: '10:00', texto: 'Hola' });
  await assert.rejects(d.approve(p.id), /todavía no puede salir: Instagram necesita al menos una imagen o un video/);
  await d.patch(p.id, { medios: ['demo/z.jpg'] });
  await assert.rejects(d.patch(p.id, { estado: 'aprobada' }), /usa «Aprobar»/);
  const ok = await d.approve(p.id); assert.equal(ok.pieza.estado, 'aprobada');
  const interno = await d.patch(p.id, { notas: 'algo interno' }); assert.equal(interno.pieza.estado, 'aprobada'); assert.equal(interno.soltada, false);
  const publico = await d.patch(p.id, { texto: 'Hola, otro precio' }); assert.equal(publico.pieza.estado, 'revision'); assert.equal(publico.soltada, true);
  const sinDia = await d.create({ texto: 'x', medios: ['demo/a.jpg'] }); await assert.rejects(d.approve(sinDia.id), /ponle un día/);
});

test('devolver quita el OK, borrar la saca de la lista y el resumen se pone al día', async () => {
  const d = demo(); const antes = (await d.resumen()).aprobadas; const apr = (await d.list({})).piezas.find(p => p.estado === 'aprobada');
  assert.equal((await d.back(apr.id, 'borrador')).estado, 'borrador'); assert.equal((await d.resumen()).aprobadas, antes - 1);
  await d.remove(apr.id); assert.ok(!(await d.list({})).piezas.some(p => p.id === apr.id));
  await assert.rejects(d.approve(apr.id), /ya no existe/);
});

test('la demo no toca la red ni el disco: cada instancia tiene sus propias piezas', async () => {
  const a = demo(), b = demo(); await a.create({ titulo: 'Solo en A' });
  assert.ok((await a.list({})).piezas.some(p => p.titulo === 'Solo en A')); assert.ok(!(await b.list({})).piezas.some(p => p.titulo === 'Solo en A'));
});
