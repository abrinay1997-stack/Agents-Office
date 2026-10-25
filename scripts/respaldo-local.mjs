#!/usr/bin/env node
// Copia de seguridad de lo que SOLO está en esta computadora (no viaja por GitHub): data/, las entregas y notas
// del Cerebro de la oficina, y los ajustes locales. Hazla ANTES de mudar nada a la nube.
//   node scripts/respaldo-local.mjs [carpeta-destino]
// Por defecto va a ../respaldo-oficina-AAAA-MM-DD (fuera del repositorio: no se puede subir a GitHub por error).
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, ROOT } from '../config.mjs';

const SALTAR = new Set(['node_modules', '.git', 'capturas']); // las capturas de pruebas pesan y se regeneran

export function listar(dir, base = dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SALTAR.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) listar(p, base, acc); else acc.push({ ruta: path.relative(base, p), bytes: fs.statSync(p).size });
  }
  return acc;
}

export function respaldar({ destino, raiz = ROOT, cerebro = loadConfig().brainPath } = {}) {
  const fuentes = [
    ['data', path.join(raiz, 'data')],
    ['cerebro/Agents Office', path.join(cerebro, 'Agents Office')],
  ];
  for (const f of ['office.config.local.json', 'office.agents.local.json']) if (fs.existsSync(path.join(raiz, f))) fuentes.push([f, path.join(raiz, f)]);
  fs.mkdirSync(destino, { recursive: true });
  const manifiesto = { fecha: new Date().toISOString(), de: raiz, partes: [] };
  for (const [nombre, origen] of fuentes) {
    if (!fs.existsSync(origen)) { manifiesto.partes.push({ nombre, estado: 'no existe' }); continue; }
    const hacia = path.join(destino, nombre);
    fs.cpSync(origen, hacia, { recursive: true, filter: (s) => !SALTAR.has(path.basename(s)) && !fs.lstatSync(s).isSymbolicLink() });
    const archivos = fs.statSync(hacia).isDirectory() ? listar(hacia) : [{ bytes: fs.statSync(hacia).size }];
    manifiesto.partes.push({ nombre, archivos: archivos.length, bytes: archivos.reduce((a, x) => a + x.bytes, 0) });
  }
  fs.writeFileSync(path.join(destino, 'MANIFIESTO.json'), JSON.stringify(manifiesto, null, 2));
  return manifiesto;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const destino = path.resolve(process.argv[2] || path.join(ROOT, '..', `respaldo-oficina-${new Date().toISOString().slice(0, 10)}`));
  if (destino.startsWith(ROOT + path.sep)) { console.error('El destino no puede estar dentro del repositorio (se podría subir a GitHub por error).'); process.exit(1); }
  const m = respaldar({ destino });
  for (const p of m.partes) console.log(`${p.estado ? '·' : '✓'} ${p.nombre}${p.estado ? ' — ' + p.estado : `: ${p.archivos} archivos, ${(p.bytes / 1048576).toFixed(1)} MB`}`);
  console.log(`\nCopia lista en: ${destino}\nGuárdala en otro disco o en la nube. Contiene datos privados de tu negocio.`);
}
