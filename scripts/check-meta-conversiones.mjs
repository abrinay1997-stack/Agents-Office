// Agents Office — la prueba de la API DE CONVERSIONES con el token REAL de Meta (Fase A6, 10 oct 2026). Se corre a mano, nunca en CI
// (los tests usan tests/meta-stand.mjs).
//   node scripts/check-meta-conversiones.mjs            → NO manda nada: dice qué se mandaría (el conjunto de datos, la versión, los
//                                                         permisos del token) y arma un evento de ejemplo sin datos de nadie.
//   node scripts/check-meta-conversiones.mjs --probar   → manda UN SOLO evento («Lead», sin correo ni teléfono, solo un id de prueba
//                                                         cifrado) CON el código de prueba (test_event_code): sale en el Administrador
//                                                         de eventos → «Probar eventos» y Meta no lo cuenta como conversión real.
//                                                         Sin código de prueba, no manda nada.
// El conjunto de datos: office.config.local.json → anuncios.pixel (Ajustes → Anuncios) o META_PIXEL=…; el código: anuncios.conversionesPrueba
// o META_TEST_EVENT_CODE=…. El token viene del entorno (META_ACCESS_TOKEN) y nunca se imprime. Lo que contestó Meta va a
// data/salida-meta/conversiones.json (data/ no viaja): con eso se quitan los «POR VERIFICAR» de anuncios/conversiones.mjs (la forma de
// la respuesta: events_received, messages, fbtrace_id).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearMeta, mensajeMeta, VERSION_GRAPH } from '../contenido/meta.mjs';
import { armarEvento } from '../anuncios/conversiones.mjs';
import { loadConfig } from '../config.mjs';

const PROBAR = process.argv.includes('--probar');
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA = process.env.AO_DATA ? path.resolve(process.env.AO_DATA) : path.join(ROOT, 'data');
const OUT = path.join(DATA, 'salida-meta');
const ok = s => console.log('  ✓ ' + s), aviso = s => console.log('  ! ' + s);

const meta = crearMeta({ dir: path.join(DATA, 'contenido') });
if (!meta.configurado()) { console.error('Falta META_ACCESS_TOKEN en el entorno (Business Manager → Usuarios del sistema → Generar token).'); process.exit(1); }
const aj = loadConfig().anuncios || {};
const dataset = String(process.env.META_PIXEL || aj.pixel || '').trim();
const codigo = String(process.env.META_TEST_EVENT_CODE || aj.conversionesPrueba || '').trim();
if (!/^\d{5,25}$/.test(dataset)) { console.error('Falta el píxel o conjunto de datos: ponlo en Ajustes → Anuncios o en META_PIXEL=… para esta prueba.'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

console.log(`API de conversiones — conjunto de datos ${dataset}, Graph ${VERSION_GRAPH}${PROBAR ? ', mandando UN evento de prueba' : ' (sin mandar nada)'}`);
console.log(`  La API en la oficina está ${aj.conversiones === true ? 'ENCENDIDA' : 'apagada'} (Ajustes → Anuncios).`);
const { evento } = armarEvento({ nombre: 'Lead', via: 'sistema', externoId: 'agents-office-check', origen: 'check', ref: String(Date.now()) });
ok(`Evento de ejemplo: ${evento.event_name}, action_source ${evento.action_source}, event_time ${evento.event_time} (segundos), event_id ${evento.event_id}, solo external_id cifrado.`);

if (!PROBAR) { aviso('No mandé nada. Con --probar (y el código de «Probar eventos») manda este único evento.'); process.exit(0); }
if (!/^[A-Za-z0-9_-]{3,40}$/.test(codigo)) { console.error('Sin código de prueba no mando nada: ponlo en Ajustes → Anuncios («Código de prueba de eventos») o en META_TEST_EVENT_CODE=TEST…'); process.exit(1); }
try {
  const token = await meta.tokenDe(null);
  const r = await meta.enviar(token, `/${dataset}/events`, { campos: { data: [evento], test_event_code: codigo } });
  const salida = { at: new Date().toJSON(), dataset, version: VERSION_GRAPH, campos: Object.keys(r || {}), events_received: r?.events_received ?? null, messages: r?.messages ?? null, fbtrace_id: r?.fbtrace_id ? 'sí' : 'no' };
  fs.writeFileSync(path.join(OUT, 'conversiones.json'), JSON.stringify(salida, null, 1));
  ok(`Meta contestó con: ${salida.campos.join(', ') || '(nada)'} — events_received = ${salida.events_received}.`);
  ok('Míralo en el Administrador de eventos → tu conjunto de datos → «Probar eventos» (tarda uno o dos minutos).');
  console.log(`  Guardado en ${path.relative(ROOT, path.join(OUT, 'conversiones.json'))}.`);
} catch (e) { console.error('  ✗ Meta no aceptó el evento de prueba — ' + mensajeMeta(e)); process.exit(1); }
