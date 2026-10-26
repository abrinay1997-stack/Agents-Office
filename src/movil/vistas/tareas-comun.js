// Versión móvil (25 oct 2026) — lo que comparten las pantallas de TAREAS: los textos de los estados, el catálogo (proyectos y
// etiquetas), las personas del equipo, y `hacer`: UN botón que dispara una petición con su estado visible (Un momento… → ✓ → o el
// motivo y «Reintentar») y, si se puede deshacer, el aviso con DESHACER. Nada de esto toca el escritorio.
import { conEstado } from '../../accion.js';
import { esc, svg as _svg, limiteTexto as _lim } from '../ui.js';
import { visible as _visible } from '../../../tareas/estados.mjs';
import { esNombreMio, esMia } from '../../../tareas/identidad.mjs';

export const ESTADO_AG = { espera_ok: 'Esperan tu OK', en_curso: 'En curso', en_cola: 'En cola', programada: 'Programadas', bloqueada: 'Bloqueadas', idea: 'Ideas', en_manos: 'En manos de una persona', fallida: 'Fallaron', tuya: 'Tuyas', hecha: 'Hechas' };
export const ESTADO_UNO = { espera_ok: 'Espera tu OK', en_curso: 'En curso', en_cola: 'En cola', programada: 'Programada', bloqueada: 'Bloqueada', idea: 'Idea', en_manos: 'En manos de una persona', fallida: 'Falló', tuya: 'Tuya', hecha: 'Hecha' };
export const DEPTS = { emails: 'Correos', sales: 'Ventas', marketing: 'Marketing', ops: 'Operaciones', fin: 'Finanzas', delivery: 'Entregas' };
export const COLOR_PROY = { azul: '#1F5FD1', verde: '#1E7B4F', ambar: '#B8860B', rojo: '#B3261E', violeta: '#6B3FA0', cian: '#0F7C8C', rosa: '#B3366D', gris: '#6B6B66' };

/** El catálogo de proyectos y etiquetas (con el progreso de cada proyecto): se guarda 20 s por pantalla. */
export async function catalogo(ctx, fresco = false) {
  const c = ctx._cat; if (!fresco && c && Date.now() - c.at < 20e3) return c.v;
  const v = await ctx.api('/api/tareas/catalogo'); ctx._cat = { at: Date.now(), v }; return v;
}
export const olvidarCatalogo = ctx => { ctx._cat = null; };
/** La gente a quien se le puede asignar una tarea (26 oct 2026): las cuentas de la plataforma (administradores, editores…) y las personas de Ajustes → Equipo.
 *  → { people: [{ name, usuario?, rol? }], yo } — `yo` es la cuenta que mira (solo en la nube). Se pide una vez por pantalla. */
export async function gente(ctx) {
  if (ctx._gente) return ctx._gente;
  try { const j = await ctx.api('/api/team'); ctx._gente = { people: (j.people || []).filter(p => p && p.name), yo: j.yo || null }; } catch { ctx._gente = { people: [], yo: null }; }
  return ctx._gente;
}
/** Los nombres a quienes pasarle una tarea: todos menos yo (pasármela a mí es «Para mí»). */
export async function personas(ctx) { return (await gente(ctx)).people.map(p => p.name).filter(n => !esNombreMio(n)); }
/** Los <option> de «Para quién»: Para mí · las personas del equipo (con su rol si es una cuenta) · un agente de cada departamento. `valor` es el seleccionado. */
export function opcionesPara(g, { agentes = true, valor = 'yo', yoTexto = 'Para mí' } = {}) {
  const otros = g.people.filter(p => !esNombreMio(p.name)), rol = { admin: 'administrador', editor: 'editor', lectura: 'solo lectura' };
  const op = (v, t) => `<option value="${esc(v)}"${v === valor ? ' selected' : ''}>${esc(t)}</option>`;
  return op('yo', yoTexto)
    + (otros.length ? `<optgroup label="Personas del equipo">${otros.map(p => op('p:' + p.name, p.name + (p.usuario && rol[p.rol] ? ` (${rol[p.rol]})` : ''))).join('')}</optgroup>` : '')
    + (agentes ? `<optgroup label="Un agente de…">${Object.entries(DEPTS).map(([k, n]) => op(k, n)).join('')}</optgroup>` : '');
}
/** Lo que se le dice a quien elige, según el destino. */
export const ayudaPara = (v, base = 'Queda en tu lista.') => (v === 'yo' ? base : String(v).startsWith('p:') ? `Se la asignas a ${String(v).slice(2)}: le sale en su lista de Mías y tú la sigues en Delegadas.` : 'Un agente la hace; lo que envíe espera tu OK.');

/**
 * Un botón que hace algo con estado visible.
 *   hacer(ctx, boton, () => promesa, { ocupado, hecho, aviso: 'Hecha: …' | fn(resultado), deshacer: () => promesa, antes, despues })
 * → { ok, valor }. Si falla, el botón dice el motivo y «Reintentar» (conEstado). Si pasa y hay `deshacer`, el aviso lo ofrece.
 */
export async function hacer(ctx, boton, fn, o = {}) {
  const r = await conEstado(boton, fn, { ocupado: o.ocupado || 'Un momento…', hecho: o.hecho || 'Hecho', ms: o.ms ?? 1200 });
  if (r.ok) {
    const texto = typeof o.aviso === 'function' ? o.aviso(r.valor) : o.aviso;
    if (texto) ctx.toast(texto, o.deshacer ? { accion: 'Deshacer', alAccion: async () => { try { await o.deshacer(r.valor); ctx.toast('Deshecho.'); } catch (e) { ctx.toast('No se pudo deshacer: ' + e.message); } o.despues?.(); } } : {});
    o.despues?.(r.valor);
  }
  return r;
}
/** Lo mismo sin botón (un gesto, una fila): hace, avisa con DESHACER y dice el motivo si falla. */
export async function hacerYa(ctx, fn, o = {}) {
  try {
    const v = await fn();
    const texto = typeof o.aviso === 'function' ? o.aviso(v) : o.aviso;
    if (texto) ctx.toast(texto, o.deshacer ? { accion: 'Deshacer', alAccion: async () => { try { await o.deshacer(v); ctx.toast('Deshecho.'); } catch (e) { ctx.toast('No se pudo deshacer: ' + e.message); } o.despues?.(); } } : {});
    o.despues?.(v);
    return { ok: true, valor: v };
  } catch (e) { ctx.toast('No se pudo: ' + e.message, o.reintentar ? { accion: 'Reintentar', alAccion: () => hacerYa(ctx, fn, o) } : {}); return { ok: false, error: e.message }; }
}

export const recorte = (s, n = 38) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));
/** Una pastilla de elección: botón de 44 px que se enciende (aria-pressed). */
export const pastilla = (txt, attrs, on) => `<button type="button" class="mv-chip" ${attrs} aria-pressed="${!!on}">${esc(txt)}</button>`;
/** Un interruptor con texto (nunca solo color): <button role="switch">. */
export const interruptor = (id, txt, on, ayuda = '') => `<button type="button" class="mv-sw" role="switch" id="${id}" aria-checked="${!!on}"><span><b>${esc(txt)}</b>${ayuda ? `<small>${esc(ayuda)}</small>` : ''}</span><i aria-hidden="true"></i></button>`;
export function alternar(btn) { const on = btn.getAttribute('aria-checked') !== 'true'; btn.setAttribute('aria-checked', String(on)); return on; }

/** Una tarea en una fila de lista que se toca para abrirla: título y debajo «estado · agente · vence…». */
export function filaMini(t, { porId, ags = [] } = {}) {
  const v = _visible(t, porId), a = ags.find(x => x.id === t.agent), lim = t.limite ? _lim(t.limite) : '';
  const meta = [esMia(t) ? 'Tuya' : ESTADO_UNO[v] || v, a && a.name, t.person && !esMia(t) && '👤 ' + t.person, lim].filter(Boolean).join(' · ');
  return `<li class="mv-mini-fila"><button type="button" class="mv-lista-b" data-abrir="${esc(t.id)}"><span class="mv-fila-t">${esc(t.title)}<small class="${lim.startsWith('vencida') ? 'rojo' : ''}">${esc(meta)}</small></span>${_svg('der', 'mv-der')}</button></li>`;
}

/** El rótulo corto de un destino ('yo' · 'p:Carla' · 'sales') para el botón «Para…». */
export const paraTexto = v => (v === 'yo' ? 'Para mí' : String(v).startsWith('p:') ? String(v).slice(2) : DEPTS[v] || 'Para mí');
/** La hoja «¿Para quién es?»: Para mí, las personas del equipo (cuentas y Ajustes → Equipo) y, si `agentes`, un agente de cada departamento.
 *  → Promise<string|null>: 'yo' · 'p:Nombre' · la clave de un departamento; null si la cierra sin elegir. */
export function elegirPara(ctx, actual = 'yo', { agentes = true } = {}) {
  return new Promise(async res => {
    const g = await gente(ctx); let hecho = false; const fin = v => { if (!hecho) { hecho = true; res(v); } };
    const otros = g.people.filter(p => !esNombreMio(p.name)), rol = { admin: 'Administrador', editor: 'Editor', lectura: 'Solo lectura' };
    const fila = (v, t, sub) => `<li><button type="button" class="mv-lista-b" data-v="${esc(v)}" aria-pressed="${v === actual}"><span><b>${esc(t)}${v === actual ? ' ✓' : ''}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span></button></li>`;
    const h = ctx.hoja({ titulo: '¿Para quién es?', alCerrar: () => fin(null), cuerpo: `<ul class="mv-lista">${fila('yo', 'Para mí', 'Queda en tu lista')}</ul>
      ${otros.length ? `<h3 class="mv-gh">Personas del equipo <span>${otros.length}</span></h3><ul class="mv-lista">${otros.map(p => fila('p:' + p.name, p.name, (p.usuario && rol[p.rol]) || 'Le sale en su lista de Mías')).join('')}</ul>` : ''}
      ${agentes ? `<h3 class="mv-gh">Un agente de…</h3><ul class="mv-lista">${Object.entries(DEPTS).map(([k, n]) => fila(k, n, 'Lo que envíe espera tu OK')).join('')}</ul>` : ''}` });
    h.cuerpo.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; fin(b.dataset.v); h.cerrar(); });
  });
}
