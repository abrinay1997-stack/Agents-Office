// Versión móvil (25 oct 2026) — DELEGAR una tarea tuya: a un agente (de un departamento, o «el que elija la oficina») o a una persona del
// equipo, con una nota y si debe pedirte el OK antes de enviar nada. Una hoja con los botones a mano del pulgar. DESHACER la devuelve a tu lista.
import { esc } from '../ui.js';
import { DEPTS, personas, hacer, recorte, interruptor, alternar } from './tareas-comun.js';

export async function abrirDelegar(ctx, t, { alTerminar = () => {}, ultimoDept = '' } = {}) {
  const [ags, pers] = await Promise.all([ctx.store.agentes(), personas(ctx)]);
  const origen = ags.find(a => a.id === t.deAgente) || null, dept0 = t.dept || origen?.department || ultimoDept || 'marketing';
  let modo = 'agente';
  const opcionesAgente = dept => `<option value="">El que elija la oficina</option>${ags.filter(a => a.department === dept).map(a => `<option value="${esc(a.id)}"${origen?.id === a.id ? ' selected' : ''}>${esc(a.name)}${a.lead ? ' (jefe)' : ''}${origen?.id === a.id ? ' — la tenía' : ''}</option>`).join('')}`;
  const cuerpo = `<div class="mv-deleg">
    ${pers.length ? `<div class="mv-seg mv-seg-in" role="group" aria-label="A quién se la pasas"><button type="button" data-modo="agente" aria-pressed="true">Un agente</button><button type="button" data-modo="persona" aria-pressed="false">Una persona</button></div>` : ''}
    <div data-parte="agente"><label class="mv-lab" for="mvDgD">Departamento</label><select id="mvDgD" class="mv-campo">${Object.entries(DEPTS).map(([k, n]) => `<option value="${k}"${k === dept0 ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>
      <label class="mv-lab" for="mvDgA">Agente</label><select id="mvDgA" class="mv-campo">${opcionesAgente(dept0)}</select></div>
    <div data-parte="persona" hidden><label class="mv-lab" for="mvDgP">Persona</label><select id="mvDgP" class="mv-campo">${pers.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('')}</select></div>
    <label class="mv-lab" for="mvDgN">Lo que tiene que saber (opcional)</label><textarea id="mvDgN" class="mv-campo" rows="3" maxlength="600" placeholder="El contexto, el resultado que esperas, el límite…"></textarea>
    <div data-parte="agente" class="mv-sw-fila">${interruptor('mvDgOk', 'Que me pida el OK', true, 'Antes de enviar o publicar nada, espera tu visto bueno.')}</div>
    <p class="mv-meta" data-pista>«${esc(recorte(t.title, 60))}» sale de tu lista y la sigues en Delegadas.</p></div>`;
  const h = ctx.hoja({ titulo: 'Delegar', cuerpo, acciones: [{ texto: 'Cancelar', alTocar: x => x.cerrar() }, {
    texto: 'Delegar', tipo: 'primario', alTocar: async (x, b) => {
      const c = x.cuerpo, val = id => c.querySelector('#' + id)?.value || '';
      const cuerpoPost = modo === 'persona' ? { a: 'persona', persona: val('mvDgP'), nota: val('mvDgN') } : { a: 'agente', dept: val('mvDgD'), agente: val('mvDgA') || undefined, nota: val('mvDgN'), needsOk: c.querySelector('#mvDgOk').getAttribute('aria-checked') === 'true' };
      const prev = { deAgente: t.deAgente || null };
      const r = await hacer(ctx, b, () => ctx.api(`/api/tareas/${t.id}/delegar`, { method: 'POST', body: cuerpoPost }), {
        ocupado: 'Delegando…', hecho: 'Delegada', ms: 400,
        aviso: j => `Delegada: «${recorte(t.title)}» → ${modo === 'persona' ? j.a : ags.find(a => a.id === j.a)?.name || 'el agente'}${j.como === 'enrutador' ? ' (la eligió la oficina)' : ''}.`,
        deshacer: () => ctx.api(`/api/tareas/${t.id}/tomar`, { method: 'POST', body: { deshacer: true, ...prev } }),
        despues: v => { if (v) alTerminar(cuerpoPost.dept); else alTerminar(); },
      });
      if (r.ok) setTimeout(() => x.cerrar(), 450);
    } }] });
  const c = h.cuerpo;
  c.querySelector('#mvDgD')?.addEventListener('change', e => { c.querySelector('#mvDgA').innerHTML = opcionesAgente(e.target.value); });
  c.addEventListener('click', e => {
    const m = e.target.closest('[data-modo]'); if (m) { modo = m.dataset.modo; for (const b of c.querySelectorAll('[data-modo]')) b.setAttribute('aria-pressed', String(b === m)); c.querySelectorAll('[data-parte="agente"]').forEach(n => { n.hidden = modo !== 'agente'; }); c.querySelector('[data-parte="persona"]').hidden = modo !== 'persona'; return; }
    const sw = e.target.closest('[role="switch"]'); if (sw) alternar(sw);
  });
  return h;
}
