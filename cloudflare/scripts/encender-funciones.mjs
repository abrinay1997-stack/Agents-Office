#!/usr/bin/env node
// Enciende (o apaga) las funciones que se publicaron apagadas, en la base de DATOS de producción. Se lanza desde GitHub
// («Cloudflare · encender funciones»), nunca a mano con llaves en la terminal.
//
// POR QUÉ EXISTE. Cada función se publicó detrás de su interruptor, apagado. Los interruptores viven en tres documentos de D1
// y no tenían pantalla: encenderlos pedía la consola del navegador. Esto es el botón que faltaba, hasta que el panel
// «Funciones nuevas» de Ajustes lo haga desde dentro de la oficina.
//
// LO QUE HACE Y LO QUE NO:
//  · Escribe un booleano en un documento de ajustes. NADA MÁS. No gasta, no envía, no publica, no toca cuentas ni contraseñas.
//  · Lee el documento, mezcla el interruptor y lo vuelve a escribir comprobando la versión: si alguien lo cambió entre medias,
//    reintenta; nunca pisa lo que otro guardó (la misma regla que `mutarDoc` del Worker).
//  · «listas» (lo de siempre) solo enciende lo que está construido de punta a punta. Lo que no lo está hay que nombrarlo uno
//    por uno y el resumen dice por qué no estaba en el grupo.
//  · Al encender el chat deja a todas las cuentas en #general, igual que haría la oficina (sembrarGeneral).
//
// Uso:  node scripts/encender-funciones.mjs [--funciones=listas|todas|a,b] [--apagar] [--probar] [--local]
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FUNCIONES, MANEJABLES, porId, documentosDe, plan, activa, idsDe } from '../../funciones-core.mjs';

const arg = (n, d = '') => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const tiene = (n) => process.argv.includes(`--${n}`);
const remoto = !tiene('local'), apagar = tiene('apagar'), soloProbar = tiene('probar');
const BD = 'agents-office-db';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const comilla = (s) => `'${String(s).replace(/'/g, "''")}'`;

function sql(comando, { leer = false } = {}) {
  const args = ['wrangler', 'd1', 'execute', BD, remoto ? '--remote' : '--local', '--command', comando];
  if (leer) args.push('--json');
  const salida = execFileSync('npx', args, { cwd: raiz, encoding: 'utf8', stdio: leer ? ['ignore', 'pipe', 'inherit'] : 'inherit' });
  if (!leer) return null;
  const i = salida.indexOf('['), j = salida.lastIndexOf(']');
  if (i < 0 || j < i) throw new Error('no entendí la respuesta de wrangler');
  const bloques = JSON.parse(salida.slice(i, j + 1));
  const b = (Array.isArray(bloques) ? bloques : [bloques]).find((x) => x && Array.isArray(x.results));
  return { filas: b ? b.results : [], meta: b?.meta || {} };
}

const ids = idsDe(arg('funciones', 'listas'));
const pedidas = [], fuera = [];
for (const id of ids) {
  const f = porId(id);
  if (!f) { fuera.push(`«${id}» no está en la lista de funciones.`); continue; }
  if (f.panel) { fuera.push(`${f.titulo}: se cambia en ${f.panel}.`); continue; }
  // lo que no está listo solo entra si lo nombraron explícitamente (no por «listas» ni por «todas»)
  const porNombre = !['', 'listas', 'todas'].includes(arg('funciones', 'listas').trim().toLowerCase());
  if (!f.lista && !apagar && !porNombre) { fuera.push(`${f.titulo}: no se encendió. ${f.porque}`); continue; }
  pedidas.push({ id: f.id, activo: !apagar });
}
if (!pedidas.length) {
  console.log('No hay nada que cambiar.');
  for (const t of fuera) console.log(` · ${t}`);
  process.exit(0);
}

const claves = documentosDe(pedidas.map((p) => porId(p.id)));
const leido = sql(`select clave, json, version from docs where clave in (${claves.map(comilla).join(',')})`, { leer: true });
const docs = {}, version = {};
for (const fila of leido.filas) { try { docs[fila.clave] = JSON.parse(fila.json); version[fila.clave] = fila.version; } catch { /* un documento roto es uno que no está */ } } // secrets-ok: «clave» es la columna de la tabla docs

const { cambios, hechos, avisos } = plan(docs, pedidas);

const linea = (h) => `${h.a ? 'ENCENDIDA' : 'apagada'}  ${porId(h.id).titulo}${h.yaEstaba ? ' (ya estaba así)' : ''}`;
console.log(`\nLo que voy a dejar${soloProbar ? ' (solo es una prueba: no escribo nada)' : ''}:`);
for (const h of hechos) console.log(` · ${linea(h)}`);
for (const t of [...fuera, ...avisos]) console.log(` · ${t}`);
if (soloProbar || !Object.keys(cambios).length) {
  if (!Object.keys(cambios).length) console.log('\nNada que escribir: ya estaba como lo pediste.');
  process.exit(0);
}

const ahora = new Date().toISOString();
for (const [clave, valor] of Object.entries(cambios)) {
  const json = comilla(JSON.stringify(valor));
  const v = version[clave];
  const comando = v === undefined
    ? `insert into docs (clave, json, version, actualizado) values (${comilla(clave)}, ${json}, 1, ${comilla(ahora)})`
    : `update docs set json = ${json}, version = version + 1, actualizado = ${comilla(ahora)} where clave = ${comilla(clave)} and version = ${v}`;
  sql(comando);
  // comprobar que de verdad quedó escrito (si otro lo cambió a la vez, el update no toca ninguna fila)
  const ahoraEsta = sql(`select json from docs where clave = ${comilla(clave)}`, { leer: true }).filas[0];
  if (!ahoraEsta || ahoraEsta.json !== JSON.stringify(valor)) {
    console.error(`\nNo pude guardar «${clave}»: alguien lo cambió en este mismo momento. No se escribió nada a medias; vuelve a lanzarlo.`);
    process.exit(1);
  }
}

// El chat, al encenderse, deja a todas las cuentas en #general (lo mismo que hace la oficina al activarlo desde dentro).
if (hechos.some((h) => h.id === 'chat' && h.a && !h.yaEstaba)) {
  sql(`insert or ignore into chat_canales (id, tipo, nombre, clave_nombre, privado, creado_at) values ('general','general','general','general',0,${Date.now()});`
    + ` insert or ignore into chat_miembros (canal_id, user_id, rol, desde) select 'general', u.id, 'miembro', ${Date.now()} from users u left join perfiles p on p.user_id = u.id where p.baja_at is null;`);
  console.log(' · #general listo con todas las cuentas dentro.');
}

const cambiadas = hechos.filter((h) => !h.yaEstaba);
console.log(`\nListo: ${cambiadas.length === 0 ? 'no hizo falta cambiar nada' : `${cambiadas.length} ${cambiadas.length === 1 ? 'función' : 'funciones'} cambiada${cambiadas.length === 1 ? '' : 's'}`}.`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs');
  const md = ['### Funciones de la oficina', '', '| Estado | Función |', '|---|---|',
    ...hechos.map((h) => `| ${h.a ? '**encendida**' : 'apagada'}${h.yaEstaba ? ' (ya estaba)' : ''} | ${porId(h.id).titulo} |`),
    ...( [...fuera, ...avisos].length ? ['', '**Sin tocar:**', '', ...[...fuera, ...avisos].map((t) => `- ${t}`)] : []),
    '', 'Entra en la oficina y recarga la página para verlas.'].join('\n');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
}
