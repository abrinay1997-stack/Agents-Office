// La BIBLIOTECA de habilidades (7 oct 2026): se lee de biblioteca/<colección>/<id>/ y del Cerebro del dueño (gana el dueño), cada
// agente ve el índice de las suyas, la que encaja con la tarea se le adelanta entera y el resto lo pide con habilidades-mcp.mjs, que
// solo lee. Y la biblioteca real que viaja con la oficina cumple su formato.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarBiblioteca, raices, TOPES } from '../biblioteca.mjs';
import { TOOLS } from '../habilidades-mcp.mjs';
import { validarEvals } from '../scripts/evals-skill.mjs';
import { kindOf } from '../safety.mjs';

const AGENTES = [{ id: 'mlead', department: 'marketing' }, { id: 'ada', department: 'marketing' }, { id: 'pros', department: 'sales' }, { id: 'invo', department: 'fin' }];
const DEPTOS = ['emails', 'sales', 'marketing', 'ops', 'fin', 'delivery'];
const escribir = (dir, archivos) => { for (const [f, t] of Object.entries(archivos)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), t); } };
const skill = (id, extra = {}) => `---\nname: ${id}\ntitulo: ${extra.titulo || id}\ndescription: ${extra.description || 'Úsala cuando haga falta.'}\narea: ${extra.area || 'estrategia'}\ndepartments: [${extra.departments || 'marketing'}]\nagents: [${extra.agents || ''}]\norigen: prueba\n---\n# ${id}\n${extra.cuerpo || 'Pasos.'}\n`;

function fixture() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-bib-')), brain = path.join(raiz, 'brain');
  escribir(path.join(raiz, 'biblioteca', 'marketing'), {
    'campanas-pagadas/SKILL.md': skill('campanas-pagadas', { titulo: 'Campañas pagadas', description: 'Úsala cuando haya que planear o revisar anuncios pagados en Meta o Google: presupuesto, públicos, campañas.', area: 'pagados-y-medicion', agents: 'ada', cuerpo: 'Paso 1: el objetivo.\n\n## Habilidades relacionadas\n- `creatividad-anuncios`\n- `no-existe`' }),
    'campanas-pagadas/referencias/estructura de cuentas.md': '# Estructura\nCampañas, conjuntos, anuncios.',
    'campanas-pagadas/evals.json': JSON.stringify({ skill: 'campanas-pagadas', evals: [{ id: 'uno', prompt: 'Arma una campaña de Meta para la ferretería', expectations: ['Propone un objetivo claro', 'No dice que lanzó nada'] }] }),
    'creatividad-anuncios/SKILL.md': skill('creatividad-anuncios', { titulo: 'Creatividad de anuncios', description: 'Úsala cuando haya que escribir titulares y textos de anuncios.', agents: 'ada,mlead' }),
    'prospeccion/SKILL.md': skill('prospeccion', { titulo: 'Prospección', description: 'Úsala cuando haya que armar listas de prospectos.', departments: 'sales, marketing', agents: 'pros', area: 'ventas-y-gtm' }),
    'mala/SKILL.md': skill('mala', { area: 'inventada', agents: 'nadie', departments: 'marte' }),
    'sin-skill/leeme.md': 'nada',
  });
  escribir(path.join(brain, 'Agents Office', 'biblioteca'), { 'creatividad-anuncios/SKILL.md': skill('creatividad-anuncios', { titulo: 'Creatividad (la nuestra)', description: 'Úsala cuando haya que escribir anuncios con nuestra voz.', agents: 'ada' }) });
  return { raiz, brain };
}

test('se lee la de la oficina y la del dueño (gana el dueño); los problemas se dicen en palabras; una skill del dueño la reemplaza', () => {
  const { raiz, brain } = fixture();
  try {
    const b = cargarBiblioteca({ raiz, brainPath: brain, agentes: AGENTES, deptos: DEPTOS });
    assert.deepEqual(b.todas.map(h => h.id).sort(), ['campanas-pagadas', 'creatividad-anuncios', 'prospeccion'], 'una sin ningún puesto ni departamento válido no se usa');
    assert.equal(b.porId('creatividad-anuncios').fuente, 'cerebro'); assert.equal(b.porId('creatividad-anuncios').titulo, 'Creatividad (la nuestra)');
    assert.ok(b.problemas.some(p => /sin-skill\/: falta SKILL.md/.test(p)));
    assert.ok(b.problemas.some(p => /mala.*área «inventada»/.test(p)) && b.problemas.some(p => /«nadie» no es un puesto/.test(p)) && b.problemas.some(p => /«marte» no es un departamento/.test(p)) && b.problemas.some(p => /mala: ninguno de sus puestos/.test(p)));
    assert.deepEqual(b.porId('campanas-pagadas').referencias.map(r => r.nombre), ['estructura de cuentas']);
    assert.deepEqual(b.rotas(b.porId('campanas-pagadas')), ['no-existe'], 'una relacionada que no existe se detecta');
    const sin = cargarBiblioteca({ raiz, brainPath: brain, agentes: AGENTES, deptos: DEPTOS, skillsDelDueno: ['prospeccion'] });
    assert.ok(!sin.porId('prospeccion'), 'una skill del dueño con el mismo nombre manda (y esa se lee siempre)');
  } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
});

test('cada agente ve las suyas; la que encaja con la tarea se adelanta entera; el índice es corto', () => {
  const { raiz, brain } = fixture();
  try {
    const b = cargarBiblioteca({ raiz, brainPath: brain, agentes: AGENTES, deptos: DEPTOS });
    const ada = AGENTES[1], pros = AGENTES[2], invo = AGENTES[3];
    assert.deepEqual(b.de(ada).map(h => h.id).sort(), ['campanas-pagadas', 'creatividad-anuncios', 'prospeccion'], 'las de su departamento');
    assert.deepEqual(b.de(pros).map(h => h.id), ['prospeccion']); assert.deepEqual(b.de(invo), [], 'Finanzas no tiene ninguna');
    assert.equal(b.elegir('Prepara la campaña de anuncios en Meta para el lanzamiento, con presupuesto', ada)[0]?.id, 'campanas-pagadas');
    assert.deepEqual(b.elegir('Contesta el correo de la señora García', ada), [], 'nada por debajo del umbral');
    const p = b.promptText(ada, 'campaña de anuncios pagados en Meta con presupuesto');
    assert.match(p, /HABILIDAD QUE APLICA A ESTA TAREA: Campañas pagadas \(campanas-pagadas\)/); assert.match(p, /Paso 1: el objetivo/);
    assert.match(p, /Las de tu puesto:\n(- .*\n)*- campanas-pagadas — Campañas pagadas: cuando haya que planear/);
    assert.ok(!/HABILIDAD QUE APLICA/.test(b.promptText(ada, '')), 'sin pedido, solo el índice');
    assert.equal(b.promptText(invo, 'lo que sea'), '');
  } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
});

test('leer: la habilidad con su lista de referencias, una referencia por nombre (sin salirse de su carpeta), y errores claros', () => {
  const { raiz, brain } = fixture();
  try {
    const b = cargarBiblioteca({ raiz, brainPath: brain, agentes: AGENTES, deptos: DEPTOS });
    assert.match(b.leer('campanas-pagadas').texto, /REFERENCIAS[\s\S]*- estructura de cuentas/);
    assert.match(b.leer('campanas-pagadas', 'estructura').texto, /Campañas, conjuntos, anuncios/, 'por parte del nombre');
    assert.match(b.leer('campanas-pagadas', '../../SKILL').error, /no tiene la referencia/);
    assert.match(b.leer('nada').error, /no hay ninguna habilidad «nada»/);
    assert.ok(raices('Campañas de anuncios').includes('campan') && !raices('para las de').length); assert.ok(!raices('contesta').some(r => raices('contexto').includes(r)), 'el verbo de un pedido no encuentra otra palabra');
  } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
});

test('el servidor MCP solo lee: sus herramientas empiezan por ver/leer y el guardián las cuenta como lectura', () => {
  assert.deepEqual(TOOLS.map(t => t.name), ['ver_habilidades', 'leer_habilidad']);
  for (const t of TOOLS) { assert.match(t.name, /^(ver|leer)_/); assert.equal(kindOf(`mcp__habilidades__${t.name}`), 'read'); }
});

test('la biblioteca que viaja con la oficina: formato, ids, relacionadas, puestos, evals y tamaños', () => {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // 8 oct 2026: `.pathname` daba «C:\C:\…» en Windows
  const roster = JSON.parse(fs.readFileSync(path.join(ROOT, 'office.agents.json'), 'utf8')).agents;
  const b = cargarBiblioteca({ raiz: ROOT, brainPath: null, agentes: roster, deptos: DEPTOS });
  if (!b.todas.length) return; // todavía sin colección
  assert.deepEqual(b.problemas, [], 'sin problemas de formato');
  for (const h of b.todas) {
    assert.ok(h.description.length >= 30 && h.description.length <= 400, `${h.id}: la descripción dice cuándo usarla (30–400)`);
    assert.ok(h.departments.length || h.agents.length, `${h.id}: está atada a algún departamento o puesto`);
    assert.ok(h.cuerpo.length >= 1500, `${h.id}: el cuerpo tiene sustancia`);
    assert.ok(h.cuerpo.length <= TOPES.leer, `${h.id}: el cuerpo cabe de una vez (${h.cuerpo.length} > ${TOPES.leer}): lo detallado va a referencias/`);
    assert.deepEqual(b.rotas(h), [], `${h.id}: sus habilidades relacionadas existen`);
    assert.match(h.origen, /MIT|propia|oficina/, `${h.id}: dice de dónde viene`);
    for (const r of h.referencias) assert.ok(r.chars <= TOPES.referencia * 1.4, `${h.id}/${r.nombre}: la referencia es demasiado larga (${r.chars})`);
    if (h.evals) { const e = JSON.parse(fs.readFileSync(path.join(h.dir, 'evals.json'), 'utf8')); assert.equal(e.skill, h.id); assert.deepEqual(validarEvals(e), [], `${h.id}/evals.json`); }
    assert.ok(!/\?ref=|\.agents\/product-marketing/.test(h.cuerpo), `${h.id}: sin enlaces de afiliado ni el archivo de contexto del original`);
  }
});

test('habilidades-mcp habla con la oficina: lista las del agente o busca, y lee una habilidad o su referencia', async () => {
  const { spawn } = await import('node:child_process'); const http = await import('node:http');
  const pedidas = [];
  const srv = http.createServer((rq, rs) => { pedidas.push(rq.url); rs.writeHead(200, { 'content-type': 'application/json' });
    rs.end(JSON.stringify(rq.url.startsWith('/api/biblioteca?') ? { habilidades: [{ id: 'precios', titulo: 'Precios', areaNombre: 'Estrategia', description: 'Úsala cuando…' }] } : { texto: '# Precios\nPasos.' })); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const p = spawn(process.execPath, [path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'habilidades-mcp.mjs')], { env: { ...process.env, AO_OFFICE: `http://127.0.0.1:${srv.address().port}`, AO_AGENT: 'mlead' } });
  const respuestas = new Map(); let buf = '';
  p.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); respuestas.set(m.id, m); } });
  const pide = (id, method, params) => { p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); return new Promise(r => { const t = setInterval(() => { if (respuestas.has(id)) { clearInterval(t); r(respuestas.get(id)); } }, 10); }); };
  try {
    assert.equal((await pide(1, 'initialize', {})).result.serverInfo.name, 'habilidades');
    assert.equal((await pide(2, 'tools/list')).result.tools.length, 2);
    assert.match((await pide(3, 'tools/call', { name: 'ver_habilidades', arguments: { buscar: 'precio' } })).result.content[0].text, /precios — Precios/);
    assert.match((await pide(4, 'tools/call', { name: 'leer_habilidad', arguments: { id: 'precios', referencia: 'tabla de planes' } })).result.content[0].text, /<habilidad>\n# Precios/);
    assert.equal((await pide(5, 'tools/call', { name: 'leer_habilidad', arguments: { id: '../etc' } })).result.isError, true, 'un id raro no llega a la oficina');
    assert.deepEqual(pedidas, ['/api/biblioteca?agente=mlead&buscar=precio', '/api/biblioteca/precios?referencia=tabla%20de%20planes']);
  } finally { p.kill(); srv.close(); }
});
