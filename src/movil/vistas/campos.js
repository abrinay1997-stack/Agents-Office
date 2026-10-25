// Versión móvil (25 oct 2026) — LOS CAMPOS de un formulario de Ajustes, dibujados a partir de las definiciones del servidor (settings.FIELDS: la
// MISMA lista que usa escritorio; aquí no se repite ninguna). Controles nativos y grandes: el interruptor ocupa toda la fila (44 px o más),
// los números abren el teclado numérico, un <select> es el del teléfono, y todo campo mide 16 px o más (así iOS no hace zoom al enfocar).
import { esc } from '../ui.js';
import { lineas } from '../ajustes-core.mjs';

export const DEPT = { emails: 'Correos', sales: 'Ventas', marketing: 'Marketing', ops: 'Operaciones', fin: 'Finanzas', delivery: 'Entregas' };
const idDe = p => 'c-' + p.replace(/\W/g, '-');

/** → HTML de un campo; `v` es su valor (el del borrador o el guardado). */
export function campoHTML(f, v) {
  const id = idDe(f.path), ayuda = f.help ? `<small id="${id}-h" class="mv-ayuda">${esc(f.help)}</small>` : '', desc = f.help ? ` aria-describedby="${id}-h"` : '';
  const reinicia = f.restart ? ' <i class="mv-reinicia" title="Se aplica al reiniciar la oficina">↻ al reiniciar</i>' : '';
  const lab = `<label class="mv-lab" for="${id}">${esc(f.label)}${reinicia}</label>`;
  if (f.type === 'bool') return `<div class="mv-sw"><span class="mv-sw-t"><b>${esc(f.label)}</b>${reinicia}${f.help ? `<small id="${id}-h">${esc(f.help)}</small>` : ''}</span><input type="checkbox" role="switch" id="${id}" data-p="${f.path}" aria-label="${esc(f.label)}"${v ? ' checked' : ''}${desc}><i class="mv-sw-p" aria-hidden="true"></i></div>`;
  if (f.type === 'select') return `<div class="mv-cm">${lab}<select id="${id}" data-p="${f.path}"${desc}>${f.options.map(([k, t]) => `<option value="${esc(k)}"${v === k ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>${ayuda}</div>`;
  if (f.type === 'number') return `<div class="mv-cm">${lab}<input type="number" inputmode="${f.step && f.step < 1 || String(f.step || '').includes('.') ? 'decimal' : 'numeric'}" id="${id}" data-p="${f.path}" value="${v ?? ''}"${f.default !== undefined ? ` placeholder="${esc(f.default)} (por defecto)"` : ''} min="${f.min}" max="${f.max}" step="${f.step || 1}"${desc}>${ayuda}</div>`;
  if (f.type === 'time') return `<div class="mv-cm">${lab}<input type="time" id="${id}" data-p="${f.path}" value="${esc(v || '')}"${desc}>${ayuda}</div>`;
  if (f.type === 'list') return `<div class="mv-cm">${lab}<textarea id="${id}" data-p="${f.path}" rows="4" placeholder="Uno por línea" autocapitalize="none" spellcheck="false"${desc}>${esc((v || []).join('\n'))}</textarea>${ayuda}</div>`;
  if (f.type === 'depts' || f.type === 'checks') {
    const opts = f.type === 'depts' ? Object.entries(DEPT) : f.options, marcados = v ?? f.default ?? [];
    return `<fieldset class="mv-cm mv-checks"><legend class="mv-lab">${esc(f.label)}</legend><div class="mv-chk-g">${opts.map(([k, t]) => `<label class="mv-chk"><input type="checkbox" data-p="${f.path}" data-d="${esc(k)}"${marcados.includes(k) ? ' checked' : ''}><span>${esc(t)}</span></label>`).join('')}</div>${ayuda}</fieldset>`;
  }
  if (f.type === 'people') return `<div class="mv-cm"><span class="mv-lab">${esc(f.label)}</span>${ayuda}<div class="mv-people" data-p="${f.path}">${(v || []).map(personaHTML).join('')}</div><button type="button" class="mv-btn" data-persona-mas>+ Añadir una persona</button></div>`;
  // texto: sin mayúsculas ni corrector si es un id o una lista de nombres técnicos (los ids de Meta son números)
  const tecnico = /anuncios\.|\.id$|token|url/i.test(f.path);
  return `<div class="mv-cm">${lab}<input type="text" id="${id}" data-p="${f.path}" value="${esc(v ?? '')}" maxlength="${f.max || 200}"${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ''}${tecnico ? ' autocapitalize="none" autocorrect="off" spellcheck="false" inputmode="' + (/cuenta/.test(f.path) ? 'text' : 'numeric') + '"' : ' autocomplete="off"'}${desc}>${f.patternHelp ? `<small class="mv-ayuda">${esc(f.patternHelp)}</small>` : ''}${ayuda}</div>`;
}

export const personaHTML = p => `<div class="mv-persona"><label class="mv-lab">Nombre<input aria-label="Nombre" autocomplete="off" value="${esc(p.name || '')}" data-k="name"></label>
  <label class="mv-lab">Id de Telegram (opcional)<input aria-label="Id de Telegram" inputmode="numeric" autocomplete="off" value="${esc(p.telegram || '')}" data-k="telegram"></label>
  <label class="mv-lab">Departamento<select aria-label="Departamento" data-k="dept"><option value="">Toda la oficina</option>${Object.entries(DEPT).map(([k, t]) => `<option value="${k}"${(p.depts || [])[0] === k ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
  <button type="button" class="mv-btn peligro" data-persona-quitar aria-label="Quitar a ${esc(p.name || 'esta persona')}">Quitar</button></div>`;

/** Lee del DOM el valor de cada campo `fields` que está dentro de `raiz` → { path: valor } */
export function leerCampos(raiz, fields) {
  const out = {};
  for (const f of fields) {
    const nodos = [...raiz.querySelectorAll(`[data-p="${f.path}"]`)]; if (!nodos.length) continue;
    if (f.type === 'bool') out[f.path] = nodos[0].checked;
    else if (f.type === 'depts' || f.type === 'checks') out[f.path] = nodos.filter(x => x.dataset.d && x.checked).map(x => x.dataset.d);
    else if (f.type === 'people') out[f.path] = [...nodos[0].querySelectorAll('.mv-persona')].map(r => { const d = r.querySelector('[data-k=dept]').value; return { name: r.querySelector('[data-k=name]').value.trim(), telegram: r.querySelector('[data-k=telegram]').value.trim(), depts: d ? [d] : [] }; }).filter(p => p.name);
    else if (f.type === 'list') out[f.path] = lineas(nodos[0].value);
    else out[f.path] = nodos[0].value;
  }
  return out;
}
