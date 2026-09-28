// Agents Office V4.4 (25 Sep 2026) — «Ajustes» (audit J5, I10, H4, H6, H9). Key «,» or the gear in the dock.
// Every setting that used to need a JSON file, as a form that explains itself: security, approvals, costs, notices,
// connectors, quality, the team; plus the company's figures (H4), the brand voice (H6) and «set the office up from my
// website» (H9). The server validates and writes office.config.local.json (settings.mjs).
// V4.5 (27 Sep 2026, the owner): two tabs that live in this browser, not on the server, so they work in the demo too —
// «Apariencia» (the theme: Claro by default, Oscuro, Automático) and «Atajos de teclado» (the list that was the ? sheet;
// ? still opens it, here). Both apply at once, with no Guardar. The Estudio's caps are a server group («Estudio»).
import { modal } from './modal.js';

const DEPT = { emails: 'Correos', sales: 'Ventas', marketing: 'Marketing', ops: 'Operaciones', fin: 'Finanzas', delivery: 'Entregas' };
export function initSettings({ served, esc, keys = [], runKey, theme }) {
  const btn = document.getElementById('topSettings');
  const el = document.createElement('div'); el.id = 'setOv'; el.hidden = true;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'setT');
  el.innerHTML = `<div class="sg-box"><div class="sg-head"><h2 id="setT">Ajustes</h2><span class="sp"></span><button type="button" class="sg-x" aria-label="Cerrar" title="Cerrar (Esc)">✕</button></div>
    <div class="sg-wrap"><div class="sg-tabs" role="tablist" aria-label="Secciones"></div><div class="sg-pane" role="tabpanel" tabindex="-1"></div></div>
    <div class="sg-foot"><span class="sg-msg" role="status" aria-live="polite"></span><span class="sp"></span><button type="button" class="sg-btn pri" data-a="save">Guardar</button></div></div>`;
  document.body.appendChild(el);
  let data = null, tab = served ? 'general' : 'apariencia', opener = null, dirty = {}, cifras = null, voice = null;
  const EXTRA = [['cifras', 'Cifras de la empresa'], ['voz', 'Voz de marca'], ['empresa', 'Preparar desde mi web']];
  const LOCAL = ['apariencia', 'atajos'], NO_SAVE = ['empresa', ...LOCAL];
  const tabList = () => (served && data ? [data.groups[0], ['apariencia', 'Apariencia'], ...data.groups.slice(1), ...EXTRA, ['atajos', 'Atajos de teclado']] : [['apariencia', 'Apariencia'], ['atajos', 'Atajos de teclado']]);
  const THEME_NAME = { light: 'Claro', dark: 'Oscuro', auto: 'Automático' };
  function themeHTML() {
    const cur = theme ? theme.get() : 'light', sys = theme && theme.systemDark() ? 'oscuro' : 'claro';
    const opt = (v, note) => `<label class="sg-th"><input type="radio" name="sgTheme" value="${v}"${cur === v ? ' checked' : ''}><span class="sg-sw ${v}" aria-hidden="true"><i class="l"></i><i class="d"></i></span><b>${THEME_NAME[v]}</b><small>${note}</small><span class="sg-ok" aria-hidden="true">✓</span></label>`;
    return `<p class="sg-lead">Cómo se ve la oficina en este navegador. Se aplica al instante y se recuerda aquí: cada computadora elige el suyo.</p>
      <fieldset class="sg-theme"><legend>Tema</legend>${opt('light', 'El de siempre. Es el predeterminado.')}${opt('dark', 'Para la noche o una sala a oscuras.')}${opt('auto', `Sigue a tu sistema y cambia con él (ahora: ${sys}).`)}</fieldset>
      <p class="sg-lead">¿Grabas la pantalla? El modo cámara (tecla V) pone un fondo neutro que no se quema en video.</p>`;
  }
  const keysHTML = () => `<div class="sg-keys"><p class="sg-lead">Funcionan cuando no estás escribiendo. Pulsa una línea para hacerlo ahora. <kbd>?</kbd> abre esta lista desde cualquier sitio.</p>
    <div class="ks-grid">${keys.map(([h, rows]) => `<section><h3>${esc(h)}</h3>${rows.map(([k, t, key]) => key
      ? `<button type="button" class="ks-row" data-key="${esc(key)}"><kbd>${esc(k)}</kbd><span>${esc(t)}</span></button>`
      : `<div class="ks-row"><kbd>${esc(k)}</kbd><span>${esc(t)}</span></div>`).join('')}</section>`).join('')}</div></div>`;
  const msg = (t, bad) => { const m = el.querySelector('.sg-msg'); m.textContent = t || ''; m.classList.toggle('bad', !!bad); };
  const val = p => (p in dirty ? dirty[p] : data.values[p]);
  function field(f) {
    const id = 'sg-' + f.path.replace(/\W/g, '-'), v = val(f.path), help = f.help ? `<small id="${id}-h">${esc(f.help)}</small>` : '', desc = f.help ? ` aria-describedby="${id}-h"` : '';
    const lab = `<label for="${id}">${esc(f.label)}${f.restart ? ' <i title="Se aplica al reiniciar la oficina">↻</i>' : ''}</label>`;
    if (f.type === 'bool') return `<div class="sg-f sg-bool"><input type="checkbox" role="switch" id="${id}" data-p="${f.path}"${v ? ' checked' : ''}${desc}>${lab}${help}</div>`;
    if (f.type === 'select') return `<div class="sg-f">${lab}<select id="${id}" data-p="${f.path}"${desc}>${f.options.map(([k, t]) => `<option value="${k}"${v === k ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>${help}</div>`;
    if (f.type === 'number') return `<div class="sg-f">${lab}<input type="number" inputmode="decimal" id="${id}" data-p="${f.path}" value="${v ?? ''}"${f.default !== undefined ? ` placeholder="${f.default} (por defecto)"` : ''} min="${f.min}" max="${f.max}" step="${f.step || 1}"${desc}>${help}</div>`;
    if (f.type === 'time') return `<div class="sg-f">${lab}<input type="time" id="${id}" data-p="${f.path}" value="${esc(v || '')}"${desc}>${help}</div>`;
    if (f.type === 'list') return `<div class="sg-f">${lab}<textarea id="${id}" data-p="${f.path}" rows="3" placeholder="uno por línea"${desc}>${esc((v || []).join('\n'))}</textarea>${help}</div>`;
    if (f.type === 'depts') return `<fieldset class="sg-f sg-depts"><legend>${esc(f.label)}</legend>${Object.entries(DEPT).map(([k, t]) => `<label><input type="checkbox" data-p="${f.path}" data-d="${k}"${(v || []).includes(k) ? ' checked' : ''}> ${t}</label>`).join('')}${help}</fieldset>`;
    if (f.type === 'people') return `<div class="sg-f"><span class="sg-l">${esc(f.label)}</span>${help}<div class="sg-people" data-p="${f.path}">${(v || []).map((p, i) => personRow(p, i)).join('')}</div><button type="button" class="sg-btn" data-a="add-person">+ Añadir una persona</button></div>`;
    return `<div class="sg-f">${lab}<input type="text" id="${id}" data-p="${f.path}" value="${esc(v ?? '')}" maxlength="${f.max || 200}"${desc}>${help}</div>`;
  }
  const personRow = (p, i) => `<div class="sg-person"><input aria-label="Nombre" placeholder="Nombre" value="${esc(p.name || '')}" data-k="name"><input aria-label="Id de Telegram (opcional)" placeholder="Id de Telegram (opcional)" value="${esc(p.telegram || '')}" data-k="telegram" inputmode="numeric"><select aria-label="Departamento" data-k="dept"><option value="">Toda la oficina</option>${Object.entries(DEPT).map(([k, t]) => `<option value="${k}"${(p.depts || [])[0] === k ? ' selected' : ''}>${t}</option>`).join('')}</select><button type="button" class="sg-del" data-a="del-person" aria-label="Quitar a ${esc(p.name || 'esta persona')}">✕</button></div>`;
  function readPeople() { return [...el.querySelectorAll('.sg-person')].map(r => ({ name: r.querySelector('[data-k=name]').value.trim(), telegram: r.querySelector('[data-k=telegram]').value.trim(), depts: r.querySelector('[data-k=dept]').value ? [r.querySelector('[data-k=dept]').value] : [] })).filter(p => p.name); }
  function render() {
    const tabs = el.querySelector('.sg-tabs'), pane = el.querySelector('.sg-pane');
    const all = tabList();
    if ((!served || data) && !all.some(([k]) => k === tab)) tab = all[0][0];
    tabs.innerHTML = all.map(([k, t]) => `<button type="button" role="tab" id="sgt-${k}" aria-selected="${tab === k}" aria-controls="sgp" data-tab="${k}" tabindex="${tab === k ? 0 : -1}">${esc(t)}</button>`).join('');
    pane.id = 'sgp'; pane.setAttribute('aria-labelledby', 'sgt-' + tab);
    el.querySelector('[data-a="save"]').hidden = NO_SAVE.includes(tab) || !served;
    if (tab === 'apariencia') { pane.innerHTML = themeHTML(); return; }
    if (tab === 'atajos') { pane.innerHTML = keysHTML(); return; }
    if (!served) { pane.innerHTML = '<p class="sg-lead">Esta es la demo: el resto de los ajustes se cambia en la oficina real (<code>npm start</code>).</p>'; return; }
    if (!data) { pane.innerHTML = '<p class="sg-lead">Leyendo…</p>'; return; }
    if (tab === 'cifras') { pane.innerHTML = `<p class="sg-lead">Precios, comisiones, metas, horarios: los agentes los leen antes de cada trabajo y los usan tal cual, en vez de adivinarlos. Se guardan en el cerebro de esta máquina.</p>${cifras === null ? '<p>Leyendo…</p>' : `<div class="sg-tw"><table class="sg-cif"><thead><tr><th>Nombre</th><th>Valor</th><th>Unidad</th><th>Nota</th><th><span class="sr">Quitar</span></th></tr></thead><tbody>${cifras.map((c, i) => `<tr><td><input aria-label="Nombre" value="${esc(c.name)}" data-c="name"></td><td><input aria-label="Valor" value="${esc(c.value)}" data-c="value"></td><td><input aria-label="Unidad" value="${esc(c.unit || '')}" data-c="unit"></td><td><input aria-label="Nota" value="${esc(c.note || '')}" data-c="note"></td><td><button type="button" class="sg-del" data-a="del-cifra" aria-label="Quitar ${esc(c.name)}">✕</button></td></tr>`).join('')}</tbody></table></div><button type="button" class="sg-btn" data-a="add-cifra">+ Añadir una cifra</button>`}`; return; }
    if (tab === 'voz') { pane.innerHTML = `<p class="sg-lead">Cómo habla tu marca: el tono, las palabras que usa y las que nunca, cómo firma. Todos los agentes la leen. Se guarda como la nota «voice» del Cerebro.</p>${voice === null ? '<p>Leyendo…</p>' : `<label for="sgVoice" class="sg-l">Voz de marca</label><textarea id="sgVoice" rows="16">${esc(voice)}</textarea>`}`; return; }
    if (tab === 'empresa') { pane.innerHTML = `<p class="sg-lead">Dame tu web y la oficina la lee: escribe en el Cerebro el perfil de tu empresa, tu oferta y precios, tu voz y las preguntas frecuentes; da instrucciones a cada jefe que aún no las tenga y propone cifras para confirmar. Tarda unos minutos; te aviso al terminar.</p>
      <div class="sg-f"><label for="sgUrl">Tu web</label><input id="sgUrl" type="url" placeholder="https://panaclaw.com" inputmode="url"></div>
      <div class="sg-f"><label for="sgAbout">Lo que la web no dice (opcional)</label><textarea id="sgAbout" rows="4" placeholder="A quién le vendes, qué te diferencia, qué nunca prometes…"></textarea></div>
      <button type="button" class="sg-btn pri" data-a="bootstrap">Leer mi web y preparar la oficina</button>`; return; }
    const fs = data.fields.filter(f => f.group === tab);
    const extra = tab === 'avisos' ? `<p class="sg-lead">Telegram: ${data.telegram.on ? `encendido (${data.telegram.owners} dueño${data.telegram.owners === 1 ? '' : 's'})` : 'apagado — se enciende con dos variables de entorno; mira docs/telegram.md'}. Webhooks: ${data.hookToken ? 'con clave' : 'sin clave AO_HOOK_TOKEN'}.</p>` : tab === 'general' ? `<p class="sg-lead">Estos ajustes se guardan en <code>${esc(data.localFile)}</code>: son de esta máquina y ganan sobre los del equipo. ${data.embeddings ? 'Búsqueda por significado: ' + esc(data.embeddings) + '.' : 'Búsqueda por significado: apagada (se enciende sola si hay GEMINI_API_KEY, OPENAI_API_KEY o VOYAGE_API_KEY).'}</p>` : '';
    pane.innerHTML = extra + fs.map(field).join('');
  }
  async function load() {
    if (!served) return render();
    try { const r = await fetch('/api/settings'); data = await r.json(); } catch { msg('Sin conexión con la oficina.', true); }
    render();
  }
  async function loadTab() {
    if (tab === 'cifras' && cifras === null) { try { cifras = (await (await fetch('/api/cifras')).json()).items; } catch { cifras = []; } render(); }
    if (tab === 'voz' && voice === null) { try { voice = (await (await fetch('/api/voice')).json()).text; } catch { voice = ''; } render(); }
  }
  function collect() {
    for (const i of el.querySelectorAll('.sg-pane [data-p]')) {
      const p = i.dataset.p, f = data.fields.find(x => x.path === p); if (!f) continue;
      let v;
      if (f.type === 'bool') v = i.checked;
      else if (f.type === 'depts') v = [...el.querySelectorAll(`[data-p="${p}"][data-d]`)].filter(x => x.checked).map(x => x.dataset.d);
      else if (f.type === 'people') v = readPeople();
      else if (f.type === 'list') v = i.value.split('\n').map(s => s.trim()).filter(Boolean);
      else v = i.value;
      // V4.5: only what changed goes to the server — an empty number keeps its default (it was sent as 0, and «0» now means
      // «sin tope» for the Estudio), an untouched switch or list stays unset instead of being written as off or empty
      const o = data.values[p];
      const same = f.type === 'number' ? v === '' || (o != null && +v === +o)
        : f.type === 'bool' ? (o == null ? !v : !!o === v)
        : Array.isArray(v) ? (o == null && !v.length) || JSON.stringify(v) === JSON.stringify(o)
        : String(v) === String(o ?? '');
      if (same) delete dirty[p]; else dirty[p] = v;
    }
  }
  const readCifras = () => [...el.querySelectorAll('.sg-cif tbody tr')].map(tr => Object.fromEntries([...tr.querySelectorAll('[data-c]')].map(i => [i.dataset.c, i.value.trim()])));
  async function save() {
    if (tab === 'cifras') { const r = await fetch('/api/cifras', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: readCifras() }) }); const j = await r.json(); if (r.ok) { cifras = j.items; render(); msg(`Guardadas ${j.items.length} cifras. Los agentes las usan desde su próxima tarea.`); } else msg(j.error || 'No se pudo.', true); return; }
    if (tab === 'voz') { const r = await fetch('/api/voice', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: el.querySelector('#sgVoice').value }) }); const j = await r.json(); if (r.ok) msg('Guardada. Los agentes hablan así desde su próxima tarea.'); else msg(j.error || 'No se pudo.', true); return; }
    collect(); if (!Object.keys(dirty).length) return msg('No hay cambios.');
    const r = await fetch('/api/settings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ changes: dirty }) }); const j = await r.json();
    if (j.errors?.length) msg(j.errors.join(' · '), true); else msg(j.restart ? 'Guardado. Algunos cambios (↻) se aplican al reiniciar la oficina.' : 'Guardado y aplicado.');
    dirty = {}; await load();
  }
  function showTab(t) { if (t === tab) return; collect(); tab = t; render(); loadTab(); el.querySelector(`[data-tab="${tab}"]`)?.focus(); }
  function open(at) { if (!el.hidden) { if (at) showTab(at); return; } opener = document.activeElement; if (at) tab = at; el.hidden = false; modal.open(el); btn?.setAttribute('aria-expanded', 'true'); msg(''); load().then(loadTab); requestAnimationFrame(() => el.classList.add('on')); el.querySelector('.sg-x').focus({ preventScroll: true }); }
  function close() { if (el.hidden) return; if (el.contains(document.activeElement)) document.activeElement.blur(); modal.close(el); el.classList.remove('on'); el.hidden = true; btn?.setAttribute('aria-expanded', 'false'); dirty = {}; if (opener && document.contains(opener) && opener.focus) opener.focus({ preventScroll: true }); }
  el.addEventListener('click', async e => {
    if (e.target === el || e.target.closest('.sg-x')) return close();
    const t = e.target.closest('[data-tab]'); if (t) { showTab(t.dataset.tab); return; }
    const kr = e.target.closest('.ks-row[data-key]'); if (kr) { close(); if (runKey) runKey(kr.dataset.key); return; } // a shortcut pressed from the list does what the key does
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'save') return save();
    if (a === 'add-person') { collect(); const p = data.fields.find(f => f.type === 'people').path; dirty[p] = [...readPeople(), { name: '', telegram: '', depts: [] }]; render(); const rows = el.querySelectorAll('.sg-person [data-k=name]'); rows[rows.length - 1]?.focus(); return; }
    if (a === 'del-person') { e.target.closest('.sg-person').remove(); return; }
    if (a === 'add-cifra') { cifras = [...readCifras(), { name: '', value: '', unit: '', note: '' }]; render(); const r = el.querySelectorAll('.sg-cif [data-c=name]'); r[r.length - 1]?.focus(); return; }
    if (a === 'del-cifra') { e.target.closest('tr').remove(); return; }
    if (a === 'bootstrap') { const b = e.target.closest('button'); b.disabled = true; const r = await fetch('/api/onboard/company', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: el.querySelector('#sgUrl').value.trim(), about: el.querySelector('#sgAbout').value.trim() }) }); const j = await r.json(); b.disabled = false; msg(r.ok ? 'En marcha: te aviso en el semáforo (y por Telegram) cuando termine.' : j.error || 'No se pudo.', !r.ok); }
  });
  el.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
    const t = e.target.closest('[role=tab]'); if (t && (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); const l = [...el.querySelectorAll('[role=tab]')], i = l.indexOf(t), n = l[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + l.length) % l.length]; n.click(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); }
  });
  el.addEventListener('change', e => { // Apariencia: the theme applies at once, remembered in this browser
    if (e.target.name !== 'sgTheme' || !theme) return;
    theme.set(e.target.value); msg(`Tema: ${THEME_NAME[e.target.value] || e.target.value}. Se recuerda en este navegador.`);
  });
  btn?.addEventListener('click', () => (el.hidden ? open() : close()));
  return { open, close, toggle: () => (el.hidden ? open() : close()), isOpen: () => !el.hidden, tab: () => tab };
}
