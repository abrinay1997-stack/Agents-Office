// C1 (8 oct 2026): lo que el editor nuevo de Contenido pide al servidor — los textos guardados (una nota del Cerebro), «✨ Mejorar con
// Marketing» (la propuesta de tu agente, que no guarda nada) y «Publicar ya» (aprobada para dentro de unos 5 minutos).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { parsearGuardados, serializarGuardados, hashtagsUsados, crearGuardados, NOTA_GUARDADOS } from '../contenido/guardados.mjs';
import { agenteDeContenido, promptMejorar, leerPropuesta } from '../contenido/mejorar.mjs';
import { crearAlmacen, ahoraMas, PRONTO_MIN } from '../contenido/piezas.mjs';
import { crearRutas } from '../contenido/rutas.mjs';
import { revisarMomento } from '../src/contenido-reglas.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ao-editor-'));

test('los textos guardados: una nota del Cerebro, una sección por texto; los que son solo hashtags son un juego de hashtags', () => {
  const md = '---\ntipo: textos-guardados\n---\n# Textos guardados\n\nExplicación.\n\n## Firma\nPanaClaw · tu óptica\nen Panamá\n\n## Hashtags de lentes\n#lentes #optica #panama\n\n## Vacío\n\n';
  assert.deepEqual(parsearGuardados(md), [{ nombre: 'Firma', texto: 'PanaClaw · tu óptica\nen Panamá', hashtags: false }, { nombre: 'Hashtags de lentes', texto: '#lentes #optica #panama', hashtags: true }]);
  const ida = serializarGuardados(parsearGuardados(md), { hoy: '2026-10-08' });
  assert.match(ida, /^---\ntipo: textos-guardados\nactualizado: 2026-10-08\n---\n# Textos guardados/);
  assert.deepEqual(parsearGuardados(ida), parsearGuardados(md), 'ida y vuelta');
  assert.deepEqual(parsearGuardados(serializarGuardados([{ nombre: 'Truco', texto: 'línea\n## Notas\nfin' }])), [{ nombre: 'Truco', texto: 'línea\n# Notas\nfin', hashtags: false }], 'un «##» dentro del texto no abre otra sección');
  assert.deepEqual(hashtagsUsados([{ hashtags: '#optica #lentes', texto: 'Hola #Optica' }, { hashtags: '#lentes #sol' }, { texto: 'sin nada' }], 3), ['#lentes', '#optica', '#sol'], 'por uso, sin repetir dentro de una pieza');
});

test('el almacén de textos guardados: guardar, cambiar por su nombre, topes y borrar', () => {
  const cerebro = tmp(), g = crearGuardados({ cerebro, ahora: () => Date.parse('2026-10-08T12:00:00') });
  assert.equal(g.archivo, path.join(cerebro, NOTA_GUARDADOS));
  assert.deepEqual(g.listar(), []);
  assert.match(g.guardar({ nombre: '', texto: 'x' }).error, /nombre/);
  assert.match(g.guardar({ nombre: 'Firma', texto: '  ' }).error, /vacío/);
  assert.ok(g.guardar({ nombre: 'Firma', texto: 'PanaClaw' }).ok);
  assert.ok(g.guardar({ nombre: 'firma', texto: 'PanaClaw · Panamá' }).ok, 'el mismo nombre (sin mayúsculas) se cambia');
  g.guardar({ nombre: 'Lentes', texto: '#lentes #optica' });
  assert.deepEqual(g.listar().map(x => [x.nombre, x.texto, x.hashtags]), [['firma', 'PanaClaw · Panamá', false], ['Lentes', '#lentes #optica', true]]);
  assert.match(fs.readFileSync(g.archivo, 'utf8'), /actualizado: 2026-10-08/);
  assert.ok(g.borrar('LENTES').ok); assert.equal(g.borrar('Lentes').nada, true);
  assert.match(g.guardar({ nombre: 'Largo', texto: 'x'.repeat(2201) }).error, /2200/);
});

test('«Mejorar con Marketing»: escribe el puesto de redes con su voz, sin inventar datos, y la respuesta se lee aunque venga en un bloque', () => {
  const agentes = [{ id: 'mlead', department: 'marketing', lead: true, name: 'MARKETING LEAD', role: 'Lead', does: 'Runs marketing.' }, { id: 'newt', department: 'marketing', name: 'NEWSLETTER', role: 'News', does: 'Writes the newsletter.' }, { id: 'iggy', department: 'marketing', name: 'INSTAGRAM ORGANIC', role: 'IG', does: 'Runs the IG content engine.' }];
  assert.equal(agenteDeContenido(agentes, ['marketing', 'delivery']).id, 'iggy');
  assert.equal(agenteDeContenido(agentes.slice(0, 2), ['marketing']).id, 'mlead', 'sin un puesto de redes, el jefe');
  const { system, user } = promptMejorar({ empresa: 'PanaClaw', agente: agentes[2], instrucciones: 'STANDING INSTRUCTIONS\nTutea siempre.', voz: 'Cercana y clara.', contexto: 'Cliente ideal: familias.', cifras: '\n\nTHE COMPANY\'S FIGURES\n- Examen: 0 US$', pieza: { titulo: 'Examen gratis', texto: 'Ven por tu examen #optica', redes: ['instagram', 'x'], hashtags: '#optica', notas: 'Solo octubre' }, red: 'x', formato: 'post', limite: 280, pide: 'más corto' });
  assert.match(system, /INSTAGRAM ORGANIC \(IG\) de PanaClaw/); assert.match(system, /Tutea siempre/); assert.match(system, /Cercana y clara/); assert.match(system, /familias/); assert.match(system, /Examen: 0 US\$/);
  assert.match(system, /para X \(post\): como mucho 280 caracteres/); assert.match(system, /No inventes precios/); assert.match(system, /SOLO un objeto JSON/);
  assert.match(user, /Lo que pide el dueño: más corto/); assert.match(user, /Texto actual para X:\nVen por tu examen #optica/); assert.match(user, /Notas del equipo \(no se publican\): Solo octubre/);
  assert.deepEqual(leerPropuesta('```json\n{"texto":"Tu examen, gratis en octubre.","porque":"Más corto y con gancho."}\n```'), { texto: 'Tu examen, gratis en octubre.', porque: 'Más corto y con gancho.' });
  assert.deepEqual(leerPropuesta('Aquí va: {"texto":"Hola"}'), { texto: 'Hola', porque: '' });
  assert.throws(() => leerPropuesta('{"porque":"nada"}'), /cortada/);
  assert.throws(() => leerPropuesta('lo siento'), /cortada/);
});

test('«Publicar ya»: la pieza queda aprobada para el primer minuto entero a 5 minutos, aunque estuviera para otro día (y otro mes)', () => {
  assert.deepEqual(ahoraMas(Date.parse('2026-10-08T10:00:00'), PRONTO_MIN), { fecha: '2026-10-08', hora: '10:05' });
  assert.deepEqual(ahoraMas(Date.parse('2026-10-08T10:00:20'), PRONTO_MIN), { fecha: '2026-10-08', hora: '10:06' }, 'con segundos, el minuto siguiente');
  assert.deepEqual(ahoraMas(Date.parse('2026-10-31T23:58:00'), PRONTO_MIN), { fecha: '2026-11-01', hora: '00:03' });
  const T = Date.parse('2026-10-31T23:58:00'), dir = tmp(), a = crearAlmacen({ dir, ahora: () => T, medioExiste: () => true, medida: () => ({ ancho: 1080, alto: 1350 }) });
  const { pieza } = a.crear({ titulo: 'Promo', fecha: '2026-10-25', hora: '09:00', redes: ['instagram'], medios: ['2026-10/a.jpg'], texto: 'Hola' });
  assert.match(a.aprobar(pieza.id).error, /ya pasó/, 'sin «pronto», su hora ya pasó');
  const r = a.aprobar(pieza.id, { pronto: true });
  assert.equal(r.pieza.estado, 'aprobada'); assert.equal(r.pieza.fecha, '2026-11-01'); assert.equal(r.pieza.hora, '00:03');
  assert.ok(fs.existsSync(path.join(dir, '2026-11', `${pieza.id}.md`)) && !fs.existsSync(path.join(dir, '2026-10', `${pieza.id}.md`)), 'cambió de mes: se movió, no se duplicó');
  assert.equal(revisarMomento('2026-11-01', '00:03', T).errores.length, 1, 'a 5 minutos, «Aprobar» normal no la deja (Meta pide 10)');
  assert.equal(revisarMomento('2026-11-01', '00:03', T, { minMin: 4 }).errores.length, 0);
});

test('las rutas del editor: textos guardados, la propuesta (solo el dueño, nada se guarda) y aprobar «pronto»', async () => {
  const dir = tmp(), cerebro = tmp(), almacen = crearAlmacen({ dir, medioExiste: () => true });
  const json = (res, code, b) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
  const body = req => new Promise(ok => { let s = ''; req.on('data', d => { s += d; }); req.on('end', () => ok(s ? JSON.parse(s) : {})); });
  const pedidos = [];
  const handle = crearRutas({ almacen, json, body, guardados: crearGuardados({ cerebro }), mejorar: async x => { pedidos.push(x); return { texto: 'Propuesta', porque: 'Más gancho', agente: 'INSTAGRAM ORGANIC', red: x.red }; } });
  const srv = http.createServer(async (req, res) => { if (!await handle(req, res, new URL(req.url, 'http://x'))) json(res, 404, {}); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const api = async (m, p, b) => { const r = await fetch(`http://127.0.0.1:${srv.address().port}${p}`, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, ...(await r.json()) }; };
  try {
    almacen.crear({ titulo: 'a', texto: 'Hola #optica', hashtags: '#lentes #optica' });
    let g = await api('GET', '/api/contenido/guardados');
    assert.deepEqual([g.textos, g.usados], [[], ['#lentes', '#optica']], 'una vez cada uno: en orden alfabético');
    assert.equal((await api('POST', '/api/contenido/guardados', { nombre: 'Firma', texto: 'PanaClaw', por: 'agente' })).status, 403);
    assert.equal((await api('POST', '/api/contenido/guardados', { nombre: '', texto: 'x' })).status, 400);
    g = await api('POST', '/api/contenido/guardados', { nombre: 'Firma', texto: 'PanaClaw' }); assert.deepEqual(g.textos.map(x => x.nombre), ['Firma']);
    assert.equal((await api('DELETE', '/api/contenido/guardados/' + encodeURIComponent('Firma'))).status, 200);
    assert.equal((await api('DELETE', '/api/contenido/guardados/Firma')).status, 404);
    // la propuesta
    assert.equal((await api('POST', '/api/contenido/mejorar', { pieza: { texto: 'x' }, por: 'agente' })).status, 403);
    assert.equal((await api('POST', '/api/contenido/mejorar', { pieza: {} })).status, 400, 'sin nada de donde partir');
    const m = await api('POST', '/api/contenido/mejorar', { pieza: { texto: 'Hola', redes: ['x'] }, red: 'x', pide: 'más corto' });
    assert.deepEqual([m.status, m.texto, m.agente], [200, 'Propuesta', 'INSTAGRAM ORGANIC']);
    assert.deepEqual([pedidos[0].red, pedidos[0].pide, pedidos[0].pieza.texto], ['x', 'más corto', 'Hola']);
    // «pronto»
    const { pieza } = almacen.crear({ titulo: 'Ya', redes: ['facebook'], texto: 'Abrimos el sábado' });
    assert.equal((await api('POST', `/api/contenido/piezas/${pieza.id}/aprobar`, { pronto: true, por: 'agente' })).status, 403);
    const ok = await api('POST', `/api/contenido/piezas/${pieza.id}/aprobar`, { pronto: true });
    assert.equal(ok.status, 200); assert.equal(ok.pieza.estado, 'aprobada');
    const sale = new Date(`${ok.pieza.fecha}T${ok.pieza.hora}:00`).getTime() - Date.now();
    assert.ok(sale > 4 * 60e3 && sale <= 6 * 60e3, `sale en unos 5 minutos (${Math.round(sale / 1000)} s)`);
  } finally { srv.close(); }
});


test('el editor de piezas va en su propio paquete: la página no lo lleva, y él no lleva su propio modal', async () => {
  const { construirPieza, SOLO_AQUI } = await import('../build-pieza.mjs');
  const p = await construirPieza();
  assert.match(p.js, /^\/\*ao-pieza:[0-9a-f]{12}\*\//, 'la primera línea dice de qué construcción es');
  assert.ok(p.js.includes(p.version) && !p.js.includes('@@AO_PIEZA_VERSION@@'));
  assert.ok(p.js.includes('AO_PIEZA') && p.js.includes('data-ao-pieza'), 'se presenta en window.AO_PIEZA y trae su estilo');
  assert.deepEqual([...p.aparte].sort(), [...SOLO_AQUI].sort());
  const { build } = await import('esbuild');
  const r = await build({ entryPoints: ['src/main.js'], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020', metafile: true, define: { __AO_EXTRA_VERSION__: '"x"', __AO_TAREAS_VERSION__: '"x"', __AO_PIEZA_VERSION__: '"x"' }, logLevel: 'silent' });
  const dentro = Object.keys(r.metafile.outputs[Object.keys(r.metafile.outputs)[0]].inputs);
  assert.deepEqual(dentro.filter(f => SOLO_AQUI.includes(f)), [], 'la página no lleva el editor');
  assert.ok(dentro.includes('src/pieza-base.js') && dentro.includes('src/pieza-carga.js'));
});
