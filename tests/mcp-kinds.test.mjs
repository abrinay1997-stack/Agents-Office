// Auditoría MCP (1 oct 2026, MCP-01/02/07/08): what the guard thinks each REAL tool does. The fixture is the init event of a
// `claude -p` on the owner's machine (153 MCP tools: Gmail, Calendar, Drive and Shopify plugins, Cloudflare, Telegram…).
// Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as S from '../safety.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INIT = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', 'mcp', 'init.json'), 'utf8'));
const MCP_TOOLS = INIT.tools.filter(t => t.startsWith('mcp__'));
const P = 'mcp__plugin_small-business_';

test('the fixture is the real thing', () => {
  assert.ok(MCP_TOOLS.length > 140, 'fixture lost its tools');
});

test('MCP-01: every tool that changes something outside is a send, and passes no draft', () => {
  const sends = [`${P}shopify__graphql_mutation`, 'mcp__claude_ai_Cloudflare_Developer_Platform__d1_database_query', `${P}google-calendar__respond_to_event`, `${P}google-drive__copy_file`,
    'mcp__claude_ai_Claude_Docs__batch', 'mcp__plugin_telegram_telegram__react', 'mcp__plugin_telegram_telegram__reply', `${P}gmail__untrash_message`, `${P}gmail__unlabel_thread`, `${P}gmail__unmark_message_spam`,
    `${P}gmail__apply_sensitive_message_label`, `${P}shopify__switch-shop`, `${P}shopify__set-inventory`, `${P}shopify__run-analytics-query`, `${P}shopify__publish-digital-product`,
    'mcp__plugin_abracadabrax-song-maker_abracadabrax-song-maker__generate_song', 'mcp__x__send_draft', 'mcp__x__publish_draft', 'mcp__x__schedule_draft', 'mcp__db__execute_sql', 'mcp__supabase__query'];
  for (const n of sends) {
    assert.ok(MCP_TOOLS.includes(n) || !n.startsWith(P), `${n} is not in the fixture`);
    assert.equal(S.kindOf(n), 'write', n);
    const d = S.decide(n, { sql: 'DROP TABLE clientes' }, { writes: false });
    assert.equal(d.allow, false, n); assert.equal(d.code, 'no-writes', n);
  }
});

test('MCP-01: the reads still read (a desk in a draft can work)', () => {
  for (const n of [`${P}gmail__search_threads`, `${P}gmail__get_thread`, `${P}gmail__create_draft`, `${P}gmail__list_drafts`, `${P}google-calendar__list_events`, `${P}google-calendar__suggest_time`,
    `${P}google-drive__read_file_content`, `${P}google-drive__download_file_content`, `${P}shopify__list-orders`, `${P}shopify__get-order`, `${P}shopify__graphql_query`, `${P}shopify__graphql_schema`,
    'mcp__claude_ai_Claude_Docs__read', 'mcp__claude_ai_Claude_Docs__guide', 'mcp__claude_ai_Cloudflare_Developer_Platform__workers_list', 'mcp__plugin_bio-research_consensus__search', 'mcp__cal__get_schedule', 'mcp__x__summary']) {
    assert.equal(S.kindOf(n), 'read', n);
  }
});

test('MCP-01: a name the office does not understand counts as a send (fail closed); the owner can say otherwise', () => {
  const odd = `${P}shopify__test-digital-products-connection`;
  assert.equal(S.kindOf(odd), 'write');
  assert.equal(S.kindOf('mcp__x__frobnicate'), 'write');
  const tk = { '*test-digital-products-connection': 'read' };
  assert.equal(S.kindOf(odd, undefined, tk), 'read');
  assert.equal(S.decide(odd, {}, { writes: false, safety: { toolKinds: tk } }).allow, true);
  assert.equal(S.decide(odd, {}, { writes: false, safety: { toolKinds: { [odd]: 'nonsense' } } }).allow, false); // an unknown kind is ignored
  assert.equal(S.problems({ toolKinds: { x: 'nonsense' } }).length, 1);
});

test('MCP-01: the whole fixture — no tool whose name changes something is a read', () => {
  const changers = /(mutation|delete|create|update|edit|reply|react|respond|copy|batch|trash|label|mark|set|switch|publish|upload|import|install|generate|add)/;
  const reads = MCP_TOOLS.filter(t => S.kindOf(t) === 'read');
  for (const t of reads) assert.ok(!changers.test(S.splitTool(t).tool) || /draft|get_|list_|search|find|schema/.test(S.splitTool(t).tool), `read but looks like a change: ${t}`);
  assert.ok(reads.length > 60 && reads.length < MCP_TOOLS.length - 50, `reads: ${reads.length}`);
});

test('MCP-02: Chrome — browser_batch is checked item by item, shortcuts_execute and gif_creator act', () => {
  const B = 'mcp__claude-in-chrome__browser_batch';
  const bank = { actions: [{ name: 'navigate', input: { url: 'https://www.bank.com' } }, { name: 'computer', input: { action: 'type', text: 'x' } }] };
  const d = S.decide(B, bank, { writes: true, safety: { browserBlock: ['*.bank.com'] } });
  assert.equal(d.allow, false); assert.equal(d.code, 'site'); assert.match(d.why, /lote del navegador/);
  const type = S.decide(B, { actions: [{ name: 'navigate', input: { url: 'https://ok.com' } }, { name: 'computer', input: { action: 'type', text: 'hola' } }] }, { writes: false });
  assert.equal(type.allow, false); assert.equal(type.code, 'no-writes');
  const look = S.decide(B, { actions: [{ name: 'navigate', input: { url: 'https://ok.com' } }, { name: 'computer', input: { action: 'screenshot' } }, { name: 'get_page_text', input: {} }] }, { writes: false });
  assert.equal(look.allow, true); assert.equal(look.kind, 'read');
  assert.equal(S.decide(B, {}, { writes: false }).allow, false); // an empty or odd batch is a send
  for (const t of ['shortcuts_execute', 'gif_creator']) assert.equal(S.decide(`mcp__claude-in-chrome__${t}`, {}, { writes: false }).allow, false, t);
  assert.equal(S.decide('mcp__claude-in-chrome__tabs_create_mcp', { url: 'https://www.bank.com' }, { writes: true, safety: { browserBlock: ['bank.com'] } }).code, 'site');
});

test('MCP-07: a server this desk was not given is refused, whatever the owner\'s own settings allow', () => {
  const ctx = { writes: true, servers: [`plugin_small-business_gmail`, 'estudio'] };
  assert.equal(S.decide('mcp__plugin_telegram_telegram__reply', { text: 'x' }, ctx).code, 'server');
  assert.equal(S.decide(`${P}shopify__list-orders`, {}, ctx).code, 'server'); // even a read
  assert.equal(S.decide(`${P}gmail__search_threads`, {}, ctx).allow, true);
  assert.equal(S.decide('WebSearch', {}, ctx).allow, true);
});

test('MCP-08: the Estudio spends money — allowed before the OK, never with «nunca»', () => {
  for (const t of ['generar_imagen', 'generar_video', 'generar_voz', 'generar_musica', 'analizar_video', 'transcribir_audio']) {
    assert.equal(S.kindOf(`mcp__estudio__${t}`), 'cost', t);
    assert.equal(S.decide(`mcp__estudio__${t}`, {}, { writes: false, policy: 'aprobar' }).allow, true, t);
    assert.equal(S.decide(`mcp__estudio__${t}`, {}, { writes: false, policy: 'nunca' }).code, 'cost', t);
  }
  for (const t of ['buscar_en_galeria', 'estado_trabajo', 'estado_estudio']) assert.equal(S.kindOf(`mcp__estudio__${t}`), 'read', t);
});
