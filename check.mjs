// Agents Office — the build loop (Beta).
//   node check.mjs             build + offline smoke + server smoke (no Claude calls)
//   CHECK_LIVE=1 node check.mjs  … plus one real routed task and one chat turn through Claude
// Every step prints ✓ or ✗ with the reason; the process exits 1 if anything failed. This is the
// loop the Beta was built against: change something, run it, fix what is red, repeat.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig, ROOT } from './config.mjs';

const results = [];
const ok = (name, detail = '') => { results.push([true, name, detail]); console.log(`✓ ${name}${detail ? '  — ' + detail : ''}`); };
const bad = (name, detail = '') => { results.push([false, name, detail]); console.log(`✗ ${name}${detail ? '  — ' + detail : ''}`); };
const step = async (name, fn) => { try { const d = await fn(); ok(name, d || ''); return true; } catch (e) { bad(name, e.message); return false; } };
const sh = (cmd, args, opts = {}) => new Promise((resolve, reject) => {
  const p = spawn(cmd, args, { cwd: ROOT, ...opts }); let out = '', err = '';
  p.stdout?.on('data', d => { out += d; }); p.stderr?.on('data', d => { err += d; });
  p.on('close', c => c === 0 ? resolve(out) : reject(new Error((err || out).trim().split('\n').slice(-3).join(' | '))));
  p.on('error', reject);
});
const cfg = loadConfig();
const LIVE = process.env.CHECK_LIVE === '1';

/* ---------- 1. build ---------- */
await step('build: braingraph + bundle', async () => {
  const out = await sh('node', ['build.mjs']);
  const html = fs.readFileSync(path.join(ROOT, 'dist', 'command-centre-v2.html'), 'utf8');
  if (html.length < 500000) throw new Error('bundle looks too small: ' + html.length);
  if (!/AGENTS OFFICE/.test(html)) throw new Error('shell missing');
  return out.trim().split('\n').pop();
});
await step('build: graph has linked notes', async () => {
  const { BRAIN } = await import('./src/braingraph.js?' + Date.now());
  if (!BRAIN.nodes.length || !BRAIN.links.length) throw new Error('empty graph');
  if (!BRAIN.floor || BRAIN.floor.length < Math.min(90, BRAIN.nodes.length)) throw new Error('floor layout missing');
  return `${BRAIN.notes} notes · ${BRAIN.nodes.length} linked · ${BRAIN.links.length} links`;
});

/* ---------- 1b. the roster + the connector parser ---------- */
await step('roster: office.agents.json validates', async () => {
  const { loadRoster } = await import('./roster.mjs');
  const r = loadRoster();
  if (r.agents.length !== 35) throw new Error('agents: ' + r.agents.length);
  if (r.problems.length) throw new Error(r.problems.join(' | '));
  return `35 agents · ${r.customised} customised${r.files.length ? ' · ' + r.files.join(' + ') : ''}`;
});
await step('roster: bad edits are refused, not applied', async () => {
  const { validate } = await import('./roster.mjs');
  const r = validate({ agents: [{ id: 'newt', name: 'PODCAST NOTES', department: 'sales', lead: true, colour: 'red' }, { id: 'ghost', name: 'X' }] });
  const n = r.agents.find(a => a.id === 'newt');
  if (n.name !== 'PODCAST NOTES' || n.department !== 'marketing' || n.lead) throw new Error('validation let a fixed field through');
  if (r.problems.length < 4) throw new Error('expected four problems, got ' + r.problems.length);
});
await step('roster: brief is accepted and trimmed', async () => {
  const { validate } = await import('./roster.mjs');
  const r = validate({ agents: [{ id: 'piper', brief: ['Three tiers.', 'Never discount.'] }, { id: 'lexi', brief: 'x'.repeat(2500) }] });
  if (r.agents.find(a => a.id === 'piper').brief !== 'Three tiers.\nNever discount.') throw new Error('list brief not joined');
  if (r.agents.find(a => a.id === 'lexi').brief.length !== 2000 || !r.problems.some(p => /brief is over/.test(p))) throw new Error('long brief not trimmed with a warning');
});
await step('skills: shipped skills load and bind', async () => {
  const { loadSkills } = await import('./skills.mjs'); const { loadRoster } = await import('./roster.mjs');
  const r = loadRoster(); const sk = loadSkills(cfg.brainPath, r.agents);
  if (sk.problems.length) throw new Error(sk.problems.join(' | '));
  const piper = r.agents.find(a => a.id === 'piper'), cmail = r.agents.find(a => a.id === 'cmail'), lexi = r.agents.find(a => a.id === 'lexi');
  if (!sk.names(piper).includes('proposal')) throw new Error('proposal not bound to piper: ' + sk.names(piper));
  if (!sk.names(cmail).includes('client-reply') || sk.names(lexi).includes('client-reply')) throw new Error('department binding wrong');
  if (!sk.names(lexi).includes('house-style')) throw new Error('unbound skill did not reach everyone');
  const txt = sk.promptText(piper); if (!/--- template\.md ---/.test(txt) || !/### proposal/.test(txt)) throw new Error('files beside SKILL.md not inlined');
  const sum = sk.summary();
  return `${sum.count} skills (${sum.shipped} shipped, ${sum.brain} in the brain) · ` + sum.skills.map(x => `${x.name}→${x.everyone ? 'everyone' : [...x.agents, ...x.departments].join('+')}`).join(' ');
});
await step('skills: a broken skill is refused, not applied', async () => {
  const { loadSkills } = await import('./skills.mjs'); const { loadRoster } = await import('./roster.mjs');
  const os = await import('node:os'); const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-skills-')); const dir = path.join(tmp, 'Agents Office', 'skills');
  fs.mkdirSync(path.join(dir, 'ghost'), { recursive: true }); fs.mkdirSync(path.join(dir, 'nofile')); fs.mkdirSync(path.join(dir, 'proposal'));
  fs.writeFileSync(path.join(dir, 'ghost', 'SKILL.md'), '---\nagents: [nobody]\ncolour: red\n---\n# Ghost\nDo things.');
  fs.writeFileSync(path.join(dir, 'proposal', 'SKILL.md'), '---\ndescription: Our own proposal skill\nagents: [piper]\n---\n# Ours\nThe brain version.');
  fs.writeFileSync(path.join(dir, 'oneliner.md'), '---\ndepartments: [fin]\n---\nMonth-end pack rules.');
  const sk = loadSkills(tmp, loadRoster().agents); fs.rmSync(tmp, { recursive: true, force: true });
  if (sk.skills.some(x => x.name === 'ghost')) throw new Error('a skill with no valid binding was loaded');
  if (!sk.problems.some(p => /nobody/.test(p)) || !sk.problems.some(p => /colour/.test(p)) || !sk.problems.some(p => /nofile/.test(p))) throw new Error('problems not reported: ' + sk.problems.join(' | '));
  const prop = sk.skills.find(x => x.name === 'proposal'); if (!prop || prop.source !== 'brain' || prop.description !== 'Our own proposal skill') throw new Error('the brain skill did not replace the shipped one');
  if (!sk.skills.find(x => x.name === 'oneliner' && x.departments.includes('fin'))) throw new Error('one-file skill not loaded');
  return `${sk.problems.length} problems reported · brain proposal wins`;
});
await step('lessons: a correction is recorded and standing rules come back', async () => {
  const learn = await import('./learn.mjs'); const os = await import('node:os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-learn-')); const a = { id: 'piper', name: 'PROPOSALS', role: 'x', does: 'y' };
  learn.record(tmp, a, { title: 'Harbourside proposal' }, 'add the booking integration for this one', { standing: false, rule: '' });
  learn.record(tmp, a, { title: 'Harbourside proposal' }, 'too long — proposals are always one page', { standing: true, rule: 'Keep every proposal to one page.' });
  learn.record(tmp, a, { title: 'Marina quote' }, 'never quote a discount', { standing: true, rule: 'Never offer a discount.' });
  const r = learn.read(tmp, 'piper'); const txt = learn.promptText(tmp, a); fs.rmSync(tmp, { recursive: true, force: true });
  if (r.rules.length !== 2 || r.oneOffs.length !== 1) throw new Error(`rules ${r.rules.length} one-offs ${r.oneOffs.length}`);
  if (!/^LESSONS/.test(txt) || !/one page/.test(txt) || /booking integration/.test(txt) || /←/.test(txt)) throw new Error('prompt text wrong: ' + txt);
  if (learn.promptText(tmp, { id: 'nobody' })) throw new Error('no file should mean no block');
  return `${r.rules.length} standing rules · ${r.oneOffs.length} one-off · agent with no file gets nothing`;
});
await step('interview: the lead asks five questions, then writes briefs + a skill into the brain', async () => {
  const onboard = await import('./onboard.mjs'); const { loadRoster } = await import('./roster.mjs'); const { loadSkills } = await import('./skills.mjs'); const os = await import('node:os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-onboard-')); const brain = path.join(tmp, 'brain'), data = path.join(tmp, 'data'); fs.mkdirSync(brain);
  const agents = loadRoster(brain).agents; const dept = agents.filter(a => a.department === 'sales'); const lead = dept.find(a => a.lead);
  const stub = async () => JSON.stringify({ briefs: [{ id: 'lexi', brief: 'Every deal gets a next step with a date.' }, { id: 'piper', brief: 'Three options, recommend the middle.' }, { id: 'ghost', brief: 'x' }],
    skill: { name: 'Wholesale Quote', description: 'How we quote a wholesale account', agents: ['piper'], body: '# Quoting a wholesale account\nUse this for any quote to a trade customer.\n## Steps\n1. Check the account in 30-Customers.\n## The shape\nFollow template.md.\n## Rules\n- Never discount.', template: '# Quote for {account}\n## Lines\n## Terms' }, try: 'quote Harbour Hardware for 40 units' });
  const ctx = { dept: 'sales', deptName: 'Sales', lead, agents: dept, connected: ['Gmail'], brainPath: brain, dataDir: data, ask: stub, business: 'Test Co' };
  if (await onboard.handle('what are you working on?', ctx) !== null) throw new Error('ordinary chat was captured');
  if (await onboard.handle('configurar el Gmail de ventas', ctx) !== null) throw new Error('"configurar …" in ordinary chat was captured');
  const r0 = await onboard.handle('configurar', ctx); if (!/Pregunta 1 de 5/.test(r0.reply) || !onboard.active(data, 'sales')) throw new Error('did not start: ' + r0.reply.slice(0, 80));
  const r1 = await onboard.handle('We sell to trade accounts.', ctx); if (!/Pregunta 2 de 5/.test(r1.reply)) throw new Error('no second question');
  await onboard.handle('Quoting a wholesale account: check the account, price from the ladder, send.', ctx); await onboard.handle('saltar', ctx); await onboard.handle('never discount', ctx);
  const r5 = await onboard.handle('Gmail and our bookkeeper', ctx);
  if (onboard.active(data, 'sales')) throw new Error('interview still active after the last answer');
  if (!r5.wrote || r5.wrote.briefs.length !== 2 || !r5.wrote.skill || r5.wrote.skill.name !== 'wholesale-quote') throw new Error('write-up wrong: ' + JSON.stringify(r5.wrote));
  if (!r5.wrote.problems.some(p => /ghost/.test(p))) throw new Error('an agent outside the department was accepted');
  const merged = loadRoster(brain); if (merged.agents.find(a => a.id === 'piper').brief !== 'Three options, recommend the middle.' || merged.problems.length) throw new Error('brief not merged into the brain roster: ' + merged.problems);
  const sk = loadSkills(brain, merged.agents); const w = sk.skills.find(x => x.name === 'wholesale-quote');
  if (!w || w.source !== 'brain' || !w.agents.includes('piper') || !w.files.some(f => f.name === 'template.md') || sk.problems.length) throw new Error('skill not loadable: ' + sk.problems);
  if (!onboard.isSetUp(merged.agents, sk, 'sales') || onboard.isSetUp(merged.agents, sk, 'fin')) throw new Error('setUp flag wrong');
  const c = await onboard.handle('set up', ctx); await onboard.handle('cancel', ctx); if (onboard.active(data, 'sales')) throw new Error('cancel did not clear');
  await onboard.handle('entrevístame', ctx); await onboard.handle('Cancelar.', ctx); if (onboard.active(data, 'sales')) throw new Error('cancelar did not clear');
  fs.rmSync(tmp, { recursive: true, force: true });
  return `5 questions · 2 briefs merged · skill wholesale-quote→piper with template · sales set up, fin not · cancel clears`;
});
await step('connectors: claude mcp list parses', async () => {
  const m = await import('./mcp.mjs');
  const l = m.parseList('Checking MCP server health…\n\nclaude.ai Gmail: https://gmailmcp.googleapis.com/mcp/v1 - ✔ Connected\nclaude.ai Meta Ads: https://mcp.facebook.com/ads - ! Needs authentication\nplaywright: npx -y @playwright/mcp@latest - ✔ Connected');
  if (l.length !== 3) throw new Error('parsed ' + l.length);
  if (l[0].id !== 'claude_ai_Gmail' || l[0].key !== 'gmail' || l[0].status !== 'connected') throw new Error('gmail: ' + JSON.stringify(l[0]));
  if (l[1].status !== 'needs-auth' || l[1].key !== 'meta') throw new Error('meta: ' + JSON.stringify(l[1]));
  if (l[2].depts.length !== 2) throw new Error('playwright depts: ' + l[2].depts);
});

/* ---------- 1c. routines (V3.5) ---------- */
await step('routines: plain words become a schedule', async () => {
  const w = await import('./src/when.js');
  const cases = [
    ['every weekday at 8am, triage the inbox and tell me what needs me', 'cada día hábil a las 08:00', 'triage the inbox and tell me what needs me'],
    ['Every Monday 9am, list the overdue invoices and draft the reminders', 'lunes a las 09:00', 'list the overdue invoices and draft the reminders'],
    ["match today's bank lines to invoices, daily at 5:30pm", 'todos los días a las 17:30', "match today's bank lines to invoices"],
    ['every hour between 9am and 5pm on weekdays, qualify new leads', 'cada hora de 09:00 a 17:00 · días hábiles', 'qualify new leads'],
    ['chase quiet deals every tuesday and thursday at 10', 'mar, jue a las 10:00', 'chase quiet deals'],
    ['on fridays at 4pm this week\'s cash position', 'viernes a las 16:00', "this week's cash position"],
    ['every 2 minutes say hello', 'cada 2 min', 'say hello'],
    ['every weekend at noon, check the queue', 'fines de semana a las 12:00', 'check the queue'],
  ];
  for (const [text, desc, task] of cases) {
    const r = w.parseWhen(text); if (!r) throw new Error('no schedule found in: ' + text);
    if (w.describe(r.when) !== desc) throw new Error(`"${text}" → ${w.describe(r.when)}, expected ${desc}`);
    if (r.text !== task) throw new Error(`"${text}" → task "${r.text}", expected "${task}"`);
    if (!w.valid(r.when) || !(w.nextRun(r.when) > Date.now())) throw new Error('no next run for ' + desc);
  }
  if (w.parseWhen('reply to a client asking when their September report will arrive within 24 hours')) throw new Error('a plain task was read as a routine');
  const t = w.parseWhen('every weekday, triage the inbox'); if (!t || !t.needsTime) throw new Error('missing time not asked back');
  const g = w.parseWhen('every morning triage the inbox'); if (!g || g.when.at !== '08:00' || !g.guessed) throw new Error('"morning" not taken as 08:00 with a flag');
  const d = w.parseWhen('weekly at 3pm list renewals'); if (!d || !d.needsDay) throw new Error('weekly with no day not asked back');
  const now = new Date('2026-09-09T17:05:00').getTime(); // a Wednesday
  const nx = w.nextRun({ kind: 'weekly', days: [1], at: '09:00' }, now); if (new Date(nx).getDay() !== 1 || new Date(nx).getHours() !== 9) throw new Error('Monday 09:00 not next');
  if (w.untilText(now + 120000, now) !== 'en 2 min' || w.untilText(w.fromPicker('fri', '16:00') && nx, now) !== 'lun 09:00') throw new Error('countdown text');
  return `${cases.length} phrasings · asks back for a missing time or day · "morning" → 08:00 flagged`;
});
await step('routines: every department can have them (marketing too), bad ones named', async () => {
  const rt = await import('./routines.mjs'); const { loadRoster } = await import('./roster.mjs'); const agents = loadRoster().agents;
  const mk = rt.validate({ id: 'x', dept: 'marketing', agent: 'iggy', text: 'post the reel', when: { kind: 'daily', at: '09:00' } }, agents);
  if (mk.problems.length) throw new Error('a marketing routine was refused: ' + mk.problems);
  const nowhere = rt.validate({ id: 'y', dept: 'brain', agent: 'iggy', text: 'x', when: { kind: 'daily', at: '09:00' } }, agents);
  if (!nowhere.problems.length) throw new Error('a routine for no department was accepted');
  const wrong = rt.validate({ dept: 'fin', agent: 'ghost', text: 'x', when: { kind: 'weekly', days: [] } }, agents);
  if (!wrong.problems.some(p => /no agent/.test(p)) || !wrong.problems.some(p => /not complete/.test(p))) throw new Error('unknown agent / incomplete schedule not named: ' + wrong.problems);
  const cross = rt.validate({ dept: 'fin', agent: 'lexi', text: 'x', when: { kind: 'daily', at: '09:00' } }, agents);
  if (!cross.problems.some(p => /is in Sales, not Accounting/.test(p))) throw new Error('cross-department agent not named: ' + cross.problems);
  const good = rt.validate({ dept: 'emails', agent: 'elead', text: 'Triage the overnight inbox', when: { kind: 'weekdays', at: '08:00' } }, agents);
  if (good.problems.length || good.routine.id !== 'triage-the-overnight-inbox' || good.routine.needsOk !== true) throw new Error('a good routine did not validate: ' + JSON.stringify(good));
  const dup = rt.validate({ id: 'triage-the-overnight-inbox', dept: 'emails', agent: 'elead', text: 'x', when: { kind: 'daily', at: '09:00' } }, agents, [good.routine]);
  if (!dup.problems.some(p => /share this id/.test(p))) throw new Error('duplicate id not named');
  if (rt.guessNeedsOk('list the overdue invoices') || !rt.guessNeedsOk('send the reminders') || !rt.guessNeedsOk('draft replies to unanswered client emails')) throw new Error('needs-OK guess');
  return 'marketing accepted · no department refused · unknown agent, wrong department, incomplete schedule, duplicate id all named · needsOk defaults on';
});
await step('routines: due fires once, a missed run catches up marked LATE, then the clock moves on', async () => {
  const rt = await import('./routines.mjs'); const { loadRoster } = await import('./roster.mjs'); const os = await import('node:os');
  const agents = loadRoster().agents; const brain = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-routines-')); const data = path.join(brain, 'data');
  rt.save(brain, [{ id: 'a', dept: 'emails', agent: 'elead', title: 'A', text: 'triage', when: { kind: 'weekdays', at: '08:00' } }, { id: 'p', dept: 'sales', agent: 'folo', title: 'P', text: 'chase', when: { kind: 'daily', at: '10:00' }, paused: true, needsOk: false }]);
  const l = rt.load(brain, agents); if (l.problems.length || l.routines.length !== 2) throw new Error('load: ' + l.problems);
  const st = rt.loadState(data); const now = Date.now();
  const { list } = rt.withState(l.routines, st, now); if (!(st.a.nextAt > now) || list.find(r => r.id === 'p').nextAt !== null) throw new Error('nextAt not set / paused not null');
  if (rt.due(l.routines, st, now).length) throw new Error('fired before its time');
  st.a.nextAt = now - 2 * 3600 * 1000; st.p.nextAt = now - 3600 * 1000; // the office was off for two hours
  const d = rt.due(l.routines, st, now); if (d.length !== 1 || d[0].routine.id !== 'a' || !d[0].late) throw new Error('catch-up wrong: ' + JSON.stringify(d.map(x => [x.routine.id, x.late])));
  rt.advance(st, l.routines[0], now, 't1', true); rt.saveState(data, st);
  if (!(st.a.nextAt > now) || st.a.runs !== 1 || !st.a.lastLate) throw new Error('advance did not move the clock on');
  if (rt.due(l.routines, st, now).length) throw new Error('fired twice');
  const s2 = rt.loadState(data); if (s2.a.lastTaskId !== 't1') throw new Error('state not saved');
  const soon = { kind: 'minutes', every: 2 }; st.a.nextAt = now - 30 * 1000; const d2 = rt.due(l.routines, st, now); if (d2.length !== 1 || d2[0].late) throw new Error('a run 30 s past its minute is not late');
  const m = rt.matchRoutine(list, 'emails', 'the triage one'); if (!m || m.id !== 'a') throw new Error('match by words');
  fs.rmSync(brain, { recursive: true, force: true });
  return 'due once · 2 h late → one catch-up marked LATE · paused never fires · state persists · words match a routine';
});

/* ---------- 1d. models + the usage gauge (V3.6) ---------- */
await step('models: three names + five effort levels, one precedence, the right CLI flags', async () => {
  const m = await import('./src/models.js');
  if (JSON.stringify(m.MODEL_KEYS) !== '["sonnet","opus","fable"]' || m.DEFAULT_MODEL !== 'sonnet') throw new Error('keys/default');
  if (m.normModel('Opus') !== 'opus' || m.normModel('claude-sonnet-5') !== 'sonnet' || m.normModel('haiku') !== null || m.normModel('') !== null) throw new Error('normModel');
  const p = (o) => m.modelFor(o); 
  if (p({}).model !== 'sonnet' || p({}).from !== 'office') throw new Error('empty → office sonnet');
  if (p({ office: 'opus' }).model !== 'opus' || p({ agent: 'fable', office: 'opus' }).from !== 'agent' || p({ routine: 'opus', agent: 'fable' }).model !== 'opus' || p({ task: 'sonnet', routine: 'opus', agent: 'fable', office: 'opus' }).from !== 'task') throw new Error('precedence');
  if (p({ task: 'haiku', office: 'opus' }).model !== 'opus') throw new Error('an unknown task model must fall through');
  if (m.modelArgs('sonnet').join(' ') !== '--model sonnet' || m.modelArgs('opus').join(' ') !== '--model opus --effort high' || m.modelArgs('fable').join(' ') !== '--model fable' || m.modelArgs('nonsense').join(' ') !== '--model sonnet') throw new Error('args: ' + m.modelArgs('opus').join(' '));
  // V3.6.1 effort: five CLI levels, AUTO = the model's own, same precedence then the model
  if (m.normEffort('Extra high') !== 'xhigh' || m.normEffort('auto') !== null || m.normEffort('turbo') !== null || m.normEffort('MAX') !== 'max') throw new Error('normEffort');
  const e = (o) => m.effortFor(o);
  if (e({ model: 'opus' }).effort !== 'high' || e({ model: 'opus' }).from !== 'model' || e({ model: 'sonnet' }).effort !== null) throw new Error('effort falls through to the model');
  if (e({ office: 'low', model: 'opus' }).effort !== 'low' || e({ agent: 'max', office: 'low' }).from !== 'agent' || e({ routine: 'medium', agent: 'max' }).effort !== 'medium' || e({ task: 'xhigh', routine: 'medium', agent: 'max', office: 'low' }).from !== 'task') throw new Error('effort precedence');
  if (m.modelArgs('sonnet', 'max').join(' ') !== '--model sonnet --effort max' || m.modelArgs('opus', 'low').join(' ') !== '--model opus --effort low' || m.modelArgs('opus', 'nonsense').join(' ') !== '--model opus --effort high') throw new Error('effort args');
  const { validate } = await import('./roster.mjs');
  const r = validate({ agents: [{ id: 'invo', model: 'OPUS', effort: 'High' }, { id: 'lexi', model: 'haiku', effort: 'turbo' }] });
  if (r.agents.find(a => a.id === 'invo').model !== 'opus' || r.agents.find(a => a.id === 'lexi').model !== '' || !r.problems.some(x => /sonnet, opus or fable/.test(x))) throw new Error('roster model field');
  if (r.agents.find(a => a.id === 'invo').effort !== 'high' || r.agents.find(a => a.id === 'lexi').effort !== '' || !r.problems.some(x => /low, medium, high, xhigh or max/.test(x))) throw new Error('roster effort field');
  const rt = await import('./routines.mjs'); const { loadRoster } = await import('./roster.mjs');
  const v = rt.validate({ dept: 'fin', agent: 'invo', text: 'x', when: { kind: 'daily', at: '09:00' }, model: 'Fable', effort: 'xhigh' }, loadRoster().agents); if (v.problems.length || v.routine.model !== 'fable' || v.routine.effort !== 'xhigh') throw new Error('routine model/effort field');
  return 'sonnet · opus (effort high) · fable · task > routine > agent > office · roster and routines refuse anything else';
});
await step('usage: the gauge parses Claude\'s answer and the office\'s own count sits underneath', async () => {
  const u = await import('./usage.mjs');
  const sample = { five_hour: { utilization: 29, resets_at: '2026-09-09T08:20:00.322898+00:00' }, seven_day: { utilization: 39.6, resets_at: '2026-09-12T03:00:00.322921+00:00' } };
  const p = u.parseUsage(sample); if (!p || p.session.percent !== 29 || p.week.percent !== 40 || !p.session.resetsAt || new Date(p.week.resetsAt).getUTCDay() !== 6) throw new Error('parse: ' + JSON.stringify(p));
  if (u.parseUsage({ nothing: true }) !== null || u.parseUsage(null) !== null) throw new Error('unknown shape must be null');
  const now = Date.now(); let st = {};
  st = u.record(st, { input_tokens: 10, output_tokens: 40, cache_creation_input_tokens: 9000, cache_read_input_tokens: 5000 }, now);
  st = u.record(st, { input_tokens: 5, output_tokens: 5 }, now + 1000);
  const f = u.fallback(st, now + 2000); if (f.source !== 'office' || f.window.tokens !== 14060 || f.window.runs !== 2 || f.window.resetsAt !== st.startedAt + u.WINDOW) throw new Error('count: ' + JSON.stringify(f));
  const later = u.fallback(st, now + u.WINDOW + 1); if (later.window.tokens !== 0 || later.window.runs !== 0 || later.window.startedAt !== null) throw new Error('window did not reset');
  const tok = u.readToken(); // read into memory only — never printed
  return `parses percent + reset · unknown shape → null · 2 runs = 14,060 tokens · window resets after 5 h · login token on this machine: ${tok ? 'found' : 'none'}`;
});

/* ---------- 1e. Agent Teams + Claude in Chrome (V3.2 (16 Sep)) ---------- */
await step('teams: the sentence says team, the plan is checked against the seats, notes are parsed', async () => {
  const t = await import('./teams.mjs');
  for (const ok of ['as a team, write three hooks', 'get the team on this', 'spawn three teammates to plan the launch', 'split it across the desks']) if (!t.intent(ok)) throw new Error('not a team: ' + ok);
  for (const no of ['write three hooks', 'draft the team offsite email', 'reply to the client']) if (t.intent(no)) throw new Error('wrongly a team: ' + no);
  if (t.askedSize('spawn three teammates') !== 3 || t.askedSize('as a team') !== null) throw new Error('askedSize');
  const seats = [{ id: 'mlead', lead: true }, { id: 'ada' }, { id: 'newt' }, { id: 'gfx' }], lead = seats[0];
  const plan = t.parsePlan('```json\n{"pieces":[{"agent":"ada","title":"A","text":"a"},{"agent":"ada","title":"dup","text":"x"},{"agent":"ghost","title":"g","text":"x"},{"agent":"newt","title":"N","text":"n"},{"agent":"gfx","title":"G","text":"g"},{"agent":"mlead","title":"M","text":"m"}],"why":"split"}\n```', { seats, lead, max: 3 });
  if (plan.solo || plan.pieces.map(p => p.agent).join() !== 'ada,newt,gfx') throw new Error('plan: ' + JSON.stringify(plan));
  const solo = t.parsePlan('not json at all', { seats, lead, max: 3, fallback: { title: 'T', text: 'x' } });
  if (!solo.solo || solo.pieces[0].agent !== 'mlead') throw new Error('no fallback to the lead');
  const one = t.parsePlan('{"pieces":[{"agent":"ada","title":"A","text":"a"}]}', { seats, lead, max: 3, fallback: { title: 'T', text: 'x' } });
  if (!one.solo || one.pieces[0].agent !== 'ada') throw new Error('a one-piece plan should be solo on that desk');
  if (!/never one piece/.test(t.planPrompt({ business: 'x', deptName: 'y', lead: { name: 'L' }, seats: [], text: 't', max: 3 }).user)) throw new Error('the plan prompt must insist on a split');
  const m = t.parseMessages('Heading\nbody\n@newt: use the June figure\n@lead: two hooks clash\n@nobody: ignored', ['ada', 'newt', 'gfx', 'mlead']);
  if (m.messages.length !== 2 || m.messages[0].to !== 'newt' || m.messages[1].to !== 'lead' || !/@nobody/.test(m.body) || /@newt/.test(m.body)) throw new Error('messages: ' + JSON.stringify(m));
  const sec = t.teamSection({ me: { id: 'ada' }, lead, pieces: plan.pieces, nameOf: id => id.toUpperCase() });
  if (!/Your piece: A/.test(sec) || !/NEWT: N/.test(sec) || !/@lead|@newt/.test(sec)) throw new Error('team section: ' + sec.slice(0, 200));
  const st = t.settings({ teams: { max: 99 } }); if (st.max !== 6 || !st.enabled) throw new Error('settings clamp: ' + JSON.stringify(st));
  if (t.settings({ teams: { enabled: false } }).enabled) throw new Error('enabled false ignored');
  const extra = t.noteExtra({ pieces: [{ agent: 'ada', title: 'A', result: 'r' }], messages: [{ from: 'ada', to: 'lead', text: 'x' }] }, id => id.toUpperCase());
  if (!/## Team/.test(extra) || !/ADA → lead: x/.test(extra) || !/### ADA — A\nr/.test(extra)) throw new Error('note extra: ' + extra);
  return 'intent · askedSize · plan (dedupe, unknown seats, cap, one desk → solo, none → the lead) · notes · section · settings · note';
});
await step('teams: a team routine is kept and moved to the department lead', async () => {
  const { validate } = await import('./routines.mjs'); const { loadRoster } = await import('./roster.mjs');
  const agents = loadRoster().agents;
  const v = validate({ id: 'wk', dept: 'sales', agent: 'piper', title: 'x', text: 'x', when: { kind: 'weekly', days: [1], at: '09:00' }, team: true }, agents);
  if (v.problems.length) throw new Error(v.problems.join(' | '));
  if (v.routine.team !== true || v.routine.agent !== 'lexi') throw new Error('agent ' + v.routine.agent + ' team ' + v.routine.team);
  const w = validate({ id: 'wk2', dept: 'sales', agent: 'piper', title: 'x', text: 'x', when: { kind: 'weekly', days: [1], at: '09:00' } }, agents);
  if (w.routine.team !== undefined || w.routine.agent !== 'piper') throw new Error('a plain routine changed');
  return 'team:true → lexi (the Sales lead) · plain routine untouched';
});
await step('browser: tools.browser puts --chrome and the Chrome server in the agents\' hands; off means --no-chrome', async () => {
  const m = await import('./mcp.mjs');
  if (m.toolId('claude-in-chrome') !== 'claude-in-chrome' || m.toolId('claude.ai Gmail') !== 'claude_ai_Gmail') throw new Error('toolId');
  m.configure({ mcp: {}, tools: { browser: true } });
  if (m.cliArgs().join() !== '--chrome') throw new Error('cliArgs on: ' + m.cliArgs());
  m.fromInit({ mcp_servers: [{ name: 'claude-in-chrome', status: 'connected' }], tools: ['mcp__claude-in-chrome__navigate', 'mcp__claude-in-chrome__read_page'] });
  const s = m.list().find(x => x.id === 'claude-in-chrome'); if (!s || s.key !== 'chrome' || s.name !== 'Chrome' || s.status !== 'connected' || s.tools.length !== 2) throw new Error('chrome server: ' + JSON.stringify(s));
  if (!m.allowedTools().includes('mcp__claude-in-chrome')) throw new Error('not in allowedTools: ' + m.allowedTools());
  if (!/Chrome browser/.test(m.promptText([])) || !/CAPTCHA/.test(m.promptText([]))) throw new Error('prompt does not explain the browser');
  if (m.keyOf('mcp__claude-in-chrome__navigate') !== 'chrome' || m.namesOf(['mcp__claude-in-chrome__find'])[0] !== 'Chrome') throw new Error('keyOf/namesOf');
  if (m.summary().browser?.on !== true || typeof m.summary().browser.installed !== 'boolean') throw new Error('summary.browser');
  m.configure({ mcp: { deny: ['Chrome'] }, tools: { browser: true } });
  if (m.allowedTools().includes('mcp__claude-in-chrome')) throw new Error('deny did not keep Chrome out of the agents\' hands');
  m.configure({ mcp: {}, tools: { browser: false } });
  if (m.cliArgs().join() !== '--no-chrome') throw new Error('cliArgs off: ' + m.cliArgs());
  m.configure(cfg); // back to the office's own config
  const logos = fs.readFileSync(path.join(ROOT, 'src', 'mcplogos.js'), 'utf8'); if (!/\n  chrome: \{ name: 'Chrome'/.test(logos)) throw new Error('no Chrome tile in src/mcplogos.js');
  const b = m.browserState();
  return `--chrome · mcp__claude-in-chrome allowed · deny works · --no-chrome when off · tile baked · this machine: ${b.installed ? 'extension paired' + (b.device ? ' (' + b.device + ')' : '') : 'extension NOT paired'}`;
});
await step('calendar: a routine can start on a date, and projects forward day by day', async () => { // V3.2.1
  const w = await import('./src/when.js');
  const now = new Date('2026-09-16T10:00:00').getTime();
  const later = w.nextRun({ kind: 'weekdays', at: '08:00', start: '2026-09-28' }, now); if (new Date(later).toDateString() !== 'Mon Sep 28 2026') throw new Error('start ignored: ' + new Date(later));
  const earlier = w.nextRun({ kind: 'weekdays', at: '08:00', start: '2026-09-01' }, now); if (new Date(earlier).toDateString() !== 'Thu Sep 17 2026') throw new Error('a past start changed the next run: ' + new Date(earlier));
  const occ = w.occurrences({ kind: 'weekly', days: [1], at: '09:00', start: '2026-09-28' }, now, now + 30 * 864e5).map(t => new Date(t).getDate()); if (occ.join() !== '28,5,12') throw new Error('occurrences: ' + occ);
  if (!/desde el 5 Ene/.test(w.describe({ kind: 'daily', at: '08:00', start: '2099-01-05' })) || /desde/.test(w.describe({ kind: 'daily', at: '08:00', start: '2020-01-05' }))) throw new Error('describe start');
  if (w.valid({ kind: 'daily', at: '08:00', start: 'next week' })) throw new Error('a bad start date passed');
  const pk = w.fromPicker('mon', '09:30', '2026-10-05'); if (pk.start !== '2026-10-05' || pk.days[0] !== 1) throw new Error('picker start: ' + JSON.stringify(pk));
  const { validate } = await import('./routines.mjs'); const { loadRoster } = await import('./roster.mjs');
  const v = validate({ id: 'oct', dept: 'emails', agent: 'elead', title: 'x', text: 'x', when: { kind: 'weekdays', at: '08:00', start: '2026-10-05' } }, loadRoster().agents); if (v.problems.length || v.routine.when.start !== '2026-10-05') throw new Error('routine start lost: ' + v.problems.join(' | '));
  return 'start date honoured · past start ignored · 3 Mondays projected · described "from 5 Jan" · picker + routines carry start';
});
await step('config: browser and teams default on, max 4', async () => {
  const c = loadConfig(); if (c.tools.browser !== true || c.teams.enabled !== true || c.teams.max !== 4) throw new Error(JSON.stringify({ tools: c.tools, teams: c.teams }));
});

/* ---------- 2. offline smoke (Playwright) ---------- */
let chromium = null;
try { ({ chromium } = await import('playwright')); } catch { try { ({ chromium } = await import('playwright-core')); } catch {} }
if (!chromium) bad('smoke: playwright', 'not installed — npm i -D playwright-core (uses your Chrome)');
else {
  let browser = null;
  try {
    try { browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] }); }
    catch { browser = await chromium.launch({ channel: 'chrome', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] }); }
    const page = await browser.newPage({ viewport: { width: 1512, height: 900 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
    await page.goto('file://' + path.join(ROOT, 'dist', 'command-centre-v2.html') + '?s=check'); await page.waitForTimeout(3000);
    await step('smoke: loads without page errors', async () => { if (errors.length) throw new Error(errors[0]); });
    await step('smoke: 35 agents at their desks', async () => { const n = await page.evaluate(() => Object.keys(window.CC.R).length); if (n !== 35) throw new Error('agents: ' + n); return n + ' agents'; });
    await step('smoke: six department cards + the Brain and Dimitri at the centre', async () => {
      const t = await page.evaluate(() => [...document.querySelectorAll('.badge .b-name, .brainTag .bt-t')].map(e => e.textContent.trim()));
      for (const k of ['CORREOS', 'VENTAS', 'MARKETING', 'OPERACIONES', 'FINANZAS', 'ENTREGAS', 'EL CEREBRO', 'DIMITRI']) if (!t.some(x => x.startsWith(k))) throw new Error('missing card ' + k);
    });
    await step('smoke: task panel has rows and counts', async () => {
      const n = await page.evaluate(() => document.querySelectorAll('.tp-row').length); if (n < 10) throw new Error('rows: ' + n);
      const chips = await page.evaluate(() => document.querySelectorAll('.tp-chip').length); if (chips !== 6) throw new Error('chips: ' + chips);
      return n + ' rows';
    });
    await step('smoke: command bar adds a task in demo mode', async () => {
      await page.click('.tp-dd'); await page.click('.tp-menu button[data-k="marketing"]');
      await page.fill('.tp-in', 'cut a 15 second teaser from the demo reel'); await page.keyboard.press('Enter'); await page.waitForTimeout(600);
      const hint = await page.evaluate(() => document.querySelector('.tp-hint').textContent); if (!/Agregado/.test(hint)) throw new Error('hint: ' + hint);
      await page.waitForFunction(() => [...document.querySelectorAll('.tp-row .tp-t')].some(e => /teaser/i.test(e.textContent)), null, { timeout: 4000 }).catch(() => {}); // the panel draws on a later frame; headless frames are slow
      const row = await page.evaluate(() => [...document.querySelectorAll('.tp-row .tp-t')].some(e => /teaser/i.test(e.textContent))); if (!row) throw new Error('row not in the feed');
      return hint.trim().slice(0, 60);
    });
    await step('smoke: TEAM in the bar → the lead + piece cards on the desks (demo)', async () => { // V3.2 (16 Sep)
      await page.waitForTimeout(2800); // the previous step's hint timer (2.6 s) would wipe our "Added" line mid-read
      await page.click('.tp-dd'); await page.click('.tp-menu button[data-k="sales"]');
      await page.fill('.tp-in', 'as a team, plan the spring outreach push');
      await page.evaluate(() => document.querySelector('.tp-in').dispatchEvent(new Event('input', { bubbles: true })));
      const pre = await page.evaluate(() => document.querySelector('.tp-hint').textContent); if (!/Equipo · LÍDER DE VENTAS/.test(pre)) throw new Error('hint before Add: ' + pre);
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelectorAll('.tp-row.piece').length >= 2 && [...document.querySelectorAll('.tp-row .tp-t')].some(e => /⚑ As a team, plan the spring/.test(e.textContent)), null, { timeout: 5000 }).catch(() => {}); // the lead's card and its pieces land over a few frames
      const hint = await page.evaluate(() => document.querySelector('.tp-hint').textContent); if (!/Agregado — LÍDER DE VENTAS lo tiene con/.test(hint)) throw new Error('hint: ' + hint);
      const n = await page.evaluate(() => ({ lead: [...document.querySelectorAll('.tp-row .tp-t')].filter(e => /⚑ As a team, plan the spring/.test(e.textContent)).length, pieces: document.querySelectorAll('.tp-row.piece').length, chip: [...document.querySelectorAll('.tp-team-chip')].map(e => e.textContent) }));
      if (n.lead !== 1 || n.pieces < 2 || !n.chip.some(c => /^TEAM [34]$/.test(c)) || !n.chip.includes('PIECE')) throw new Error(JSON.stringify(n) + ' DEBUG ' + JSON.stringify(await page.evaluate(() => ({ rows: [...document.querySelectorAll('.tp-row .tp-t')].slice(0, 6).map(e => e.textContent), filter: document.querySelector('.tp-chip.on')?.textContent, q: document.querySelector('.tp-search')?.value, drawer: !document.getElementById('tdDrawer').hidden, tasks: window.CC.tasks.tasks.filter(t => /spring/.test(t.title)).map(t => t.title + '|' + t.state + '|' + t.dept) }))));
      await page.fill('.tp-in', 'draft the renewal email'); await page.evaluate(() => document.querySelector('.tp-in').dispatchEvent(new Event('input', { bubbles: true })));
      const plain = await page.evaluate(() => document.querySelector('.tp-hint').textContent); if (/Equipo ·/.test(plain)) throw new Error('a plain sentence still reads as a team: ' + plain);
      await page.click('.tp-team'); const on = await page.evaluate(() => document.querySelector('.tp-hint').textContent); if (!/Equipo · LÍDER DE VENTAS/.test(on)) throw new Error('the TEAM toggle did not take: ' + on);
      await page.click('.tp-team'); await page.fill('.tp-in', '');
      return `${hint.trim().slice(0, 70)} · ${n.pieces} piece cards · chips ${[...new Set(n.chip)].join(' ')}`;
    });
    await step('smoke: a routine typed in the bar lands in SCHEDULED (demo)', async () => {
      await page.click('.tp-dd'); await page.click('.tp-menu button[data-k="emails"]');
      await page.fill('.tp-in', 'every weekday at 8am, triage the inbox and tell me what needs me');
      await page.evaluate(() => document.querySelector('.tp-in').dispatchEvent(new Event('input', { bubbles: true })));
      await page.waitForFunction(() => /Rutina/.test(document.querySelector('.tp-hint').textContent), null, { timeout: 5000 }).catch(() => {});
      const pre = await page.evaluate(() => document.querySelector('.tp-hint').textContent); if (!/Rutina/.test(pre) || !/cada día hábil a las 08:00/.test(pre)) throw new Error('hint before Add: ' + pre);
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => /Rutina programada|No se pudo/.test(document.querySelector('.tp-hint').textContent), null, { timeout: 5000 }).catch(() => {});
      const hint = await page.evaluate(() => document.querySelector('.tp-hint').textContent); if (!/Rutina programada/.test(hint)) throw new Error('hint: ' + hint);
      await page.waitForTimeout(400);
      const n = await page.evaluate(() => window.CC.routines().length); if (n !== 1) throw new Error('routines: ' + n);
      const kept = await page.evaluate(() => document.querySelector('.tp-chip.on')?.dataset.f); if (kept === 'sched') throw new Error('the panel jumped to SCHEDULED on its own (audit 46)');
      await page.click('.tp-hint .tp-lnk[data-f="sched"]'); await page.waitForTimeout(300); // «Ver en PROGRAMADAS» in the hint
      const row = await page.evaluate(() => [...document.querySelectorAll('.tp-row.sched .tp-t')].some(e => /triage the inbox/i.test(e.textContent))); if (!row) throw new Error('no SCHEDULED row');
      const strip = await page.evaluate(() => { const e = document.querySelector('.tp-next'); return e.hidden ? '' : e.textContent; }); if (!/PRÓXIMA/.test(strip) || !/triage/i.test(strip)) throw new Error('next-up strip: ' + strip);
      await page.keyboard.press('b'); await page.waitForTimeout(600);
      const col = await page.evaluate(() => [...document.querySelectorAll('#board .lh')].map(e => e.textContent)); if (col[1] !== 'PROGRAMADAS') throw new Error('board columns: ' + col.join(','));
      const card = await page.evaluate(() => document.querySelectorAll('#board .tk.sched').length); if (!card) throw new Error('no SCHEDULED card on the board');
      await page.keyboard.press('Escape'); await page.waitForTimeout(400);
      await page.evaluate(() => window.CC.tasks.rtAct(window.CC.routines()[0].id, 'run')); await page.waitForTimeout(500);
      const fired = await page.evaluate(() => window.CC.tasks.tasks.some(t => t.routine && /triage the inbox/i.test(t.title))); if (!fired) throw new Error('RUN NOW did not make a task');
      await page.click('.tp-dd'); await page.click('.tp-menu button[data-k="marketing"]');
      await page.fill('.tp-in', 'every day at 9am post the reel'); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
      const mk = await page.evaluate(() => document.querySelector('.tp-hint').textContent); if (!/Rutina programada/.test(mk)) throw new Error('a marketing routine was not set: ' + mk);
      const two = await page.evaluate(() => window.CC.routines().length); if (two !== 2) throw new Error('routines: ' + two);
      const opts = await page.evaluate(() => [...document.querySelectorAll('.tp-model option')].map(o => o.value).join(',') + '|' + document.querySelector('.tp-model').value); if (opts !== 'sonnet,opus,fable|sonnet') throw new Error('model menu: ' + opts);
      const eff = await page.evaluate(() => [...document.querySelectorAll('.tp-effort option')].map(o => o.value).join(',') + '|' + document.querySelector('.tp-effort').value); if (eff !== ',low,medium,high,xhigh,max|') throw new Error('effort menu: ' + eff);
      // V3.7: the box grows with the text, and the big editor mirrors it both ways
      await page.fill('.tp-in', 'line one\nline two\nline three'); await page.evaluate(() => document.querySelector('.tp-in').dispatchEvent(new Event('input', { bubbles: true }))); await page.waitForTimeout(200);
      const grown = await page.evaluate(() => document.querySelector('.tp-in').offsetHeight); if (grown < 50) throw new Error('box did not grow: ' + grown + 'px');
      await page.click('.tp-big-btn'); await page.waitForTimeout(300);
      const bigOn = await page.evaluate(() => document.getElementById('tpBig').classList.contains('on') && document.querySelector('.tb-in').value === document.querySelector('.tp-in').value && document.querySelector('.tb-dept').textContent === 'MARKETING'); if (!bigOn) throw new Error('big editor did not open with the text');
      await page.type('.tb-in', ' and more'); await page.waitForTimeout(200);
      const back = await page.evaluate(() => document.querySelector('.tp-in').value.endsWith(' and more') && /LÍDER DE MARKETING|Va a|va a|Probablemente/.test(document.querySelector('.tb-hint').textContent)); if (!back) throw new Error('big editor did not mirror back');
      await page.keyboard.press('Escape'); await page.waitForTimeout(200);
      const bigOff = await page.evaluate(() => !document.getElementById('tpBig').classList.contains('on')); if (!bigOff) throw new Error('Esc did not close the big editor');
      await page.fill('.tp-in', ''); await page.evaluate(() => document.querySelector('.tp-in').dispatchEvent(new Event('input', { bubbles: true }))); await page.evaluate(() => document.querySelector('.tp-in').blur()); await page.click('.tp-chip[data-f="all"]'); // hand the keys back, feed back to All
      const rest = await page.evaluate(() => document.querySelector('.tp-in').offsetHeight); if (rest > 34) throw new Error('box did not shrink back: ' + rest + 'px');
      return 'hint says the schedule · SCHEDULED row + next-up strip + board column · RUN NOW fires · marketing routine set · box grows + big editor mirrors';
    });
    await step('smoke: the CALENDAR button and P open the calendar — routines on their days, a task scheduled for a date, a routine from a date (demo)', async () => { // V3.2.1
      await page.click('#topCal'); await page.waitForTimeout(500); // the top-bar button opens it…
      if (!await page.$eval('#calOv', e => e.classList.contains('on'))) throw new Error('the CALENDAR button did not open the calendar');
      await page.keyboard.press('Escape'); await page.waitForTimeout(400);
      await page.keyboard.press('p'); await page.waitForTimeout(600); // …and so does P
      if (!await page.$eval('#calOv', e => e.classList.contains('on'))) throw new Error('P did not open the calendar');
      const cells = await page.$$eval('.cv-day', e => e.length); if (cells !== 35 && cells !== 42) throw new Error('month cells: ' + cells);
      if (!await page.$('.cv-day.today')) throw new Error('no today cell');
      const rt = await page.$$eval('.cv-ev.routine', e => e.length); if (rt < 3) throw new Error('routine occurrences on the grid: ' + rt);
      const rail = await page.$eval('#cvRtN', e => +e.textContent); if (rail < 1) throw new Error('rail empty');
      // a task for a day next week (the second day after today on the grid)
      const days = await page.$$eval('.cv-day', els => els.map(e => e.dataset.day)); const ti = days.indexOf(await page.$eval('.cv-day.today', e => e.dataset.day));
      const target = days[Math.min(days.length - 1, ti + 2)];
      await page.hover(`.cv-day[data-day="${target}"]`); await page.click(`.cv-day[data-day="${target}"] .cv-add`); await page.waitForTimeout(300);
      await page.selectOption('.cv-dept', 'sales'); await page.fill('.cv-text', 'Call the three warm leads from the expo'); await page.click('.cv-go'); await page.waitForTimeout(500);
      const sched = await page.$$eval('.cv-ev.sched', e => e.map(x => x.closest('.cv-day').dataset.day)); if (sched.length !== 1 || sched[0] !== target) throw new Error('scheduled card: ' + JSON.stringify(sched));
      const panel = await page.evaluate(() => window.CC.tasks.tasks.filter(t => t.state === 'scheduled').length); if (panel !== 1) throw new Error('panel has ' + panel + ' scheduled');
      // a routine from that date: REPEAT on, emails (routines are Emails/Accounting/Sales)
      await page.hover(`.cv-day[data-day="${target}"]`); await page.click(`.cv-day[data-day="${target}"] .cv-add`); await page.waitForTimeout(300);
      await page.selectOption('.cv-dept', 'emails'); await page.fill('.cv-text', 'Send the weekly client update'); await page.click('.cv-rep'); await page.waitForTimeout(200);
      const hint = await page.$eval('.cv-hint', e => e.textContent); if (!/Rutina ·/.test(hint) || !/primera ejecución/.test(hint)) throw new Error('routine hint: ' + hint);
      await page.click('.cv-go'); await page.waitForTimeout(500);
      const r = await page.evaluate(() => window.CC.tasks.routines.find(x => /weekly client update/i.test(x.title))); if (!r || r.when.start !== target) throw new Error('routine start: ' + JSON.stringify(r && r.when));
      const before = await page.$$eval('.cv-ev.routine', (els, t) => els.filter(x => x.title.startsWith('Send the weekly client update') && x.closest('.cv-day').dataset.day < t).length, target); if (before) throw new Error('the routine shows before its start date');
      // marketing can have routines too (24 Sep 2026)
      await page.hover(`.cv-day[data-day="${target}"]`); await page.click(`.cv-day[data-day="${target}"] .cv-add`); await page.waitForTimeout(200);
      await page.selectOption('.cv-dept', 'marketing'); await page.click('.cv-rep'); await page.waitForTimeout(150);
      const mkh = await page.$eval('.cv-hint', e => e.textContent); const dis = await page.$eval('.cv-go', e => e.disabled); if (!/Rutina ·/.test(mkh) || dis) throw new Error('marketing routine not offered: ' + mkh);
      await page.keyboard.press('Escape'); await page.waitForTimeout(150); if (!await page.$eval('#cvPop', e => e.hidden)) throw new Error('Esc did not close the popover');
      await page.click('.cv-seg button[data-v="week"]'); await page.waitForTimeout(300); const wk = await page.$$eval('.cv-tg-d', e => e.length), slots = await page.$$eval('.cv-slot', e => e.length); if (wk !== 7 || slots !== 7 * 24) throw new Error('week time grid: ' + wk + ' days, ' + slots + ' slots');
      await page.keyboard.press('Escape'); await page.waitForTimeout(300); if (await page.$eval('#calOv', e => e.classList.contains('on'))) throw new Error('Esc did not close the calendar');
      return `${cells} cells · ${rt} routine runs on the grid · rail ${rail} · task scheduled for ${target} · routine starts ${target} (none before) · marketing offered · week view 7`;
    });
    await step('smoke: department focus opens the chat rail', async () => {
      await page.evaluate(() => document.activeElement && document.activeElement.blur());
      await page.keyboard.press('1'); await page.waitForFunction(() => /agentOpen/.test(document.getElementById('rail').className) && /open/.test(document.getElementById('rail').className) && document.querySelector('#topconn').classList.contains('focus'), null, { timeout: 8000 }).catch(() => {});
      const cls = await page.evaluate(() => document.getElementById('rail').className); if (!/agentOpen/.test(cls) || !/open/.test(cls)) throw new Error('rail: ' + cls);
      const strip = await page.evaluate(() => document.querySelector('#topconn').className); if (!/focus/.test(strip)) throw new Error('top strip not centred');
      await page.keyboard.press('Escape'); await page.waitForTimeout(1200);
    });
    await step('smoke: V4 — the wheel scrolls panels and zooms only the office; the dock never moves; ✕ closes a department', async () => {
      const cancelled = sel => page.evaluate(q => { const el = document.querySelector(q); return el ? !el.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true })) : null; }, sel);
      if (await cancelled('.tp-rows') !== false) throw new Error('the wheel over the task list was taken by the 3D view');
      if (await cancelled('#scene') !== true) throw new Error('the wheel over the office did not zoom');
      const x0 = await page.evaluate(() => { document.body.classList.add('connFold'); dispatchEvent(new Event('resize')); return Math.round(document.getElementById('topdock').getBoundingClientRect().left); });
      const x1 = await page.evaluate(() => { document.body.classList.remove('connFold'); dispatchEvent(new Event('resize')); return Math.round(document.getElementById('topdock').getBoundingClientRect().left); });
      if (Math.abs(x0 - x1) > 1) throw new Error(`the dock moved when the connectors opened: ${x0} → ${x1}`);
      if (await page.evaluate(() => !!document.getElementById('clock') || !!document.getElementById('topSub'))) throw new Error('the clock / the Subgerente button are still in the bar');
      const until = (fn, what) => page.waitForFunction(fn, null, { timeout: 6000 }).catch(() => { throw new Error(what); });
      await page.keyboard.press('2'); await until(() => document.querySelector('#railHeader .rh-x') && /open/.test(document.getElementById('rail').className), 'the department did not open');
      await page.waitForTimeout(600); await page.click('#railHeader .rh-x');
      await until(() => !document.body.classList.contains('railLeft') && !/open/.test(document.getElementById('rail').className), '✕ did not close the department');
      await page.evaluate(() => document.activeElement && document.activeElement.blur());
      await page.keyboard.press('s'); await until(() => !document.getElementById('subOv').hidden, 'S did not open Dimitri');
      const name = await page.evaluate(() => document.querySelector('#subOv .sb-name').textContent); if (name !== 'DIMITRI') throw new Error('Dimitri named ' + name);
      await page.evaluate(() => document.activeElement && document.activeElement.blur()); await page.keyboard.press('g'); await page.waitForTimeout(300); // a window is open: G must not open the Brain behind it
      if (await page.evaluate(() => document.body.classList.contains('brainOpen'))) throw new Error('G opened the Brain behind Dimitri');
      await page.keyboard.press('Escape'); await until(() => document.getElementById('subOv').hidden, 'Esc did not close Dimitri');
      return `wheel ok · dock fixed at ${x0}px · ✕ closes · S opens Dimitri · keys stay out · Esc closes it`;
    });
    await step('smoke: B opens and closes the company board', async () => {
      await page.evaluate(() => document.activeElement && document.activeElement.blur()); await page.keyboard.press('b'); await page.waitForFunction(() => window.CC.tasks.isOpen(), null, { timeout: 5000 }).catch(() => {});
      if (!(await page.evaluate(() => window.CC.tasks.isOpen()))) throw new Error('board did not open');
      await page.keyboard.press('Escape'); await page.waitForTimeout(500);
      if (await page.evaluate(() => window.CC.tasks.isOpen())) throw new Error('board did not close');
    });
    await step('smoke: G opens the Brain graph with notes', async () => {
      await page.keyboard.press('g'); await page.waitForTimeout(700);
      if (!(await page.evaluate(() => window.CC.brain.isOpen()))) throw new Error('graph did not open');
      const n = await page.evaluate(() => window.CC.brain.nodes.length); if (n < 10) throw new Error('nodes: ' + n);
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      if (await page.evaluate(() => window.CC.brain.isOpen())) throw new Error('graph did not close');
      return n + ' notes';
    });
    await step('smoke: approval flow reaches the panel', async () => {
      await page.evaluate(() => { const all = document.querySelector('.tp-chip[data-f="all"]'); if (all) all.click(); }); // an earlier step leaves the panel on SCHEDULED
      await page.evaluate(() => window.CC.requestApproval('ada'));
      await page.waitForFunction(() => document.querySelectorAll('.tp-row.waiting').length > 0, null, { timeout: 4000 }).catch(() => {}); // the panel renders on the next frame; headless WebGL frames can be slow
      const w = await page.evaluate(() => document.querySelectorAll('.tp-row.waiting').length); if (!w) throw new Error('no waiting row (ada: ' + (await page.evaluate(() => window.CC.R.ada.state)) + ')');
    });
    await step('smoke: V4.1 — Limpiar listas archives with DESHACER, ARCHIVADAS brings one back, the list says when it is cut', async () => {
      const click = (sel) => page.click(sel, { timeout: 5000 }).catch(e => { throw new Error(`click ${sel}: ${e.message.split('\n')[0]}`); });
      await page.evaluate(() => { const s = document.querySelector('.tp-search'); s.value = ''; s.dispatchEvent(new Event('input')); document.querySelector('.tp-chip[data-f="all"]').click(); });
      const cut = await page.evaluate(() => { const shown = document.querySelectorAll('.tp-row').length, m = document.querySelector('.tp-more'); return { shown, more: m ? m.textContent : '' }; });
      if (cut.shown >= 60 && !/Se ven 60 de/.test(cut.more)) throw new Error('60 rows and no «show more»: ' + cut.more);
      await click('.tp-chip[data-f="done"]');
      const n0 = await page.evaluate(() => document.querySelectorAll('.tp-row.done').length); if (!n0) return 'no finished tasks yet (skipped)';
      await click('.tp-clear'); await page.waitForFunction(() => !document.querySelector('.tp-toast').hidden, null, { timeout: 4000 });
      const arch = await page.evaluate(() => +(document.querySelector('.tp-chip[data-f="archived"] b')?.textContent || 0)); // the demo keeps finishing (and pruning) work, so the count is checked against the toast, not the rows seen before
      const said = await page.evaluate(() => +(document.querySelector('.tp-toast').textContent.match(/\d+/) || [0])[0]); if (!arch || arch !== said) throw new Error(`archived ${arch}, the toast says ${said} (rows before: ${n0})`);
      await click('.tp-undo'); await page.waitForFunction(() => !document.querySelector('.tp-chip[data-f="archived"]'), null, { timeout: 4000 }).catch(() => {});
      const left = await page.evaluate(() => document.querySelector('.tp-chip[data-f="archived"]')?.textContent || ''); if (left) throw new Error('DESHACER left ' + left);
      await click('.tp-clear'); await page.waitForFunction(() => document.querySelector('.tp-chip[data-f="archived"]'), null, { timeout: 4000 });
      const archN = () => page.evaluate(() => +(document.querySelector('.tp-chip[data-f="archived"] b')?.textContent || 0));
      await click('.tp-chip[data-f="archived"]'); const a1 = await archN(); if (!await page.evaluate(() => document.querySelectorAll('.tp-row.archived').length)) throw new Error('ARCHIVADAS shows no rows');
      await click('.tp-row.archived button[data-act="unarchive"]'); await page.waitForTimeout(400);
      const a2 = await archN(); if (a2 !== a1 - 1) throw new Error(`unarchive: ${a1} → ${a2}`);
      await page.evaluate(() => document.querySelector('.tp-chip[data-f="all"]').click());
      return `${n0} archived · DESHACER brings them back · ARCHIVADAS ${a1} → ${a2}${cut.more ? ' · ' + cut.more : ''}`;
    });
    await step('smoke: V4.1 — Tab stays inside an open window, the closed board is inert, ? opens the shortcuts', async () => {
      await page.keyboard.press('e'); await page.waitForFunction(() => document.body.classList.contains('studioOpen'), null, { timeout: 4000 });
      let out = 0; for (let i = 0; i < 40; i++) { await page.keyboard.press('Tab'); if (!await page.evaluate(() => document.getElementById('studioOv').contains(document.activeElement))) out++; }
      for (let i = 0; i < 3 && await page.evaluate(() => document.body.classList.contains('studioOpen')); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); } // Esc closes an open menu first, then the Estudio
      if (out) throw new Error(`Tab left the Estudio ${out} times`);
      if (!await page.evaluate(() => document.getElementById('board').inert)) throw new Error('the closed board is reachable with Tab');
      const at = await page.evaluate(() => { const a = document.activeElement; return a ? a.tagName + '.' + a.className : ''; });
      await page.keyboard.press('Shift+Slash'); await page.waitForTimeout(300);
      const sheet = await page.evaluate(() => !document.getElementById('keysOv').hidden && document.querySelectorAll('#keysOv .ks-row').length); if (!sheet) throw new Error('? did not open the shortcuts (focus on ' + at + ')');
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      if (await page.evaluate(() => [...document.body.children].some(c => c.inert && c.id === 'tpanel'))) throw new Error('the panel stayed inert after the windows closed');
      return `40 Tabs inside the Estudio · board inert when closed · ${sheet} shortcuts`;
    });
    await step('smoke: V4.1 — on a phone the whole office fits above the task sheet, with one-line department cards', async () => {
      const ph = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
      try {
        await ph.goto('file://' + path.join(ROOT, 'dist', 'command-centre-v2.html') + '?s=check'); await ph.waitForTimeout(3000);
        const r = await ph.evaluate(() => { const b = [...document.querySelectorAll('.badge:not(.brainTag)')].map(e => e.getBoundingClientRect()); return { compact: document.body.classList.contains('cardsCompact'), inside: b.every(x => x.left >= 0 && x.right <= innerWidth + 1 && x.bottom <= innerHeight * 0.56), n: b.length, overflow: document.documentElement.scrollWidth > innerWidth }; });
        if (!r.compact) throw new Error('cards not compact on a phone');
        if (!r.inside) throw new Error('a department card sits off screen or under the task sheet');
        if (r.overflow) throw new Error('the page scrolls sideways on a phone');
        return `${r.n} one-line cards, all above the sheet · no sideways scroll`;
      } finally { await ph.close(); }
    });
    await step('smoke: no errors after the run', async () => { if (errors.length) throw new Error(errors[0]); });
  } catch (e) { bad('smoke: browser', e.message); }
  finally { if (browser) await browser.close(); }
}

await step('dates: a day named once is a DATE, «cada»/«los»/plurals make a ROUTINE; «del lunes» names a report', async () => {
  const w = await import('./src/when.js'); const now = new Date('2026-09-24T11:00:00'); // a Thursday
  const once = w.parseOnce('el viernes a las 10 publica el post del blog', now);
  if (w.parseWhen('el viernes a las 10 publica el post del blog') || !once || new Date(once.at).getDate() !== 25 || once.text !== 'publica el post del blog') throw new Error('«el viernes a las 10» → ' + JSON.stringify(once));
  for (const t of ['cada viernes a las 10 publica', 'los lunes y jueves a las 9 revisa', 'mondays at 8 check the inbox', 'every weekend at noon, check']) if (!w.parseWhen(t)) throw new Error('not a routine: ' + t);
  if (w.parseWhen('¿qué hiciste el martes?')) throw new Error('a question about Tuesday became a routine');
  if (w.parseOnce('prepara el informe del lunes', now)) throw new Error('«el informe del lunes» was taken as a date');
  const tm = w.parseOnce('mañana a las 9 llama a Sol', now); if (!tm || new Date(tm.at).getDate() !== 25 || new Date(tm.at).getHours() !== 9) throw new Error('mañana a las 9: ' + JSON.stringify(tm));
  if (!w.parseOnce('hoy a las 8 algo', now).past) throw new Error('a time that passed today was not refused');
  return 'el viernes → one task on the 25th · cada/los/mondays → routines · «¿qué hiciste el martes?» → nothing · «del lunes» → nothing';
});

await step('dimitri: a chat or a status carries no pieces, a plan does; the mode is kept to five', async () => {
  const sub = await import('./sub.mjs'); const { loadRoster } = await import('./roster.mjs'); const agents = loadRoster().agents;
  const DEPTS = { emails: {}, sales: {}, marketing: {}, ops: {}, fin: {}, delivery: {}, brain: {} };
  const chat = sub.parsePlan('{"mode":"charla","reply":"Buena pregunta.","tasks":[{"dept":"sales","title":"x","instruction":"x"}]}', { depts: DEPTS, agents });
  if (chat.mode !== 'charla' || chat.tasks.length) throw new Error('a chat carried a piece: ' + JSON.stringify(chat));
  const plan = sub.parsePlan('{"mode":"plan","reply":"Así:","tasks":[{"dept":"sales","title":"Propuesta","instruction":"Haz la propuesta"}]}', { depts: DEPTS, agents });
  if (plan.mode !== 'plan' || plan.tasks.length !== 1) throw new Error('a plan lost its piece');
  const odd = sub.parsePlan('{"mode":"repartir","reply":"ok","tasks":[]}', { depts: DEPTS, agents }); if (odd.mode !== 'charla') throw new Error('unknown mode kept: ' + odd.mode);
  const p = sub.systemPrompt({ name: 'Dimitri', business: 'X', depts: { sales: { name: 'Ventas' } }, agents, skillsOf: () => [], routineDepts: ['Ventas'], status: '', notes: 'nota', recent: 'r' });
  if (!/Eres Dimitri/.test(p) || !/"charla"/.test(p) || !/No conviertas cada mensaje en tareas/.test(p)) throw new Error('the prompt lost its modes');
  return 'charla → no pieces · plan → 1 piece · unknown mode → charla · prompt names Dimitri and the five modes';
});

await step('subgerente: a plan is parsed, moved pieces named, bad departments and past dates dropped', async () => {
  const sb = await import('./sub.mjs'); const { DEPTS } = await import('./src/data.js');
  const agents = [{ id: 'lexi', department: 'sales', lead: true }, { id: 'piper', department: 'sales' }, { id: 'mlead', department: 'marketing', lead: true }];
  const future = new Date(Date.now() + 3 * 864e5); const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T10:00`;
  const p = sb.parsePlan('```json\n' + JSON.stringify({ reply: 'ok', tasks: [
    { dept: 'sales', title: 'Propuesta', instruction: 'Arma la propuesta', why: 'es venta', owner_said: 'marketing', team: false, at: iso(future) },
    { dept: 'nowhere', title: 'x', instruction: 'y' },
    { dept: 'marketing', title: 'Post', instruction: 'Escribe el post', at: '2020-01-01T10:00' }] }) + '\n```', { depts: DEPTS, agents });
  if (p.tasks.length !== 2) throw new Error('pieces: ' + p.tasks.length);
  if (p.tasks[0].lead !== 'lexi' || p.tasks[0].ownerSaid !== 'marketing' || !(p.tasks[0].at > Date.now())) throw new Error('first piece: ' + JSON.stringify(p.tasks[0]));
  if (p.tasks[1].at !== null || p.tasks[1].i !== 1) throw new Error('a past date must become «now»');
  const bad = sb.parsePlan('no json here', { depts: DEPTS, agents }); if (bad.tasks.length || !bad.reply) throw new Error('prose must come back as a reply');
  const sys = sb.systemPrompt({ business: 'X', depts: DEPTS, agents, skillsOf: () => [], routineDepts: [], status: '' });
  if (!/CALENDARIO \(usa estas fechas/.test(sys) || !/lexi/.test(sys)) throw new Error('prompt lacks the calendar or the roster');
  return '2 pieces · moved from marketing · past date → now · prose → reply';
});

await step('routines: one run can be skipped — the clock moves on without firing, the next one fires', async () => {
  const rt = await import('./routines.mjs'); const w = await import('./src/when.js');
  const r = { id: 'skipme', dept: 'emails', agent: 'elead', title: 'x', text: 'x', when: { kind: 'daily', at: '09:00' }, paused: false };
  const due = w.nextRun(r.when, Date.now() - 2 * 864e5); // a run two days ago, still pending in the state
  const st = { skipme: { nextAt: due, when: JSON.stringify(r.when), skip: [due] } };
  const hits = rt.due([r], st, due + 1000);
  if (hits.length !== 1 || !hits[0].skipped) throw new Error('the skipped run fired: ' + JSON.stringify(hits));
  if (!(st.skipme.nextAt > due) || st.skipme.skip.length) throw new Error('the clock did not move on');
  const again = rt.due([r], st, st.skipme.nextAt + 1000); if (again.length !== 1 || again[0].skipped) throw new Error('the next run did not fire');
  return 'skipped once · next run fires';
});

await step('estudio: the free test engine generates, files are stored with their record, paths stay inside', async () => {
  const md = await import('./media.mjs');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-media-'));
  try {
    md.configure({ media: { dailyLimit: 5 } }, tmp, path.join(tmp, 'data'));
    const out = await md.generate({ prompt: 'Fondo oscuro con brillo naranja', n: 2, ratio: '4:5', provider: 'prueba' });
    if (out.items.length !== 2 || out.cost !== 0) throw new Error('generate: ' + JSON.stringify(out).slice(0, 120));
    const all = md.list(); if (all.length !== 2 || !all[0].prompt) throw new Error('list: ' + all.length);
    if (!md.resolve(all[0].file)) throw new Error('resolve a real file');
    for (const bad of ['../../office.config.json', '2026-09/../../x.png', 'C:/Windows/win.ini', '2026-09/a.exe']) if (md.resolve(bad)) throw new Error('escaped: ' + bad);
    let refused = ''; try { await md.generate({ prompt: 'x', provider: 'gemini' }); } catch (e) { refused = e.message; }
    if (!/GEMINI_API_KEY/.test(refused) && !process.env.GEMINI_API_KEY) throw new Error('a provider with no key must say which key: ' + refused);
    if (!md.trash(all[1].file) || md.list().length !== 1) throw new Error('trash');
    return `2 test images · record · no path escapes · no key → «${refused.slice(0, 40)}…»`;
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

await step('estudio: Higgsfield and fal.ai through their queues (a local stand-in: no key, no spend), uploads, resume after a restart', async () => {
  const md = await import('./media.mjs'); const http = await import('node:http');
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAYAAAC56t6BAAAADklEQVR4nGNgYGD4z4ADAAMFAAHiJVjLAAAAAElFTkSuQmCC', 'base64');
  const seen = []; let polls = 0;
  const mock = http.createServer((req, res) => { let b = ''; req.on('data', d => b += d); req.on('end', () => {
    const u = req.url, body = b && /json/.test(req.headers['content-type'] || '') ? JSON.parse(b) : null; seen.push({ u, auth: req.headers.authorization, body });
    const j = o => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (u === '/files/generate-upload-url') return j({ public_url: M + '/pub/ref.png', upload_url: M + '/put/ref' });
    if (u.startsWith('/put/')) return res.end();
    if (u === '/out.png') { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(PNG); }
    if (u === '/out.mp4') { res.writeHead(200, { 'content-type': 'video/mp4' }); return res.end(Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(16)])); }
    const st = u.match(/^\/requests\/(\w+)\/status$/); if (st) { polls++; return st[1].startsWith('nsfw') ? j({ status: 'nsfw' }) : polls % 2 ? j({ status: 'in_progress' }) : j({ status: 'completed', ...(st[1].startsWith('v') ? { video: { url: M + '/out.mp4' } } : { images: [{ url: M + '/out.png' }] }) }); }
    if (u.startsWith('/q/') && /\/status$/.test(u)) return j({ status: 'COMPLETED' });
    if (u.startsWith('/q/') && body === null) return j({ video: { url: M + '/out.mp4' } });
    if (u.startsWith('/q/')) return j({ request_id: 'f1', status_url: M + '/q/r/f1/status', response_url: M + '/q/r/f1' });
    const id = (body?.prompt?.includes('NSFW') ? 'nsfw' : /video/.test(u) ? 'v' : 'i') + seen.length;
    j({ request_id: id, status_url: `${M}/requests/${id}/status` });
  }); });
  await new Promise(r => mock.listen(0, '127.0.0.1', r)); const M = `http://127.0.0.1:${mock.address().port}`;
  const keep = {}; const ENV = { HF_KEY: 'id:secret', HF_API_BASE_URL: M, FAL_KEY: 'fal-k', AO_FAL_QUEUE: M + '/q', AO_POLL_MS: '20' };
  for (const k of Object.keys(ENV)) { keep[k] = process.env[k]; process.env[k] = ENV[k]; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-media-q-'));
  try {
    md.configure({ media: { dailyLimit: 50 } }, tmp, path.join(tmp, 'data'));
    const up = md.upload({ name: 'producto.png', data: 'data:image/png;base64,' + PNG.toString('base64') });
    if (!up.upload || up.w !== 2 || up.h !== 3) throw new Error('upload: ' + JSON.stringify(up));
    let refused = ''; try { md.upload({ name: 'x.png', data: 'data:image/png;base64,' + Buffer.from('<svg onload=alert(1)>').toString('base64') }); } catch (e) { refused = e.message; }
    if (!refused) throw new Error('a file that is not what it says was accepted');
    const soul = await md.generate({ model: 'soul-2', prompt: 'retrato', settings: { aspectRatio: '3:4' } });
    const sb = seen.find(x => x.u === '/higgsfield-ai/soul/v2/standard');
    if (sb.auth !== 'Key id:secret' || sb.body.batch_size !== 1 || sb.body.aspect_ratio !== '3:4' || sb.body.resolution !== '720p' || sb.body.enhance_prompt !== false || soul.items.length !== 1) throw new Error('Soul 2 body: ' + JSON.stringify(sb.body));
    const kl = await md.generate({ model: 'kling-3-std', kind: 'video', prompt: 'se acerca', media: { start: [up.file] }, settings: { duration: 7, sound: false } });
    const kb = seen.find(x => x.u === '/kling-video/v3.0/std/image-to-video');
    if (!kb || kb.body.image_url !== M + '/pub/ref.png' || kb.body.sound !== 'off' || kb.body.duration !== 7 || kl.items[0].kind !== 'video') throw new Error('Kling 3 from an image: ' + JSON.stringify(kb && kb.body));
    const fk = await md.generate({ model: 'kling-2.5-fal', kind: 'video', prompt: 'olas', media: { start: [up.file] } });
    const fb = seen.find(x => x.u === '/q/fal-ai/kling-video/v2.5-turbo/pro/image-to-video');
    if (!fb || fb.auth !== 'Key fal-k' || !fb.body.image_url.startsWith('data:image/png;base64,') || fk.items.length !== 1) throw new Error('fal video: ' + JSON.stringify(fb && fb.body).slice(0, 120));
    let blocked = ''; try { await md.generate({ model: 'soul-cinema', prompt: 'NSFW x' }); } catch (e) { blocked = e.message; }
    if (!/contenido/.test(blocked)) throw new Error('nsfw said: ' + blocked);
    let needs = ''; try { md.submit({ model: 'dop', kind: 'video', prompt: 'x' }); } catch (e) { needs = e.message; } if (!/imagen inicial/.test(needs)) throw new Error('dop without an image: ' + needs);
    const pr = await md.generate({ model: 'prueba', prompt: 'tarjeta' });
    let card = ''; try { md.submit({ model: 'flux-2', prompt: 'x', media: { reference: [pr.items[0].file] } }); } catch (e) { card = e.message; } if (!/tarjeta de prueba/.test(card)) throw new Error('a test card went in as a reference: ' + card);
    // the office restarted while a video was generating: the job keeps its request id and picks the poll up again
    const jf = path.join(tmp, 'data', 'media-jobs.json'), jobs = JSON.parse(fs.readFileSync(jf, 'utf8'));
    jobs.push({ id: 'jresume1', state: 'running', kind: 'video', model: 'kling-3-pro', engine: 'higgsfield', prompt: 'reel', n: 1, s: { duration: 5 }, media: {}, weight: 5, by: 'agent', agent: 'vid', task: 'tk1', at: Date.now(), startedAt: Date.now(), items: [], unit: 0.55, remote: [{ id: 'v9', status: M + '/requests/v9/status' }] });
    fs.writeFileSync(jf, JSON.stringify(jobs));
    let doneJob = null; md.configure({ media: { dailyLimit: 50 } }, tmp, path.join(tmp, 'data'), { onDone: j => { doneJob = j; } });
    const back = await md.wait('jresume1', 10000);
    if (back.state !== 'done' || back.resumed !== 1 || !doneJob || doneJob.task !== 'tk1') throw new Error('resume: ' + JSON.stringify(back).slice(0, 160));
    const z = md.zip(md.list().map(i => i.file)); if (z.buf.readUInt32LE(0) !== 0x04034b50 || z.count !== md.list().length) throw new Error('zip');
    const t = md.trash(up.file); if (!t || md.list().some(i => i.file === up.file) || !md.restore(t) || !md.list().some(i => i.file === up.file)) throw new Error('trash and restore');
    if (md.restore({ id: '../../office.config.json', bin: ['1-x'] })) throw new Error('restore escaped');
    return `${md.models().length} models · Soul 2, Kling 3 (image → video, upload to Higgsfield), fal Kling (queue, data URI) · NSFW says why · a video resumes after a restart · ZIP · undo`;
  } finally { for (const k of Object.keys(ENV)) { if (keep[k] === undefined) delete process.env[k]; else process.env[k] = keep[k]; } mock.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
});

/* ---------- 3. server smoke ---------- */
{
  const port = 4600 + Math.floor(Math.random() * 300);
  // a throwaway data folder and a COPY of the brain: the test server never reads or writes the owner's tasks, routines or notes
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-check-'));
  const brainCopy = path.join(sandbox, 'brain'); fs.cpSync(loadConfig().brainPath, brainCopy, { recursive: true });
  const env = { ...process.env, PORT: String(port), AO_DATA: path.join(sandbox, 'data'), AO_BRAIN: brainCopy };
  const srv = spawn('node', ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
  const base = `http://localhost:${port}`;
  const up = await (async () => { for (let i = 0; i < 40; i++) { try { const r = await fetch(base + '/api/health'); if (r.ok) return await r.json(); } catch {} await new Promise(r => setTimeout(r, 250)); } return null; })();
  if (!up) bad('server: starts', log.trim().split('\n').slice(-2).join(' | ') || 'no health response');
  else {
    ok('server: starts', `${up.name} · ${up.backend} · brain ${up.notes} notes`);
    await step('server: serves the office', async () => { const r = await fetch(base + '/'); const t = await r.text(); if (!/AGENTS OFFICE/.test(t)) throw new Error('html missing'); });
    await step('server: /api/brain has the live graph', async () => { const g = await (await fetch(base + '/api/brain')).json(); if (!g.nodes.length) throw new Error('empty'); return `${g.nodes.length} linked notes`; });
    await step('server: /api/mcp lists this machine\'s connectors', async () => {
      const m = await (await fetch(base + '/api/mcp')).json();
      if (!Array.isArray(m.servers)) throw new Error('no servers array');
      const c = m.servers.filter(s => s.status === 'connected').length;
      return `${m.servers.length} servers · ${c} connected · agents get tools: ${m.tools ? 'yes' : 'no (API backend)'}${m.web ? ' + web' : ''}`;
    });
    await step('server: /api/health carries the roster', async () => { if (!Array.isArray(up.agents) || up.agents.length !== 35) throw new Error('agents: ' + (up.agents && up.agents.length)); if (!up.agents[0].does) throw new Error('no job description'); });
    await step('server: the office default is Sonnet and /api/usage always answers', async () => {
      if (up.model !== 'sonnet' || JSON.stringify(up.models) !== '["sonnet","opus","fable"]') throw new Error('health model: ' + up.model);
      if (up.effort !== '' || JSON.stringify(up.efforts) !== '["low","medium","high","xhigh","max"]') throw new Error('health effort: ' + up.effort);
      const r = await fetch(base + '/api/usage'); if (r.status !== 200) throw new Error('status ' + r.status); const u = await r.json();
      if (!u.ok || !['claude', 'office'].includes(u.source)) throw new Error(JSON.stringify(u).slice(0, 120));
      return u.source === 'claude' ? `Claude's gauge: session ${u.session?.percent}% · week ${u.week?.percent}%` : `office count (${u.reason})`;
    });
    await step('server: /api/skills lists the skills and who has them', async () => {
      const s = await (await fetch(base + '/api/skills')).json(); if (!s.count || !Array.isArray(s.skills)) throw new Error('no skills');
      const piper = up.agents.find(a => a.id === 'piper'); if (!piper.skills?.includes('proposal')) throw new Error('health roster has no skills on piper');
      return `${s.count} skills · piper: ${piper.skills.join(', ')}`;
    });
    await step('server: the lead offers the interview when a department is not set up', async () => {
      const lead = up.agents.find(a => a.id === 'lexi'); if (lead.interviewer !== true) throw new Error('lexi is not the interviewer');
      if (typeof up.setup?.sales !== 'boolean') throw new Error('no setup map');
      const r = await (await fetch(base + '/api/lessons')).json(); if (!Array.isArray(r.agents)) throw new Error('no lessons endpoint');
      return `sales set up: ${up.setup.sales} · lessons dir ${path.basename(r.dir)}`;
    });
    await step('server: /api/routines lists the timetable and names the departments', async () => {
      const r = await (await fetch(base + '/api/routines')).json(); if (!Array.isArray(r.routines) || JSON.stringify(r.depts) !== '["emails","fin","sales","marketing","ops","delivery"]') throw new Error(JSON.stringify(r).slice(0, 120));
      if (typeof up.routines?.count !== 'number') throw new Error('health has no routines');
      return `${r.routines.length} routines${r.routines.length ? ' · next ' + (r.routines.filter(x => x.nextAt).sort((a, b) => a.nextAt - b.nextAt)[0]?.title || '—') : ''} · ${path.basename(path.dirname(r.path))}/${path.basename(r.path)}`;
    });
    await step('server: a routine for no department is refused, a routine with no time is asked back', async () => {
      const r = await fetch(base + '/api/routines', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dept: 'brain', text: 'every day at 9am post the reel' }) });
      const j = await r.json(); if (r.status !== 400 || !/departamento desconocido/.test(j.error)) throw new Error(r.status + ' ' + JSON.stringify(j));
      const t = await fetch(base + '/api/routines', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dept: 'emails', text: 'every weekday, triage the inbox' }) });
      const k = await t.json(); if (t.status !== 400 || !k.needsTime) throw new Error('missing time not asked back: ' + JSON.stringify(k));
      const n = await fetch(base + '/api/routines', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dept: 'sales', text: 'chase the quiet deals' }) });
      const m = await n.json(); if (n.status !== 400 || !m.noSchedule) throw new Error('no schedule not named: ' + JSON.stringify(m));
      return j.error;
    });
    await step('server: /api/health says teams and the browser are on; the bar has the Chrome tile', async () => {
      if (!up.teams || up.teams.enabled !== true || up.teams.max !== 4) throw new Error('health.teams: ' + JSON.stringify(up.teams));
      if (!up.browser || up.browser.on !== true) throw new Error('health.browser: ' + JSON.stringify(up.browser));
      const m = await (await fetch(base + '/api/mcp')).json();
      const c = m.servers.find(s => s.id === 'claude-in-chrome'); if (!c || c.key !== 'chrome' || !Array.isArray(c.depts) || c.depts.length !== 6) throw new Error('chrome not in /api/mcp: ' + JSON.stringify(c));
      return `teams on (max ${up.teams.max}) · Chrome ${c.status}${up.browser.device ? ' · ' + up.browser.device : ''} · wired to every pod`;
    });
    await step('server: a task scheduled for a time that has passed is refused', async () => { // V3.2.1
      const r = await fetch(base + '/api/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dept: 'sales', text: 'call the leads', at: Date.now() - 3600000 }) });
      const j = await r.json(); if (r.status !== 400 || !/ya pasó/.test(j.error)) throw new Error(r.status + ' ' + JSON.stringify(j));
      const b = await fetch(base + '/api/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dept: 'sales', text: 'call the leads', at: 'tomorrowish' }) });
      if (b.status !== 400) throw new Error('bad time accepted');
      return j.error;
    });
    await step('server: the Estudio queues a job, a finished one reaches its task, uploads, zips, undoes (free engine only)', async () => {
      const post = async (p, b) => { const r = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`${p} ${r.status} ${j.error}`); return j; };
      const cat = await (await fetch(base + '/api/media/models')).json(); if (cat.models.length < 30 || !cat.engines.some(e => e.id === 'higgsfield')) throw new Error('catalog: ' + cat.models.length);
      const tf = path.join(sandbox, 'data', 'tasks.json'); let list = []; try { list = JSON.parse(fs.readFileSync(tf, 'utf8')); } catch {}
      list.push({ id: 'tkstudio1', dept: 'marketing', agent: 'gfx', title: 'Post con imagen', text: 'x', state: 'done', result: 'Aquí va:\n⏳ Estudio: fondo (trabajo PLACEHOLDER)\nFin.', doneAt: Date.now(), addedAt: Date.now() }); fs.mkdirSync(path.dirname(tf), { recursive: true }); fs.writeFileSync(tf, JSON.stringify(list));
      const { job } = await post('/api/media/jobs', { model: 'prueba', prompt: 'fondo naranja', n: 2, by: 'agent', agent: 'gfx', task: 'tkstudio1', wait: 8000 });
      if (job.state !== 'done' || job.items.length !== 2) throw new Error('job: ' + JSON.stringify(job).slice(0, 120));
      await new Promise(r => setTimeout(r, 300));
      const t = JSON.parse(fs.readFileSync(tf, 'utf8')).find(x => x.id === 'tkstudio1'); if (!t || !/Del Estudio[\s\S]*!\[fondo naranja\]\(\/media\//.test(t.result)) throw new Error('not added to the task: ' + (t && t.result.slice(-120)));
      const png = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAYAAAC56t6BAAAADklEQVR4nGNgYGD4z4ADAAMFAAHiJVjLAAAAAElFTkSuQmCC';
      const { item } = await post('/api/media/upload', { name: 'logo.png', data: 'data:image/png;base64,' + png });
      const z = await fetch(base + '/api/media/zip', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids: [item.file, ...job.items] }) });
      if (z.headers.get('content-type') !== 'application/zip') throw new Error('zip');
      const d = await (await fetch(base + '/api/media/item/' + encodeURIComponent(item.file), { method: 'DELETE' })).json(); await post('/api/media/restore', d.undo);
      const rg = await fetch(base + '/media/' + job.items[0].split('/').map(encodeURIComponent).join('/'), { headers: { range: 'bytes=0-9' } }); if (rg.status !== 206) throw new Error('range ' + rg.status);
      return `${cat.models.length} models · job → task · upload · ZIP · undo · ranges`;
    });
    await step('server: rejects an empty task', async () => { const r = await fetch(base + '/api/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"dept":"sales","text":""}' }); if (r.status !== 400) throw new Error('status ' + r.status); });
    if (LIVE) {
      await step('live: Claude routes a task', async () => {
        const r = await fetch(base + '/api/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dept: 'emails', text: 'reply to a client asking when their September report will arrive' }) });
        if (!r.ok) throw new Error((await r.json()).error); const t = await r.json(); globalThis.__t = t; return `${t.agent} · ${t.title}`;
      });
      await step('live: the agent delivers and the note is saved', async () => {
        const t = globalThis.__t; if (!t) throw new Error('no task'); const r = await fetch(`${base}/api/tasks/${t.id}/run`, { method: 'POST' });
        if (!r.ok) throw new Error((await r.json()).error); const d = await r.json(); if (d.error) throw new Error(d.result);
        const notePath = path.join(cfg.brainPath, 'Agents Office', d.note + '.md'); if (!fs.existsSync(notePath)) throw new Error('note not written: ' + notePath);
        return `${d.result.length} chars · read ${d.read.join(', ')} · ${d.note}.md`;
      });
      await step('live: a two-minute routine fires on the server, runs and lands', async () => {
        const r = await fetch(base + '/api/routines', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dept: 'emails', text: 'every 2 minutes, list what is in the inbox that needs me today' }) });
        const j = await r.json(); if (!r.ok) throw new Error(j.error); const id = j.routine.id;
        try {
          if (!j.routine.nextAt || j.routine.desc !== 'cada 2 min') throw new Error('routine wrong: ' + JSON.stringify(j.routine));
          let task = null;
          for (let i = 0; i < 100 && !(task && task.state !== 'next' && task.state !== 'doing'); i++) { await new Promise(r => setTimeout(r, 3000)); task = (await (await fetch(base + '/api/tasks')).json()).find(t => t.routine === id); }
          if (!task) throw new Error('the routine never fired'); if (task.state === 'next' || task.state === 'doing') throw new Error('the routine fired but did not finish in time');
          if (task.by !== 'routine' || task.error) throw new Error('task: ' + task.state + ' ' + (task.result || '').slice(0, 120));
          return `${task.agent} · ${task.title} · ${task.state}${task.state === 'waiting' ? ' for the OK' : ''} · ${task.result.length} chars`;
        } finally { await fetch(`${base}/api/routines/${id}`, { method: 'DELETE' }); }
      });
      await step('live: a task set to Opus runs on Opus and says so', async () => {
        const r = await fetch(base + '/api/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dept: 'sales', text: 'one line: what should the next follow-up to a quiet lead say', model: 'opus' }) });
        if (!r.ok) throw new Error((await r.json()).error); const t = await r.json(); if (t.model !== 'opus') throw new Error('task.model ' + t.model);
        const d = await (await fetch(`${base}/api/tasks/${t.id}/run`, { method: 'POST' })).json(); if (d.error) throw new Error(d.result);
        if (d.modelUsed !== 'opus' || d.modelFrom !== 'task' || !/opus/.test(String(d.modelId))) throw new Error(`ran on ${d.modelId} (${d.modelUsed} from ${d.modelFrom})`);
        const u = await (await fetch(base + '/api/usage')).json(); if (!u.ok) throw new Error('usage after a run');
        return `${d.agent} · ${d.modelId} · from the task · gauge ${u.source}`;
      });
      await step('live: a task scheduled 75 s ahead fires on its minute and lands; a routine from a date waits for it', async () => { // V3.2.1
        const at = Date.now() + 75000;
        const r = await fetch(base + '/api/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dept: 'emails', text: 'list what is in the inbox that needs me today', at }) });
        const t = await r.json(); if (!r.ok) throw new Error(t.error); if (t.state !== 'scheduled' || t.dueAt !== at) throw new Error('not scheduled: ' + JSON.stringify({ state: t.state, dueAt: t.dueAt }));
        const start = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
        const rr = await fetch(base + '/api/routines', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dept: 'emails', text: 'triage the inbox', when: { kind: 'weekdays', at: '08:00', start } }) });
        const j = await rr.json(); if (!rr.ok) throw new Error(j.error);
        try {
          if (!j.routine.nextAt || new Date(j.routine.nextAt).toISOString().slice(0, 10) < start) throw new Error('routine fires before its start: ' + new Date(j.routine.nextAt));
          let task = null;
          for (let i = 0; i < 100 && !(task && task.state !== 'scheduled' && task.state !== 'next' && task.state !== 'doing'); i++) { await new Promise(r => setTimeout(r, 3000)); task = (await (await fetch(base + '/api/tasks')).json()).find(x => x.id === t.id); }
          if (!task || task.state === 'scheduled') throw new Error('the scheduled task never fired'); if (task.state === 'next' || task.state === 'doing') throw new Error('fired but did not finish in time');
          if (task.error) throw new Error('task failed: ' + task.result.slice(0, 120));
          return `${task.agent} · ${task.title} · ${task.state}${task.state === 'waiting' ? ' for the OK' : ''} · routine "${j.routine.desc}" next ${new Date(j.routine.nextAt).toDateString()}`;
        } finally { await fetch(`${base}/api/routines/${j.routine.id}`, { method: 'DELETE' }); }
      });
      await step('live: a team task — the lead plans, the desks work at once, the lead writes the final', async () => {
        const r = await fetch(base + '/api/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dept: 'marketing', text: 'as a team, give me three angles for a reel about inbox overload: for each one a hook line and a two-sentence caption', team: true }) });
        if (!r.ok) throw new Error((await r.json()).error); const t = await r.json();
        if (!t.team || t.agent !== 'mlead') throw new Error('not a team task for the lead: ' + JSON.stringify({ team: t.team, agent: t.agent }));
        const d = await (await fetch(`${base}/api/tasks/${t.id}/run`, { method: 'POST' })).json(); if (d.error) throw new Error(d.result);
        const ps = d.team?.pieces || []; if (ps.length < 2) throw new Error('fewer than two pieces: ' + JSON.stringify(d.team));
        if (new Set(ps.map(p => p.agent)).size !== ps.length) throw new Error('a desk got two pieces');
        if (!ps.every(p => p.state === 'done' && p.result)) throw new Error('a piece did not finish: ' + JSON.stringify(ps.map(p => [p.agent, p.state])));
        if (!/Team:/i.test(d.result)) throw new Error('the final has no Team line');
        const note = fs.readFileSync(path.join(cfg.brainPath, 'Agents Office', d.note + '.md'), 'utf8'); if (!/^team: /m.test(note) || !/## Team/.test(note)) throw new Error('the note does not carry the team');
        return `${ps.map(p => p.agent).join(' + ')} → ${d.agent} · ${d.result.length} chars · ${(d.team.messages || []).length} notes between them · ${d.note}.md`;
      });
      await step('live: an agent drives the owner\'s Chrome', async () => {
        const r = await fetch(base + '/api/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dept: 'ops', text: 'Open https://example.com in the browser and tell me the exact page heading and where its one link points. Then close the tab.' }) });
        if (!r.ok) throw new Error((await r.json()).error); const t = await r.json();
        const d = await (await fetch(`${base}/api/tasks/${t.id}/run`, { method: 'POST' })).json(); if (d.error) throw new Error(d.result);
        if (!(d.tools || []).includes('chrome')) throw new Error('the browser was not used (tools: ' + (d.tools || []).join(' ') + '): ' + d.result.slice(0, 200));
        if (!/example domain/i.test(d.result)) throw new Error('the heading is not in the result: ' + d.result.slice(0, 200));
        return `${d.agent} · used ${d.used.join(', ')} · "${d.result.match(/example domain/i)[0]}"`;
      });
      await step('live: chat answers in persona', async () => {
        const r = await fetch(base + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ agent: 'lexi', text: 'what is our proposal win rate?' }) });
        if (!r.ok) throw new Error((await r.json()).error); const j = await r.json(); if (!j.reply) throw new Error('empty reply'); return j.reply.slice(0, 80).replace(/\n/g, ' ');
      });
      if (chromium) await step('live: the whole flow in a browser', async () => {
        let browser; try { browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] }); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
        try {
          const page = await browser.newPage({ viewport: { width: 1512, height: 900 } });
          const errs = []; page.on('pageerror', e => errs.push(e.message));
          await page.goto(base + '/'); await page.waitForTimeout(3500);
          const mode = await page.evaluate(() => document.querySelector('.tp-mode').textContent); if (!/LIVE/.test(mode)) throw new Error('panel not live: ' + mode);
          const before = await page.evaluate(() => window.CC.brain.nodes.length);
          const known = await page.evaluate(() => window.CC.tasks.tasks.filter(t => t.live).map(t => t.id));
          await page.click('.tp-dd'); await page.click('.tp-menu button[data-k="marketing"]');
          await page.fill('.tp-in', 'write three hook lines for a reel about why most businesses ignore their inbox'); await page.keyboard.press('Enter');
          await page.waitForFunction(() => /Agregado|No se agregó/i.test(document.querySelector('.tp-hint').textContent), { timeout: 150000 });
          const hint = await page.evaluate(() => document.querySelector('.tp-hint').textContent); if (!/Agregado/.test(hint)) throw new Error(hint);
          const mine = await page.evaluate(k => window.CC.tasks.tasks.find(t => t.live && !k.includes(t.id))?.id, known); if (!mine) throw new Error('the new task is not in the panel');
          await page.waitForFunction(id => { const t = window.CC.tasks.tasks.find(x => x.id === id); return t && t.state === 'done'; }, mine, { timeout: 240000 });
          const done = await page.evaluate(id => { const t = window.CC.tasks.tasks.find(x => x.id === id); return { error: t.error, note: t.note, read: t.read }; }, mine);
          if (done.error) throw new Error('task failed');
          await page.waitForTimeout(2500);
          await page.click(`.tp-row[data-id="${mine}"]`); await page.waitForTimeout(2500);
          const card = await page.evaluate(n => [...document.querySelectorAll('.m-file')].some(e => e.textContent.includes(n + '.md')), done.note); if (!card) throw new Error('deliverable card not in the chat');
          const after = await page.evaluate(() => window.CC.brain.nodes.length);
          const inGraph = await page.evaluate(n => window.CC.brain.nodes.some(x => x.id === n), done.note); // a second run on the same day rewrites the same note, so the count may not grow
          if (after < before || !inGraph) throw new Error(`the new note is not in the brain graph (${before} → ${after}, ${done.note})`);
          if (errs.length) throw new Error(errs[0]);
          return `${hint.trim().slice(0, 50)} · ${done.note}.md in the chat and in the graph · brain ${before} → ${after} notes`;
        } finally { await browser.close(); }
      });
    } else ok('live: skipped', 'set CHECK_LIVE=1 to route one task and one chat through Claude');
  }
  srv.kill();
  setTimeout(() => { try { fs.rmSync(sandbox, { recursive: true, force: true }); } catch {} }, 500); // the throwaway copy goes when the server has let go of it
}

/* ---------- summary ---------- */
const fails = results.filter(r => !r[0]);
console.log(`\n${fails.length ? '✗' : '✓'} ${results.length - fails.length}/${results.length} checks passed${fails.length ? ' — ' + fails.map(f => f[1]).join(', ') : ''}`);
process.exit(fails.length ? 1 : 0);
