// Versión móvil (25 oct 2026) — CONECTORES: una tarjeta de 56 px o más por conector con su icono, su nombre, su estado en palabras (color Y texto)
// y a qué departamentos sirve. Tocar una abre una hoja con el detalle (qué herramientas leen y cuáles envían), «Probar conexión» y, en la nube,
// apagarlo, editarlo o quitarlo. «+ Añadir conector» (solo en la nube y solo administradores) lleva a las plantillas (Zapier, n8n, Make, Gmail…)
// y a un formulario que guarda el token cifrado: la API es la de cloudflare/worker/modulos/conectores.js (GET /api/conectores,
// /plantillas, POST, /probar, PATCH, DELETE); el token se manda UNA vez y no vuelve nunca.
import { esc, svg, esqueleto, vacio, falla } from '../ui.js';
import { conEstado } from '../../accion.js';
import { estadoConector, TONO_ORDEN, monograma, herramientasDe, slugConector } from '../ajustes-core.mjs';
import { iconoDe } from '../conectores.js';
import { DEPT } from './campos.js';

const bonito = n => String(n || '').replace(/^plugin:[^:]+:/, '').replace(/^claude\.ai\s+/i, '').replace(/[-_]+/g, ' ').replace(/^./, c => c.toUpperCase());
const GLIFO = { ok: '✓', warn: '!', bad: '✕', off: '–' };
const dormir = ms => new Promise(r => setTimeout(r, ms));

/** El icono de un conector: el que trae (iconUri), el que la página ya dibujó en su barra, o un monograma de color estable. */
export function iconoHTML(s, clase = 'mv-cxi') {
  const src = s.iconUri || iconoDe(bonito(s.name)) || iconoDe(s.key), m = monograma(s.name), e = estadoConector(s);
  return `<span class="${clase} ${e.tono}">${src ? `<img src="${esc(src)}" alt="">` : `<b style="--h:${m.tono}">${esc(m.ini)}</b>`}<i aria-hidden="true">${GLIFO[e.tono]}</i></span>`;
}

export function registrar(shell) {
  shell.registrarVista({
    id: 'conectores', titulo: 'Conectores', icono: 'conectores', grupo: 'mas', sec: 'oficina', texto: 'Las herramientas conectadas',
    montar(el, ctx) {
      el.innerHTML = '<div class="mv-scroll"><div class="mv-cuerpo" aria-live="polite"></div></div>';
      const cuerpo = el.querySelector('.mv-cuerpo'), sc = el.querySelector('.mv-scroll');
      let mcp = null, err = '', ext = null /* /api/conectores (nube): etiqueta, auth, activo, token… */, admin = false, cifrado = false;
      const esNube = () => !!(mcp && mcp.nube) || !!window.AO_NUBE;

      async function cargar(fresco) {
        try { mcp = await ctx.store.conectores(!!fresco); err = ''; } catch (e) { err = e.message; }
        if (esNube()) { // lo de más que solo sabe la nube (y solo el administrador cambia)
          try { const [yo, c] = await Promise.all([ctx.api('/api/yo').catch(() => null), ctx.api('/api/conectores')]); admin = yo?.usuario?.rol === 'admin'; ext = c.conectores || []; cifrado = !!c.cifrado; } catch { ext = null; }
        }
        pintar(); acciones();
      }
      function acciones() { ctx.cabecera({ acciones: esNube() && admin && ext ? [{ icono: 'mas1', etiqueta: 'Añadir un conector', alTocar: () => anadir() }] : [] }); }
      const lista = () => (mcp?.servers || []).filter(s => s.name && !s.office).sort((a, b) => TONO_ORDEN[estadoConector(a).tono] - TONO_ORDEN[estadoConector(b).tono] || bonito(a.name).localeCompare(bonito(b.name)));
      function tarjeta(s) {
        const e = estadoConector(s), d = (s.depts || []).map(k => DEPT[k] || k), x = ext?.find(c => c.nombre === s.id);
        return `<li><button type="button" class="mv-cxt ${e.tono}" data-id="${esc(s.id || s.name)}">${iconoHTML(s)}<span class="mv-cxt-t"><b>${esc(x?.etiqueta || bonito(s.name))}</b><small class="${e.tono}">${GLIFO[e.tono]} ${esc(e.txt)}</small><small>${d.length ? 'Sirve a: ' + esc(d.join(', ')) : 'No llega a ningún departamento'}</small></span>${svg('der', 'mv-der')}</button></li>`;
      }
      function pintar() {
        if (!mcp) { cuerpo.innerHTML = err ? falla(err) : esqueleto(5); return; }
        const l = lista(), ok = l.filter(s => s.status === 'connected' && !s.denied).length, mal = l.filter(s => ['bad', 'warn'].includes(estadoConector(s).tono)).length;
        cuerpo.innerHTML = `<p class="mv-intro"><b>${ok} de ${l.length}</b> conectados${mal ? ` · <span class="rojo">${mal} ${mal === 1 ? 'pide' : 'piden'} atención</span>` : ''}. Un conector es la puerta de los agentes a otra herramienta: leer es libre; enviar solo pasa con tu OK.</p>
          ${mcp.discovering ? '<p class="mv-aviso">Buscando los conectores de esta computadora…</p>' : ''}
          ${l.length ? `<ul class="mv-lista mv-cxts">${l.map(tarjeta).join('')}</ul>` : vacio('Todavía no hay conectores', esNube() ? (admin ? 'Añade el primero con el botón + de arriba.' : 'Un administrador puede añadir el primero.') : 'Conéctalos con «claude mcp add» en tu computadora y vuelve a abrir esta pantalla.', { icono: 'conectores' })}
          ${esNube() && admin && ext ? '<button type="button" class="mv-btn primario mv-ancho" data-anadir>+ Añadir conector</button>' : ''}
          ${!esNube() ? '<p class="mv-meta">Para añadir o quitar uno en esta computadora: <code>claude mcp add …</code> y vuelve a abrir esta pantalla.</p>' : ''}`;
      }

      // ---- el detalle
      function detalle(s) {
        const e = estadoConector(s), x = ext?.find(c => c.nombre === s.id), h = herramientasDe(s), d = (s.depts || []).map(k => DEPT[k] || k);
        const lis = (l, vac) => l.length ? `<ul class="mv-herr">${l.slice(0, 40).map(t => `<li>${esc(t)}</li>`).join('')}${l.length > 40 ? `<li>y ${l.length - 40} más</li>` : ''}</ul>` : `<p class="mv-meta">${vac}</p>`;
        const hj = ctx.hoja({ titulo: x?.etiqueta || bonito(s.name), lleno: true, clase: 'mv-cx-det', cuerpo: `<div class="mv-cxd-cab">${iconoHTML(s, 'mv-cxi grande')}<div><p class="mv-cxd-e ${e.tono}">${GLIFO[e.tono]} <b>${esc(e.txt)}</b></p>${e.que ? `<p class="mv-meta">${esc(e.que)}</p>` : ''}${s.target ? `<p class="mv-meta">${esc(s.target)}</p>` : ''}</div></div>
          <h3 class="mv-gh">Llega a</h3><p class="mv-texto">${d.length ? esc(d.join(', ')) : 'Ningún departamento todavía.'}</p>
          <h3 class="mv-gh">Herramientas que lee <span>${h.lee.length}</span></h3>${lis(h.lee, s.status === 'connected' ? 'No ofrece herramientas de lectura.' : 'Aparecen cuando conecta.')}
          <h3 class="mv-gh">Herramientas que envían <span>${h.envia.length}</span></h3>${lis(h.envia, 'Ninguna.')}${h.envia.length ? '<p class="mv-meta">Estas solo corren en una ejecución que tú hayas aprobado, y solo hacia quien salga en el borrador aprobado.</p>' : ''}
          <p class="mv-aviso" id="mvCxMsg" role="status" aria-live="polite" hidden></p>`,
          acciones: [{ texto: 'Probar conexión', alTocar: async (hh, b) => probar(s, b, hh) },
            ...(esNube() && admin && x ? [{ texto: x.activo ? 'Apagar' : 'Encender', alTocar: async (hh, b) => alternar(x, b, hh) }, { texto: 'Editar', alTocar: (hh) => { hh.cerrar(); setTimeout(() => anadir(x), 280); } }, { texto: 'Quitar', tipo: 'peligro', alTocar: async (hh, b) => quitar(x, b, hh) }] : [])] });
        return hj;
      }
      const msg = (hh, t, mal) => { const m = hh.cuerpo.querySelector('#mvCxMsg'); if (m) { m.hidden = !t; m.textContent = t || ''; m.className = 'mv-aviso' + (mal ? ' malo' : ''); } };
      async function probar(s, b, hh) {
        const x = ext?.find(c => c.nombre === s.id);
        const r = await conEstado(b, async () => {
          if (esNube() && x) { const j = await ctx.api('/api/conectores/probar', { method: 'POST', body: { nombre: x.nombre, auth_tipo: x.auth_tipo, cabecera: x.cabecera || undefined } }); if (!j.ok) throw new Error(j.error || 'No conecta.'); return { hecho: `Conecta: ${j.herramientas.length} herramientas (${j.lectura} de lectura, ${j.envio} de envío).` }; }
          await ctx.api('/api/mcp?refresh=1'); // en esta computadora: se vuelven a mirar todos (tarda un rato)
          for (let i = 0; i < 40; i++) { await dormir(2500); const m = await ctx.store.conectores(true); if (!m.discovering) { mcp = m; const nuevo = m.servers.find(q => q.id === s.id), e = nuevo ? estadoConector(nuevo) : null; pintar(); return { hecho: e ? `${bonito(s.name)}: ${e.txt}.` : 'Listo.' }; } }
          throw new Error('Tardó más de lo normal. Vuelve a mirar en un minuto.');
        }, { ocupado: 'Probando…', hecho: 'Probado ✓', ms: 2600 });
        msg(hh, r.ok ? r.valor.hecho : r.error, !r.ok);
        if (!r.ok && x) { /* el motivo ya está en palabras */ }
      }
      async function alternar(x, b, hh) {
        const r = await conEstado(b, () => ctx.api(`/api/conectores/${x.nombre}`, { method: 'PATCH', body: { activo: !x.activo } }), { ocupado: '…', hecho: x.activo ? 'Apagado' : 'Encendido', ms: 600 });
        if (r.ok) { hh.cerrar(); ctx.toast(x.activo ? 'Apagado: los agentes ya no lo usan.' : 'Encendido.'); document.dispatchEvent(new CustomEvent('ao:conectores')); await cargar(true); } else msg(hh, r.error, true);
      }
      async function quitar(x, b, hh) {
        if (!(await ctx.confirmar({ titulo: `¿Quitar «${x.etiqueta || x.nombre}»?`, texto: 'Los agentes dejan de usarlo y se borra el token que tenga guardado aquí.', ok: 'Quitar', peligro: true }))) return;
        const r = await conEstado(b, () => ctx.api(`/api/conectores/${x.nombre}`, { method: 'DELETE' }), { ocupado: 'Quitando…', hecho: 'Quitado', ms: 600 });
        if (r.ok) { hh.cerrar(); ctx.toast('Conector quitado.'); document.dispatchEvent(new CustomEvent('ao:conectores')); await cargar(true); } else msg(hh, r.error, true);
      }

      // ---- añadir / editar
      async function anadir(editar) {
        let plantillas = [];
        try { const j = await ctx.api('/api/conectores/plantillas'); plantillas = j.plantillas || []; if (j.cifrado !== undefined) cifrado = !!j.cifrado; } catch (e) { ctx.toast('No se pudo abrir: ' + e.message); return; }
        const F = editar ? { paso: 'datos', existente: true, nombre: editar.nombre, plantilla: editar.plantilla || 'otro', etiqueta: editar.etiqueta || '', url: '', urlVisible: editar.url, auth: editar.auth_tipo, cabecera: editar.cabecera || '', donde: editar.secreto ? 'secreto' : cifrado ? 'aqui' : 'secreto', secreto: editar.secreto || '', token: '', tokenGuardado: editar.tokenGuardado, departamentos: [...(editar.departamentos || [])], dominios: (editar.dominios_permitidos || []).join('\n'), tools: [...editar.herramientas_lectura.map(n => ({ name: n, tipo: 'lectura' })), ...editar.herramientas_envio.map(n => ({ name: n, tipo: 'envio' }))], marcadas: new Set([...editar.herramientas_lectura, ...editar.herramientas_envio]) } : { paso: 'elegir' };
        const hj = ctx.hoja({ titulo: editar ? 'Editar conector' : 'Añadir conector', lleno: true, clase: 'mv-cx-form', cuerpo: '<div id="mvCxF"></div>', acciones: [{ texto: 'Probar conexión', alTocar: (hh, b) => probarForm(b) }, { texto: 'Guardar conector', tipo: 'primario', alTocar: (hh, b) => guardarForm(hh, b) }] });
        const cu = hj.cuerpo.querySelector('#mvCxF'), [bProbar, bGuardar] = hj.acciones();
        const plant = () => plantillas.find(p => p.id === F.plantilla) || plantillas.at(-1) || { id: 'otro', nombre: 'Otro', auth: 'bearer', pista: '' };
        function dibujar() {
          bProbar.hidden = bGuardar.hidden = F.paso === 'elegir'; hj.titulo(F.paso === 'elegir' ? 'Añadir conector' : `${F.existente ? 'Editar' : 'Añadir'}: ${plant().nombre}`);
          if (F.paso === 'elegir') { cu.innerHTML = `<p class="mv-intro">¿Qué quieres conectar?</p><ul class="mv-tiles">${plantillas.map(p => `<li><button type="button" class="mv-tile" data-pl="${esc(p.id)}"><img src="${esc(p.iconUri)}" alt="" width="40" height="40"><span>${esc(p.nombre)}</span></button></li>`).join('')}</ul>`; return; }
          const p = plant(), ed = !!F.existente;
          const pasos = p.pasos ? `<details class="mv-acord" open><summary>Cómo conectarlo en pocos pasos</summary><ol>${p.pasos.map(t => `<li>${esc(t)}</li>`).join('')}</ol></details>` : (p.pista ? `<p class="mv-aviso">${esc(p.pista)}${p.oauth ? ' <b>Suele pedir iniciar sesión con OAuth, algo que la oficina todavía no hace.</b>' : ''}</p>` : '');
          cu.innerHTML = `${pasos}<div class="mv-cm"><label class="mv-lab" for="cxEt">Nombre que verás</label><input id="cxEt" maxlength="60" autocomplete="off" value="${esc(F.etiqueta)}" placeholder="${esc(p.nombre)}"></div>
            ${ed ? `<p class="mv-meta">Dirección: ${esc(F.urlVisible)}. Para cambiarla, quita el conector y añádelo otra vez.</p>` : '<div class="mv-cm"><label class="mv-lab" for="cxUrl">Dirección del servidor MCP (https)</label><input id="cxUrl" type="url" inputmode="url" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="https://…" value="' + esc(F.url || '') + '"></div>'}
            <fieldset class="mv-cm"><legend class="mv-lab">Autenticación</legend>${[['bearer', 'Token (Bearer)', 'Lo más común'], ['cabecera', 'Cabecera propia', 'Por ejemplo X-API-Key'], ['ninguna', 'Sin autenticación', 'La dirección ya trae su permiso, o es pública']].map(([k, t, d]) => `<label class="mv-opc"><input type="radio" name="cxAuth" value="${k}"${F.auth === k ? ' checked' : ''}><span><b>${t}</b><small>${d}</small></span></label>`).join('')}</fieldset>
            <div class="mv-cm" id="cxCab"${F.auth === 'cabecera' ? '' : ' hidden'}><label class="mv-lab" for="cxCabN">Nombre de la cabecera</label><input id="cxCabN" maxlength="40" autocapitalize="none" spellcheck="false" placeholder="X-API-Key" value="${esc(F.cabecera)}"></div>
            <div id="cxTok"${F.auth === 'ninguna' ? ' hidden' : ''}><fieldset class="mv-cm"><legend class="mv-lab">Dónde vive el token</legend>
              <label class="mv-opc"><input type="radio" name="cxDonde" value="aqui"${F.donde === 'aqui' ? ' checked' : ''}${cifrado ? '' : ' disabled'}><span><b>Guardarlo aquí, cifrado</b><small>${cifrado ? 'No se puede volver a ver.' : 'Falta AO_CLAVE_CIFRADO en Cloudflare.'}</small></span></label>
              <label class="mv-opc"><input type="radio" name="cxDonde" value="secreto"${F.donde === 'secreto' ? ' checked' : ''}><span><b>Es un secreto del Worker</b><small>Ya está o lo guardaré en GitHub.</small></span></label></fieldset>
              <div class="mv-cm" id="cxAqui"${F.donde === 'aqui' ? '' : ' hidden'}><label class="mv-lab" for="cxToken">Token</label><input id="cxToken" type="password" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="${ed && F.tokenGuardado ? '••• guardado (escribe uno nuevo para cambiarlo)' : 'Pégalo aquí'}"></div>
              <div class="mv-cm" id="cxSec"${F.donde === 'secreto' ? '' : ' hidden'}><label class="mv-lab" for="cxSecN">Nombre del secreto</label><input id="cxSecN" maxlength="64" autocapitalize="characters" spellcheck="false" placeholder="MCP_${esc(slugConector(F.etiqueta || p.nombre).toUpperCase().replace(/-/g, '_').slice(0, 20))}_TOKEN" value="${esc(F.secreto)}"></div></div>
            <fieldset class="mv-cm mv-checks"><legend class="mv-lab">Departamentos que lo usan</legend><div class="mv-chk-g">${Object.entries(DEPT).map(([k, t]) => `<label class="mv-chk"><input type="checkbox" name="cxDep" value="${k}"${F.departamentos.includes(k) ? ' checked' : ''}><span>${t}</span></label>`).join('')}</div></fieldset>
            <div class="mv-cm"><label class="mv-lab" for="cxDominios">Dominios que puede consultar</label><textarea id="cxDominios" rows="3" maxlength="900" autocapitalize="none" spellcheck="false" placeholder="ejemplo.com">${esc(F.dominios || '')}</textarea><small>Uno por línea (ejemplo.com o *.ejemplo.com). Vacío = ninguno. Solo cuenta si el dueño enciende «Dominios por conector» en Ajustes → Seguridad. Lista corta y solo dominios propios de confianza: un dominio que deja subir o publicar texto sirve para sacar datos por la dirección.</small></div>
            <p class="mv-aviso" id="cxMsg" role="status" aria-live="polite" hidden></p><div id="cxTools">${herr()}</div>`;
        }
        const herr = () => {
          if (!F.tools) return '<p class="mv-meta">Toca «Probar conexión» para ver las herramientas del servidor y elegir cuáles se permiten.</p>';
          if (!F.tools.length) return '<p class="mv-meta">Conecta, pero el servidor no ofrece ninguna herramienta.</p>';
          const filaH = t => { const on = F.marcadas.has(t.name); return `<li><label class="mv-chk"><input type="checkbox" data-h="${esc(t.name)}"${on ? ' checked' : ''}><span><b>${esc(t.name)}</b> <em class="mv-k ${t.tipo}">${t.tipo === 'lectura' ? 'lee' : 'envía'}</em>${t.descripcion ? `<small>${esc(t.descripcion)}</small>` : ''}</span></label></li>`; };
          return `<h3 class="mv-gh">Herramientas (${F.tools.length})</h3><p class="mv-meta">«Lee» sirve en cualquier tarea. «Envía» solo corre en una ejecución que tú hayas aprobado.</p><ul class="mv-herr-c">${F.tools.map(filaH).join('')}</ul>`;
        };
        const leer = () => {
          const q = s => cu.querySelector(s);
          F.etiqueta = q('#cxEt')?.value ?? F.etiqueta; if (q('#cxUrl')) F.url = q('#cxUrl').value.trim();
          F.auth = cu.querySelector('input[name=cxAuth]:checked')?.value || F.auth; F.cabecera = q('#cxCabN')?.value || ''; F.donde = cu.querySelector('input[name=cxDonde]:checked')?.value || F.donde;
          F.secreto = q('#cxSecN')?.value.trim() || ''; F.token = q('#cxToken')?.value || ''; F.departamentos = [...cu.querySelectorAll('input[name=cxDep]:checked')].map(x => x.value); F.dominios = q('#cxDominios')?.value ?? F.dominios ?? '';
        };
        const decir = (t, mal) => { const m = cu.querySelector('#cxMsg'); if (m) { m.hidden = !t; m.textContent = t || ''; m.className = 'mv-aviso' + (mal ? ' malo' : ''); if (t) m.scrollIntoView({ block: 'nearest' }); } };
        async function probarForm(b) {
          leer();
          const r = await conEstado(b, async () => { const j = await ctx.api('/api/conectores/probar', { method: 'POST', body: { nombre: F.existente ? F.nombre : undefined, url: F.url || undefined, auth_tipo: F.auth, cabecera: F.auth === 'cabecera' ? F.cabecera : undefined, token: F.donde === 'aqui' && F.token ? F.token : undefined } }); if (!j.ok) throw new Error(j.error || 'No conecta.'); return j; }, { ocupado: 'Probando…', hecho: 'Conecta ✓', ms: 1500 });
          if (!r.ok) { decir(r.error, true); return; }
          const j = r.valor, antes = F.marcadas; F.tools = j.herramientas; F.marcadas = new Set(F.existente && antes.size ? antes : j.herramientas.filter(t => t.tipo === 'lectura').map(t => t.name));
          cu.querySelector('#cxTools').innerHTML = herr(); decir(`Conecta: ${j.herramientas.length} herramientas (${j.lectura} de lectura, ${j.envio} de envío).`);
        }
        async function guardarForm(hh, b) {
          leer();
          if (!F.existente) F.nombre = slugConector(F.etiqueta || plant().nombre || 'conector', (ext || []).map(c => c.nombre));
          if (!F.tools && !F.confirmoSin) { F.confirmoSin = true; decir('Mejor toca «Probar conexión» primero para elegir qué herramientas se permiten. Si prefieres guardarlo sin herramientas, toca «Guardar conector» otra vez.', true); return; }
          const body = { nombre: F.nombre, etiqueta: F.etiqueta || undefined, plantilla: F.plantilla === 'otro' ? undefined : F.plantilla, auth_tipo: F.auth, cabecera: F.auth === 'cabecera' ? F.cabecera : undefined, departamentos: F.departamentos, dominios_permitidos: String(F.dominios || '').split('\n').map(x => x.trim()).filter(Boolean) };
          if (F.url) body.url = F.url;
          if (F.auth !== 'ninguna') { if (F.donde === 'secreto' && F.secreto) body.secreto = F.secreto; else if (F.token) body.token = F.token; }
          const t = F.tools || []; body.herramientas_lectura = t.filter(h => h.tipo === 'lectura' && F.marcadas.has(h.name)).map(h => h.name); body.herramientas_envio = t.filter(h => h.tipo === 'envio' && F.marcadas.has(h.name)).map(h => h.name);
          const r = await conEstado(b, () => ctx.api('/api/conectores', { method: 'POST', body }), { ocupado: 'Guardando…', hecho: 'Guardado ✓', ms: 900 });
          if (!r.ok) { decir(r.error, true); return; }
          hh.cerrar(); ctx.toast('Guardado. Los agentes de esos departamentos lo usan desde su próxima tarea.'); document.dispatchEvent(new CustomEvent('ao:conectores')); await cargar(true);
        }
        cu.addEventListener('click', e => { const t = e.target.closest('[data-pl]'); if (!t) return; const p = plantillas.find(x => x.id === t.dataset.pl); Object.assign(F, { paso: 'datos', plantilla: p.id, etiqueta: p.id === 'otro' ? '' : p.nombre, url: '', auth: p.auth, cabecera: '', donde: cifrado ? 'aqui' : 'secreto', secreto: '', token: '', departamentos: [], tools: null, marcadas: new Set() }); dibujar(); hj.cuerpo.scrollTop = 0; });
        cu.addEventListener('change', e => {
          if (F.paso === 'elegir') return;
          if (e.target.name === 'cxAuth') { leer(); cu.querySelector('#cxCab').hidden = F.auth !== 'cabecera'; cu.querySelector('#cxTok').hidden = F.auth === 'ninguna'; }
          if (e.target.name === 'cxDonde') { leer(); cu.querySelector('#cxAqui').hidden = F.donde !== 'aqui'; cu.querySelector('#cxSec').hidden = F.donde !== 'secreto'; }
          if (e.target.dataset?.h) { if (e.target.checked) F.marcadas.add(e.target.dataset.h); else F.marcadas.delete(e.target.dataset.h); }
        });
        dibujar();
      }
      // exportado a quien lo necesite (Inicio, Más): ctx.conectores.añadir()
      ctx.conectores = { añadir: () => anadir(), actualizar: cargar };

      cuerpo.addEventListener('click', e => {
        if (e.target.closest('[data-reintentar]')) return cargar(true);
        if (e.target.closest('[data-anadir]')) return anadir();
        const b = e.target.closest('[data-id]'); if (!b) return; const s = (mcp?.servers || []).find(x => (x.id || x.name) === b.dataset.id); if (s) detalle(s);
      });
      ctx.tirar(sc, () => cargar(true));
      const alCambiar = () => { if (!el.hidden) cargar(true); }; document.addEventListener('ao:conectores', alCambiar); el._off = () => document.removeEventListener('ao:conectores', alCambiar);
      cuerpo.innerHTML = esqueleto(5); el._cargar = cargar;
    },
    desmontar(el) { el._off?.(); },
    alMostrar(el) { el._cargar(true); },
  });
}
