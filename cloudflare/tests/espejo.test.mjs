// El espejo (lib/espejo.js): los archivos de data/ de la oficina local viven en D1 y corren en una carpeta temporal por petición.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fusionarJson, fusionarTexto, abrirEspejo, conEspejo } from '../worker/lib/espejo.js';
import { leerDoc } from '../worker/lib/almacen.js';
import { SALTAR, crearD1 } from './d1-memoria.mjs';

const BASE = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-espejo-test-'));
const opts = (extra = {}) => ({ base: BASE, ...extra });

test('fusión de tres vías: objetos clave a clave, listas con id por id, lo mío gana solo si chocamos', () => {
  const base = { items: [{ id: 'a', estado: 'borrador' }, { id: 'b', estado: 'borrador' }], n: 1 };
  const mio = { items: [{ id: 'a', estado: 'creando', progreso: 'x' }, { id: 'b', estado: 'borrador' }], n: 1 };
  const suyo = { items: [{ id: 'a', estado: 'borrador' }, { id: 'b', estado: 'borrador', nombre: 'Otro' }, { id: 'c', estado: 'borrador' }], n: 2 };
  const f = fusionarJson(base, mio, suyo);
  assert.deepEqual(f.items.map((x) => x.id), ['a', 'b', 'c'], 'lo nuevo del otro se queda');
  assert.equal(f.items[0].estado, 'creando', 'lo que cambié yo se queda');
  assert.equal(f.items[1].nombre, 'Otro', 'lo que cambió el otro se queda');
  assert.equal(f.n, 2);
  // yo quité b y el otro no lo tocó: se va; si el otro lo cambió, se queda
  assert.deepEqual(fusionarJson({ items: [{ id: 'a' }, { id: 'b' }] }, { items: [{ id: 'a' }] }, { items: [{ id: 'a' }, { id: 'b' }] }).items.map((x) => x.id), ['a']);
  assert.deepEqual(fusionarJson({ items: [{ id: 'a' }, { id: 'b', x: 1 }] }, { items: [{ id: 'a' }] }, { items: [{ id: 'a' }, { id: 'b', x: 2 }] }).items.map((x) => x.id), ['a', 'b']);
  // un valor que cambiamos los dos: gana el mío (lo último en escribir)
  assert.equal(fusionarJson({ v: 1 }, { v: 2 }, { v: 3 }).v, 2);
});

test('fusión de un .jsonl (el historial): las líneas de los dos, sin repetir', () => {
  const r = fusionarTexto('data/anuncios/historial.jsonl', 'a\n', 'a\nmia\n', 'a\nsuya\n');
  assert.deepEqual(r.split('\n').filter(Boolean), ['a', 'suya', 'mia']);
  assert.equal(fusionarTexto('data/x.txt', 'a', 'b', 'c'), 'b');
});

test('el espejo trae de D1, deja correr código que escribe archivos (con temporal y renombrar) y vuelca lo cambiado', { skip: SALTAR }, async () => {
  const db = crearD1();
  await conEspejo(db, opts({ prefijos: ['data/anuncios/'] }), async (esp) => {
    const f = esp.ruta('data/anuncios/borradores.json');
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f + '.tmp', JSON.stringify({ items: [{ id: 'b1' }] })); fs.renameSync(f + '.tmp', f);
    fs.writeFileSync(esp.ruta('data/anuncios/historial.jsonl'), '{"a":1}\n');
  });
  assert.deepEqual(JSON.parse((await leerDoc(db, 'fs:data/anuncios/borradores.json')).valor.t), { items: [{ id: 'b1' }] });
  assert.equal((await leerDoc(db, 'fs:data/anuncios/historial.jsonl')).valor.t, '{"a":1}\n');
  assert.equal((await leerDoc(db, 'fs:data/anuncios/borradores.json.tmp')).version, 0, 'un temporal nunca se guarda');
  // otra petición: lo ve, lo cambia y quita un archivo
  await conEspejo(db, opts({ prefijos: ['data/anuncios/'] }), async (esp) => {
    assert.deepEqual(JSON.parse(fs.readFileSync(esp.ruta('data/anuncios/borradores.json'), 'utf8')), { items: [{ id: 'b1' }] });
    fs.writeFileSync(esp.ruta('data/anuncios/borradores.json'), JSON.stringify({ items: [{ id: 'b1' }, { id: 'b2' }] }));
    fs.rmSync(esp.ruta('data/anuncios/historial.jsonl'));
  });
  assert.equal(JSON.parse((await leerDoc(db, 'fs:data/anuncios/borradores.json')).valor.t).items.length, 2);
  assert.equal((await leerDoc(db, 'fs:data/anuncios/historial.jsonl')).version, 0, 'lo que el código quitó se borra de D1');
  assert.equal(fs.readdirSync(BASE).filter((n) => n.startsWith('ao-')).length, 0, 'la carpeta de la petición se borra');
});

test('un volcado a mitad de la petición (flush) deja el diario en D1 ANTES de llamar a Meta', { skip: SALTAR }, async () => {
  const db = crearD1();
  const esp = await abrirEspejo(db, opts({ prefijos: ['data/anuncios/'] }));
  fs.mkdirSync(esp.ruta('data/anuncios'), { recursive: true });
  fs.writeFileSync(esp.ruta('data/anuncios/creaciones.json'), '{"b1":{"enCurso":{"nivel":"campana"}}}');
  await esp.flush(); // «apuntar el paso ANTES de llamar a Meta»
  assert.match((await leerDoc(db, 'fs:data/anuncios/creaciones.json')).valor.t, /enCurso/);
  esp.cerrar();
});

test('dos peticiones a la vez sobre el mismo archivo no se pisan: se fusionan (y el historial conserva las dos líneas)', { skip: SALTAR }, async () => {
  const db = crearD1();
  await conEspejo(db, opts({ prefijos: ['data/anuncios/'] }), async (esp) => {
    fs.mkdirSync(esp.ruta('data/anuncios'), { recursive: true });
    fs.writeFileSync(esp.ruta('data/anuncios/borradores.json'), JSON.stringify({ items: [{ id: 'a', estado: 'borrador' }, { id: 'b', estado: 'borrador' }] }));
    fs.writeFileSync(esp.ruta('data/anuncios/historial.jsonl'), '{"n":0}\n');
  });
  const lenta = await abrirEspejo(db, opts({ prefijos: ['data/anuncios/'] })); // la creación del cron, que dura
  const rapida = await abrirEspejo(db, opts({ prefijos: ['data/anuncios/'] }));  // el dueño edita otro borrador y anota algo
  fs.writeFileSync(rapida.ruta('data/anuncios/borradores.json'), JSON.stringify({ items: [{ id: 'a', estado: 'borrador' }, { id: 'b', estado: 'borrador', nombre: 'Editado' }] }));
  fs.appendFileSync(rapida.ruta('data/anuncios/historial.jsonl'), '{"n":"rapida"}\n');
  await rapida.flush(); rapida.cerrar();
  fs.writeFileSync(lenta.ruta('data/anuncios/borradores.json'), JSON.stringify({ items: [{ id: 'a', estado: 'creando' }, { id: 'b', estado: 'borrador' }] }));
  fs.appendFileSync(lenta.ruta('data/anuncios/historial.jsonl'), '{"n":"lenta"}\n');
  await lenta.flush(); lenta.cerrar();
  const items = JSON.parse((await leerDoc(db, 'fs:data/anuncios/borradores.json')).valor.t).items;
  assert.equal(items.find((x) => x.id === 'a').estado, 'creando', 'lo de la creación');
  assert.equal(items.find((x) => x.id === 'b').nombre, 'Editado', 'lo del dueño, sin perderse');
  const lineas = (await leerDoc(db, 'fs:data/anuncios/historial.jsonl')).valor.t.split('\n').filter(Boolean);
  assert.deepEqual(lineas.sort(), ['{"n":"lenta"}', '{"n":"rapida"}', '{"n":0}'].sort());
});

test('un archivo que no cabe en una fila de D1 se dice en palabras; las semillas y los medios no se guardan', { skip: SALTAR }, async () => {
  const db = crearD1();
  await assert.rejects(() => conEspejo(db, opts({ prefijos: ['data/anuncios/'] }), async (esp) => {
    fs.mkdirSync(esp.ruta('data/anuncios'), { recursive: true });
    fs.writeFileSync(esp.ruta('data/anuncios/enorme.json'), 'x'.repeat(2_000_000));
  }), /no cabe en una fila de D1/);
  await conEspejo(db, opts({ semillas: { 'biblioteca/umbrales.json': '{}' } }), async (esp) => {
    assert.equal(fs.readFileSync(esp.ruta('biblioteca/umbrales.json'), 'utf8'), '{}');
    fs.mkdirSync(esp.ruta('media/2026-10'), { recursive: true }); fs.writeFileSync(esp.ruta('media/2026-10/a.jpg'), 'bytes');
  });
  assert.equal((await db.prepare("select count(*) n from docs where clave like 'fs:%'").first()).n, 0);
});

test('las claves con % y _ no se cuelan en el LIKE de otro prefijo', { skip: SALTAR }, async () => {
  const db = crearD1();
  await conEspejo(db, opts(), async (esp) => { fs.mkdirSync(esp.ruta('data/an_uncios'), { recursive: true }); fs.writeFileSync(esp.ruta('data/an_uncios/x.json'), '{}'); fs.mkdirSync(esp.ruta('data/anXuncios'), { recursive: true }); fs.writeFileSync(esp.ruta('data/anXuncios/y.json'), '{}'); });
  await conEspejo(db, opts({ prefijos: ['data/an_uncios/'] }), async (esp) => {
    assert.ok(fs.existsSync(esp.ruta('data/an_uncios/x.json')));
    assert.ok(!fs.existsSync(esp.ruta('data/anXuncios/y.json')), '«_» no es un comodín');
  });
});
