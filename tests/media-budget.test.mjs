// V4.5 — the Estudio's caps from Ajustes → Estudio (media.mjs): a count a day (0 = no cap) and a spend limit in US$ a day and
// a month. Every refusal happens before anything is sent, so these tests spend nothing and need no network. Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as md from '../media.mjs';

process.env.FAL_KEY = process.env.FAL_KEY || 'test-key'; // turns the fal engine «on»; every paid request below is refused before it leaves
const PAID = 'nano-banana-fal'; // ~US$0.039 an image
const box = () => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-budget-')); return { dir, data: path.join(dir, 'data') }; };
const day = () => { const x = new Date(); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };

test('0 means no daily count cap, and the page is told so (left: null)', () => {
  const { dir, data } = box();
  try {
    md.configure({ media: { dailyLimit: 0 } }, dir, data);
    const b = md.budget(); assert.equal(b.left, null); assert.equal(b.limit, 0); assert.equal(b.costLeftDay, null); assert.equal(b.costLeftMonth, null);
    md.configure({ media: { dailyLimit: 5 } }, dir, data);
    assert.equal(md.budget().left, 5);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a request that would pass the day\'s spend limit is refused in plain words, before it is sent', () => {
  const { dir, data } = box();
  try {
    md.configure({ media: { dailyLimit: 0, dailyBudget: 0.1 } }, dir, data);
    assert.throws(() => md.submit({ model: PAID, prompt: 'una taza', n: 4 }), /presupuesto del día del Estudio: esto cuesta aprox\. US\$0\.16 y quedan US\$0\.10 de US\$0\.10 \(cámbialo en Ajustes → Estudio\)/);
    assert.equal(md.jobs().length, 0, 'nothing was queued');
    assert.equal(md.budget().costLeftDay, 0.1);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the month\'s limit counts what was spent on earlier days of the month', () => {
  const { dir, data } = box();
  try {
    fs.mkdirSync(data, { recursive: true });
    fs.writeFileSync(path.join(data, 'media-usage.json'), JSON.stringify({ day: day().slice(0, 7) + '-00', images: 30, videos: 0, cost: 1.5, month: day().slice(0, 7), monthCost: 9.98 })); // an earlier day, same month
    md.configure({ media: { monthlyBudget: 10 } }, dir, data);
    const b = md.budget(); assert.equal(b.images, 0, 'a new day starts its own count'); assert.equal(b.monthCost, 9.98); assert.equal(b.costLeftMonth, 0.02);
    assert.throws(() => md.submit({ model: PAID, prompt: 'una taza' }), /presupuesto del mes del Estudio/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a usage file from before V4.5 (no month) starts the month with that day\'s spend', () => {
  const { dir, data } = box();
  try {
    fs.mkdirSync(data, { recursive: true });
    fs.writeFileSync(path.join(data, 'media-usage.json'), JSON.stringify({ day: day(), images: 3, videos: 1, cost: 2.5 }));
    md.configure({ media: {} }, dir, data);
    const b = md.budget(); assert.equal(b.used, 8); assert.equal(b.monthCost, 2.5); assert.equal(b.left, 32);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('Ajustes → Estudio applies at once (setLimits), and the free test engine never counts', async () => {
  const { dir, data } = box();
  try {
    md.configure({ media: { dailyLimit: 1 } }, dir, data);
    md.setLimits({ dailyLimit: 0, dailyBudget: 0.01, monthlyBudget: 0.01 });
    const b = md.budget(); assert.equal(b.left, null); assert.equal(b.dailyBudget, 0.01);
    const out = await md.generate({ prompt: 'prueba sin gasto', n: 2, provider: 'prueba' });
    assert.equal(out.items.length, 2); assert.equal(out.budget.cost, 0);
    assert.throws(() => md.submit({ model: PAID, prompt: 'una taza' }), /presupuesto del día/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
