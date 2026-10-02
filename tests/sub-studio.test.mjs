// Dimitri's «Plan de creativos» on the page (src/sub-studio.js): the pure parts — the total, the budget check, the body that
// GENERAR posts to /api/sub/studio, and the reducer that makes the copy of an image Claude's vision sees.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planTotal, unitCost, fitsBudget, studioBody, fitWithin, shrinkStep, b64Bytes, usd, creativesHTML, actionsHTML, stripHTML, discardBody, applyDiscards, outgoing, VISION_SIDE, VISION_BYTES, loteHTML, loteRefHTML, loteVivo, esHoja, actionsCost } from '../src/sub-studio.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MODELS = [
  { id: 'nano-banana-2', name: 'Nano Banana 2', kind: 'image', on: true, cost: 0.04, per: 'image', settings: { aspectRatio: { type: 'enum', values: ['1:1', '4:5', '9:16'], default: '1:1' } } },
  { id: 'gpt-image-1', name: 'GPT Image', kind: 'image', on: true, cost: 0.08, per: 'image' },
  { id: 'veo-3.1-fast', name: 'Veo 3.1 Fast', kind: 'video', on: true, cost: 0.15, per: 'second', settings: { duration: { type: 'enum', values: [4, 6, 8], default: 8 } } },
];
const CREATIVES = [
  { i: 0, title: 'Portada', kind: 'image', model: 'nano-banana-2', n: 2, cost: 0.08, settings: { aspectRatio: '4:5' }, prompt: 'a cat', state: 'proposed' },
  { i: 1, title: 'Reel', kind: 'video', model: 'veo-3.1-fast', n: 1, cost: 1.2, settings: { duration: 8 }, prompt: 'a dog', state: 'proposed' },
  { i: 2, title: 'Ya enviado', kind: 'image', model: 'gpt-image-1', n: 1, cost: 0.08, state: 'sent', jobId: 'j1' },
];

test('el total suma lo que queda por enviar, con la cantidad y el modelo que dejó el dueño', () => {
  const t = planTotal(CREATIVES, new Map(), MODELS);
  assert.equal(t.count, 2); assert.equal(t.units, 3); assert.equal(t.total, 1.28); // 2 × 0,04 + 1,20; lo enviado no cuenta
  const ed = new Map([[0, { n: 4 }], [1, { include: false }]]);
  assert.deepEqual(planTotal(CREATIVES, ed, MODELS), { count: 1, units: 4, weight: 4, total: 0.16, items: [{ i: 0, n: 4, cost: 0.16 }] });
  assert.equal(t.weight, 7); // 2 imágenes + 1 video × 5, como cuenta media.budget
  assert.equal(planTotal(CREATIVES, new Map([[0, { model: 'gpt-image-1' }]]), MODELS).items[0].cost, 0.16); // otro modelo: el precio del catálogo
});

test('un video cobra por segundo: cambiar la duración cambia el costo', () => {
  assert.equal(unitCost(CREATIVES[1], MODELS[2], { duration: 8 }), 1.2); // lo que estimó Dimitri
  assert.equal(+unitCost(CREATIVES[1], MODELS[2], { duration: 4 }).toFixed(2), 0.6);
  assert.equal(unitCost({ model: 'x', n: 1 }, null), 0); // sin modelo ni estimación: 0, nunca NaN
});

test('cabe o no cabe en lo que queda del día y del mes', () => {
  assert.equal(fitsBudget(1, { costLeftDay: 5, costLeftMonth: 20 }).fits, true);
  const no = fitsBudget(6, { costLeftDay: 5, costLeftMonth: 20 });
  assert.equal(no.fits, false); assert.match(no.why, /quedan US\$5,00 hoy/);
  assert.match(fitsBudget(3, { costLeftDay: null, costLeftMonth: 2 }).why, /este mes/);
  assert.equal(fitsBudget(9, { costLeftDay: null, costLeftMonth: null }).why, 'sin tope de gasto');
  assert.deepEqual(fitsBudget(9, null, { fits: false, why: 'lo dice el servidor' }), { fits: false, why: 'lo dice el servidor' }); // sin presupuesto en la página: manda el servidor
});

test('el tope de cantidad del día también cuenta (un video vale 5), aunque no haya tope en dólares', () => {
  const b = { left: 4, costLeftDay: null, costLeftMonth: null };
  const no = fitsBudget(0.5, b, null, 7);
  assert.equal(no.fits, false); assert.match(no.why, /quedan 4 hoy/);
  assert.deepEqual(fitsBudget(0.5, b, null, 4), { fits: true, why: 'cabe en el tope de hoy (quedan 4)' });
  assert.equal(fitsBudget(0.5, { left: null, costLeftDay: null, costLeftMonth: null }, null, 99).why, 'sin tope de gasto'); // left null: tope apagado
  const h = creativesHTML({ id: 'm5', studio: { creatives: [CREATIVES[1]] } }, { esc, models: MODELS, budget: b }); // un video de 8 s pesa 5 > 4
  assert.match(h, /sc-total bad/); assert.match(h, /quedan 4 hoy/);
});

test('«Descartar» nunca manda acciones: con una acción propuesta no llama al servidor, y se descarta en la página', () => {
  const withAct = { creatives: [CREATIVES[0], CREATIVES[2]], actions: [{ type: 'mover', files: ['a.png'], folder: 'X', state: 'proposed' }, { type: 'carpeta_crear', name: 'Y', state: 'done' }] };
  assert.equal(discardBody('m1', withAct), null); // /api/sub/studio ejecuta toda acción propuesta: ni se le llama
  const onlyCreatives = { creatives: CREATIVES, actions: [{ type: 'carpeta_crear', name: 'Y', state: 'done' }] };
  const b = discardBody('m1', onlyCreatives);
  assert.deepEqual(b, { msg: 'm1', items: [{ i: 0, include: false }, { i: 1, include: false }] }); assert.equal('actions' in b, false);
  assert.equal(discardBody('m1', { creatives: [CREATIVES[2]] }), null); // nada propuesto: nada que mandar
  const msgs = [{ id: 'm1', studio: withAct }, { id: 'm2', studio: { creatives: [CREATIVES[0]] } }];
  const shown = applyDiscards(msgs, new Set(['m1']));
  assert.deepEqual(shown[0].studio.creatives.map(c => c.state), ['skipped', 'sent']); assert.deepEqual(shown[0].studio.actions.map(a => a.state), ['skipped', 'done']);
  assert.equal(shown[1], msgs[1]); assert.equal(msgs[0].studio.actions[0].state, 'proposed'); // lo demás intacto, y el original no se toca
  const h = creativesHTML(shown[0], { esc, models: MODELS });
  assert.doesNotMatch(h, /sc-go|sc-skip/); assert.match(h, /\(no se hizo\)/);
});

test('un mensaje sin texto cuyas imágenes no subieron no se envía', () => {
  const failed = [{ state: 'failed', err: 'x' }, { state: 'failed' }];
  assert.equal(outgoing('', failed).send, false); assert.equal(outgoing('  ', failed).lost.length, 2);
  const one = outgoing('', [{ state: 'ready', file: 'a.png' }, { state: 'failed' }]);
  assert.equal(one.send, true); assert.equal(one.text, 'Mira esta imagen.'); assert.equal(one.lost.length, 1);
  assert.equal(outgoing('hola', failed).text, 'hola'); assert.equal(outgoing('', [{ state: 'ready', file: 'a' }, { state: 'ready', file: 'b' }]).text, 'Mira estas imágenes.');
});

test('GENERAR envía solo lo propuesto y solo lo que el dueño cambió', () => {
  const ed = new Map([[0, { prompt: 'a black cat', n: 3, settings: { aspectRatio: '9:16' }, folder: 'Lanzamiento' }], [1, { include: false }]]);
  const b = studioBody('m9', { creatives: CREATIVES }, ed);
  assert.deepEqual(b, { msg: 'm9', items: [
    { i: 0, include: true, prompt: 'a black cat', n: 3, settings: { aspectRatio: '9:16' }, folder: 'Lanzamiento' },
    { i: 1, include: false },
  ] });
  assert.deepEqual(studioBody('m9', { creatives: CREATIVES }, new Map([[0, { prompt: 'a cat', n: 2 }]])).items[0], { i: 0, include: true }); // lo mismo que propuso: nada que mandar
  const withActs = studioBody('m9', { creatives: [], actions: [{ type: 'carpeta_crear', name: 'A' }, { type: 'mover', files: ['x'], folder: 'A', state: 'done' }, { type: 'carpeta_crear', name: 'B' }] }, new Map(), new Map([[2, false]]));
  assert.deepEqual(withActs.actions, [{ k: 0, include: true }, { k: 2, include: false }]); // la ya hecha no vuelve
});

test('la copia para la visión: lado largo ≤1568 px, nunca se agranda', () => {
  assert.deepEqual(fitWithin(3840, 2160), { w: VISION_SIDE, h: 882, scaled: true });
  assert.deepEqual(fitWithin(2160, 3840), { w: 882, h: VISION_SIDE, scaled: true });
  assert.deepEqual(fitWithin(800, 600), { w: 800, h: 600, scaled: false });
  assert.deepEqual(fitWithin(0, 0), { w: 1, h: 1, scaled: false });
});

test('si la copia pesa más de 1,5 MB baja la calidad, y luego el tamaño, hasta caber', () => {
  assert.equal(shrinkStep({ w: 100, h: 100, q: 0.85 }, VISION_BYTES), null);
  assert.deepEqual(shrinkStep({ w: 1568, h: 882, q: 0.85 }, VISION_BYTES + 1), { w: 1568, h: 882, q: 0.75 });
  assert.deepEqual(shrinkStep({ w: 1568, h: 882, q: 0.55 }, VISION_BYTES + 1), { w: 1254, h: 706, q: 0.85 });
  let t = { w: 1568, h: 1568, q: 0.85 }, k = 0; // a model where the bytes follow the pixels and the quality: it always ends
  for (const bytes = s => s.w * s.h * s.q * 1.2; shrinkStep(t, bytes(t)) && k < 30; k++) t = shrinkStep(t, bytes(t));
  assert.ok(k < 30 && t.w * t.h * t.q * 1.2 <= VISION_BYTES);
  assert.equal(b64Bytes('data:image/jpeg;base64,QUJD'), 3); assert.equal(b64Bytes('QUI='), 2); assert.equal(b64Bytes('QQ=='), 1);
});

test('las tarjetas: GENERAR con la cuenta, «no se incluye» con texto y nada sin escapar', () => {
  const m = { id: 'm1', studio: { creatives: [{ ...CREATIVES[0], title: '<b>Portada</b>', prompt_es: 'un gato' }], actions: [{ type: 'carpeta_crear', name: 'Lanzamiento' }], estimate: { total: 0.08, fits: true } } };
  const h = creativesHTML(m, { esc, models: MODELS, budget: { costLeftDay: 1, costLeftMonth: 10, maxPerRequest: 4 } });
  assert.match(h, /GENERAR \(2\) — US\$0,080/);
  assert.match(h, /&lt;b&gt;Portada&lt;\/b&gt;/); assert.doesNotMatch(h, /<b>Portada/);
  assert.match(h, /Crear la carpeta «Lanzamiento»/);
  assert.match(h, /<option value="4:5" selected>/);
  const off = creativesHTML(m, { esc, models: MODELS, edits: new Map([[0, { include: false }]]) });
  assert.match(off, /no se incluye/); assert.match(off, /HACER \(1\)/); // queda la acción
  const done = creativesHTML({ id: 'm2', studio: { creatives: [{ ...CREATIVES[0], state: 'done', files: ['2026-09/a.png'] }] } }, { esc, models: MODELS });
  assert.match(done, /listo/); assert.match(done, /data-open="2026-09\/a.png"/); assert.doesNotMatch(done, /sc-go/);
  assert.equal(actionsHTML({ studio: { actions: [{ type: 'borrar_todo' }] } }, { esc }), ''); // una acción fuera de la lista no se pinta
  assert.match(stripHTML(['v/clip.mp4'], esc), /<video/);
  assert.equal(usd(0.004), 'US$0,004'); assert.equal(usd(12), 'US$12,00');
});

/* ---------- banco de presets F3 (E7): el lote y las ediciones con presets en el chat ---------- */
const LOTE = { nombre: 'Camas <bodega>', n: 40, fotosEs: '40 fotos de «Bodega»', muestras: ['2026-10/a.png', '2026-10/b.png'], muestra: 3, receta: { pila: [{ id: 'cat-serie-muebles' }], canal: 'web' },
  recetaEs: [{ id: 'cat-serie-muebles', nombre: 'Serie de muebles' }, { id: 'limp-arrugas', nombre: 'Arrugas', intensidad: 'fuerte' }], canalEs: 'Web PanaClaw', canales: [{ id: 'web', nombre: 'Web PanaClaw' }, { id: 'amazon', nombre: 'Amazon' }],
  modelo: 'nano-banana-2', modelName: 'Nano Banana 2', alternativas: [{ id: 'gpt-image-1', name: 'GPT Image' }], estimate: { total: 1.56, porFoto: 0.039, muestraUsd: 0.117, fits: true, why: 'Cabe hoy: aprox. US$1,56.' }, pasos: ['Limpia el polvo'], state: 'proposed' };

test('la tarjeta del lote: PROBAR CON 3 y GENERAR LAS 40 con su costo, canal y modelo editables, nada sin escapar', () => {
  const h = loteHTML({ id: 'm7', studio: { creatives: [], actions: [], lote: LOTE } }, { esc });
  assert.match(h, /data-lote="probar">PROBAR CON 3 · US\$0,12</); assert.match(h, /data-lote="todas">GENERAR LAS 40 · US\$1,56</);
  assert.match(h, /data-i="-1"/); assert.match(h, /<select class="sc-set" data-k="canal"/); assert.match(h, /<option value="gpt-image-1">GPT Image/);
  assert.match(h, /Camas &lt;bodega&gt;/); assert.doesNotMatch(h, /<bodega>/); assert.match(h, /Arrugas · fuerte/); assert.match(h, /\+38/);
  assert.match(h, /Nada se gasta sin tu clic; PROBAR hace 3 y te pregunta/);
  const pocas = loteHTML({ id: 'm8', studio: { lote: { ...LOTE, n: 2, muestra: 0, estimate: { ...LOTE.estimate, total: 0, porFoto: 0 } } } }, { esc });
  assert.doesNotMatch(pocas, /PROBAR/); assert.match(pocas, /GENERAR LAS 2 · gratis/);
  const plan = creativesHTML({ id: 'm7', studio: { creatives: [], actions: [], lote: LOTE } }, { esc, models: MODELS }); // el lote va dentro del plan, sin un GENERAR de creativos vacío
  assert.match(plan, /sl-card/); assert.doesNotMatch(plan, /GENERAR \(0\)/);
});

test('los botones del lote solo llevan el lote; Descartar lo descarta; un lote en marcha mantiene viva su tarjeta', () => {
  const studio = { creatives: [CREATIVES[0]], actions: [], lote: LOTE };
  assert.deepEqual(studioBody('m7', studio, new Map([[-1, { settings: { canal: 'amazon' }, model: 'gpt-image-1' }], [0, { n: 4 }]]), new Map(), 'probar'), { msg: 'm7', items: [], lote: { accion: 'probar', canal: 'amazon', modelo: 'gpt-image-1' } });
  assert.deepEqual(studioBody('m7', studio, new Map(), new Map(), 'seguir'), { msg: 'm7', items: [], lote: { accion: 'seguir' } });
  assert.equal(studioBody('m7', studio).lote, undefined, 'GENERAR de creativos no toca el lote');
  assert.deepEqual(discardBody('m7', { creatives: [], lote: LOTE }), { msg: 'm7', items: [], lote: { accion: 'descartar' } });
  assert.equal(applyDiscards([{ id: 'm7', studio: { creatives: [], lote: LOTE } }], new Set(['m7']))[0].studio.lote.state, 'skipped');
  assert.equal(loteVivo({ studio: { lote: LOTE } }), false, 'propuesto: nada que seguir');
  assert.equal(loteVivo({ studio: { lote: { ...LOTE, id: 'L1', progreso: { estado: 'corriendo' } } } }), true);
  assert.equal(loteVivo({ studio: { lote: { ...LOTE, id: 'L1', progreso: { estado: 'hecho' } } } }), false);
  assert.equal(loteVivo({ studio: { loteRef: { id: 'L1', seguir: true } } }), true);
});

test('la tarjeta viva: barra con su valor, antes → después que abren el visor, y SEGUIR cuando la muestra espera', () => {
  const vivo = { ...LOTE, id: 'L9', state: 'sent', progreso: { estado: 'pausado', motivo: 'muestra', total: 40, hechas: 3, listas: 2, aprobadas: 0, revisar: 1, fallo: 0, quedan: 37, gastado: 0.117, estimado: 1.56, texto: '3 de 40 · 2 listas · 1 para revisar', estadoEs: 'muestra lista',
    pares: [{ n: 1, src: '2026-10/a.png', out: '2026-10/a-out.png', estado: 'lista', marca: '✓ lista', sku: 'CM-1' }, { n: 2, src: '2026-10/b.png', out: '2026-10/b-out.png', estado: 'revisar', marca: '⚠ revisar', motivo: 'el fondo quedó en 248' }] } };
  const h = loteHTML({ id: 'm7', studio: { lote: vivo } }, { esc });
  assert.match(h, /role="progressbar" aria-valuemin="0" aria-valuemax="40" aria-valuenow="3"/); assert.match(h, /muestra lista/); assert.match(h, /3 de 40 · 2 listas · 1 para revisar/);
  assert.match(h, /data-open="2026-10\/a.png" aria-label="Antes #1"/); assert.match(h, /data-open="2026-10\/a-out.png" aria-label="Después #1"/); assert.match(h, /⚠ revisar/); assert.match(h, /248/);
  assert.doesNotMatch(h, /data-lote="seguir"/, 'SEGUIR va una vez, en el mensaje de la muestra'); assert.match(h, /sl-ver" data-lote="L9"/); assert.doesNotMatch(h, /PROBAR/);
  const fin = loteHTML({ id: 'm7', studio: { lote: { ...vivo, progreso: { ...vivo.progreso, estado: 'hecho', motivo: null, hechas: 40, quedan: 0 } } } }, { esc });
  assert.doesNotMatch(fin, /SEGUIR/); assert.match(fin, /terminado|Ver el lote/);
  const ref = loteRefHTML({ id: 'm9', studio: { loteRef: { msg: 'm7', id: 'L9', seguir: true, quedan: 37, costo: 1.44 } } }, { esc });
  assert.match(ref, /data-msg="m9" data-lote="seguir">SEGUIR CON LAS 37 · US\$1,44/); assert.match(ref, /sl-cambiar" data-msg="m7"/);
  assert.doesNotMatch(loteRefHTML({ id: 'm9', studio: { loteRef: { msg: 'm7', id: 'L9', seguir: false } } }, { esc }), /SEGUIR/);
});

test('una edición con presets: receta en chips y «Qué hará», sin caja de prompt; y las acciones de lote dicen lo que gastan', () => {
  const c = { i: 0, title: 'Lámpara', kind: 'image', presets: [{ id: 'cat-web-panaclaw' }], recetaEs: ['Catálogo para la web'], canalEs: 'Web PanaClaw', input: '2026-10/l.png', refs: [], n: 1, cost: 0.04, model: 'nano-banana-2', modelName: 'Nano Banana 2', alternativas: [{ id: 'gpt-image-1', name: 'GPT Image' }], pasos: ['Fondo blanco 255'], prompt: 'Image 1 is the product photo', state: 'proposed' };
  const h = creativesHTML({ id: 'm1', studio: { creatives: [{ ...c, media: { reference: ['2026-10/l.png'] } }] } }, { esc, models: MODELS });
  assert.doesNotMatch(h, /<textarea/); assert.match(h, /Catálogo para la web/); assert.match(h, /Qué hará · 1 pasos/); assert.match(h, /lang="en">Image 1/); assert.match(h, /US\$0,040/); assert.match(h, /data-open="2026-10\/l.png"/);
  assert.match(h, /<option value="gpt-image-1">GPT Image</); assert.doesNotMatch(h, /Formato/); assert.match(h, /GENERAR \(1\) — US\$0,040/);
  const a = actionsHTML({ id: 'm2', studio: { actions: [{ k: 0, type: 'lote_reintentar', lote: 'L9', nombre: 'Camas', cuantas: 2, costo: 0.08, texto: 'Reintentar 2 fotos del lote «Camas» · gasta aprox. US$0,080', state: 'proposed' }] } }, { esc });
  assert.match(a, /Reintentar 2 fotos del lote «Camas» · gasta aprox\. US\$0,080/); assert.match(a, /class="sc-acton"/);
  assert.match(a, /Sobre el lote \(cada una espera tu clic\)/); assert.doesNotMatch(a, /para ordenar/, 'pausar o aprobar un lote no es «ordenar»');
});

test('un Excel adjunto va como hoja: el mensaje sale aunque no haya imágenes ni texto', () => {
  assert.equal(esHoja('camas.XLSX'), true); assert.equal(esHoja('camas.csv'), true); assert.equal(esHoja('cama.png'), false);
  const o = outgoing('', [{ state: 'ready', hoja: 'h123', name: 'camas.xlsx' }]);
  assert.equal(o.send, true); assert.equal(o.hoja, 'h123'); assert.equal(o.ready.length, 0); assert.equal(o.text, 'Mira esta hoja.');
  assert.equal(outgoing('', [{ state: 'uploading', hoja: null }]).send, false);
});

test('revisión E7: un «reintentar» marcado que gasta con el mismo clic entra en el total y en el presupuesto del pie', () => {
  const re = { k: 0, type: 'lote_reintentar', lote: 'L1', nombre: 'Camas', filas: 'fallidas', cuantas: 3, costo: 0.12, texto: 'Reintentar 3 fotos del lote «Camas» · gasta aprox. US$0,12', state: 'proposed' };
  const ap = { k: 1, type: 'lote_aprobar', lote: 'L1', nombre: 'Camas', filas: 'listas', cuantas: 5, texto: 'Aprobar 5 fotos', state: 'proposed' };
  assert.deepEqual(actionsCost([re, ap]), { usd: 0.12, weight: 3 });
  assert.deepEqual(actionsCost([re, ap], new Map([[0, false]])), { usd: 0, weight: 0 }, 'desmarcado no cuenta');
  assert.deepEqual(actionsCost([{ ...re, state: 'done' }]), { usd: 0, weight: 0 }, 'hecho no cuenta');
  const m = { id: 'm9', studio: { creatives: [CREATIVES[0]], actions: [re, ap], estimate: { total: 0.08, fits: true } } };
  const h = creativesHTML(m, { esc, models: MODELS, budget: { costLeftDay: 0.1, costLeftMonth: 10, left: 20, maxPerRequest: 4 } });
  assert.match(h, /GENERAR \(2\) — US\$0,20/); assert.match(h, /Total: <b>US\$0,20<\/b>/);
  assert.match(h, /sc-total bad/, 'US$0,20 no cabe en los US$0,10 que quedan hoy'); assert.match(h, /no cabe: quedan US\$0,10 hoy/);
  const sin = creativesHTML(m, { esc, models: MODELS, actionEdits: new Map([[0, false]]), budget: { costLeftDay: 0.1, costLeftMonth: 10, maxPerRequest: 4 } });
  assert.match(sin, /GENERAR \(2\) — US\$0,080/); assert.doesNotMatch(sin, /sc-total bad/);
  const solo = creativesHTML({ id: 'm10', studio: { creatives: [], actions: [re] } }, { esc, models: MODELS });
  assert.match(solo, /HACER \(1\) — US\$0,12/);
});

test('revisión E7: PROBAR dice el costo de la muestra que calculó el servidor fila por fila', () => {
  const h = loteHTML({ id: 'm11', studio: { lote: { ...LOTE, estimate: { ...LOTE.estimate, muestraUsd: 0.5 } } } }, { esc });
  assert.match(h, /data-lote="probar">PROBAR CON 3 · US\$0,50</);
});
