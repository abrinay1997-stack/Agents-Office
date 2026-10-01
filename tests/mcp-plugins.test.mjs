// Auditoría MCP (1 oct 2026, MCP-03/04/05/06/07/09/12/14): the connectors as the owner's machine really lists them.
// The fixture is `claude mcp list` from that machine (129 servers, most of them plugins). Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-mcp-'));
// a plugin folder like ~/.claude/plugins, and a ~/.claude.json, so runConfig() never reads the real ones
const PLUG = path.join(TMP, 'plugins', 'synced', 'a', 'b');
fs.mkdirSync(path.join(PLUG, '.claude-plugin'), { recursive: true });
fs.writeFileSync(path.join(PLUG, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'small-business' }));
fs.writeFileSync(path.join(PLUG, '.mcp.json'), JSON.stringify({ mcpServers: { gmail: { type: 'http', url: 'https://gmailmcp.googleapis.com/mcp/v1' }, 'google-calendar': { type: 'http', url: 'https://calendarmcp.googleapis.com/mcp/v1' }, 'google-drive': { type: 'http', url: 'https://drivemcp.googleapis.com/mcp/v1' }, shopify: { type: 'http', url: 'https://setup.shopify.com/mcp', headers: { Authorization: 'Bearer ${SHOPIFY_TOKEN}' } } } }));
process.env.AO_PLUGINS_DIR = path.join(TMP, 'plugins');
process.env.AO_CLAUDE_JSON = path.join(TMP, 'claude.json'); fs.writeFileSync(process.env.AO_CLAUDE_JSON, JSON.stringify({ mcpServers: {} }));
process.env.CLAUDE_BIN = 'no-such-claude-binary-for-this-test'; // before the import: mcp.mjs reads it once
const mcp = await import('../mcp.mjs');

const LIST = fs.readFileSync(path.join(HERE, 'fixtures', 'mcp', 'mcp-list.txt'), 'utf8');
const INIT = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', 'mcp', 'init.json'), 'utf8'));
const emails = { id: 'elead', department: 'emails', tools: [] };
// the office's list = the fixture, as a discovery would leave it
function load(cfg = {}) {
  mcp.configure({ tools: { browser: false }, ...cfg });
  const file = path.join(TMP, `cache-${Math.random()}.json`);
  fs.writeFileSync(file, JSON.stringify({ at: 1, servers: mcp.parseList(LIST).map(s => ({ raw: s.raw, name: s.name, target: s.target, status: s.status, detail: s.detail })) }));
  return file;
}
const first = load(); mcp.useCache(first);

test('MCP-04: «Not configured» is its own state, and the reason of a failure is kept (without keys)', () => {
  const l = mcp.parseList(LIST), c = {};
  for (const s of l) c[s.status] = (c[s.status] || 0) + 1;
  assert.deepEqual(c, { connected: 17, 'needs-auth': 74, failed: 10, 'not-configured': 28 });
  assert.match(l.find(s => s.raw === 'plugin:github:github').detail, /HTTP 400/);
  assert.equal(mcp.parseList('x: https://a.com/mcp (HTTP) - ✘ Failed to connect — HTTP 401: Bearer abcdefghijklmnopqrstuvwx rejected')[0].detail.includes('abcdefghijklmnop'), false);
  const h = mcp.health();
  assert.equal(h.failed.length, 10); assert.equal(h.total, 101); // the 28 empty slots are not in the light
});

test('MCP-03: a plugin server is named and wired by its own name; an unknown one reaches no desk', () => {
  const gmail = mcp.list().find(s => s.raw === 'plugin:small-business:gmail');
  assert.equal(gmail.name, 'Gmail'); assert.equal(gmail.key, 'gmail'); assert.equal(gmail.plugin, 'small-business');
  assert.equal(mcp.list().find(s => s.raw === 'plugin:small-business:google-calendar').name, 'Google Calendar');
  assert.deepEqual(mcp.list().find(s => s.raw === 'plugin:bio-research:pubmed').depts, []);
  const got = mcp.allowedTools(emails);
  assert.ok(got.includes('mcp__plugin_small-business_gmail') && got.includes('mcp__plugin_small-business_google-calendar'), got.join());
  for (const no of ['telegram', 'shopify', 'pubmed', 'Cloudflare', 'abracadabrax', 'magic']) assert.ok(!got.some(t => t.includes(no)), `emails got ${no}: ${got}`);
  assert.equal(got.filter(t => t.startsWith('mcp__')).length, 2);
});

test('MCP-03/12: deny, allow and departments take the name the owner sees, at once', () => {
  mcp.configure({ tools: { browser: false }, mcp: { deny: ['Gmail'] } });
  assert.ok(!mcp.allowedTools(emails).includes('mcp__plugin_small-business_gmail'));
  mcp.configure({ tools: { browser: false }, mcp: { departments: { Pubmed: ['emails'], 'plugin:small-business:shopify': ['emails'] } } });
  const got = mcp.allowedTools(emails);
  assert.ok(got.includes('mcp__plugin_bio-research_pubmed') && got.includes('mcp__plugin_small-business_shopify'), got.join());
  mcp.configure({ tools: { browser: false }, mcp: { allow: ['Google Calendar'] } });
  assert.deepEqual(mcp.allowedTools(emails).filter(t => t.startsWith('mcp__')), ['mcp__plugin_small-business_google-calendar']);
  mcp.configure({ tools: { browser: false } });
});

test('MCP-07: the owner\'s own Telegram plugin is denied by default; only the owner naming it brings it back', () => {
  const tg = () => mcp.summary().servers.find(s => s.raw === 'plugin:telegram:telegram');
  assert.equal(tg().denied, true); assert.equal(tg().defaultDenied, true);
  mcp.configure({ tools: { browser: false }, mcp: { departments: { Telegram: ['emails'] } } }); // wiring it to a desk is the owner saying so
  assert.equal(tg().denied, false);
  assert.ok(mcp.allowedTools(emails).includes('mcp__plugin_telegram_telegram'));
  mcp.configure({ tools: { browser: false } });
});

test('MCP-04/07: a run\'s init — disabled is not connected; a server never listed waits for the next check', () => {
  mcp.fromInit({ mcp_servers: [{ name: 'flowly', status: 'disabled' }, { name: 'nuevo-servidor', status: 'connected' }, { name: 'estudio', status: 'connected' }], tools: ['mcp__nuevo-servidor__get_x'] });
  const f = mcp.list().find(s => s.id === 'flowly'), n = mcp.list().find(s => s.id === 'nuevo-servidor');
  assert.equal(f.status, 'disabled'); assert.equal(n.fresh, true);
  assert.equal(mcp.list().some(s => s.id === 'estudio'), false);
  mcp.configure({ tools: { browser: false }, mcp: { departments: { 'nuevo-servidor': ['emails'] } } });
  assert.ok(!mcp.allowedTools(emails).includes('mcp__nuevo-servidor'));
  mcp.configure({ tools: { browser: false } });
});

test('MCP-05: the long names are learnt from a run, kept in the cache, read back on start; the 64-character error is recognised', () => {
  mcp.fromInit(INIT);
  const long = INIT.tools.filter(t => t.length > 64);
  assert.ok(long.length >= 10);
  for (const t of long) assert.ok(mcp.disallowedTools(emails).includes(t) || mcp.disallowedTools(emails).some(x => t.startsWith(x + '__')), t);
  assert.deepEqual(JSON.parse(fs.readFileSync(first, 'utf8')).long.sort(), mcp.longToolNames().sort());
  const name = 'mcp__plugin_x_y__' + 'a'.repeat(60);
  assert.equal(mcp.learnLongToolError(`API Error: 400 tools.3.custom.name: String should have at most 64 characters (${name})`), true);
  assert.ok(mcp.longToolNames().includes(name));
  assert.equal(mcp.learnLongToolError('Claude took longer than 300 s'), false);
});

test('MCP-05: a fresh start reads the long names from the cache before any run', async () => {
  const again = await import('../mcp.mjs?second');
  again.useCache(first);
  assert.ok(again.longToolNames().length >= 10);
  again.configure({ tools: { browser: false } }); // and each server's tools: a draft right after a restart already loses the send tools
  assert.ok(again.writeTools(emails).includes('mcp__plugin_small-business_gmail__trash_message'));
  assert.ok(!again.writeTools(emails).includes('mcp__plugin_small-business_gmail__create_draft'));
});

test('MCP-06: a desk whose servers can be rebuilt starts only them; anything else keeps the full load', () => {
  mcp.configure({ tools: { browser: false } });
  const iso = mcp.runConfig(emails);
  assert.deepEqual(Object.keys(iso).sort(), ['plugin_small-business_gmail', 'plugin_small-business_google-calendar']);
  assert.equal(iso['plugin_small-business_gmail'].url, 'https://gmailmcp.googleapis.com/mcp/v1');
  assert.equal(mcp.needsClaudeAi(emails), false);
  const sales = { id: 'lexi', department: 'sales', tools: [] }; // Shopify's config carries ${SHOPIFY_TOKEN}: the office cannot rebuild it
  assert.equal(mcp.runConfig(sales), null);
  mcp.configure({ tools: { browser: false }, mcp: { departments: { 'Cloudflare Developer Platform': ['emails'] } } });
  assert.equal(mcp.runConfig(emails), null); assert.equal(mcp.needsClaudeAi(emails), true); // a claude.ai connector cannot go in --mcp-config
  mcp.configure({ tools: { browser: false }, mcp: { isolate: false } });
  assert.equal(mcp.runConfig(emails), null);
  mcp.configure({ tools: { browser: false } });
  // an isolated run that could not reach Gmail: Gmail goes back to the full load, and is not marked down
  mcp.fromInit({ mcp_servers: [{ name: 'plugin_small-business_gmail', status: 'needs-auth' }], tools: [] }, { isolated: true });
  const g = mcp.list().find(s => s.id === 'plugin_small-business_gmail');
  assert.equal(g.status, 'connected'); assert.equal(g.noIsolate, true); assert.equal(mcp.runConfig(emails), null);
});

test('MCP-09: one `claude mcp list` at a time; the summary says when it is running', async () => {
  const a = mcp.discover({ timeout: 3000 }), b = mcp.discover({ timeout: 3000 });
  assert.equal(a, b);
  assert.equal(mcp.summary().discovering, true);
  await a;
  assert.equal(mcp.summary().discovering, false);
});

test('MCP-14: the page never sees a local path or a key in a target', () => {
  const s = mcp.summary().servers;
  assert.equal(s.find(x => x.raw === 'plugin:telegram:telegram').target, 'local');
  assert.equal(s.find(x => x.raw === 'plugin:small-business:gmail').target, 'gmailmcp.googleapis.com');
  assert.ok(!JSON.stringify(s).includes('C:/Users'));
  assert.equal(mcp.publicTarget('https://mcp.zapier.com/api/mcp/s/ABCDEFGHIJKLMNOPQRSTUVWXYZ123456/sse'), 'mcp.zapier.com');
  const k = s.find(x => x.raw === 'plugin:small-business:gmail').kinds; // each tool's kind, for the panel
  assert.ok(!k || typeof k === 'object');
});

test('revisión MCP: el reintento por un nombre largo solo corre si ninguna herramienta corrió y se aprendió un nombre nuevo', () => {
  const msg = n => `API Error: 400 tools.3.custom.name: String should have at most 64 characters (${n})`;
  const before = mcp.longToolNames().length;
  const fresh = 'mcp__plugin_retry_z__' + 'b'.repeat(60);
  const e1 = new Error(msg(fresh)); e1.used = ['mcp__gmail__send_email'];
  assert.equal(mcp.retryLong(e1, before), false, 'ya usó herramientas: un reintento podría enviar dos veces');
  const before2 = mcp.longToolNames().length; // the name was learnt anyway
  const e2 = new Error(msg(fresh)); e2.used = [];
  assert.equal(mcp.retryLong(e2, before2), false, 'nada nuevo aprendido: fallaría igual y se pagaría dos veces');
  const other = 'mcp__plugin_retry_w__' + 'c'.repeat(60);
  const e3 = new Error(msg(other)); e3.used = [];
  assert.equal(mcp.retryLong(e3, mcp.longToolNames().length), true);
  assert.equal(mcp.retryLong(new Error('Claude took longer than 300 s'), 0), false);
});
