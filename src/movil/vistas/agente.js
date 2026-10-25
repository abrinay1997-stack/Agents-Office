// Versión móvil (25 oct 2026) — LA FICHA DE UN AGENTE: quién es (nombre, rol, qué hace, su brief con contador de 2.000 caracteres, modelo y
// esfuerzo), sus skills, la biblioteca de habilidades, las lecciones que aprendió (se pueden olvidar), su historial y las versiones de su
// brief y sus skills (con «Volver a esta»). Las secciones se pliegan; GUARDAR queda fijo abajo y el cambio vale desde la próxima tarea.
// Se llega desde Ajustes → Agentes. Usa GET/PATCH /api/agents/<id> (las mismas que la ficha de escritorio).
import { esc, svg, esqueleto, falla, hace } from '../ui.js';
import { conEstado } from '../../accion.js';
import { mdToHtml } from '../../md.js';
import { MODEL_KEYS, modelName, EFFORT_KEYS, EFFORT_NAME } from '../../models.js';

const ESTADO = { next: 'en cola', scheduled: 'programada', doing: 'en curso', waiting: 'espera tu OK', done: 'lista' };
const cuando = at => new Date(at).toLocaleString('es-PA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const CAMPOS = ['#agNom', '#agRol', '#agDoes', '#agBrief', '#agModelo', '#agEsf', '#agTools'];

export function registrar(shell) {
  shell.registrarVista({
    id: 'agente', titulo: 'Agente', icono: 'persona', grupo: 'oculta',
    montar(el, ctx) {
      el.innerHTML = '<div class="mv-scroll"><div class="mv-cuerpo mv-form" aria-live="polite"></div></div><footer class="mv-guardar" hidden><span class="mv-gst" role="status" aria-live="polite"></span><button type="button" class="mv-btn primario ac" data-guardar>Guardar</button></footer>';
      const cuerpo = el.querySelector('.mv-cuerpo'), pie = el.querySelector('.mv-guardar'), gst = el.querySelector('.mv-gst'), btn = el.querySelector('[data-guardar]');
      let id = null, d = null, err = '', snap = '', versiones = [], abiertas = { quien: true }, bib = {}, borrador = null;
      const snapDe = a => [a.name, a.role || '', a.does || '', String(a.brief || ''), a.model || '', a.effort || '', (a.tools || []).join(', ')].join('\u0001');
      const tomar = () => { const q = s => cuerpo.querySelector(s)?.value ?? ''; return { ...d.agent, name: q('#agNom'), role: q('#agRol'), does: q('#agDoes'), brief: q('#agBrief'), model: q('#agModelo'), effort: q('#agEsf'), tools: q('#agTools').split(',').map(x => x.trim()).filter(Boolean) }; };
      const ahora = () => CAMPOS.map(c => cuerpo.querySelector(c)?.value ?? '').join('\u0001');
      const sucio = () => !!d && !!cuerpo.querySelector('#agNom') && ahora() !== snap;
      const marcar = () => { const n = sucio(); pie.classList.toggle('sucio', n); const c = cuerpo.querySelector('#agBrief'), k = cuerpo.querySelector('.mv-cont'); if (c && k) k.textContent = `${c.value.length} / 2000`; if (n) { gst.textContent = 'Sin guardar'; gst.className = 'mv-gst sin'; } else if (!gst.classList.contains('ok')) gst.textContent = ''; };
      const avisarSalir = e => { if (!el.hidden && sucio()) { e.preventDefault(); e.returnValue = ''; } }; addEventListener('beforeunload', avisarSalir); el._off = () => removeEventListener('beforeunload', avisarSalir);

      async function cargar(quien, fresco) {
        if (quien !== id || fresco) { id = quien; d = null; versiones = []; }
        try { d = await ctx.api('/api/agents/' + encodeURIComponent(id)); err = ''; } catch (e) { err = e.message; d = null; }
        pintar(); if (d) traerVersiones(id);
      }
      async function traerVersiones(quien) {
        const items = [...(d.skills || []).filter(k => k.source !== 'shipped').map(k => ({ kind: 'skill', name: k.name })), { kind: 'brief', name: quien }];
        const got = await Promise.all(items.map(it => ctx.api(`/api/history?kind=${it.kind}&name=${encodeURIComponent(it.name)}`).then(j => ({ ...it, versions: j.versions || [] })).catch(() => ({ ...it, versions: [] }))));
        if (quien !== id || !d) return; versiones = got.filter(x => x.versions.length);
        const box = cuerpo.querySelector('#agVers'); if (box) box.innerHTML = versionesHTML();
        const c = cuerpo.querySelector('[data-cuenta-v]'); if (c) c.textContent = versiones.reduce((n, x) => n + x.versions.length, 0) || '';
      }
      const versionesHTML = () => versiones.length ? versiones.map(x => `<p class="mv-lab">${x.kind === 'skill' ? 'Skill «' + esc(x.name) + '»' : 'Su brief'}</p><ul class="mv-calidad">${x.versions.map((v, i) => `<li><span><b>${esc(cuando(v.at))}${i === 0 ? ' · la actual' : ''}</b><small>${esc(v.preview)}…</small></span>${i ? `<button type="button" class="mv-btn ac" data-restaurar data-kind="${x.kind}" data-name="${esc(x.name)}" data-at="${v.at}">Volver a esta</button>` : ''}</li>`).join('')}</ul>`).join('') : '<p class="mv-meta">La oficina guarda cada versión de su brief y de sus skills desde que empieza a verlas; aparecen aquí cuando cambien.</p>';
      const sec = (k, t, cuerpoS, n) => `<details class="mv-sec" data-k="${k}"${abiertas[k] ? ' open' : ''}><summary><span>${t}</span>${n !== undefined ? `<b${k === 'versiones' ? ' data-cuenta-v' : ''}>${n}</b>` : ''}</summary><div class="mv-sec-c">${cuerpoS}</div></details>`;
      function pintar() {
        if (!d) { cuerpo.innerHTML = err ? falla(err) : esqueleto(5); pie.hidden = true; return; }
        const a = d.agent, v = borrador || a; ctx.cabecera({ titulo: a.name });
        const quien = `<div class="mv-cm"><label class="mv-lab" for="agNom">Nombre (el cartel del escritorio)</label><input id="agNom" maxlength="32" autocomplete="off" value="${esc(v.name)}"></div>
          <div class="mv-cm"><label class="mv-lab" for="agRol">Rol</label><input id="agRol" maxlength="80" autocomplete="off" value="${esc(v.role || '')}"></div>
          <div class="mv-cm"><label class="mv-lab" for="agDoes">Qué hace <small class="mv-ayuda">Lo lee antes de cada tarea; Dimitri y el jefe reparten por esto.</small></label><textarea id="agDoes" rows="4" maxlength="400">${esc(v.does || '')}</textarea></div>
          <div class="mv-cm"><label class="mv-lab" for="agBrief">Instrucciones permanentes (brief) <span class="mv-cont"></span></label><textarea id="agBrief" rows="9" maxlength="2000" placeholder="Lo que siempre debe tener en cuenta. Si tiene pasos o una plantilla, mejor una skill.">${esc(v.brief || '')}</textarea></div>
          <div class="mv-dos"><div class="mv-cm"><label class="mv-lab" for="agModelo">Modelo</label><select id="agModelo"><option value="">El de la oficina</option>${MODEL_KEYS.map(k => `<option value="${k}"${v.model === k ? ' selected' : ''}>${esc(modelName(k))}</option>`).join('')}</select></div>
          <div class="mv-cm"><label class="mv-lab" for="agEsf">Esfuerzo</label><select id="agEsf"><option value="">El de la oficina</option>${EFFORT_KEYS.map(k => `<option value="${k}"${v.effort === k ? ' selected' : ''}>${esc(EFFORT_NAME[k] || k)}</option>`).join('')}</select></div></div>
          <div class="mv-cm"><label class="mv-lab" for="agTools">Conectores habituales <small class="mv-ayuda">Separados por coma; los que usa primero.</small></label><input id="agTools" autocomplete="off" autocapitalize="none" spellcheck="false" value="${esc((v.tools || []).join(', '))}"></div>
          <p class="mv-meta">Tiene acceso a: ${d.connectors.length ? esc(d.connectors.join(', ')) : 'ningún conector conectado'}${d.studio ? ' · Estudio (imágenes y video)' : ''}${d.contenido ? ' · Contenido (deja borradores; tú los apruebas)' : ''}. Los cambios valen desde la próxima tarea.</p>`;
        const skills = d.skills.length ? d.skills.map(s => `<details class="mv-det"><summary><b>${esc(s.name)}</b>${s.description ? ' — ' + esc(s.description) : ''}${s.everyone ? ' <i>(toda la oficina)</i>' : ''}</summary><div class="md mv-md">${mdToHtml(s.text || '')}</div>${s.files.length ? `<p class="mv-meta">Archivos: ${esc(s.files.join(', '))}</p>` : ''}</details>`).join('') + '<p class="mv-meta">Para cambiar una skill, dile al jefe del departamento «configurar» o «esto lo hacemos así».</p>' : '<p class="mv-meta">Sin skills todavía. Escribe «configurar» al jefe del departamento para crear una.</p>';
        const bl = d.biblioteca || [], hab = h => `<details class="mv-det" data-hab="${esc(h.id)}"><summary><b>${esc(h.titulo)}</b> — ${esc(h.description.replace(/^Úsala cuando\s*/i, 'cuando '))}${h.fuente === 'cerebro' ? ' <i>(tu versión)</i>' : ''}</summary><div class="md mv-md">${bib[h.id] ? mdToHtml(bib[h.id]) : '<p class="mv-meta">Cargando…</p>'}</div></details>`;
        const suyas = bl.filter(h => h.suya), depto = bl.filter(h => !h.suya);
        const biblio = bl.length ? `${suyas.length ? `<p class="mv-lab">De su puesto</p>${suyas.map(hab).join('')}` : ''}${depto.length ? `<p class="mv-lab">De su departamento</p>${depto.map(hab).join('')}` : ''}<p class="mv-meta">No las lee todas en cada tarea: la que encaja con el pedido se le adelanta entera y el resto lo pide cuando le hace falta.</p>` : '<p class="mv-meta">Su departamento todavía no tiene habilidades en la biblioteca.</p>';
        const L = d.lessons, linea = t => `<li><span>${esc(t)}</span><button type="button" class="mv-ic" data-olvidar="${esc(t)}" aria-label="Olvidar esta lección: ${esc(t.slice(0, 60))}">${svg('cerrar')}</button></li>`;
        const lec = (L.rules.length || L.oneOffs.length) ? `${L.rules.length ? `<p class="mv-lab">Reglas que sigue siempre</p><ul class="mv-lecc">${L.rules.map(linea).join('')}</ul>` : ''}${L.oneOffs.length ? `<p class="mv-lab">Correcciones puntuales</p><ul class="mv-lecc">${L.oneOffs.map(linea).join('')}</ul>` : ''}` : '<p class="mv-meta">Aún no aprendió nada. Cada vez que devuelves un trabajo con una nota, la corrección queda aquí.</p>';
        const st = d.stats, hist = `<div class="mv-dos-t mv-stats"><div class="mv-card"><b>${st.done}</b><small>listas</small></div><div class="mv-card"><b>${st.failed}</b><small>con error</small></div><div class="mv-card"><b>${st.waiting}</b><small>esperan tu OK</small></div><div class="mv-card"><b>${st.avgMinutes ?? '—'}</b><small>min de promedio</small></div></div>` +
          (d.recent.length ? `<ul class="mv-lista">${d.recent.map(t => `<li><button type="button" class="mv-lista-b" data-tarea="${esc(t.id)}"><span><b>${esc(t.title)}</b><small>${t.error ? 'con error' : ESTADO[t.state] || esc(t.state)}</small></span>${svg('der', 'mv-der')}</button></li>`).join('')}</ul>` : '<p class="mv-meta">Sin tareas todavía.</p>');
        cuerpo.innerHTML = `<p class="mv-meta mv-quien">${esc(a.role || '')}${a.lead ? ' · jefe del departamento' : ''}</p>${sec('quien', 'Quién es', quien)}${sec('skills', 'Skills', skills, d.skills.length)}${sec('biblio', 'Biblioteca de habilidades', biblio, bl.length || undefined)}${sec('lecc', 'Lecciones aprendidas', lec, L.rules.length + L.oneOffs.length)}${sec('hist', 'Historial', hist, st.done + st.failed)}${sec('versiones', 'Versiones de su brief y sus skills', '<div id="agVers">' + versionesHTML() + '</div>', versiones.reduce((n, x) => n + x.versions.length, 0) || '')}`;
        pie.hidden = false; snap = snapDe(a); borrador = null; marcar(); const b = cuerpo.querySelector('#agBrief'); if (b) cuerpo.querySelector('.mv-cont').textContent = `${b.value.length} / 2000`;
      }
      async function guardar() {
        const q = s => cuerpo.querySelector(s).value, patch = { name: q('#agNom').trim(), role: q('#agRol').trim(), does: q('#agDoes').trim(), brief: q('#agBrief').trim(), model: q('#agModelo'), effort: q('#agEsf'), tools: q('#agTools').split(',').map(x => x.trim().toLowerCase()).filter(Boolean) };
        if (!patch.name) throw new Error('El nombre no puede quedar vacío.');
        const j = await ctx.api('/api/agents/' + encodeURIComponent(id), { method: 'PATCH', body: patch });
        d.agent = j.agent; ctx.store.agentes().then(() => {}); return { hecho: 'Guardado. Vale desde la próxima tarea.' };
      }
      async function alGuardar() {
        if (!sucio()) { ctx.toast('No hay cambios que guardar.'); return true; }
        gst.textContent = 'Guardando…'; gst.className = 'mv-gst';
        const r = await conEstado(btn, guardar, { ocupado: 'Guardando…', hecho: 'Guardado ✓' });
        if (r.ok) { borrador = null; pintar(); gst.textContent = r.valor.hecho; gst.className = 'mv-gst ok'; pie.classList.remove('sucio'); setTimeout(() => { if (gst.classList.contains('ok')) { gst.textContent = ''; gst.className = 'mv-gst'; } }, 5000); } else { gst.textContent = 'Sin guardar'; gst.className = 'mv-gst sin'; }
        return r.ok;
      }
      btn.addEventListener('click', alGuardar);
      cuerpo.addEventListener('input', marcar); cuerpo.addEventListener('change', marcar);
      cuerpo.addEventListener('toggle', e => {
        const s = e.target.closest?.('.mv-sec'); if (s && e.target === s) abiertas[s.dataset.k] = s.open;
        const h = e.target.closest?.('[data-hab]'); if (h && e.target === h && h.open && !bib[h.dataset.hab]) { const hid = h.dataset.hab; ctx.api('/api/biblioteca/' + encodeURIComponent(hid)).then(j => { bib[hid] = j.texto || j.error || ''; const c = cuerpo.querySelector(`[data-hab="${CSS.escape(hid)}"] .mv-md`); if (c) c.innerHTML = mdToHtml(bib[hid]); }).catch(() => {}); }
      }, true);
      cuerpo.addEventListener('click', async e => {
        if (e.target.closest('[data-reintentar]')) return cargar(id, true);
        const t = e.target.closest('[data-tarea]'); if (t) return ctx.navegar('tareas', { t: t.dataset.tarea });
        const o = e.target.closest('[data-olvidar]'); if (o) {
          if (!(await ctx.confirmar({ titulo: '¿Olvidar esta lección?', texto: o.dataset.olvidar.slice(0, 200), ok: 'Olvidarla', peligro: true }))) return;
          try { const j = await ctx.api(`/api/agents/${encodeURIComponent(id)}/forget`, { method: 'POST', body: { line: o.dataset.olvidar } }); d.lessons = j.lessons; if (sucio()) borrador = tomar(); pintar(); ctx.toast('Olvidada.'); } catch (x) { ctx.toast('No se pudo: ' + x.message); } return;
        }
        const r = e.target.closest('[data-restaurar]'); if (r) {
          if (!(await ctx.confirmar({ titulo: '¿Volver a esta versión?', texto: `La del ${cuando(+r.dataset.at)}. La actual queda guardada en el historial.`, ok: 'Volver a esta' }))) return;
          const x = await conEstado(r, () => ctx.api('/api/history/restore', { method: 'POST', body: { kind: r.dataset.kind, name: r.dataset.name, at: +r.dataset.at } }), { ocupado: 'Restaurando…', hecho: 'Restaurada ✓', ms: 700 }); if (x.ok) setTimeout(() => cargar(id, true), 800);
        }
      });
      // salir con cambios: se pregunta (la ficha pierde lo escrito si no se guarda)
      shell.raiz.querySelector('.mv-atras')?.addEventListener('click', e => {
        if (el.hidden || !sucio()) return; e.stopImmediatePropagation(); e.preventDefault();
        ctx.hoja({ titulo: 'Tienes cambios sin guardar', cuerpo: `<p class="mv-texto">En la ficha de ${esc(d.agent.name)}. ¿Qué hago con ellos?</p>`, acciones: [
          { texto: 'Guardar y salir', tipo: 'primario', alTocar: async hh => { hh.cerrar(); if (await alGuardar()) setTimeout(() => ctx.volver(), 260); } },
          { texto: 'Descartar', tipo: 'peligro', alTocar: hh => { borrador = null; snap = ahora(); hh.cerrar(); setTimeout(() => ctx.volver(), 260); } },
          { texto: 'Seguir editando', alTocar: hh => hh.cerrar() }] });
      }, true);
      el._cargar = cargar; el._id = () => id; el._guardarBorrador = () => { if (d && sucio()) { borrador = tomar(); return d.agent.name; } return null; };
      cuerpo.innerHTML = esqueleto(5);
    },
    desmontar(el) { el._off?.(); },
    alMostrar(el, ctx, p) { if (p?.id) el._cargar(p.id, false); },
    alOcultar(el, ctx) { const n = el._guardarBorrador?.(); if (n) ctx.toast(`Quedaron cambios sin guardar en la ficha de ${n}.`, { accion: 'Revisar', alAccion: () => ctx.navegar('agente', { id: el._id?.() }) }); },
  });
}
