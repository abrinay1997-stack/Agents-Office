// El banco de presets en la página (src/studio-banco.js, con su lógica pura en src/studio-banco-core.js): la marca de cada
// tarjeta, la portada, el pedido que manda el compositor, la pila con sus ejes exclusivos (también dentro de una receta), los
// chips, el canal que añade la exportación, el teclado y el resumen de la QA. Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { cargarFabrica } from '../presets/fabrica.mjs';
import * as B from '../src/studio-banco.js';
import * as core from '../src/presets-core.js';
import * as K from '../src/studio-banco-core.js';

const fab = cargarFabrica();
const byId = new Map(fab.presets.map(p => [p.id, p]));
const P = id => byId.get(id);

test('la marca de la tarjeta dice en texto cómo se hace (§7.4)', () => {
  assert.equal(B.marca(P('luz-mas-clara')), 'gratis · en tu máquina');
  assert.equal(B.marca(P('luz-mas-clara'), { sharp: false }), 'no disponible en esta máquina');
  assert.match(B.marca(P('fondo-blanco')), /necesita tu foto/);
  assert.equal(B.marca(P('esc-sala'), { sirve: { on: false } }), 'sin motor: actívalo');
  assert.match(B.marca(P('ref-estilo')), /la IA rehace la imagen/i, 'la honestidad del preset, en texto');
});

test('la portada: favoritos, de PanaClaw, recientes y las estrella que encajan con la puerta', () => {
  const ps = [...fab.presets, { id: 'mio-x', nombre: 'Mío', categoria: 'mios', modos: ['foto'] }];
  const s = B.portada(ps, { fav: ['luz-mas-clara', 'no-existe'], rec: ['color-blancos'], puerta: 'foto' });
  assert.deepEqual(s.map(x => x.titulo), ['Favoritos', 'De PanaClaw', 'Recientes', 'Para empezar']);
  assert.deepEqual(s[0].ids, ['luz-mas-clara'], 'un id que no existe no sale');
  assert.ok(s[3].ids.every(id => core.modoAdmite(byId.get(id), 'foto')));
  const cero = B.portada(fab.presets, { puerta: 'cero' }).find(x => x.titulo === 'Para empezar');
  assert.ok(!cero || cero.ids.every(id => core.modoAdmite(byId.get(id), 'cero')));
});

test('el pedido del compositor: las puertas son atajos; el modo sale de lo que pusiste', () => {
  const st = { puerta: 'cero', foto: 'f.png', refs: [{ id: 'r.png', ejes: { color: 2 } }], pila: [{ id: 'luz-mas-clara', params: { intensidad: 'fuerte' } }, { id: 'color-blancos', params: {} }], canal: 'web', escena: null, idea: 'que se vea la madera' };
  assert.equal(B.modoDeEstado(st), 'foto+ref', 'la puerta «Desde cero» no borra la foto ni la referencia');
  const p = B.pedidoDe(st);
  assert.deepEqual(p.pila, [{ id: 'luz-mas-clara', params: { intensidad: 'fuerte' } }, { id: 'color-blancos' }]);
  assert.deepEqual(p.params, { canal: 'web' });
  assert.deepEqual(p.entradas, { foto: ['f.png'], referencias: [{ id: 'r.png', ejes: { color: 2 } }] });
  assert.equal(p.idea, 'que se vea la madera'); assert.equal(p.escena, undefined);
  assert.equal(B.modoDeEstado({ foto: null, refs: [] }), 'cero');
});

test('apilar: una vez cada uno; en un eje exclusivo gana el último, con DESHACER', () => {
  let r = B.anadir([], P('fondo-blanco'), byId); assert.equal(r.aviso, null);
  const fondoGris = fab.presets.find(p => p.id !== 'fondo-blanco' && p.capa === 'ajuste' && (p.ejes || []).includes('fondo') && p.medios.includes('image'));
  const r2 = B.anadir(r.pila, fondoGris, byId);
  assert.deepEqual(r2.pila.map(x => x.id), [fondoGris.id]);
  assert.match(r2.aviso.texto, /sustituyó a «Fondo blanco puro»/); assert.deepEqual(r2.aviso.antes, r.pila);
  const r3 = B.anadir(r2.pila, P('luz-mas-clara'), byId); assert.equal(r3.pila.length, 2, 'la luz se suma');
  assert.equal(B.anadir(r3.pila, P('luz-mas-clara'), byId).pila.length, 2, 'no se repite');
});

test('el canal añade «Exportar para un canal» solo si nada de la pila exporta ya', () => {
  assert.equal(B.exportaYa([{ id: 'luz-mas-clara' }], byId), false);
  assert.equal(B.exportaYa([{ id: 'cat-web-panaclaw' }], byId), true);
  assert.equal(B.exportaYa([{ id: 'sal-canal' }], byId), true);
});

test('el resumen de la QA en la tarjeta: revisar con su motivo, o cuántas pasaron y cuántas no se midieron', () => {
  assert.equal(B.qaResumen(null), null);
  assert.deepEqual(B.qaResumen({ checks: [{ id: 'fondo-255', ok: true }, { id: 'ocupacion', ok: null }] }), { estado: 'ok', texto: 'QA ✓ 1 de 2 · 1 sin medir' });
  assert.deepEqual(B.qaResumen({ checks: [{ id: 'fondo-255', ok: false, motivo: 'Solo el 90 % del borde es blanco 255.' }] }), { estado: 'revisar', texto: 'Revisar: Solo el 90 % del borde es blanco 255.' });
  assert.equal(B.usd(0), 'gratis'); assert.equal(B.usd(0.134), 'US$0,13');
});

test('los atajos de la referencia: «Producto» nunca viene encendido; «Solo color» no manda nada a la IA', () => {
  for (const a of B.ATAJOS_REF) assert.equal(a.ejes.producto, 0, a.id);
  const color = B.ATAJOS_REF.find(a => a.id === 'color');
  const c = core.compilar({ pila: [], byId: fab.presets, familias: fab.familias, tipos: fab.tipos, canales: fab.canales, models: [], capacidades: { local: true }, entradas: { foto: ['f.png'], referencias: [{ id: 'r.png', ejes: color.ejes }] } });
  assert.equal(c.soloLocal, true, c.errores.join());
  assert.ok(c.local.antes.some(o => o.op === 'transferir-color'));
});

/* ---------- el injerto (1 oct 2026): src/studio-banco-core.js, la lógica de la hoja de lane/presets-banco2 ---------- */

test('el núcleo es el mismo que exporta la página (studio-lotes.js importa marca, anadir y usd de studio-banco.js)', () => {
  for (const k of ['marca', 'anadir', 'usd', 'portada', 'pedidoDe', 'qaResumen', 'ATAJOS_REF', 'PUERTAS']) assert.equal(B[k], K[k], k);
});

test('los cuatro atajos de la referencia, con «Hazlo como este anuncio» primero; el pulsado se reconoce por sus ejes', () => {
  assert.deepEqual(K.ATAJOS_REF.map(a => a.es), ['Hazlo como este anuncio', 'Todo el look', 'Solo color (LUT)', 'Solo composición']);
  assert.deepEqual(K.ATAJOS_REF[0].ejes, { ...core.EJES_REF_ANUNCIO });
  assert.equal(K.atajoDe({ estilo: 0, color: 2, composicion: 0, luz: 0, fondo: 0, pose: 0, producto: 0 }), 'color');
  assert.equal(K.atajoDe({ ...core.EJES_REF_DEF }), null, 'lo de por defecto (estilo y color) no es ningún atajo');
  const refs = [{ id: 'a.png', ejes: { ...core.EJES_REF_DEF } }, { id: 'b.png', ejes: { ...core.EJES_REF_DEF } }];
  const r = K.conAtajo(refs, 1, 'comp');
  assert.equal(K.atajoDe(r[1].ejes), 'comp'); assert.deepEqual(r[0], refs[0], 'la otra referencia no se toca');
  assert.equal(K.conAtajo(refs, 5, 'comp'), refs);
  assert.equal(Object.values(K.EJE_INFO).filter(e => e.local).length, 1, 'solo el color es local');
  assert.equal(K.EJE_INFO.color.local, true);
});

test('DESHACER también cuando lo sustituido va dentro de una receta; y una receta sustituye a otra', () => {
  const r = K.anadir([], P('cat-web-panaclaw'), byId);
  const r2 = K.anadir(r.pila, P('fondo-gris'), byId);
  assert.deepEqual(r2.pila.map(x => x.id), ['cat-web-panaclaw', 'fondo-gris'], 'la receta se queda: solo pierde su fondo');
  const dentro = r2.avisos.find(a => a.dentro);
  assert.ok(dentro && dentro.pierde === 'fondo-blanco', JSON.stringify(r2.avisos));
  assert.match(r2.aviso.texto, /dentro de «Catálogo/); assert.deepEqual(r2.aviso.antes, r.pila, 'DESHACER devuelve la pila de antes');
  const r3 = K.anadir(r2.pila, P('cat-proveedor'), byId);
  assert.ok(r3.avisos.some(a => a.eje === 'receta' && a.pierde === 'cat-web-panaclaw'));
  assert.equal(r3.pila.filter(x => P(x.id).capa === 'receta').length, 1, 'como mucho una receta, como en el compilador');
  const sin = K.anadir([{ id: 'luz-mas-clara', params: {} }], P('color-blancos'), byId);
  assert.equal(sin.aviso, null, 'lo que se suma no avisa'); assert.deepEqual(sin.avisos, []);
  assert.equal(K.anadir(sin.pila, P('color-blancos'), byId).pila, sin.pila, 'no se repite');
});

test('los chips: «N pasos» de la receta, Suave · Normal · Fuerte solo si el preset la tiene, y lo que perdió su eje', () => {
  const pila = K.anadir(K.anadir([], P('cat-web-panaclaw'), byId).pila, P('fondo-gris'), byId).pila;
  const [rc, fg] = K.chipsDe(pila, byId);
  assert.ok(rc.receta && rc.pasos.length >= 3, 'la receta es un chip con contador');
  assert.ok(!rc.pasos.some(x => x.id === 'fondo-blanco'), 'lo que otro le ganó no sale entre sus pasos');
  assert.equal(fg.receta, false); assert.equal(fg.fuera, false);
  const tiene = p => (p.parametros || []).some(q => q.tipo === 'intensidad' || q.id === 'intensidad');
  const conInt = fab.presets.find(p => tiene(p) && p.medios.includes('image') && p.capa !== 'receta');
  const sinInt = fab.presets.find(p => !tiene(p) && p.medios.includes('image'));
  const ch = K.chipsDe([{ id: conInt.id, params: {} }, { id: sinInt.id, params: {} }], byId);
  assert.equal(ch[0].intensidad, 'normal'); assert.equal(ch[1].intensidad, null, 'sin el parámetro no se ofrece (el compilador no lo usaría)');
  const fuerte = K.ponerIntensidad([{ id: conInt.id, params: {} }], 0, 'fuerte');
  assert.equal(K.chipsDe(fuerte, byId)[0].intensidad, 'fuerte');
  assert.deepEqual(K.ponerIntensidad(fuerte, 0, 'normal')[0].params, {}, '«normal» no se guarda: el pedido no cambia por nada');
  // un ajuste elegido ANTES de una receta que trae el mismo eje: gana el del dueño y el de la receta no sale entre sus pasos
  const antes = K.chipsDe([{ id: 'fondo-gris', params: {} }, { id: 'cat-web-panaclaw', params: {} }], byId);
  assert.ok(!antes[1].pasos.some(x => x.id === 'fondo-blanco'));
});

test('la portada rellena «Desde cero» (de 6 a 8) con lo que encaja, sin repetir lo de arriba', () => {
  const img = fab.presets.filter(p => p.medios.includes('image'));
  for (const puerta of ['cero', 'foto', 'ref']) {
    const s = K.portada(img, { puerta }).find(x => x.titulo === 'Para empezar');
    assert.ok(s.ids.length >= 6 && s.ids.length <= 8, `${puerta}: ${s.ids.length}`);
    const modo = K.modoDePuerta(puerta);
    assert.ok(s.ids.every(id => core.modoAdmite(byId.get(id), modo)), puerta);
  }
  assert.ok(!K.portada(img, { puerta: 'cero' }).find(x => x.titulo === 'Para empezar').ids.includes('luz-mas-clara'), 'lo que pide tu foto no sale en «Desde cero»');
  const top = K.portada(img, { puerta: 'foto', fav: ['cat-web-panaclaw'], rec: ['luz-arreglar'] }).find(x => x.titulo === 'Para empezar').ids;
  assert.ok(!top.includes('cat-web-panaclaw') && !top.includes('luz-arreglar'), 'favoritos y recientes no se repiten abajo');
  assert.equal(K.modoDePuerta('ref', { foto: 'f.png' }), 'foto+ref');
});

test('la puerta dice lo que le falta, sin borrar nada', () => {
  assert.match(K.faltaEnPuerta({ puerta: 'foto', foto: null, refs: [] }), /tu foto/);
  assert.match(K.faltaEnPuerta({ puerta: 'ref', foto: 'f.png', refs: [] }), /referencia/);
  assert.equal(K.faltaEnPuerta({ puerta: 'cero', foto: null, refs: [] }), '');
  assert.equal(K.faltaEnPuerta({ puerta: 'foto', foto: 'f.png', refs: [] }), '');
});

test('el teclado: roving tabindex con ↑ ↓ Inicio Fin, y Esc por capas', () => {
  assert.equal(K.moverEnLista('ArrowDown', 0, 5), 1);
  assert.equal(K.moverEnLista('ArrowDown', 4, 5), 4, 'en la última se queda');
  assert.equal(K.moverEnLista('ArrowUp', 3, 5), 2);
  assert.equal(K.moverEnLista('ArrowUp', 0, 5), 'buscar', '↑ en la primera vuelve al buscador');
  assert.equal(K.moverEnLista('Home', 3, 5), 0); assert.equal(K.moverEnLista('End', 0, 5), 4);
  assert.equal(K.moverEnLista('Enter', 1, 5), -1, 'Enter es de la tarjeta (añade o quita)');
  assert.equal(K.moverEnLista('ArrowDown', 0, 0), -1);
  assert.equal(K.capaEsc({ chip: true, guardar: true, enBuscador: true, q: 'x', hoja: true }), 'chip', 'lo de más adentro primero');
  assert.equal(K.capaEsc({ guardar: true, hoja: true }), 'guardar');
  assert.equal(K.capaEsc({ enBuscador: true, q: 'luz', hoja: true }), 'busqueda');
  assert.equal(K.capaEsc({ enBuscador: true, q: '', hoja: true }), 'hoja', 'con el buscador vacío, Esc cierra la hoja');
  assert.equal(K.capaEsc({ q: 'luz', hoja: true }), 'hoja', 'fuera del buscador, lo escrito no retiene Esc');
  assert.equal(K.capaEsc({}), null, 'sin nada del banco abierto, Esc es del Estudio');
  assert.deepEqual(K.PESTANAS.map(x => x[1]), ['Elegir', 'Mi receta', 'Qué hará']); assert.equal(K.ESTRECHO, 700);
  assert.equal(K.cuantos(0), 'Ningún resultado'); assert.equal(K.cuantos(1), '1 resultado'); assert.equal(K.cuantos(4), '4 resultados');
});

test('la marca y su tipo: el color acompaña al texto, nunca lo sustituye', () => {
  assert.equal(K.tipoMarca(P('luz-mas-clara')), 'gratis');
  assert.equal(K.tipoMarca(P('luz-mas-clara'), { sharp: false }), 'falta');
  assert.equal(K.tipoMarca(P('esc-sala'), { sirve: { on: false } }), 'falta');
  assert.equal(K.tipoMarca(P('fondo-pared')), 'ia');
});

test('DESHACER vuelve atrás solo lo que cambió la acción que avisó (revisión del injerto)', () => {
  // sustituyo «fondo-blanco» por «fondo-gris» (sale DESHACER) y, en esos 8 s, elijo mi foto y un atajo de la referencia
  const st = { foto: null, refs: [{ id: 'r.png', ejes: { ...core.EJES_REF_DEF } }], pila: [{ id: 'fondo-blanco', params: {} }], canal: null, escena: null };
  const snap = K.instantanea(st, ['pila']);
  st.pila = K.anadir(st.pila, P('fondo-gris'), byId).pila;
  st.foto = 'mia.png';
  assert.equal(K.tocaDeshacer(snap, ['foto']), false, 'elegir la foto no anula un DESHACER de la pila');
  st.refs = K.conAtajo(st.refs, 0, 'color');
  K.restaurar(st, snap);
  assert.deepEqual(st.pila.map(x => x.id), ['fondo-blanco'], 'la pila vuelve');
  assert.equal(st.foto, 'mia.png', 'DESHACER no borra la foto recién elegida');
  assert.equal(K.atajoDe(st.refs[0].ejes), 'color', 'ni el atajo marcado después');
  // la instantánea es una copia: lo que se toque después no la cambia
  const s2 = { pila: [{ id: 'a', params: { intensidad: 'fuerte' } }], refs: [{ id: 'r', ejes: { color: 2 } }], foto: 'f' };
  const sn = K.instantanea(s2, ['pila', 'refs']);
  s2.pila[0].params.intensidad = 'suave'; s2.refs[0].ejes.color = 0;
  assert.equal(sn.v.pila[0].params.intensidad, 'fuerte'); assert.equal(sn.v.refs[0].ejes.color, 2);
  assert.equal(K.tocaDeshacer(sn, ['refs']), true, 'una acción sin aviso sobre lo mismo anula el DESHACER (ya no sabría a qué volver)');
  assert.equal(K.tocaDeshacer(null, ['pila']), false);
});
