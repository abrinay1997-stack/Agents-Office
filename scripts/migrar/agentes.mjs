// Exportador de los agentes para la nube (fase 4): lee de ESTA computadora lo que hace que un agente trabaje como tú quieres y lo devuelve en la forma que sube
// scripts/migrar-a-nube.mjs:  { filas: { coleccion: [{ id, valor, orden? }] }, docs: { clave: valor } }
//   · skills (las de la oficina y las de tu Cerebro; gana la del Cerebro) → colección `skills`
//   · lecciones (feedback/<agente>.md) → doc `feedback.<id>` { rules, oneOffs }
//   · ejemplos que guardaste («⭐ Guardar como ejemplo») → doc `ejemplos.<id>`
//   · las cifras de la empresa → doc `cifras`
//   · las sinapsis que aprenden (data/memory.json) → doc `memoria`
//   · las correcciones que le hiciste al enrutador (data/routing.json) → doc `enrutador.correcciones`
// Solo LEE. Nunca lleva una key, un token ni una contraseña. NO sube el historial de costos (data/costs.jsonl): en la nube el libro empieza vacío.
// Las lecciones y los ejemplos pueden traer datos de clientes: viajan a TU Cloudflare por una ruta con sesión, nunca por GitHub.
import fs from 'node:fs';
import path from 'node:path';
import { loadSkills } from '../../skills.mjs';
import { loadRoster } from '../../roster.mjs';
import * as learn from '../../learn.mjs';

const leerJSON = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) ?? def; } catch { return def; } };
const lista = d => { try { return fs.readdirSync(d); } catch { return []; } };

export async function exportar({ raiz, vault }) {
  const data = process.env.AO_DATA || path.join(raiz, 'data');
  const brain = path.join(vault, 'Agents Office');
  const filas = {}, docs = {};
  let agentes = []; try { agentes = loadRoster().agents; } catch { /* sin roster: solo se exporta lo que no depende de él */ }

  const sk = loadSkills(vault, agentes).skills.map((s, i) => ({ id: s.name, orden: i, valor: { name: s.name, description: s.description, agents: s.agents, departments: s.departments, everyone: s.everyone, text: s.text, files: s.files.map(f => ({ name: f.name, text: f.text })), source: s.source } }));
  if (sk.length) filas.skills = sk;

  for (const a of agentes) {
    const l = learn.read(vault, a.id);
    if (l.rules.length || l.oneOffs.length) docs['feedback.' + a.id] = { rules: l.rules, oneOffs: l.oneOffs };
    const dir = path.join(brain, 'ejemplos', a.id);
    const items = lista(dir).filter(f => f.endsWith('.md')).sort().slice(-8).map(f => {
      const crudo = fs.readFileSync(path.join(dir, f), 'utf8'), cab = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(crudo);
      const tarea = /(?:^|\n)tarea:\s*(\S+)/.exec(cab?.[1] || '')?.[1] || f, title = /(?:^|\n)título:\s*(.+)/.exec(cab?.[1] || '')?.[1]?.trim() || f.replace(/\.md$/, '');
      return { tarea, title: title.slice(0, 120), text: crudo.replace(/^---[\s\S]*?---\s*/, '').slice(0, 12000), at: fs.statSync(path.join(dir, f)).mtimeMs };
    });
    if (items.length) docs['ejemplos.' + a.id] = { items };
  }

  const cifras = leerJSON(path.join(brain, 'cifras.json'), null); if (cifras && Array.isArray(cifras.items) && cifras.items.length) docs.cifras = { items: cifras.items };
  const mem = leerJSON(path.join(data, 'memory.json'), null); if (mem && mem.notes) docs.memoria = mem;
  const rut = leerJSON(path.join(data, 'routing.json'), []); if (Array.isArray(rut) && rut.length) docs['enrutador.correcciones'] = { lista: rut.slice(-300) };
  return { filas, docs };
}
