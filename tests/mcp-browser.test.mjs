// The Chrome tile follows tools.browser even when `claude mcp list` cannot answer (a machine without the Claude CLI,
// like GitHub's runner, left the bar without it). Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.CLAUDE_BIN = 'no-such-claude-binary-for-this-test'; // before the import: mcp.mjs reads it once
const mcp = await import('../mcp.mjs');

test('without the Claude CLI, the Chrome tile is still in the bar, wired to every department', async () => {
  mcp.configure({ tools: { browser: true } });
  const list = await mcp.discover({ timeout: 5000 });
  const c = list.find(s => s.id === mcp.BROWSER);
  assert.ok(c, 'no Chrome tile');
  assert.equal(c.key, 'chrome');
  assert.equal(c.depts.length, 6);
});

test('with tools.browser off, there is no Chrome tile', async () => {
  mcp.configure({ tools: { browser: false } });
  const list = await mcp.discover({ timeout: 5000 });
  assert.equal(list.find(s => s.id === mcp.BROWSER), undefined);
});
