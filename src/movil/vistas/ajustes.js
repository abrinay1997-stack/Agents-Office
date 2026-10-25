// Versión móvil (25 oct 2026) — AJUSTES: en el teléfono no son 17 pestañas en una fila sino una LISTA de secciones, y cada sección es una
// pantalla con sus campos y un GUARDAR FIJO abajo (sobre el teclado) que dice qué pasa: «Sin guardar», «Guardando…», «Guardado ✓» o por qué
// no se pudo. Los campos salen de settings.FIELDS (GET /api/settings, la misma lista de escritorio): aquí no se repite ninguna definición.
// Lo que se edita se guarda como borrador mientras se cambia de pantalla: nada se pierde, y si te vas con cambios, el aviso te lleva de vuelta.
import { esc, svg, esqueleto, vacio } from '../ui.js';
import { conEstado, enviar } from '../../accion.js';
import { cambios, nAtencion, ROL, avisoModelo, usd } from '../ajustes-core.mjs';
import { campoHTML, leerCampos, personaHTML } from './campos.js';
import { ponerTema } from './mas.js';

// id → título, línea gris, icono. Los grupos que el servidor traiga y no estén aquí caen en «Otros».
export const META = {
  general: ['General', 'Nombre, modelo y agentes a la vez', 'ajustes'], estudio: ['Estudio', 'Topes de imágenes y video', 'estudio'], contenido: ['Contenido', 'Redes, modo y horas', 'contenido'],
  anuncios: ['Anuncios', 'Cuenta y topes de gasto de Meta', 'anuncios'], calidad: ['Calidad', 'Cómo se revisa lo que entregan', 'check'], cifras: ['Cifras de la empresa', 'Precios y metas que usan los agentes', 'negocio'],
  voz: ['Voz de marca', 'Cómo habla tu marca', 'dimitri'], empresa: ['Preparar desde mi web', 'La oficina lee tu sitio', 'nube'], aprobaciones: ['Aprobaciones', 'Plazos, deshacer e importes', 'alerta'],
  seguridad: ['Seguridad', 'Quién puede enviar, publicar o pagar', 'estado'], costos: ['Presupuesto', 'Tope del mes y precio de una hora', 'costos'], equipo: ['Personas del equipo', 'Quién recibe avisos y aprueba', 'persona'],
  conectores: ['Reglas de los conectores', 'Qué pueden usar los agentes', 'conectores'], avisos: ['Avisos y Telegram', 'Qué te avisa y a qué hora', 'nube'], modelos: ['Modelos', 'Qué modelo hace cada trabajo', 'cerebro'],
  agentes: ['Agentes', 'Su ficha: brief, skills, lecciones', 'persona'], apariencia: ['Apariencia y versión', 'Tema y cómo se ve en este teléfono', 'tema'],
};
const VISTAS = { estado: ['Estado de la oficina', 'Que todo funcione', 'estado'], perfil: ['Mi perfil', 'Tu nombre, foto y contraseña', 'persona'], 'equipo-cuentas': ['Cuentas y roles', 'Quién entra a la oficina', 'persona'], 'costos-retorno': ['Costos y retorno', 'Gasto, horas ahorradas, sugerencias', 'costos'], negocio: ['Cómo va el negocio', 'Tus indicadores', 'negocio'], 'conectores-vista': ['Conectores', 'Las herramientas conectadas', 'conectores'] };
const DESTINO = { 'equipo-cuentas': 'equipo', 'costos-retorno': 'costos', 'conectores-vista': 'conectores' };
const LISTA = [
  { items: ['@estado'] },
  { h: 'Mi cuenta', nube: true, items: ['@perfil', '@equipo-cuentas'] },
  { h: 'La oficina', items: ['general', 'estudio', 'contenido', 'anuncios', 'calidad', 'cifras', 'voz', 'empresa'] },
  { h: 'Dinero y control', items: ['aprobaciones', 'seguridad', 'costos', '@costos-retorno', '@negocio'] },
  { h: 'Equipo', items: ['equipo', 'agentes'] },
  { h: 'Integraciones', items: ['@conectores-vista', 'conectores', 'avisos', 'modelos'] },
  { h: 'Apariencia', items: ['apariencia'] },
];

const ESPECIALES = new Set(['apariencia', 'agentes', 'cifras', 'voz', 'empresa', 'modelos']);
const E = { data: null, rol: null, modelos: undefined, pend: new Map(), cifras: null, voz: null, menos: null };
const nube = () => !!window.AO_NUBE;
async function datos(ctx, fresco) {
  if (E.data && !fresco) return E.data;
  const j = await ctx.api('/api/settings');
  if (!Array.isArray(j.groups)) throw new Error('Esta oficina todavía no tiene estos ajustes.');
  return (E.data = j);
}
async function esAdmin(ctx) { if (!nube()) return true; if (E.rol) return E.rol === 'admin'; try { E.rol = (await ctx.api('/api/yo')).usuario?.rol || 'lectura'; } catch { E.rol = 'lectura'; } return E.rol === 'admin'; }

export function registrar(shell) {
  // ───────────────────────────── la lista
  shell.registrarVista({
    id: 'ajustes', titulo: 'Ajustes', icono: 'ajustes', grupo: 'mas', sec: 'oficina', texto: 'Apariencia, equipo, cifras, modelos…',
    montar(el, ctx) {
      el.innerHTML = '<div class="mv-scroll"><div class="mv-cuerpo" aria-live="polite"></div></div>';
      const cuerpo = el.querySelector('.mv-cuerpo');
      let err = '';
      const fila = (id, st) => {
        const v = id[0] === '@' ? VISTAS[id.slice(1)] : META[id]; if (!v) return '';
        if (id === 'modelos' && !E.modelos) return '';
        if (id[0] !== '@' && E.data && !ESPECIALES.has(id) && !E.data.groups.some(g => g[0] === id)) return ''; // un grupo que esta oficina no tiene
        const n = id === '@estado' ? nAtencion(st) : 0;
        return `<li><button type="button" class="mv-lista-b" data-ir="${esc(id)}">${svg(v[2], 'mv-lista-i')}<span><b>${esc(v[0])}</b><small>${esc(v[1])}</small></span>${n ? `<em class="mv-insignia ambar" aria-label="${n} ${n === 1 ? 'cosa necesita' : 'cosas necesitan'} atención">${n}</em>` : ''}${svg('der', 'mv-der')}</button></li>`;
      };
      function pintar() {
        const st = ctx.store.st.status, usados = new Set(LISTA.flatMap(b => b.items));
        const otros = (E.data?.groups || []).map(g => g[0]).filter(g => !usados.has(g));
        const bloques = [...LISTA, ...(otros.length ? [{ h: 'Otros', items: otros }] : [])].filter(b => !b.nube || nube());
        cuerpo.innerHTML = (err ? `<p class="mv-aviso malo" role="alert">${esc(err)} <button type="button" class="mv-link" data-reintentar>Reintentar</button></p>` : '') + bloques.map(b => {
          const l = b.items.map(i => fila(i, st)).join(''); return l ? `${b.h ? `<h3 class="mv-gh">${esc(b.h)}</h3>` : ''}<ul class="mv-lista">${l}</ul>` : '';
        }).join('') + '<p class="mv-meta mv-pie-lista">Los atajos de teclado no se usan en el teléfono.</p>';
      }
      cuerpo.addEventListener('click', e => {
        if (e.target.closest('[data-reintentar]')) { err = ''; cargar(); return; }
        const b = e.target.closest('[data-ir]'); if (!b) return; const id = b.dataset.ir;
        if (id[0] === '@') ctx.navegar(DESTINO[id.slice(1)] || id.slice(1)); else ctx.navegar('ajustes-seccion', { s: id });
      });
      async function cargar() {
        try { await datos(ctx, true); err = ''; } catch (e) { err = e.message; }
        if (E.modelos === undefined && nube()) { E.modelos = false; if (await esAdmin(ctx)) { try { await ctx.api('/api/modelos'); E.modelos = true; } catch { E.modelos = false; } } }
        pintar();
      }
      el._cargar = cargar; ctx.store.alCambiar(() => { if (!el.hidden) pintar(); });
      ctx.tirar(el.querySelector('.mv-scroll'), cargar);
      cuerpo.innerHTML = esqueleto(6);
    },
    alMostrar(el) { el._cargar(); },
  });

  // ───────────────────────────── una sección
  shell.registrarVista({
    id: 'ajustes-seccion', titulo: 'Ajustes', icono: 'ajustes', grupo: 'oculta',
    montar(el, ctx) {
      el.innerHTML = '<div class="mv-scroll"><div class="mv-cuerpo mv-form" aria-live="polite"></div></div><footer class="mv-guardar" hidden><span class="mv-gst" role="status" aria-live="polite"></span><button type="button" class="mv-btn primario ac" data-guardar>Guardar</button></footer>';
      const cuerpo = el.querySelector('.mv-cuerpo'), sc = el.querySelector('.mv-scroll'), pie = el.querySelector('.mv-guardar'), gst = el.querySelector('.mv-gst'), btn = el.querySelector('[data-guardar]');
      let sec = null, fields = [], cargando = 0, guardado = false;

      // ---- qué cambió ahora mismo en la pantalla (según el tipo de sección)
      const cifrasLeer = () => [...cuerpo.querySelectorAll('.mv-cifra')].map(r => Object.fromEntries([...r.querySelectorAll('[data-c]')].map(i => [i.dataset.c, i.value.trim()])));
      const actual = () => {
        if (sec === 'cifras') return E.cifras === null ? null : cifrasLeer();
        if (sec === 'voz') { const t = cuerpo.querySelector('#mvVoz'); return t ? t.value : null; }
        if (sec === 'modelos') return leerModelos();
        if (fields.length) return leerCampos(cuerpo, fields);
        return null;
      };
      const cuantos = () => {
        const a = actual(); if (a === null) return 0;
        if (sec === 'cifras') return JSON.stringify(a) === JSON.stringify(E.base) ? 0 : 1;
        if (sec === 'voz') return a === E.voz ? 0 : 1;
        if (sec === 'modelos') return JSON.stringify(a) === JSON.stringify(E.baseModelos) ? 0 : 1;
        return Object.keys(cambios(fields, E.data.values, a)).length;
      };
      const hay = () => !!sec && cuantos() > 0, sucio = () => !el.hidden && hay();
      function marcar() {
        const n = cuantos(); pie.classList.toggle('sucio', n > 0);
        if (guardado && !n) return; guardado = false;
        gst.textContent = n ? (sec === 'cifras' || sec === 'voz' || sec === 'modelos' ? 'Sin guardar' : `Sin guardar · ${n} ${n === 1 ? 'cambio' : 'cambios'}`) : '';
        gst.className = 'mv-gst' + (n ? ' sin' : '');
      }
      const avisarSalir = e => { if (sucio()) { e.preventDefault(); e.returnValue = ''; } };
      addEventListener('beforeunload', avisarSalir); el._off = () => removeEventListener('beforeunload', avisarSalir);

      // ---- los borradores: si te vas con cambios, se guardan aquí hasta que vuelvas
      function guardarBorrador() {
        if (!sec) return;
        if (!hay()) { E.pend.delete(sec); return; }
        const a = actual(); E.pend.set(sec, sec === 'modelos' ? a : sec === 'cifras' || sec === 'voz' ? a : cambios(fields, E.data.values, a));
      }

      // ---- cada tipo de sección
      const aviso = (t, tono = '') => `<p class="mv-aviso ${tono}">${t}</p>`;
      async function pintarGrupo(id) {
        const d = await datos(ctx), g = d.groups.find(x => x[0] === id); fields = d.fields.filter(f => f.group === id);
        const dr = E.pend.get(id) || {}, v = f => (f.path in dr ? dr[f.path] : d.values[f.path]);
        let ant = '';
        if (id === 'anuncios') ant = aviso('Nada que gaste dinero ocurre sin tus dos clics ni por encima de estos topes, y todo se crea en pausa. Los agentes nunca gastan. El token de Meta nunca va aquí.');
        if (id === 'avisos') ant = aviso(d.telegram?.on ? 'Telegram está conectado.' : 'Telegram no está conectado: se enciende con las variables de entorno <code>TELEGRAM_BOT_TOKEN</code> y <code>TELEGRAM_OWNER_ID</code> (nunca en archivos).');
        cuerpo.innerHTML = ant + (fields.length ? fields.map(f => campoHTML(f, v(f))).join('') : vacio('Nada que ajustar aquí', g ? g[1] : id));
        pie.hidden = !fields.length;
      }
      async function pintarCifras() {
        if (E.cifras === null) { const j = await ctx.api('/api/cifras'); E.cifras = j.items || []; }
        const items = E.pend.get('cifras') ?? E.cifras; E.base = E.cifras.map(x => ({ name: x.name || '', value: x.value || '', unit: x.unit || '', note: x.note || '' }));
        const fila = x => `<div class="mv-cifra mv-card"><label class="mv-lab">Nombre<input data-c="name" value="${esc(x.name || '')}" autocomplete="off" placeholder="Precio del plan"></label>
          <div class="mv-dos"><label class="mv-lab">Valor<input data-c="value" value="${esc(x.value || '')}" autocomplete="off" inputmode="text" placeholder="120"></label><label class="mv-lab">Unidad<input data-c="unit" value="${esc(x.unit || '')}" autocomplete="off" placeholder="US$"></label></div>
          <label class="mv-lab">Nota<input data-c="note" value="${esc(x.note || '')}" autocomplete="off" placeholder="De dónde sale o cuándo cambia"></label><button type="button" class="mv-btn peligro" data-cifra-quitar aria-label="Quitar la cifra ${esc(x.name || 'sin nombre')}">Quitar</button></div>`;
        cuerpo.innerHTML = aviso('Precios, comisiones, metas, horarios: los agentes los leen antes de cada trabajo y los usan tal cual, en vez de adivinarlos.') + `<div id="mvCifras">${items.map(fila).join('')}</div><button type="button" class="mv-btn" data-cifra-mas>+ Añadir una cifra</button>`;
        el._cifraFila = fila; pie.hidden = false;
      }
      async function pintarVoz() {
        if (E.voz === null) E.voz = (await ctx.api('/api/voice')).text || '';
        cuerpo.innerHTML = aviso('Cómo habla tu marca: el tono, las palabras que usa y las que nunca, cómo firma. Todos los agentes la leen.') + `<label class="mv-lab" for="mvVoz">Voz de marca</label><textarea id="mvVoz" class="mv-campo" rows="14" autocapitalize="sentences">${esc(E.pend.get('voz') ?? E.voz)}</textarea>`;
        pie.hidden = false;
      }
      function pintarEmpresa() {
        cuerpo.innerHTML = aviso('Dame tu web y la oficina la lee: escribe en el Cerebro el perfil de tu empresa, tu oferta, tu voz y tus preguntas frecuentes, y propone cifras para que las confirmes. Tarda unos minutos y te avisa al terminar.') +
          '<div class="mv-cm"><label class="mv-lab" for="mvUrl">Tu web</label><input id="mvUrl" type="url" inputmode="url" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="https://panaclaw.com"></div><div class="mv-cm"><label class="mv-lab" for="mvAbout">Lo que la web no dice (opcional)</label><textarea id="mvAbout" rows="4" placeholder="A quién le vendes, qué te diferencia, qué nunca prometes…"></textarea></div>';
        pie.hidden = false; btn.dataset.accion = 'empresa'; btn.textContent = 'Leer mi web y preparar la oficina'; btn.ac0 = btn.innerHTML;
      }
      function pintarApariencia() {
        const th = (() => { try { const v = localStorage.getItem('ao.theme'); return v === 'dark' || v === 'auto' ? v : 'light'; } catch { return 'light'; } })();
        const mv = (() => { try { return localStorage.getItem('ao.movil') || 'auto'; } catch { return 'auto'; } })();
        const opt = (n, k, ley, t, d) => `<label class="mv-opc"><input type="radio" name="${n}" value="${k}"${ley === k ? ' checked' : ''}><span><b>${t}</b><small>${d}</small></span></label>`;
        cuerpo.innerHTML = aviso('Se aplica al instante y se recuerda en este teléfono.') + `<fieldset class="mv-cm"><legend class="mv-lab">Tema</legend>${opt('mvTema', 'light', th, 'Claro', 'El de siempre.')}${opt('mvTema', 'dark', th, 'Oscuro', 'Para la noche.')}${opt('mvTema', 'auto', th, 'Automático', 'Sigue a tu teléfono.')}</fieldset>
          <fieldset class="mv-cm"><legend class="mv-lab">Versión de la oficina</legend>${opt('mvVer', 'auto', mv, 'Automática', 'Móvil en el teléfono, escritorio en una pantalla grande.')}${opt('mvVer', 'movil', mv, 'Móvil', 'Siempre esta versión.')}${opt('mvVer', 'escritorio', mv, 'Escritorio', 'La oficina 3D completa, como en la computadora.')}</fieldset>`;
        pie.hidden = true;
      }
      async function pintarAgentes() {
        const l = await ctx.store.agentes(); const D = { emails: 'Correos', sales: 'Ventas', marketing: 'Marketing', ops: 'Operaciones', fin: 'Finanzas', delivery: 'Entregas' };
        cuerpo.innerHTML = l.length ? Object.entries(D).map(([k, n]) => { const a = l.filter(x => x.dept === k || x.department === k); return a.length ? `<h3 class="mv-gh">${n}<span>${a.length}</span></h3><ul class="mv-lista">${a.map(x => `<li><button type="button" class="mv-lista-b" data-agente="${esc(x.id)}">${svg('persona', 'mv-lista-i')}<span><b>${esc(x.name)}${x.lead ? ' ★' : ''}</b><small>${esc(x.role || '')}</small></span>${svg('der', 'mv-der')}</button></li>`).join('')}</ul>` : ''; }).join('') : vacio('Sin agentes', 'No pude leer el plantel.');
        pie.hidden = true;
      }
      // ---- Modelos (solo en la nube, solo administradores: lo sirve /api/modelos)
      const FUNCIONES = [['agentes', 'Agentes (todos)', true], ['dimitri', 'Dimitri', false], ['redactar', 'Mejorar y redactar', false], ['resumen', 'Resumen del lunes e informes', false], ['enrutador', 'Enrutador', false], ['revision', 'Revisión del jefe', false]];
      const DEPTS = [['emails', 'Correos'], ['sales', 'Ventas'], ['marketing', 'Marketing'], ['ops', 'Operaciones'], ['fin', 'Finanzas'], ['delivery', 'Entregas']];
      let M = null;
      const opcionesM = (sel, vacioT) => `<option value=""${!sel ? ' selected' : ''}>${esc(vacioT)}</option>` + ['anthropic', 'meta'].map(p => { const l = M.catalogo.filter(m => m.proveedor === p); return l.length ? `<optgroup label="${p === 'meta' ? 'Meta' : 'Anthropic'}">${l.map(m => `<option value="${esc(m.id)}"${sel === m.id ? ' selected' : ''}>${esc(m.nombre)}${m.personalizado ? ' (propio)' : ''}</option>`).join('')}</optgroup>` : ''; }).join('');
      const filaM = (rot, k, val, vacioT, herr) => `<div class="mv-cm"><label class="mv-lab" for="mvm-${esc(k)}">${esc(rot)}</label><select id="mvm-${esc(k)}" data-k="${esc(k)}" data-herr="${herr ? 1 : 0}">${opcionesM(val, vacioT)}</select><small class="mv-ayuda" data-av="${esc(k)}">${esc(avisoModelo(M.catalogo, val, herr))}</small></div>`;
      function leerModelos() {
        if (!M) return null; const o = { personalizados: M.ajustes.personalizados || [], oficina: '', funciones: {}, departamentos: {}, agentes: {} };
        for (const s of cuerpo.querySelectorAll('select[data-k]')) { const k = s.dataset.k; if (k === 'oficina') o.oficina = s.value; else if (s.value) { const [t, n] = [k[0], k.slice(2)]; ({ f: o.funciones, d: o.departamentos, a: o.agentes })[t][n] = s.value; } }
        return o;
      }
      async function pintarModelos() {
        if (!(await esAdmin(ctx))) { cuerpo.innerHTML = vacio('Solo para administradores', 'Un administrador elige los modelos de la oficina.'); pie.hidden = true; return; }
        M = await ctx.api('/api/modelos'); const a = E.pend.get('modelos') || M.ajustes; E.baseModelos = leerModelosDe(M.ajustes);
        cuerpo.innerHTML = aviso('Vale desde la <b>próxima</b> tarea: lo que ya corre termina con el modelo con que empezó. Una tarea, una rutina o la ficha de un agente pueden ir por encima.') +
          `<h3 class="mv-gh">Tus llaves</h3><ul class="mv-lista">${M.proveedores.map(p => `<li class="mv-fila-llave ${p.llavePuesta ? 'ok' : 'falta'}"><span><b>${esc(p.nombre)}</b></span><em>${p.llavePuesta ? '✓ llave puesta' : '✕ falta la llave'}</em></li>`).join('')}</ul>
          <h3 class="mv-gh">Quién usa qué</h3>${filaM('Modelo de la oficina', 'oficina', a.oficina, '— el de siempre —', true)}${FUNCIONES.map(([k, n, h]) => filaM(n, 'f:' + k, a.funciones[k], '— el de la oficina —', h)).join('')}
          <details class="mv-acord"><summary>Por departamento</summary>${DEPTS.map(([k, n]) => filaM(n, 'd:' + k, a.departamentos[k], '— el de la función Agentes —', true)).join('')}</details>
          <details class="mv-acord"><summary>Por agente</summary>${(M.agentes || []).map(x => filaM(`${x.nombre}`, 'a:' + x.id, a.agentes[x.id], '— el de su departamento —', true)).join('')}</details>
          <h3 class="mv-gh">Probar este modelo</h3><div class="mv-cm"><label class="mv-lab" for="mvmP">Tu pregunta (opcional)</label><textarea id="mvmP" rows="3" maxlength="600" placeholder="Si la dejas vacía, una de ejemplo"></textarea></div>
          <div class="mv-cm"><label class="mv-lab" for="mvmA">Modelo A</label><select id="mvmA">${opcionesM('claude-sonnet-5-5', '').replace('<option value="" selected></option>', '')}</select></div>
          <div class="mv-cm"><label class="mv-lab" for="mvmB">Modelo B (para comparar)</label><select id="mvmB">${opcionesM('', 'Elige otro…')}</select></div>
          <div class="mv-botones"><button type="button" class="mv-btn ac" data-probar>Probar A</button><button type="button" class="mv-btn ac" data-comparar>Comparar A y B</button></div><div class="mv-res" id="mvmRes" aria-live="polite"></div>`;
        pie.hidden = false;
      }
      const leerModelosDe = a => ({ personalizados: a.personalizados || [], oficina: a.oficina || '', funciones: { ...(a.funciones || {}) }, departamentos: { ...(a.departamentos || {}) }, agentes: { ...(a.agentes || {}) } });
      const tarjetaM = (r, rot) => r.ok ? `<article class="mv-card"><h4>${rot}: ${esc(r.nombre || r.id)}</h4><p class="mv-texto">${esc(r.texto)}</p><p class="mv-meta">${(r.ms / 1000).toFixed(1).replace('.', ',')} s · ${r.tokens?.entrada ?? '?'} → ${r.tokens?.salida ?? '?'} tokens · ${r.costo != null ? usd(r.costo) : 'sin precio'}</p></article>` : `<article class="mv-card"><h4>${rot}: ${esc(r.nombre || r.id || '')}</h4><p class="mv-texto rojo">✕ ${esc(r.error)}</p></article>`;

      // ---- pintar la sección que toca
      async function pintar(id, fresco) {
        const n = ++cargando; sec = id; fields = []; guardado = false; btn.dataset.accion = ''; btn.textContent = 'Guardar'; btn.ac0 = undefined; delete btn.ac0;
        const v = META[id] || [id]; ctx.cabecera({ titulo: v[0] });
        cuerpo.innerHTML = esqueleto(5); pie.hidden = true; pie.querySelectorAll('.ac-err').forEach(x => x.remove()); gst.textContent = ''; pie.classList.remove('sucio');
        try {
          if (id === 'cifras') await pintarCifras(); else if (id === 'voz') await pintarVoz(); else if (id === 'empresa') pintarEmpresa();
          else if (id === 'apariencia') pintarApariencia(); else if (id === 'agentes') await pintarAgentes(); else if (id === 'modelos') await pintarModelos(); else await pintarGrupo(id);
        } catch (e) { if (n === cargando) cuerpo.innerHTML = `<div class="mv-vacio" role="alert">${svg('alerta', 'mv-vacio-i')}<h3>No se pudo abrir</h3><p>${esc(e.message)}</p><button type="button" class="mv-btn" data-reintentar>Reintentar</button></div>`; pie.hidden = true; return; }
        if (n !== cargando) return;
        marcar(); if (fresco) sc.scrollTop = 0;
      }

      // ---- guardar
      async function guardar() {
        const a = actual(); let mensaje = 'Guardado.';
        if (sec === 'empresa') { await enviar('/api/onboard/company', { url: cuerpo.querySelector('#mvUrl').value.trim(), about: cuerpo.querySelector('#mvAbout').value.trim() }); return { hecho: 'En marcha. Te aviso cuando termine (en Estado, y por Telegram si lo tienes).' }; }
        if (sec === 'cifras') { const j = await enviar('/api/cifras', { items: a }); E.cifras = j.items; E.base = a; E.pend.delete('cifras'); return { hecho: `Guardadas ${j.items.length} cifras. Los agentes las usan desde su próxima tarea.` }; }
        if (sec === 'voz') { if (!String(a).trim()) throw new Error('La voz de marca no puede quedar vacía.'); await enviar('/api/voice', { text: a }); E.voz = a; E.pend.delete('voz'); return { hecho: 'Guardada. Los agentes hablan así desde su próxima tarea.' }; }
        if (sec === 'modelos') { const r = await ctx.api('/api/modelos', { method: 'PUT', body: { ajustes: a } }); M.ajustes = r.ajustes; E.baseModelos = leerModelosDe(r.ajustes); E.pend.delete('modelos'); document.dispatchEvent(new CustomEvent('ao:modelos')); return { hecho: r.cambios && r.cambios.length ? 'Guardado. Vale desde la próxima tarea.' : 'No había cambios.' }; }
        const ch = cambios(fields, E.data.values, a);
        if (!Object.keys(ch).length) return { hecho: 'No hay cambios que guardar.' };
        const j = await enviar('/api/settings', { changes: ch });
        if (j.errors?.length) throw new Error(j.errors.join(' · '));
        E.data = null; E.pend.delete(sec); const top = sc.scrollTop; await datos(ctx, true); await pintarGrupo(sec); sc.scrollTop = top;
        return { hecho: j.restart ? 'Guardado. Lo marcado con ↻ se aplica al reiniciar la oficina.' : 'Guardado y aplicado.' };
      }
      async function alGuardar() {
        if (btn.getAttribute('aria-busy') === 'true') return false;
        if (!['empresa'].includes(sec) && !cuantos()) { ctx.toast('No hay cambios que guardar.'); return true; }
        gst.textContent = 'Guardando…'; gst.className = 'mv-gst';
        const r = await conEstado(btn, guardar, { ocupado: 'Guardando…', hecho: sec === 'empresa' ? 'En marcha' : 'Guardado ✓' });
        if (r.ok) { guardado = true; gst.textContent = r.valor.hecho; gst.className = 'mv-gst ok'; pie.classList.remove('sucio'); setTimeout(() => { if (guardado && gst.classList.contains('ok')) { gst.textContent = ''; guardado = false; } }, 5000); }
        else { gst.textContent = 'Sin guardar'; gst.className = 'mv-gst sin'; }
        return r.ok;
      }

      // ---- eventos
      btn.addEventListener('click', alGuardar);
      cuerpo.addEventListener('input', marcar); cuerpo.addEventListener('change', e => {
        marcar();
        if (e.target.name === 'mvTema') { ponerTema(e.target.value); ctx.toast('Tema: ' + ({ light: 'claro', dark: 'oscuro', auto: 'automático' })[e.target.value] + '.'); }
        if (e.target.name === 'mvVer') {
          const v = e.target.value;
          const poner = () => { try { localStorage.setItem('ao.movil', v); } catch {} dispatchEvent(new Event('ao:movil')); };
          if (v === 'escritorio') ctx.confirmar({ titulo: '¿Pasar a la versión de escritorio?', texto: 'Verás la oficina 3D completa. Para volver: Ajustes → Apariencia en esa versión, o abre esta página otra vez en el teléfono.', ok: 'Pasar a escritorio' }).then(ok => { if (ok) poner(); else pintarApariencia(); });
          else { try { localStorage.setItem('ao.movil', v); } catch {} ctx.toast('Versión: ' + (v === 'movil' ? 'móvil' : 'automática') + '.'); }
        }
        if (e.target.matches('select[data-k]')) { const av = cuerpo.querySelector(`[data-av="${CSS.escape(e.target.dataset.k)}"]`); if (av && M) av.textContent = avisoModelo(M.catalogo, e.target.value, e.target.dataset.herr === '1'); }
      });
      cuerpo.addEventListener('click', async e => {
        if (e.target.closest('[data-reintentar]')) return pintar(sec);
        const ag = e.target.closest('[data-agente]'); if (ag) return ctx.navegar('agente', { id: ag.dataset.agente });
        if (e.target.closest('[data-persona-mas]')) { const c = cuerpo.querySelector('.mv-people'); c.insertAdjacentHTML('beforeend', personaHTML({})); c.lastElementChild.querySelector('input').focus(); marcar(); return; }
        if (e.target.closest('[data-persona-quitar]')) { e.target.closest('.mv-persona').remove(); marcar(); return; }
        if (e.target.closest('[data-cifra-mas]')) { cuerpo.querySelector('#mvCifras').insertAdjacentHTML('beforeend', el._cifraFila({})); cuerpo.querySelector('#mvCifras').lastElementChild.querySelector('input').focus(); marcar(); return; }
        if (e.target.closest('[data-cifra-quitar]')) { e.target.closest('.mv-cifra').remove(); marcar(); return; }
        const pr = e.target.closest('[data-probar]'), cm = e.target.closest('[data-comparar]');
        if (pr || cm) {
          const b = pr || cm, res = cuerpo.querySelector('#mvmRes'), pedido = cuerpo.querySelector('#mvmP').value, A = cuerpo.querySelector('#mvmA').value, B = cuerpo.querySelector('#mvmB').value;
          if (pr) { const r = await conEstado(b, () => ctx.api('/api/modelos/probar', { method: 'POST', body: { modelo: A, pedido } }).catch(x => ({ ok: false, error: x.message, id: A })), { ocupado: 'Preguntando…', hecho: 'Listo' }); if (r.ok) res.innerHTML = tarjetaM(r.valor, 'A'); return; }
          if (!B) { res.innerHTML = aviso('Elige un modelo B para comparar.', 'malo'); return; }
          if (b.dataset.listo !== '1') { // primero el costo, después el gasto: un segundo toque lo confirma
            const r = await conEstado(b, () => ctx.api('/api/modelos/comparar', { method: 'POST', body: { a: A, b: B, pedido } }), { ocupado: 'Calculando el costo…', hecho: 'Costo listo', ms: 400 });
            if (r.ok) { res.innerHTML = aviso(esc(r.valor.aviso || `Comparar gasta como mucho ${usd(r.valor.costoMaximo)}.`)); b.dataset.listo = '1'; setTimeout(() => { b.dataset.listo = ''; if (b.isConnected) { b.innerHTML = b.ac0 || 'Comparar A y B'; } }, 20000); setTimeout(() => { if (b.dataset.listo === '1') b.innerHTML = `Sí, comparar (hasta ${usd(r.valor.costoMaximo)})`; }, 450); }
            return;
          }
          b.dataset.listo = '';
          const r = await conEstado(b, () => ctx.api('/api/modelos/comparar', { method: 'POST', body: { a: A, b: B, pedido, confirmar: true } }), { ocupado: 'Comparando…', hecho: 'Listo' });
          if (r.ok) res.innerHTML = tarjetaM(r.valor.a, 'A') + tarjetaM(r.valor.b, 'B');
        }
      });

      // ---- salir con cambios: antes de irte se pregunta; con el gesto o el botón del teléfono se guarda el borrador y se avisa
      shell.raiz.querySelector('.mv-atras')?.addEventListener('click', e => {
        if (el.hidden || !sucio()) return;
        e.stopImmediatePropagation(); e.preventDefault();
        const h = ctx.hoja({ titulo: 'Tienes cambios sin guardar', cuerpo: `<p class="mv-texto">En «${esc((META[sec] || [sec])[0])}». ¿Qué hago con ellos?</p>`, acciones: [
          { texto: 'Guardar y salir', tipo: 'primario', alTocar: async (hh) => { hh.cerrar(); if (await alGuardar()) setTimeout(() => ctx.volver(), 260); } },
          { texto: 'Descartar', tipo: 'peligro', alTocar: (hh) => { E.pend.delete(sec); hh.cerrar(); setTimeout(() => { sec = null; ctx.volver(); }, 260); } },
          { texto: 'Seguir editando', alTocar: hh => hh.cerrar() }] });
      }, true);
      el._pintar = pintar; el._guardarBorrador = guardarBorrador; el._sec = () => sec;
    },
    desmontar(el) { el._off?.(); },
    alMostrar(el, ctx, p) { el._pintar(p?.s || el._sec?.() || 'general', true); }, // al volver de una pantalla hija (la ficha de un agente) los params son los de ella: la sección es la que ya estaba
    alOcultar(el, ctx) {
      const antes = el._sec?.(); el._guardarBorrador?.();
      if (antes && E.pend.has(antes)) ctx.toast(`Quedaron cambios sin guardar en «${(META[antes] || [antes])[0]}».`, { accion: 'Revisar', alAccion: () => ctx.navegar('ajustes-seccion', { s: antes }) });
    },
  });
}
