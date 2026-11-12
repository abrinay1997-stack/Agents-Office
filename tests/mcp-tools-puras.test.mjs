// oficina-tools.mjs y estudio-tools.mjs: las definiciones de herramientas SIN transporte, que el conector remoto (el Worker, sin stdio ni sistema de archivos) usa tal cual.
//   · no importan (ni sus importaciones, de forma transitiva) nada exclusivo de Node;
//   · cada herramienta lleva sus metadatos (soloLectura, destructiva, idempotente; y gasta en el Estudio) y los nombres de lectura leen de verdad;
//   · lo que gasta en el Estudio es exactamente lo que `safety.mjs` trata como «cost»; nada de la oficina suena a aprobar, enviar, publicar, pagar o borrar;
//   · el ejecutor corre contra una interfaz inyectada, sin red ni disco.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as O from '../oficina-tools.mjs';
import * as E from '../estudio-tools.mjs';
import * as S from '../safety.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOLO_NODE = /^(node:|fs$|fs\/|path$|child_process$|os$|crypto$|http$|https$|net$|tls$|zlib$|stream$|readline$|url$|worker_threads$|process$|sharp$|exceljs$)/;

/** Los import/export-from de un archivo (relativos y de paquete), sin los comentarios. */
function importsDe(archivo) {
  const t = fs.readFileSync(archivo, 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  return [...t.matchAll(/(?:^|\n)\s*(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)|\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m => m[1] || m[2] || m[3] || m[4]);
}
function cierre(entrada) {
  const vistos = new Set(), malos = []; const cola = [path.join(ROOT, entrada)];
  while (cola.length) {
    const f = cola.pop(); if (vistos.has(f)) continue; vistos.add(f);
    for (const imp of importsDe(f)) {
      if (SOLO_NODE.test(imp)) { malos.push(`${path.relative(ROOT, f)} importa «${imp}»`); continue; }
      if (imp.startsWith('.')) cola.push(path.resolve(path.dirname(f), imp));
      else malos.push(`${path.relative(ROOT, f)} importa el paquete «${imp}» (el Worker no lo tiene garantizado)`);
    }
  }
  return { vistos: [...vistos].map(f => path.relative(ROOT, f)), malos };
}

for (const archivo of ['oficina-tools.mjs', 'estudio-tools.mjs']) {
  test(`${archivo}: ni él ni lo que importa usa módulos exclusivos de Node`, () => {
    const { vistos, malos } = cierre(archivo);
    assert.deepEqual(malos, []);
    assert.ok(vistos.length >= 2, 'el recorrido debe seguir las importaciones relativas');
    const t = fs.readFileSync(path.join(ROOT, archivo), 'utf8');
    assert.ok(!/\bprocess\.|\brequire\(|\b__dirname\b|readFileSync|child_process/.test(t.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n')), 'sin process, require ni lectura de archivos');
  });
}

const CATALOGO = { models: [
  { id: 'img1', name: 'Img', kind: 'image', engine: 'google', on: true }, { id: 'vid1', name: 'Vid', kind: 'video', engine: 'google', on: true },
  { id: 'voz1', name: 'Voz', kind: 'audio', engine: 'minimax', on: true }, { id: 'mus1', name: 'Mus', kind: 'music', engine: 'minimax', on: true },
], engines: [{ id: 'meta', name: 'Meta', on: true }], default: {} };
const BANCO = { presets: [{ id: 'fondo-blanco', nombre: 'Fondo blanco', medios: ['image'], on: true, ejecutor: 'local' }], sharp: true, fabrica: { canales: [] } };
const CON_ESTUDIO = E.herramientas(CATALOGO, BANCO);

test('oficina: 18 herramientas, cada una con sus metadatos', () => {
  assert.equal(O.TOOLS.length, 18);
  for (const t of O.TOOLS) {
    assert.deepEqual(Object.keys(t).sort(), ['description', 'destructiva', 'idempotente', 'inputSchema', 'name', 'soloLectura'], t.name);
    for (const k of ['soloLectura', 'destructiva', 'idempotente']) assert.equal(typeof t[k], 'boolean', `${t.name}.${k}`);
    assert.ok(!(t.soloLectura && t.destructiva), `${t.name}: lo que solo lee no es destructivo`);
    if (t.soloLectura) assert.ok(t.idempotente, `${t.name}: leer es idempotente`);
    assert.equal(t.soloLectura, /^(ver|listar|buscar|estado)_|^como_funciona$/.test(t.name), `${t.name}: solo lee quien ve, lista, busca, da el estado o explica`);
  }
  assert.deepEqual(O.publicas(O.TOOLS).map(t => Object.keys(t)), O.TOOLS.map(() => ['name', 'description', 'inputSchema']), 'por el protocolo solo salen nombre, descripción y esquema');
  assert.deepEqual(O.anotaciones(O.TOOLS.find(t => t.name === 'ver_tareas')), { readOnlyHint: true, destructiveHint: false, idempotentHint: true });
});

test('oficina: nada suena a aprobar, enviar, publicar, pagar o borrar, ni a gastar', () => {
  for (const t of O.TOOLS) {
    assert.ok(!/aprob|envi|public|pag[oa]|borr(?!ador)|elimin|gast|activ/i.test(t.name), `${t.name} suena a una acción vetada`);
    assert.ok(!('gasta' in t), `${t.name}: gastar es del Estudio, no de la oficina`);
  }
  const tipos = O.TOOLS.find(t => t.name === 'hacer').inputSchema.properties.type.enum;
  for (const tipo of tipos) assert.ok(!/aprob|envi|public|pag[oa]|borr(?!ador)|elimin|gast|activar/i.test(tipo), `hacer: el tipo ${tipo} suena a una acción vetada`);
  assert.ok(O.INSTRUCCIONES.includes('aquí no se puede'));
});

test('estudio: con todo encendido, 14 herramientas con sus metadatos; lo que gasta es exactamente lo «cost» de safety.mjs', () => {
  assert.equal(CON_ESTUDIO.length, 14);
  const gastan = [];
  for (const t of CON_ESTUDIO) {
    for (const k of ['soloLectura', 'destructiva', 'idempotente', 'gasta']) assert.equal(typeof t[k], 'boolean', `${t.name}.${k}`);
    assert.equal(t.destructiva, false, `${t.name}: el Estudio no borra`);
    assert.ok(!(t.soloLectura && t.gasta), `${t.name}: lo que lee no gasta`);
    assert.equal(t.soloLectura, /^(ver|listar|buscar|estado)_/.test(t.name), `${t.name}: solo lee quien ve, busca o da el estado`);
    if (t.gasta) gastan.push(t.name);
    assert.equal(S.kindOf(`mcp__estudio__${t.name}`, {}) === 'cost', t.gasta, `${t.name}: «gasta» coincide con lo que safety.mjs trata como «cost»`);
  }
  assert.deepEqual(gastan.sort(), ['aplicar_preset', 'analizar_video', 'crear_lote', 'generar_imagen', 'generar_musica', 'generar_video', 'generar_voz', 'transcribir_audio'].sort());
  assert.deepEqual(E.publicas(CON_ESTUDIO).map(t => Object.keys(t)), CON_ESTUDIO.map(() => ['name', 'description', 'inputSchema']));
});

test('estudio: sin keys ni banco solo ofrece lo que sirve (la lista depende de lo encendido, no del transporte)', () => {
  const nombres = lista => lista.map(t => t.name);
  assert.deepEqual(nombres(E.herramientas(null, null)), ['generar_imagen', 'generar_video', 'buscar_en_galeria', 'ver_imagen', 'estado_trabajo', 'estado_estudio']);
  const sinBanco = nombres(E.herramientas(CATALOGO, null));
  assert.ok(sinBanco.includes('generar_voz') && sinBanco.includes('generar_musica') && sinBanco.includes('analizar_video') && !sinBanco.includes('crear_lote'));
});

test('ejecutores: corren contra una interfaz inyectada (sin red ni disco) y dicen el motivo cuando fallan', async () => {
  const llamadas = [];
  const office = async (ruta, cuerpo) => { llamadas.push([ruta, cuerpo || null]); if (ruta === '/api/oficina/estado') return { texto: 'ESTADO' }; if (ruta === '/api/media/models') return CATALOGO; if (ruta === '/api/media/presets') return BANCO; throw new Error('no existe ' + ruta); };
  const o = O.crearLlamador({ office });
  assert.match(await o('estado_oficina', {}), /ESTADO/);
  await assert.rejects(() => o('no_existe', {}), /herramienta desconocida: no_existe/);
  const e = E.crearEstudio({ office, patch: async () => ({}), quien: () => ({ by: 'agent', agent: 'a1', task: 't1' }) });
  assert.equal((await e.tools()).length, 14);
  await assert.rejects(() => e.call('ver_imagen', {}), /falta el id de la imagen/);
  assert.deepEqual(llamadas.map(l => l[0]), ['/api/oficina/estado', '/api/media/models', '/api/media/presets']);
});
