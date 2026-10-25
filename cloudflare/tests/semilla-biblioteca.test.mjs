// La semilla del despliegue y la Biblioteca de habilidades en la nube (partes A y B).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SALTAR, crearD1, sembrar, envDePrueba, pedir } from './d1-memoria.mjs';
import { semillaEnDisco, assetsDe } from './semilla-ayudas.mjs';
import { manejar } from '../worker/lib/rutas.js';
import { construirSemilla, escribirSemilla, TOPE_ARCHIVO } from '../scripts/semilla.mjs';
import { guardarFila, guardarDoc } from '../worker/lib/almacen.js';
import { MODULOS } from '../worker/modulos/index.js';
import { herramientasInternas } from '../worker/lib/agentes/herramientas.js';
import { armarEjecucion } from '../worker/lib/agentes/contexto.js';
import { leerContexto } from '../worker/lib/tareas/contexto.js';
import { guardarNotas } from '../worker/lib/cerebro.js';

const todos = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? todos(join(dir, e.name)) : [join(dir, e.name)]);

test('SEMILLA: lleva las 59 notas del Cerebro de PanaClaw con su grupo, el mapa, el equipo y las 50 habilidades', async () => {
  const { manifest, semilla } = await semillaEnDisco();
  assert.equal(manifest.notas, 59);
  assert.equal(semilla.notas.length, 59);
  assert.ok(semilla.notas.every((n) => n.grupo && n.texto && !n.nombre.includes('/')));
  assert.equal(semilla.grafo.notes, 59); assert.ok(semilla.grafo.links.length > 100, 'el mapa se calcula aquí porque el Worker no puede');
  assert.equal(manifest.agentes, 35); assert.ok(manifest.rutinas >= 2); assert.ok(manifest.skills >= 15);
  assert.equal(manifest.habilidades, 50); assert.ok(manifest.referencias > 200);
  for (const [k, v] of Object.entries(manifest.bytes)) if (k !== 'biblioteca') assert.ok(v < TOPE_ARCHIVO, k);
  assert.match(manifest.huella, /^[0-9a-f]{64}$/);
});

test('SEMILLA: NADA privado viaja (entregas, correcciones, piezas, galería): solo agents.json, routines.json y skills/ de Agents Office', async () => {
  const vault = mkdtempSync(join(tmpdir(), 'ao-vault-')), ao = join(vault, 'Agents Office');
  mkdirSync(join(vault, '10-Business'), { recursive: true }); mkdirSync(join(ao, 'feedback'), { recursive: true }); mkdirSync(join(ao, 'contenido', '2026-10'), { recursive: true }); mkdirSync(join(ao, 'skills', 'mia'), { recursive: true }); mkdirSync(join(ao, 'media'), { recursive: true });
  writeFileSync(join(vault, '10-Business', 'precios.md'), '# Precios\nCombo US$ 100');
  writeFileSync(join(vault, 'CLAUDE.md'), '# Reglas');
  writeFileSync(join(ao, '2026-10-25 entrega cliente.md'), 'ENTREGA PRIVADA DE UN CLIENTE');
  writeFileSync(join(ao, 'feedback', 'elead.md'), 'CORRECCION PRIVADA');
  writeFileSync(join(ao, 'contenido', '2026-10', 'p-1.md'), 'PIEZA SIN PUBLICAR PRIVADA');
  writeFileSync(join(ao, 'media', 'foto.json'), '{"prompt":"GALERIA PRIVADA"}');
  writeFileSync(join(ao, 'cifras.json'), '{"items":[{"name":"CIFRA PRIVADA"}]}');
  writeFileSync(join(ao, 'agents.json'), '{"agents":[]}'); writeFileSync(join(ao, 'routines.json'), '{"routines":[]}');
  writeFileSync(join(ao, 'skills', 'mia', 'SKILL.md'), '---\nname: mia\ndescription: la mía\nagents: [elead]\n---\nPasos de la skill pública.');
  const s = await construirSemilla({ vault, conBiblioteca: false });
  const destino = mkdtempSync(join(tmpdir(), 'ao-semilla-priv-'));
  await escribirSemilla(s, destino);
  const todo = todos(destino).map((f) => readFileSync(f, 'utf8')).join('\n');
  for (const secreto of ['ENTREGA PRIVADA', 'CORRECCION PRIVADA', 'PIEZA SIN PUBLICAR', 'GALERIA PRIVADA', 'CIFRA PRIVADA']) assert.ok(!todo.includes(secreto), secreto + ' no debe viajar');
  assert.deepEqual(s.notas.map((n) => n.nombre).sort(), ['CLAUDE', 'precios']);
  assert.ok(todo.includes('Pasos de la skill pública'), 'las skills del Cerebro sí viajan');
});

test('SEMILLA: la biblioteca de la semilla no lleva los pedidos de prueba (evals) y trae la licencia MIT', async () => {
  const { dir } = await semillaEnDisco();
  const archivos = todos(dir).map((f) => f.slice(dir.length));
  assert.ok(!archivos.some((f) => /evals\.json$/.test(f)));
  assert.ok(archivos.some((f) => f.endsWith('LICENCIA-marketingskills.txt')));
  assert.ok(archivos.some((f) => /\/campanas-pagadas\/cuerpo\.md$/.test(f)));
});

async function nube({ rol = 'admin', ruta } = {}) {
  const { dir } = await semillaEnDisco();
  const d1 = crearD1(), admin = await sembrar(d1, { rol }), pedidas = [];
  const env = envDePrueba(d1, { ASSETS: assetsDe(dir, pedidas) });
  const r = await pedir(manejar, env, '/api/acceso', { metodo: 'POST', cuerpo: { email: admin.email, contrasena: admin.clave } });
  const ck = r.headers.get('set-cookie').split(';')[0];
  return { d1, env, ck, pedidas, get: (u) => pedir(manejar, env, u, { cookie: ck }) };
}

test('BIBLIOTECA (nube): la lista, por puesto y buscando, con la forma de la oficina local', { skip: SALTAR }, async () => {
  const { get } = await nube();
  const todas = await (await get('/api/biblioteca')).json();
  assert.equal(todas.total, 50); assert.equal(todas.habilidades.length, 50);
  assert.deepEqual(Object.keys(todas.habilidades[0]).sort(), ['agents', 'area', 'areaNombre', 'chars', 'coleccion', 'departments', 'description', 'evals', 'fuente', 'id', 'origen', 'referencias', 'titulo'].sort());
  const mlead = await (await get('/api/biblioteca?agente=mlead')).json();
  assert.ok(mlead.habilidades.length > 30 && mlead.habilidades.every((h) => h.agents.includes('mlead') || h.departments.includes('marketing')));
  const q = await (await get('/api/biblioteca?agente=mlead&buscar=' + encodeURIComponent('anuncios de Meta campaña pagada'))).json();
  assert.ok(q.habilidades.length && q.habilidades.length <= 8 && q.habilidades.some((h) => /anuncio|campa|pagad/.test(h.id)), q.habilidades.map((h) => h.id).join());
  const otro = await (await get('/api/biblioteca?agente=elead')).json(); // el de correos tiene pocas
  assert.ok(otro.habilidades.length < mlead.habilidades.length);
});

test('BIBLIOTECA (nube): leer una habilidad, una referencia, lo que no existe, y nadie escribe por aquí', { skip: SALTAR }, async () => {
  const { get, env, ck, pedidas } = await nube();
  const h = await (await get('/api/biblioteca/campanas-pagadas')).json();
  assert.equal(h.id, 'campanas-pagadas'); assert.match(h.texto, /^# .*\(campanas-pagadas\)/); assert.ok(h.texto.length > 2000); assert.ok(h.referencias.length > 0);
  const ref = await (await get(`/api/biblioteca/campanas-pagadas?referencia=${encodeURIComponent(h.referencias[0])}`)).json();
  assert.equal(ref.referencia, h.referencias[0]); assert.ok(ref.texto.includes('·'));
  assert.equal((await get('/api/biblioteca/no-existe')).status, 404);
  assert.equal((await get('/api/biblioteca/campanas-pagadas?referencia=nada-de-esto')).status, 404);
  assert.equal((await pedir(manejar, env, '/api/biblioteca', { metodo: 'POST', cuerpo: {}, cookie: ck })).status, 405);
  assert.equal((await pedir(manejar, env, '/api/biblioteca')).status, 401, 'sin sesión no se lee');
  // una ruta con trucos no sale de la carpeta de la biblioteca
  assert.equal((await get('/api/biblioteca/..%2f..%2fnotas')).status === 200, false);
  assert.ok(pedidas.every((p) => p.startsWith('/semilla/')), 'solo se leen archivos de la semilla');
});

test('BIBLIOTECA (nube): una habilidad del dueño (migración) gana a la de fábrica con el mismo id; una skill suya con ese nombre también', { skip: SALTAR }, async () => {
  const { d1, get } = await nube();
  await guardarFila(d1, 'biblioteca', 'campanas-pagadas', { id: 'campanas-pagadas', titulo: 'Campañas a MI manera', description: 'Úsala cuando armes campañas.', area: 'pagados-y-medicion', departments: ['marketing'], agents: [], origen: 'mía', palabras: [], referencias: [{ nombre: 'mi-lista', archivo: 'mi-lista.md', chars: 9 }], cuerpo: 'Mis pasos propios.', refs: { 'mi-lista.md': 'Mi lista.' } });
  const h = await (await get('/api/biblioteca/campanas-pagadas')).json();
  assert.equal(h.titulo, 'Campañas a MI manera'); assert.equal(h.fuente, 'cerebro'); assert.match(h.texto, /Mis pasos propios/);
  const r = await (await get('/api/biblioteca/campanas-pagadas?referencia=mi-lista')).json(); assert.match(r.texto, /Mi lista\./);
  assert.equal((await (await get('/api/biblioteca')).json()).total, 50, 'reemplaza, no suma');
  await guardarFila(d1, 'skills', 'auditoria-seo', { name: 'auditoria-seo', description: 'x', agents: [], departments: [], everyone: true, text: 'mi skill manda', files: [], source: 'brain' });
  const lista = await (await get('/api/biblioteca')).json();
  assert.equal(lista.total, 49); assert.ok(!lista.habilidades.some((x) => x.id === 'auditoria-seo'), 'una skill del dueño con el mismo nombre reemplaza a la habilidad (y esa sí se lee siempre)');
});

test('AGENTES (nube): el prompt trae el índice de las habilidades del puesto, la que encaja entera y el contexto de marketing; y reciben las dos herramientas (solo leen)', { skip: SALTAR }, async () => {
  const { d1, env } = await nube();
  const C = await leerContexto(d1), a = C.agents.find((x) => x.id === 'mlead');
  await guardarNotas(d1, [{ nombre: 'contexto-marketing', grupo: '00-Empresa', oficina: 0, texto: '# Contexto\nCliente ideal: dueñas de óptica.', actualizado: Date.now(), tarea: null }]);
  const e = await armarEjecucion({ db: d1, env, C, agente: a, tarea: { id: 't1', title: 'Plan de campañas pagadas en Meta', text: 'Arma la estructura de campañas de Meta Ads con presupuesto' }, modo: 'task', tieneHabilidades: true });
  assert.match(e.sistema, /BIBLIOTECA DE HABILIDADES/); assert.match(e.sistema, /Las de tu puesto:/); assert.match(e.sistema, /- campanas-pagadas — /);
  assert.match(e.sistema, /HABILIDAD QUE APLICA A ESTA TAREA/);
  assert.match(e.sistema, /CONTEXTO DE MARKETING[^]*dueñas de óptica/);
  const sin = await armarEjecucion({ db: d1, env, C, agente: a, tarea: { id: 't2', title: 'x', text: 'y' }, modo: 'task', tieneHabilidades: false });
  assert.ok(!/BIBLIOTECA DE HABILIDADES/.test(sin.sistema), 'sin las herramientas no se promete la biblioteca');
  const h = herramientasInternas({ env, db: d1, agente: a, tarea: 't1', modulos: MODULOS, habilidades: true });
  const nombres = h.defs.map((d) => d.nombre);
  assert.ok(nombres.includes('mcp__habilidades__ver_habilidades') && nombres.includes('mcp__habilidades__leer_habilidad'));
  assert.match(await h.llamar('mcp__habilidades__ver_habilidades', { buscar: 'precios' }), /habilidad\(es\):/);
  assert.match(await h.llamar('mcp__habilidades__leer_habilidad', { id: 'campanas-pagadas' }), /<habilidad>\n# /);
  await assert.rejects(() => h.llamar('mcp__habilidades__leer_habilidad', { id: '../x' }), /id es como/);
  assert.ok(!herramientasInternas({ env, db: d1, agente: a, tarea: 't1', modulos: MODULOS }).defs.some((d) => d.servidor === 'habilidades'), 'sin habilidades: false no se ofrece');
});

test('FICHA del agente (nube): GET /api/agents/<id> trae sus habilidades como la ficha local', { skip: SALTAR }, async () => {
  const { get } = await nube();
  const j = await (await get('/api/agents/mlead')).json();
  assert.ok(Array.isArray(j.biblioteca) && j.biblioteca.length > 30); assert.equal(j.biblioteca[0].suya !== undefined, true);
});
