// Versión móvil, equipo C (25 oct 2026): lo puro de Ajustes, Conectores, Costos, Negocio y Equipo, y que las vistas se registren y reemplacen a las de escritorio.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mismo, cambios, lineas, estadoConector, monograma, herramientasDe, usd, nivelPresupuesto, fmtKpi, trazo, idDe, nAtencion, avisoModelo, slugConector } from '../src/movil/ajustes-core.mjs';
import { crearShell } from '../src/movil/shell.js';
import { registrar as ajustes, META } from '../src/movil/vistas/ajustes.js';
import { registrar as conectores } from '../src/movil/vistas/conectores.js';
import { registrar as costos } from '../src/movil/vistas/costos.js';
import { registrar as estado } from '../src/movil/vistas/estado.js';
import { registrar as negocio } from '../src/movil/vistas/negocio.js';
import { registrar as equipo } from '../src/movil/vistas/equipo.js';
import { registrar as agente } from '../src/movil/vistas/agente.js';
import * as settings from '../settings.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const leer = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('cambios: solo lo que de verdad cambió viaja al servidor (la misma regla que escritorio)', () => {
  const F = [{ path: 'a', type: 'number' }, { path: 'b', type: 'bool' }, { path: 'c', type: 'list' }, { path: 'd', type: 'text' }, { path: 'e', type: 'select', options: [['x', 'X'], ['y', 'Y']] }, { path: 'f', type: 'checks', default: ['p'] }, { path: 'g', type: 'depts' }];
  const valores = { a: 3, b: true, c: ['uno'], d: 'hola', e: 'y' };
  // nada tocado: nada se manda (un número vacío, un interruptor y una lista sin tocar no se escriben)
  assert.deepEqual(cambios(F, valores, { a: '', b: true, c: ['uno'], d: 'hola', e: 'y', f: ['p'], g: [] }), {});
  assert.deepEqual(cambios(F, {}, { a: '', b: false, c: [], d: '', e: 'x', f: ['p'], g: [] }), {}, 'sin valores guardados, lo que está «como en blanco» no se escribe (ni el primer select, que es lo que muestra el teléfono)');
  assert.deepEqual(cambios(F, valores, { a: '5', b: false, c: ['uno', 'dos'], d: 'adiós', e: 'x', f: ['p', 'q'], g: ['ops'] }), { a: '5', b: false, c: ['uno', 'dos'], d: 'adiós', e: 'x', f: ['p', 'q'], g: ['ops'] });
  assert.equal(mismo({ type: 'number' }, '3', 3), true); assert.equal(mismo({ type: 'number' }, '4', 3), false);
  assert.deepEqual(cambios(F, valores, { zzz: 1 }), {}, 'un campo que no está en el formulario se ignora');
  assert.deepEqual(lineas(' a \n\n b\n'), ['a', 'b']);
});

test('estadoConector dice el estado con palabras y qué hacer (nunca solo color)', () => {
  assert.equal(estadoConector({ status: 'connected' }).txt, 'Conectado');
  assert.deepEqual([estadoConector({ status: 'needs-auth' }).txt, estadoConector({ status: 'needs-auth' }).tono], ['Necesita autorización', 'warn']);
  assert.match(estadoConector({ status: 'failed', detail: 'No respondió' }).que, /No respondió/);
  assert.equal(estadoConector({ status: 'disabled' }).txt, 'Apagado');
  assert.equal(estadoConector({ status: 'connected', denied: true }).tono, 'off', 'bloqueado para los agentes gana a «conectado»');
  for (const s of ['connected', 'needs-auth', 'failed', 'pending', 'disabled', 'raro']) assert.ok(estadoConector({ status: s }).txt.length > 3);
});

test('herramientas: separa las que leen de las que envían, y en la duda envía', () => {
  const h = herramientasDe({ tools: ['get_x', 'send_email', 'cosa_rara'], kinds: { get_x: 'read', send_email: 'write' } });
  assert.deepEqual(h.lee, ['get_x']); assert.deepEqual(h.envia, ['send_email', 'cosa_rara']);
  assert.deepEqual(herramientasDe({ tools: ['list_things', 'delete_x'] }), { lee: ['list_things'], envia: ['delete_x'] });
});

test('el monograma de un conector sin icono es estable', () => {
  assert.equal(monograma('plugin:small-business:gmail').ini, 'GM'); assert.equal(monograma('Zapier MCP').ini, 'ZM');
  assert.deepEqual(monograma('Notion'), monograma('Notion')); assert.notEqual(monograma('Notion').tono, monograma('Stripe').tono);
});

test('dinero y presupuesto', () => {
  assert.equal(usd(0), 'US$0'); assert.equal(usd(0.0042), 'US$0.004'); assert.equal(usd(12.345), 'US$12.35'); assert.match(usd(1500), /^US\$1.?500$/);
  assert.equal(nivelPresupuesto(0.5), 'ok'); assert.equal(nivelPresupuesto(0.75), 'warn'); assert.equal(nivelPresupuesto(0.89), 'warn'); assert.equal(nivelPresupuesto(0.9), 'bad'); assert.equal(nivelPresupuesto(1.4), 'bad');
});

test('indicadores: valor con su unidad, trazo, id', () => {
  assert.equal(fmtKpi(null, 'US$'), '—'); assert.match(fmtKpi(1250, 'US$'), /^US\$1.?250$/); assert.equal(fmtKpi(12, 'clientes'), '12 clientes');
  assert.equal(trazo([1]), ''); assert.match(trazo([1, 3, 2]), /^M2\.0,\d+\.\d,?L/); assert.equal(trazo([5, 5]).startsWith('M2.0,'), true);
  assert.equal(idDe('Ventas de la semana'), 'ventas_de_la_semana'); assert.equal(idDe('  ¿Café? Ñandú '), 'cafe_nandu');
});

test('atención del semáforo y aviso de un modelo sin herramientas', () => {
  assert.equal(nAtencion({ checks: [{ state: 'ok' }, { state: 'warn' }, { state: 'bad' }, { state: 'info' }] }), 2); assert.equal(nAtencion(null), 0);
  const cat = [{ id: 'm', nombre: 'Muse', herramientas: false }, { id: 'c', nombre: 'Claude', herramientas: true }];
  assert.match(avisoModelo(cat, 'm', true), /no usa herramientas/); assert.equal(avisoModelo(cat, 'm', false), ''); assert.equal(avisoModelo(cat, 'c', true), ''); assert.equal(avisoModelo(cat, '', true), '');
});

test('slugConector: id válido para el servidor y sin repetirse', () => {
  const ok = /^[a-z][a-z0-9-]{1,39}$/;
  for (const t of ['Zapier', 'n8n', '  Mi servidor ñandú  ', '123', 'a', 'X'.repeat(80)]) assert.match(slugConector(t), ok, t);
  assert.equal(slugConector('Zapier', ['zapier']), 'zapier-2'); assert.equal(slugConector('Zapier', ['zapier', 'zapier-2']), 'zapier-3');
});

test('las vistas del equipo C se registran y reemplazan a las de escritorio en «Más»', () => {
  globalThis.window = { AO_NUBE: {} };
  try {
    const sh = crearShell(); for (const r of [ajustes, conectores, costos, estado, negocio, equipo, agente]) r(sh);
    const ids = sh.vistas().map(v => v.id);
    for (const id of ['ajustes', 'ajustes-seccion', 'conectores', 'costos', 'estado', 'negocio', 'perfil', 'equipo', 'agente']) assert.ok(ids.includes(id), `falta la vista «${id}»`);
    const quedan = sh.entradasEscritorio().map(x => x.id);
    for (const id of ['ajustes', 'conectores', 'costos', 'estado', 'negocio', 'perfil', 'equipo']) assert.ok(!quedan.includes(id), `«${id}» sigue abriéndose en el contenedor de escritorio`);
    for (const v of sh.vistas().filter(v => ['ajustes', 'conectores', 'costos', 'estado', 'negocio', 'perfil', 'equipo'].includes(v.id))) assert.equal(v.grupo, 'mas', v.id);
    for (const v of sh.vistas()) assert.ok(typeof v.montar === 'function' || typeof v.abrir === 'function');
  } finally { delete globalThis.window; }
  globalThis.window = {}; // la computadora: no hay cuentas, así que ni Mi perfil ni Equipo
  try { const sh = crearShell(); equipo(sh); assert.deepEqual(sh.vistas().map(v => v.id), []); } finally { delete globalThis.window; }
});

test('Ajustes cubre TODAS las secciones que el servidor define (nada de escritorio queda sin pantalla)', () => {
  const grupos = settings.GROUPS.map(g => g[0]);
  const lista = leer('src/movil/vistas/ajustes.js');
  for (const g of grupos) assert.ok(META[g], `el grupo «${g}» de settings.mjs no tiene su fila en Ajustes móvil`);
  for (const f of settings.FIELDS) assert.ok(['text', 'number', 'bool', 'select', 'list', 'depts', 'checks', 'time', 'people'].includes(f.type), `${f.path}: tipo «${f.type}» sin control móvil`);
  const campos = leer('src/movil/vistas/campos.js');
  for (const t of ['bool', 'select', 'number', 'time', 'list', 'depts', 'checks', 'people']) assert.ok(campos.includes(`'${t}'`), `campos.js no dibuja «${t}»`);
  for (const s of ['cifras', 'voz', 'empresa', 'apariencia', 'agentes', 'modelos', 'funciones']) assert.ok(META[s], `falta ${s}`);
  assert.ok(/\/api\/settings/.test(lista) && !/FIELDS\s*=\s*\[/.test(lista), 'los campos vienen del servidor, no se redefinen aquí');
});

test('estilo de equipo C: nada de :hover, ningún texto bajo 11 px, y todo botón de acción pasa por conEstado', () => {
  const css = leer('src/css/movil-c.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/:hover/.test(css)); assert.deepEqual([...css.matchAll(/font-size:\s*([\d.]+)px/g)].map(m => +m[1]).filter(n => n < 11), []);
  for (const f of ['ajustes', 'conectores', 'costos', 'estado', 'negocio', 'equipo', 'agente']) { const s = leer(`src/movil/vistas/${f}.js`); assert.match(s, /conEstado/, `${f}.js: las acciones asíncronas deben dar feedback con conEstado`); assert.doesNotMatch(s, /\bconfirm\(|\balert\(/, `${f}.js: nada de diálogos del navegador`); }
  assert.doesNotMatch(leer('src/movil/ajustes-core.mjs') + leer('src/movil/vistas/campos.js'), /sk-ant|Bearer /);
});

test('la nube: el token de un conector solo sale del formulario hacia el servidor, nunca se pinta ni se guarda en la página', () => {
  const s = leer('src/movil/vistas/conectores.js');
  assert.doesNotMatch(s, /localStorage|sessionStorage/, 'el token no se guarda en el navegador');
  assert.match(s, /type="password"/, 'el campo del token es de contraseña');
  assert.doesNotMatch(s, /value="\$\{esc\(F\.token\)/, 'el token escrito no se vuelve a pintar');
});
