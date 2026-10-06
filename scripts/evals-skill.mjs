// Herramienta (no entra en `npm run check`): EVALUAR UNA SKILL de los agentes (plan M5, 6 oct 2026; la idea es de metricool-cli, evals.json).
// Para cada pedido de evals/<skill>/evals.json, Claude responde dos veces —con la skill y sin ella— y un juez dice qué expectativas
// se cumplen, con su evidencia. Así se sabe si una skill mejora o empeora ANTES de subirla (auditoría DIM-20).
//   node scripts/evals-skill.mjs plan-contenido            → valida el archivo y dice qué haría (no gasta)
//   node scripts/evals-skill.mjs plan-contenido --correr   → lo corre con el Claude Code de esta máquina (gasta: 4 llamadas por pedido)
// Resultados en data/evals/<skill>/<fecha>/: cada respuesta, cada veredicto y resumen.json (con skill · sin skill · diferencia).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** Lo que debe tener un evals.json; devuelve los problemas en palabras (vacío = bien). */
export function validarEvals(e) {
  const mal = [];
  if (!e || typeof e !== 'object') return ['no es un objeto JSON'];
  if (!/^[a-z0-9-]+$/.test(e.skill || '')) mal.push('falta «skill» (el nombre de la carpeta de la skill)');
  if (!Array.isArray(e.evals) || !e.evals.length) mal.push('«evals» tiene que ser una lista con al menos un pedido');
  const ids = new Set();
  for (const [i, x] of (e.evals || []).entries()) {
    const n = `pedido ${i + 1}`;
    if (!/^[a-z0-9-]+$/.test(x.id || '')) mal.push(`${n}: falta un «id» corto en minúsculas`);
    else if (ids.has(x.id)) mal.push(`${n}: el id «${x.id}» está repetido`); else ids.add(x.id);
    if (typeof x.prompt !== 'string' || x.prompt.trim().length < 10) mal.push(`${n}: el «prompt» es el pedido del dueño, en una frase o más`);
    if (!Array.isArray(x.expectations) || x.expectations.length < 2 || x.expectations.some(t => typeof t !== 'string' || t.length < 8)) mal.push(`${n}: hacen falta al menos dos «expectations», cada una una frase que se pueda comprobar`);
  }
  return mal;
}

/** El veredicto del juez: { cumple: [bool…], evidencia: [texto…] } sacado de su JSON (tolera texto alrededor). */
export function leerVeredicto(texto, n) {
  const m = /\{[\s\S]*\}/.exec(String(texto || '')); if (!m) return null;
  try { const j = JSON.parse(m[0]); if (!Array.isArray(j.cumple) || j.cumple.length !== n) return null; return { cumple: j.cumple.map(Boolean), evidencia: (j.evidencia || []).map(String) }; } catch { return null; }
}

function claude(prompt, sistema = '') {
  const bin = process.env.CLAUDE_BIN || 'claude';
  const r = spawnSync(bin, ['-p', prompt, '--output-format', 'text', ...(sistema ? ['--append-system-prompt', sistema] : [])], { encoding: 'utf8', timeout: 300000, maxBuffer: 8 << 20 });
  if (r.error || r.status !== 0) throw new Error(`Claude Code no respondió (${r.error?.message || r.stderr?.slice(0, 200) || r.status}). ¿Está instalado y con la sesión iniciada?`);
  return r.stdout.trim();
}

async function main() {
  const skill = process.argv[2], correr = process.argv.includes('--correr');
  if (!skill) { console.log('Uso: node scripts/evals-skill.mjs <skill> [--correr]'); process.exit(1); }
  const archivo = path.join(ROOT, 'evals', skill, 'evals.json');
  if (!fs.existsSync(archivo)) { console.log(`✗ No hay ${path.relative(ROOT, archivo)}.`); process.exit(1); }
  const e = JSON.parse(fs.readFileSync(archivo, 'utf8')), mal = validarEvals(e);
  if (mal.length) { for (const m of mal) console.log('✗ ' + m); process.exit(1); }
  const skillMd = [path.join(ROOT, 'skills', skill, 'SKILL.md')].find(f => fs.existsSync(f));
  console.log(`✓ ${e.evals.length} pedidos, ${e.evals.reduce((n, x) => n + x.expectations.length, 0)} expectativas${skillMd ? '' : ' · ✗ no encuentro skills/' + skill + '/SKILL.md'}`);
  if (!correr) { console.log('Sin --correr no se gasta nada. Con --correr: 4 llamadas a Claude por pedido (con la skill, sin ella y el juez dos veces).'); return; }
  const texto = fs.readFileSync(skillMd, 'utf8').replace(/^---[\s\S]*?---\n/, '');
  const out = path.join(ROOT, 'data', 'evals', skill, new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')); fs.mkdirSync(out, { recursive: true });
  const base = 'Eres un agente de Marketing de una oficina de agentes. Respondes al dueño en español. No tienes herramientas en esta prueba: escribe lo que harías y lo que dejarías como borrador.';
  const resumen = [];
  for (const x of e.evals) {
    const con = claude(x.prompt, `${base}\n\nSigue esta skill:\n${texto}`), sin = claude(x.prompt, base);
    const juez = r => leerVeredicto(claude(`Eres un juez estricto. Para cada expectativa, di si la respuesta la cumple (true/false) y cita la frase que lo prueba (o «no aparece»). Contesta SOLO con JSON: {"cumple":[…],"evidencia":[…]}.\n\nEXPECTATIVAS:\n${x.expectations.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nRESPUESTA:\n${r}`), x.expectations.length);
    const vc = juez(con), vs = juez(sin);
    fs.writeFileSync(path.join(out, `${x.id}.md`), `# ${x.id}\n\n> ${x.prompt}\n\n## Con la skill\n${con}\n\n## Sin la skill\n${sin}\n\n## Veredicto\n${JSON.stringify({ con: vc, sin: vs }, null, 1)}\n`);
    const n = v => (v ? v.cumple.filter(Boolean).length : null);
    resumen.push({ id: x.id, total: x.expectations.length, con: n(vc), sin: n(vs) });
    console.log(`${x.id}: con la skill ${n(vc) ?? '?'} / ${x.expectations.length} · sin ella ${n(vs) ?? '?'}`);
  }
  const t = k => resumen.reduce((a, r) => a + (r[k] ?? 0), 0), tot = resumen.reduce((a, r) => a + r.total, 0);
  fs.writeFileSync(path.join(out, 'resumen.json'), JSON.stringify({ skill, fecha: new Date().toISOString(), pedidos: resumen, con: t('con'), sin: t('sin'), total: tot }, null, 1));
  console.log(`\nCon la skill: ${t('con')} de ${tot} · sin ella: ${t('sin')} de ${tot}. Detalle en ${path.relative(ROOT, out)}`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.log('✗ ' + e.message); process.exit(1); });
