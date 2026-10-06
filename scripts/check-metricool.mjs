// Agents Office — la prueba de una key REAL de Metricool (plan M0, 6 oct 2026). No publica nada: crea un BORRADOR a 30 días, lo lee, lo
// cambia y lo borra. Se corre a mano, nunca en CI.
//   node scripts/check-metricool.mjs              → marcas, mejor hora, subir una imagen, normalizar, borrador (crear · listar · cambiar · borrar)
//   node scripts/check-metricool.mjs --bandeja    → también lee la bandeja (conversaciones, comentarios, reseñas), sin responder
//   node scripts/check-metricool.mjs --analiticas → también lee las publicaciones de 30 días de cada red
// La key viene del entorno (setx METRICOOL_USER_TOKEN "…", setx METRICOOL_USER_ID "…" y, si tienes varias marcas, METRICOOL_BLOG_ID) y
// nunca se imprime. Lo que confirma va a data/salida-metricool/ (data/ no viaja por GitHub): con eso se quitan los «por verificar» de
// contenido/metricool.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import * as MC from '../contenido/metricool.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(process.env.AO_DATA ? path.resolve(process.env.AO_DATA) : path.join(ROOT, 'data'), 'salida-metricool');
const want = new Set(process.argv.slice(2));
const ok = s => console.log('  ✓ ' + s);
let failed = 0; const fail = (s, e) => { failed++; console.error('  ✗ ' + s + ' — ' + (e?.message || e)); };
const guardar = (nombre, datos) => fs.writeFileSync(path.join(OUT, nombre), JSON.stringify(datos, null, 1));

const mc = MC.crearMetricool();
if (!mc.configurado()) { console.error('Faltan METRICOOL_USER_TOKEN y METRICOOL_USER_ID en el entorno (Metricool → Ajustes de la cuenta → API). Ponlas con setx y abre otra terminal.'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
console.log(`Key detectada. Probando Metricool${process.env.METRICOOL_API_BASE ? ' en ' + process.env.METRICOOL_API_BASE : ''}… (salida: ${path.relative(ROOT, OUT)})\n`);

let marca = null;
try {
  const ms = await mc.marcas({ fresco: true }); guardar('marcas.json', ms);
  marca = await mc.marca();
  ok(`Marcas: ${ms.map(m => `${m.nombre} (${m.id}${m.zona ? ', ' + m.zona : ''})`).join(' · ') || 'ninguna'} → se usa «${marca?.nombre || '—'}»`);
} catch (e) { fail('Marcas (¿la cuenta tiene el plan Advanced?)', e); }

const zona = marca?.zona || MC.zonaDeEstaMaquina();
const hoy = new Date(), en7 = new Date(Date.now() + 7 * 864e5), d = x => x.toISOString().slice(0, 10);
try { const h = await mc.mejoresHoras('instagram', d(hoy), d(en7), zona); guardar('mejor-hora-instagram.json', h); ok(`Mejor hora (Instagram): ${h.length} franjas${h.length ? `, la mejor ${['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][h.sort((a, b) => b.valor - a.valor)[0].dia]} a las ${h[0].hora}:00` : ' (sin datos o en otra forma: mira el JSON)'}`); }
catch (e) { fail('Mejor hora', e); }

let url = '';
try {
  const jpg = await sharp({ create: { width: 1080, height: 1350, channels: 3, background: '#C43E00' } }).jpeg({ quality: 80 }).toBuffer();
  url = await mc.subirArchivo({ datos: jpg, nombre: 'prueba-agents-office.jpg', tipo: 'image/jpeg' }); ok(`Subir una imagen → ${url.split('?')[0]}`);
} catch (e) { fail('Subir una imagen (forma de la transacción por verificar)', e); }
try { const n = await mc.normalizar('https://upload.wikimedia.org/wikipedia/commons/3/3f/Placeholder_view_vector.svg'); ok(`Normalizar una imagen de fuera → ${String(n).slice(0, 80)}`); }
catch (e) { fail('Normalizar', e); }

try {
  const momento = Date.now() + 30 * 864e5;
  const cuerpo = MC.cuerpoPost({ redes: marca?.redes?.length ? marca.redes.slice(0, 2) : ['instagram'], texto: 'Prueba de Agents Office: este borrador se borra solo.', medios: url ? [url] : [], momento, zona, formato: 'post' }, { borrador: true });
  const r = await mc.programar(cuerpo); guardar('borrador-creado.json', r); ok(`Borrador creado (id ${r.id}, uuid ${r.uuid || '—'}) para ${cuerpo.publicationDate.dateTime} ${cuerpo.publicationDate.timezone}`);
  const e = await mc.estado(r.id, momento, zona); guardar('borrador-leido.json', e); e ? ok(`Leído: ${e.redes.map(x => `${x.red} ${x.estado}`).join(', ')}`) : fail('Leer el borrador', 'no aparece en la lista de ese día');
  await mc.cambiar(r.id, r.uuid, { ...cuerpo, text: 'Prueba de Agents Office (cambiada).' }); ok('Cambiado (PUT)');
  await mc.borrar(r.id); ok('Borrado (DELETE)');
} catch (e) { fail('Borrador: crear · leer · cambiar · borrar', e); }

if (want.has('--bandeja')) for (const t of ['conversaciones', 'comentarios', 'resenas']) {
  try { const l = await mc.bandeja(t); guardar(`bandeja-${t}.json`, l.slice(0, 5)); ok(`Bandeja · ${t}: ${l.length}`); } catch (e) { fail(`Bandeja · ${t}`, e); }
}
if (want.has('--analiticas')) for (const red of marca?.redes?.length ? marca.redes : ['instagram', 'facebook']) {
  try { const l = await mc.analiticas(red, d(new Date(Date.now() - 30 * 864e5)), d(hoy), { zona }); guardar(`analiticas-${red}.json`, l.slice(0, 5)); ok(`Analíticas · ${red}: ${l.length} publicaciones`); } catch (e) { fail(`Analíticas · ${red}`, e); }
}

console.log(failed ? `\n${failed} cosa(s) fallaron: mira el detalle arriba y los JSON en ${path.relative(ROOT, OUT)}.` : '\nTodo bien. La oficina puede programar con Metricool.');
process.exitCode = failed ? 1 : 0;
