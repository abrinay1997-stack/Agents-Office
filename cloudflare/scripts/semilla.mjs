#!/usr/bin/env node
// La SEMILLA «PanaClaw por defecto» (25 oct 2026): lo que la nube necesita para empezar con la oficina de fábrica SIN depender de la computadora del dueño.
// Se genera en cada despliegue (workflow «Cloudflare · desplegar») a partir del repositorio y se sirve como activo estático (public/semilla/), detrás de la sesión:
// el Worker la lee con env.ASSETS (lib/semilla.js). No cuenta contra el tamaño del Worker ni se guarda en D1 hasta que el dueño pulsa «PanaClaw por defecto».
//
//   semilla/manifest.json            qué lleva, cuánto pesa, de qué commit sale y su huella
//   semilla/notas.json               las notas del Cerebro de PanaClaw (brain-panaclaw/, 59), cada una con su grupo
//   semilla/grafo.json               el mapa del Cerebro YA calculado (el Worker no puede: gasta más CPU de la que tiene)
//   semilla/equipo.json              { agents, routines, skills }: el roster, las rutinas y las skills de fábrica (las del Cerebro de PanaClaw y las de skills/)
//   semilla/biblioteca/indice.json   la Biblioteca de habilidades (biblioteca/): ficha de cada una, sin su texto
//   semilla/biblioteca/<id>/cuerpo.md y referencias/*   el texto y lo detallado, que el Worker pide cuando hace falta
//
// LO QUE NO VIAJA (nunca): brain-panaclaw/Agents Office/* salvo agents.json, routines.json y skills/ (el .gitignore lo dice y tests/contenido-privacidad.test.mjs lo vigila): entregas de los agentes,
// correcciones, piezas de Contenido, la galería del Estudio, cifras y todo lo que pueda traer datos de clientes. Tampoco evals.json (pedidos de prueba de 370 KB que solo usa una herramienta local).
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DESTINO = join(RAIZ, 'cloudflare', 'public', 'semilla');
export const TOPE_ARCHIVO = 1_200_000; // un archivo de la semilla se carga entero en el Worker: pasarse de aquí pide partirlo
export const VERSION_SEMILLA = 1;

const importar = (raiz, ...p) => import(pathToFileURL(join(raiz, ...p)).href);
const leerJSON = (f, def) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return def; } };

/**
 * Arma la semilla EN MEMORIA. `vault`: la carpeta del Cerebro de fábrica (brain-panaclaw/). `conBiblioteca`: false si solo hacen falta las notas y el equipo (la oficina local lee biblioteca/ directo del repositorio).
 * → { notas, grafo, equipo, biblioteca: { indice, archivos: [{ ruta, texto }] } | null, manifest }
 */
export async function construirSemilla({ raiz = RAIZ, vault = join(raiz, 'brain-panaclaw'), conBiblioteca = true, ahora = Date.now() } = {}) {
  const { readVault, layoutGraph } = await importar(raiz, 'graph-build.mjs');
  const { loadSkills } = await importar(raiz, 'skills.mjs');
  const { skillAFila } = await importar(raiz, 'scripts', 'migrar', 'agentes.mjs');
  const roster = leerJSON(join(raiz, 'office.agents.json'), { agents: [] }).agents || [];

  const { notes } = readVault(vault);
  const notas = [...notes].map(([nombre, n]) => ({ nombre, grupo: n.group, oficina: 0, texto: n.text, tarea: null })).sort((a, b) => a.grupo.localeCompare(b.grupo) || a.nombre.localeCompare(b.nombre));
  const grafo = await layoutGraph(vault, { office: false });

  const dirOficina = join(vault, 'Agents Office');
  const agents = leerJSON(join(dirOficina, 'agents.json'), { agents: [] });
  const routines = leerJSON(join(dirOficina, 'routines.json'), { routines: [] });
  const skills = loadSkills(vault, roster).skills.map(skillAFila);
  const equipo = { agents, routines, skills };

  let biblioteca = null;
  if (conBiblioteca) {
    const { cargarBiblioteca } = await importar(raiz, 'biblioteca.mjs');
    const { DEPT_KEYS } = await importar(raiz, 'src', 'data.js');
    const b = cargarBiblioteca({ raiz, brainPath: null, agentes: roster, deptos: DEPT_KEYS });
    const archivos = [], indice = [];
    for (const h of b.todas) {
      indice.push({ id: h.id, titulo: h.titulo, description: h.description, area: h.area, departments: h.departments, agents: h.agents, origen: h.origen, palabras: h.palabras, coleccion: h.coleccion, fuente: 'oficina', referencias: h.referencias, chars: h.cuerpo.length, evals: false });
      archivos.push({ ruta: `${h.id}/cuerpo.md`, texto: h.cuerpo });
      for (const r of h.referencias) archivos.push({ ruta: `${h.id}/referencias/${r.archivo}`, texto: readFileSync(join(h.dir, 'referencias', r.archivo), 'utf8') });
    }
    const lic = join(raiz, 'biblioteca', 'marketing', 'LICENCIA-marketingskills.txt'); // la licencia MIT viaja con las copias
    if (existsSync(lic)) archivos.push({ ruta: 'LICENCIA-marketingskills.txt', texto: readFileSync(lic, 'utf8') });
    biblioteca = { indice: { version: VERSION_SEMILLA, habilidades: indice }, archivos, problemas: b.problemas };
  }

  const huella = createHash('sha256');
  for (const n of notas) huella.update(n.nombre + '\0' + n.texto + '\0');
  huella.update(JSON.stringify(equipo));
  if (biblioteca) { huella.update(JSON.stringify(biblioteca.indice)); for (const a of biblioteca.archivos) huella.update(a.ruta + '\0' + a.texto + '\0'); }
  let commit = process.env.GITHUB_SHA || ''; if (!commit) { try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: raiz, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { commit = ''; } }
  const manifest = {
    version: VERSION_SEMILLA, nombre: 'PanaClaw', generado: new Date(ahora).toISOString(), commit: commit.slice(0, 40), huella: huella.digest('hex'),
    notas: notas.length, grupos: [...new Set(notas.map((n) => n.grupo))],
    agentes: (agents.agents || []).length, rutinas: (routines.routines || []).length, skills: skills.length,
    habilidades: biblioteca ? biblioteca.indice.habilidades.length : 0, referencias: biblioteca ? biblioteca.archivos.filter((a) => a.ruta.includes('/referencias/')).length : 0,
  };
  return { notas, grafo, equipo, biblioteca, manifest };
}

/** Escribe la semilla en `destino` (la borra antes: siempre sale de cero). → el manifiesto, con los tamaños */
export async function escribirSemilla(semilla, destino = DESTINO) {
  rmSync(destino, { recursive: true, force: true });
  mkdirSync(destino, { recursive: true });
  const poner = (ruta, texto) => { const f = join(destino, ruta); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, texto); return Buffer.byteLength(texto); };
  const bytes = {};
  bytes.notas = poner('notas.json', JSON.stringify(semilla.notas));
  bytes.grafo = poner('grafo.json', JSON.stringify(semilla.grafo));
  bytes.equipo = poner('equipo.json', JSON.stringify(semilla.equipo));
  for (const [k, v] of Object.entries(bytes)) if (v > TOPE_ARCHIVO) throw new Error(`La semilla «${k}» pesa ${v} bytes (tope ${TOPE_ARCHIVO}): hay que partirla antes de desplegar.`);
  if (semilla.biblioteca) {
    bytes.indice = poner('biblioteca/indice.json', JSON.stringify(semilla.biblioteca.indice));
    let total = 0;
    for (const a of semilla.biblioteca.archivos) { const n = poner('biblioteca/' + a.ruta, a.texto); total += n; if (n > 30_000_000) throw new Error(`«${a.ruta}» pesa demasiado para un activo.`); }
    bytes.biblioteca = total;
  }
  const manifest = { ...semilla.manifest, bytes };
  poner('manifest.json', JSON.stringify(manifest, null, 1));
  return manifest;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const destino = process.argv[2] ? resolve(process.argv[2]) : DESTINO;
  const s = await construirSemilla();
  const m = await escribirSemilla(s, destino);
  if (s.biblioteca?.problemas?.length) console.warn(`Biblioteca: ${s.biblioteca.problemas.length} aviso(s) (npm run check los lista).`);
  console.log(`Semilla «PanaClaw por defecto»: ${m.notas} notas, ${m.agentes} agentes, ${m.rutinas} rutinas, ${m.skills} skills, ${m.habilidades} habilidades (${m.referencias} referencias) · ${(Object.values(m.bytes).reduce((a, b) => a + b, 0) / 1024).toFixed(0)} KB → ${destino}`);
}
