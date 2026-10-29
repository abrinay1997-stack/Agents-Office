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
  assert.match(vuelta2, /Bloqueado: un argumento lleva una direcci/);
  assert.doesNotMatch(vuelta2.match(/"tool_result"[^}]*\}/)?.[0] ?? '', /evil\.example/, 'el motivo no repite la dirección');
  const fila = m.d1._db.prepare("select decision, codigo, motivo from auditoria_agentes where codigo = 'url-ajena'").get();
  assert.equal(fila?.decision, 'block', 'queda en la auditoría'); assert.doesNotMatch(String(fila.motivo), /evil|CLAVE/);
  assert.ok(!m.f.registro.otros.length && !m.f.registro.mcp.some((x) => JSON.stringify(x.cuerpo).includes('evil.example')));
});

test('chat: una consulta normal sigue funcionando', { skip: SALTAR }, async () => {
  const hs = { search_threads: { salida: 'tres hilos', esquema: ESQ_Q } };
  const m = await mundo([usar(['mcp__gmail__search_threads', { query: 'facturas de octubre' }]), texto('Hay tres hilos.')], hs);
  const r = await m.p.admin('POST', '/api/chat', { agent: 'elead', text: 'Busca facturas', history: [] });
  assert.equal(r.status, 200, JSON.stringify(r.j)); assert.equal(hs.search_threads.llamadas, 1);
});

// El destino se decide sobre el texto CRUDO: lo que se ve como el host del conector pero no lo es (o lo es solo tras normalizar) no pasa.
for (const [nombre, arg] of [
  ['o cirílicas en el host', { query: 'https://gооd.com/?d=SECRETO' }],
  ['barra de ancho completo antes de @', { query: 'https://gmail.mcp.example.com／@evil.example/' }],
  ['@ en la autoridad', { query: 'https://gmail.mcp.example.com@evil.example/x' }],
  ['barra invertida', { query: 'https://gmail.mcp.example.com\\@evil.example/' }],
  ['«//» sin esquema', { query: '//evil.example/c?d=SECRETO' }],
  ['IPv6 literal', { query: 'http://[2001:db8::1]:8080/x?d=SECRETO' }],
  ['control antes del esquema', { query: 'x\u0001https://evil.example/' }],
  ['host que solo parece el del conector', { query: 'https://gmail.mcp.example.com.evil.example/' }],
]) {
  test('chat: dirección ajena camuflada — ' + nombre, { skip: SALTAR }, async () => {
    const hs = { search_threads: { salida: 'ok', esquema: ESQ_Q } };
    const m = await mundo([usar(['mcp__gmail__search_threads', arg]), texto('No pude.')], hs);
    const r = await m.p.admin('POST', '/api/chat', { agent: 'elead', text: 'Busca algo', history: [] });
    assert.equal(r.status, 200, JSON.stringify(r.j));
    assert.ok(!hs.search_threads.llamadas, 'la herramienta no se llamó');
  });
}

test('chat: texto normal con puntos y una dirección del propio conector NO se bloquean', { skip: SALTAR }, async () => {
  const hs = { search_threads: { salida: 'ok', esquema: ESQ_Q } };
  const m = await mundo([usar(['mcp__gmail__search_threads', { query: 'Hola.Cómo estás, revisa index.php y clientes.Revisar' }]), usar(['mcp__gmail__search_threads', { query: 'ver https://gmail.mcp.example.com/a' }]), texto('Listo.')], hs);
  const r = await m.p.admin('POST', '/api/chat', { agent: 'elead', text: 'Busca algo', history: [] });
  assert.equal(r.status, 200, JSON.stringify(r.j)); assert.equal(hs.search_threads.llamadas, 2);
});

test('chat: una herramienta con parámetro ambiguo (source) y sin formato uri SÍ se ofrece; con formato uri no, y el aviso dice cuál parámetro y por qué', { skip: SALTAR }, async () => {
  const hs = { search_threads: { salida: 'ok', esquema: { type: 'object', properties: { source: { type: 'string' } } } }, fetch_page: { salida: 'p', esquema: { type: 'object', properties: { target: { type: 'string', format: 'uri' } } } } };
  const m = await mundo([texto('Listo.')], hs);
  const r = await m.p.admin('POST', '/api/chat', { agent: 'elead', text: 'Busca algo', history: [] });
  const ofrecidas = (m.f.registro.anthropic[0].cuerpo.tools || []).map((t) => t.name).join(' ');
  assert.match(ofrecidas, /search_threads/); assert.doesNotMatch(ofrecidas, /fetch_page/);
  assert.match(r.j.reply, /«target»: formato uri/);
});
