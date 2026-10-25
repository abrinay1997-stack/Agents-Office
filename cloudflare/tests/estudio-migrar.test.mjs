// La migración del Estudio: el exportador de la computadora del dueño y la subida de sus archivos por PUT.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { manejar } from '../worker/lib/rutas.js';
import { exportar, subirArchivos } from '../../scripts/migrar/estudio.mjs';
import { SALTAR, crearD1, sembrar, envDePrueba, pedir } from './d1-memoria.mjs';
import { crearR2 } from './r2-memoria.mjs';

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13]), Buffer.from('IHDR'), Buffer.from([0, 0, 4, 0, 0, 0, 2, 0]), Buffer.alloc(30)]);

test('el exportador lee la galería local sin llaves, y sus archivos suben por PUT con su clave y su ficha', { skip: SALTAR }, async () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-estudio-')), raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-raiz-'));
  const dir = path.join(vault, 'Agents Office', 'media', '2026-09'); fs.mkdirSync(dir, { recursive: true });
  const f1 = '2026-09/2026-09-30 lentes 101010.png', f2 = '2026-09/2026-09-30 huerfano 101011.png';
  fs.writeFileSync(path.join(dir, '2026-09-30 lentes 101010.png'), png);
  fs.writeFileSync(path.join(dir, '2026-09-30 lentes 101010.json'), JSON.stringify({ id: f1, file: f1, kind: 'image', ext: 'png', at: 1790000000000, prompt: 'Lentes', model: 'nano-banana-2', hf: { url: 'https://caduca', at: 1 }, fav: true }));
  fs.writeFileSync(path.join(dir, '2026-09-30 huerfano 101011.json'), JSON.stringify({ id: f2, file: f2, kind: 'image', at: 1 })); // la ficha sin su archivo no viaja
  fs.writeFileSync(path.join(vault, 'Agents Office', 'media', 'folders.json'), JSON.stringify({ folders: [{ id: 'cabcde', name: 'Lentes', at: 1 }] }));
  fs.mkdirSync(path.join(raiz, 'data'), { recursive: true });
  fs.writeFileSync(path.join(raiz, 'data', 'minimax-voices.json'), JSON.stringify({ voices: [{ voiceId: 'AbrinayVoz01', name: 'Abrinay', kind: 'clone', at: 5, pinned: true, consent: { at: 1, text: 'mía' }, demoAudio: 'https://muestra.example/x' }] }));
  const out = await exportar({ raiz, vault });
  assert.deepEqual(out.filas['estudio-fichas'].map((x) => x.id), [f1]);
  assert.equal(out.filas['estudio-fichas'][0].valor.hf, undefined, 'lo que caduca en horas no viaja');
  assert.equal(out.archivos.length, 1); assert.deepEqual(out.docs['estudio.carpetas'].folders.map((c) => c.name), ['Lentes']);
  assert.deepEqual(Object.keys(out.docs['estudio.voces'].voices[0]).sort(), ['at', 'consent', 'kind', 'name', 'pinned', 'voiceId']);
  assert.ok(!JSON.stringify(out.docs).includes('muestra.example'), 'ni el audio de muestra');

  const d1 = crearD1(), admin = await sembrar(d1), env = { ...envDePrueba(d1), MEDIA: crearR2() };
  const cookie = (await pedir(manejar, env, '/api/acceso', { metodo: 'POST', cuerpo: { email: admin.email, contrasena: admin.clave } })).headers.get('set-cookie').split(';')[0];
  const api = async (ruta, o = {}) => (await pedir(manejar, env, ruta, { ...o, cookie })).json();
  await api('/api/migrar/filas', { metodo: 'POST', cuerpo: { coleccion: 'estudio-fichas', filas: out.filas['estudio-fichas'] } });
  await api('/api/migrar/docs', { metodo: 'POST', cuerpo: { clave: 'estudio.carpetas', valor: out.docs['estudio.carpetas'] } }); // secrets-ok: el nombre de un documento, no una clave
  const n = await subirArchivos({ base: 'https://oficina.test', cookie, archivos: out.archivos, fetchFn: (u, o) => manejar(new Request(u, o), env) });
  assert.equal(n, 1);
  assert.equal((await api('/api/media/item/' + encodeURIComponent(f1))).fav, true);
  assert.equal((await api('/api/media?n=5')).folders[0].name, 'Lentes');
});
