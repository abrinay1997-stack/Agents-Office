// 27 oct 2026 — los agentes de la nube LEEN Anuncios de Meta (caso real: «Vigilar gasto mensual de Meta» le tocó a Líder Operaciones, que contestó «no tengo ningún conector de Meta Ads»
// porque Anuncios no se le ofrecía a ningún agente en la nube). Las mismas herramientas que en local (anuncios-tools.mjs): leer la cuenta, las campañas y sus cifras, y DEJAR borradores y
// sugerencias EN LA OFICINA. Ninguna crea en Meta, activa, pausa, cambia presupuestos, borra ni gasta, y la ruta le da 403 a quien llega como agente.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR } from './d1-memoria.mjs';
import { oficina, tarea, tareaEnDisco, crearFetch, texto, usar, minutos } from './agentes-ayudas.mjs';
import { herramientasInternas, OMITIDAS, DEPTS_ANUNCIOS } from '../worker/lib/agentes/herramientas.js';
import * as TAREAS from '../worker/modulos/tareas.js';
import * as CONTENIDO from '../worker/modulos/contenido.js';
import * as ESTUDIO from '../worker/modulos/estudio.js';
import * as ANUNCIOS from '../worker/modulos/anuncios.js';

const GRANDE = { AGENTES_MAX_CONSULTAS: '5000', AGENTES_MAX_LLAMADAS: '500' };
const MODULOS = [TAREAS, CONTENIDO, ESTUDIO, ANUNCIOS];
const PROHIBIDAS = /activar|gastar|pagar|publicar|aprobar|borrar|crear_en_meta|en_meta|pausar|presupuesto|reanudar|duplicar|relanzar|archivar|subir|bajar|enviar|delete|activate|budget|spend|publish|approve/i;
const resultadosDe = (cuerpo) => cuerpo.messages.filter((m) => m.role === 'user' && Array.isArray(m.content)).flatMap((m) => m.content).filter((b) => b.type === 'tool_result');

test('HERRAMIENTAS: Marketing recibe las de Anuncios (leer, borradores, sugerencias) y ninguna suena a activar, pausar, gastar o crear en Meta; los demás departamentos, no, y se les dice a quién pedirlo', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({ conector: false });
  const pedir = (id, dept, extra = {}) => herramientasInternas({ env, db: d1, agente: { id, department: dept }, tarea: 'abc12345', modulos: MODULOS, ...extra });
  const m = pedir('ada', 'marketing'), o = pedir('olead', 'ops');
  const an = m.defs.filter((d) => d.servidor === 'anuncios');
  assert.deepEqual(an.map((d) => d.nombre.split('__')[2]).sort(), ['crear_borrador_campana', 'mejorar_borrador_campana', 'sugerir_mejora_anuncio', 'ver_anuncio', 'ver_borradores_campana', 'ver_campanas', 'ver_cuenta_anuncios', 'ver_informe_anuncios', 'ver_resultados_anuncios', 'ver_sugerencias_anuncios']);
  for (const d of an) { const n = d.nombre.split('__')[2]; assert.ok(/^(ver_|crear_borrador_|mejorar_borrador_|sugerir_)/.test(n) && !PROHIBIDAS.test(n), n); assert.equal(d.esquema.type, 'object'); }
  assert.ok(!m.omitidas.includes(OMITIDAS.anuncios), 'a Marketing no se le dice que falta');
  assert.ok(!o.defs.some((d) => d.servidor === 'anuncios'), 'Operaciones no las recibe');
  assert.ok(o.omitidas.includes(OMITIDAS.anuncios)); assert.match(OMITIDAS.anuncios, /Marketing/); assert.match(OMITIDAS.anuncios, /no hay un «conector de Meta»/);
  assert.deepEqual(DEPTS_ANUNCIOS, ['marketing']);
  // el ajuste de la oficina (anuncios.departments) manda, como en local
  assert.ok(pedir('olead', 'ops', { deptsAnuncios: ['marketing', 'ops'] }).defs.some((d) => d.servidor === 'anuncios'));
});

test('UNA TAREA de Marketing lee la cuenta de Meta por la ruta de verdad (sin «esa ruta todavía no está en la nube») y termina', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({ env: GRANDE, conector: false });
  const t = await tarea(env, { dept: 'marketing', agent: 'ada', title: 'Cómo va el gasto de Meta', text: 'Mira cuánto llevamos gastado este mes en Meta.', needsOk: false });
  const f = crearFetch({ guion: [usar(['mcp__anuncios__ver_cuenta_anuncios', {}], ['mcp__anuncios__ver_campanas', { estado: 'activas' }]), texto('Meta todavía no está conectada: no tengo cifras.\nFuentes: —')] });
  await minutos(env, f.fetchFn);
  const d = await tareaEnDisco(d1, t.id);
  assert.equal(d.state, 'done'); assert.notEqual(d.error, true, d.result);
  assert.ok(f.registro.anthropic[0].cuerpo.tools.some((h) => h.name === 'mcp__anuncios__ver_cuenta_anuncios'), 'la herramienta se ofreció');
  const res = resultadosDe(f.registro.anthropic[1].cuerpo); assert.equal(res.length, 2);
  for (const r of res) assert.doesNotMatch(String(r.content), /todavía no está en la nube|desconocida|prohibid/i, String(r.content));
  assert.equal(f.registro.otros.length, 0, 'sin Meta configurada no se llamó a Meta (ni a nadie): se dijo en palabras');
});

test('UNA TAREA de Operaciones que pide cifras de Meta no ve herramientas de Anuncios y el aviso del sistema le dice que lo pase a Marketing', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({ env: GRANDE, conector: false });
  const t = await tarea(env, { dept: 'ops', agent: 'olead', title: 'Vigilar gasto mensual de Meta', needsOk: false });
  const f = crearFetch({ guion: [texto('No tengo cifras de Meta: es de Marketing.\nFuentes: —')] });
  await minutos(env, f.fetchFn);
  assert.equal((await tareaEnDisco(d1, t.id)).state, 'done');
  assert.ok(!f.registro.anthropic[0].cuerpo.tools.some((h) => /anuncios/.test(h.name)));
  assert.match(f.registro.anthropic[0].cuerpo.system, /NOTE ABOUT YOUR TOOLS: Anuncios de Meta: las herramientas .* son del departamento de Marketing/, 'el agente lo sabe');
  // una tarea de Operaciones que NO habla de Meta no lleva la nota (no se gastan letras)
  const f2 = crearFetch({ guion: [texto('Hecho.\nFuentes: —')] });
  await tarea(env, { dept: 'ops', agent: 'olead', title: 'Revisar los contratos', needsOk: false }); await minutos(env, f2.fetchFn);
  assert.doesNotMatch(f2.registro.anthropic[0].cuerpo.system, /NOTE ABOUT YOUR TOOLS/);
});

test('SEGURIDAD: un agente deja una sugerencia pero no la aplica, ni crea en Meta, ni toca presupuestos (403 de la ruta, aunque la herramienta no exista)', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({ conector: false });
  const h = herramientasInternas({ env, db: d1, agente: { id: 'ada', department: 'marketing' }, tarea: 'abc12345', modulos: MODULOS });
  await assert.rejects(h.llamar('mcp__anuncios__activar_campana', {}), /desconocida/);
  await assert.rejects(h.llamar('mcp__anuncios__pausar_anuncio', { id: 'A1' }), /desconocida/);
  // dejar una sugerencia pasa el permiso (rol editor): si falla, es por el contenido (no hay anuncios que sugerir), no por un 403 «es del dueño»
  const r = await h.llamar('mcp__anuncios__sugerir_mejora_anuncio', { id: 'A1', regla: 'cortar', tipo: 'revisar', dato: 'x', porque: 'y' }).then((x) => x, (e) => e.message);
  assert.doesNotMatch(String(r), /es del dueño/, String(r));
  // y por la ruta, un editor no aplica, ni descarta, ni sincroniza, ni crea en Meta
  const office = (await import('../worker/lib/agentes/herramientas.js')).crearOffice({ env, db: d1, usuario: { id: 'agente:ada', email: 'agente:ada', rol: 'editor', agente: 'ada' }, modulos: MODULOS });
  for (const ruta of ['/api/anuncios/sugerencias/x/aplicar', '/api/anuncios/sugerencias/x/descartar', '/api/anuncios/accion', '/api/anuncios/sincronizar', '/api/anuncios/borradores/b1/crear']) await assert.rejects(office(ruta, { por: 'agente' }, 'POST'), /es del dueño/, ruta);
});
