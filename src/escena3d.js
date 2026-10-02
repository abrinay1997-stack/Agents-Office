// El editor del escenario 3D del Estudio (docs/propuesta-banco-presets.md §16.4). El modelo y sus cuentas viven en
// src/escena3d-core.js (puro, con tests); aquí solo se dibuja y se toca.
//   initEscena3d(host, { value, onChange, familia, movimiento }) → { get, set, destroy, setFamilia, describir, guia }
//   · value: una escena (§16.1; lo que falte toma su valor de siempre) · onChange(escena) en cada cambio del dueño (no en set)
//   · familia: la familia de prompt del modelo elegido (§5.8), para el texto plegado · movimiento: el del preset de video
// Dos vistas: el ESCENARIO (three.js: piso con los metros, la caja del producto con su FRENTE, la cámara con su cono; órbita libre
// para mirarlo) y «LO QUE VE LA CÁMARA» (la imagen guía, la misma que va al modelo). A 600 px o menos son dos pestañas.
// Arrastrar la cámara la mueve en su órbita (alrededor y arriba o abajo, nunca bajo el piso), arrastrar el producto lo gira y su
// manija lo sube. Todo lo que se arrastra tiene su control numérico, con teclado. Nada se mueve solo; con reduced-motion, nada
// se anima. Los clics se buscan en coordenadas del lienzo con tolerancia de dedo (16 px ratón, 26 táctil); más de 5 px (10
// táctil) es un arrastre.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as C from './escena3d-core.js';

const REDUCED = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
const UNIDAD_KEY = 'ao.e3d.unidad';
const leer = k => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento: no pasa nada */ } };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PALETA = {
  claro: { fondo: 0xF4F3EE, piso: 0xEDEBE4, menor: 0xDAD7CE, mayor: 0xB9B5AA, anillo: 0x8C887E, caja: 0xC9C5BA, frente: 0x2B6BEB, borde: 0x151414, camara: 0x151414, cono: 0x2B6BEB, manija: 0xA34F00, base: 0x9C978B },
  oscuro: { fondo: 0x1E1F24, piso: 0x24252B, menor: 0x33353C, mayor: 0x4D4F58, anillo: 0x8F8C84, caja: 0x8E8B83, frente: 0x7FA6FF, borde: 0xECEAE3, camara: 0xECEAE3, cono: 0x8FB0FF, manija: 0xFFB25B, base: 0x6A675F },
};
let uid = 0;

export function initEscena3d(host, { value, onChange, familia = 'conversacional', movimiento = '' } = {}) {
  const id = 'e3d' + (++uid);
  let e = C.normalizar(value || C.ESCENA_DEFECTO), fam = familia, mov = movimiento;
  let unidad = leer(UNIDAD_KEY) === 'cm' ? 'cm' : 'm';
  const quita = []; // lo que destroy() tiene que soltar
  const on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); quita.push(() => el.removeEventListener(ev, fn, o)); };

  /* ---------- el DOM ---------- */
  const root = document.createElement('div');
  root.className = 'e3d'; root.dataset.tab = 'escenario';
  const chip = (attr, txt, sub) => `<button type="button" class="e3d-chip" ${attr}>${esc(txt)}${sub ? `<small>${esc(sub)}</small>` : ''}</button>`;
  const num = (k, label, u, extra = '') => `<label class="e3d-f"><span>${label}</span><span class="e3d-num"><input type="number" inputmode="decimal" data-k="${k}" ${extra}><span class="e3d-u" data-u="${k}">${u}</span></span></label>`;
  root.innerHTML = `
    <div class="e3d-tabs" role="tablist" aria-label="Vistas del escenario">
      <button type="button" role="tab" id="${id}-t1" aria-controls="${id}-p1" aria-selected="true" data-tab="escenario">Escenario</button>
      <button type="button" role="tab" id="${id}-t2" aria-controls="${id}-p2" aria-selected="false" tabindex="-1" data-tab="camara">Lo que ve la cámara</button>
    </div>
    <div class="e3d-views">
      <section class="e3d-stage" id="${id}-p1" role="tabpanel" aria-labelledby="${id}-t1">
        <div class="e3d-hrow"><h4 class="e3d-h">Escenario</h4><button type="button" class="e3d-mini" data-act="ver">Ver todo</button></div>
        <div class="e3d-canvas" tabindex="0" role="application" aria-roledescription="escenario 3D" aria-label="Escenario: la cámara y el producto" aria-describedby="${id}-ay">
          <div class="e3d-labels" aria-hidden="true"></div>
        </div>
        <p class="e3d-ayuda" id="${id}-ay">Arrastra la cámara para moverla alrededor y arriba o abajo, el producto para girarlo y la manija ▲ para subirlo. Con el teclado: ← → alrededor · ↑ ↓ arriba o abajo · [ ] girar el producto · Re Pág / Av Pág subirlo · + − acercar o alejar.</p>
      </section>
      <section class="e3d-cam" id="${id}-p2" role="tabpanel" aria-labelledby="${id}-t2">
        <div class="e3d-hrow"><h4 class="e3d-h">Lo que ve la cámara <span class="e3d-prop"></span></h4></div>
        <div class="e3d-frame"><canvas class="e3d-guia" role="img"></canvas></div>
        <p class="e3d-nota">Esta guía va al modelo como referencia de composición: el ángulo, el horizonte y el tamaño de la caja. La caja no se dibuja.</p>
      </section>
    </div>
    <p class="e3d-live" aria-hidden="true"></p><p class="e3d-vh" aria-live="polite"></p>
    <div class="e3d-row"><span class="e3d-lbl" id="${id}-lt">Toma</span>
      <div class="e3d-chips" role="group" aria-labelledby="${id}-lt">${C.TOMAS.map(t => chip(`data-toma="${t.id}"`, t.es)).join('')}</div></div>
    <div class="e3d-row"><span class="e3d-lbl" id="${id}-ld">Distancia</span>
      <div class="e3d-chips" role="group" aria-labelledby="${id}-ld">${C.DISTANCIAS.map(d => chip(`data-dist="${d.id}" aria-pressed="false"`, d.es, `~${Math.round(d.ocupacion * 100)} %`)).join('')}</div></div>
    <div class="e3d-ctls">
      <fieldset class="e3d-set"><legend>Cámara</legend>
        <div class="e3d-units" role="group" aria-label="Unidad de distancia y altura">
          <button type="button" class="e3d-mini" data-unidad="cm" aria-pressed="false">cm</button><button type="button" class="e3d-mini" data-unidad="m" aria-pressed="false">m</button></div>
        ${num('distancia', 'Distancia al producto', 'm', 'min="0"')}
        ${num('altura', 'Altura de la cámara', 'm', 'min="0"')}
        ${num('azimut', 'Alrededor', '°', 'min="-180" max="180" step="5"')}
        <label class="e3d-f"><span>Lente</span><select data-k="lente">${C.LENTES.map(l => `<option value="${l}">${l} mm</option>`).join('')}</select></label>
        <label class="e3d-f"><span>Proporción del cuadro</span><select data-k="proporcion">${C.PROPORCIONES.map(p => `<option value="${p}">${p}</option>`).join('')}</select></label>
      </fieldset>
      <fieldset class="e3d-set"><legend>Producto</legend>
        <label class="e3d-f e3d-wide"><span>Medidas de</span><select data-k="tipo">${C.TIPOS.map(t => `<option value="${t.id}">${esc(t.es)} · ${t.ancho}×${t.alto}×${t.fondo} cm</option>`).join('')}<option value="__otro">Otro (medidas a mano)</option></select></label>
        ${num('ancho', 'Ancho', 'cm', 'min="1" step="1"')}
        ${num('alto', 'Alto', 'cm', 'min="1" step="1"')}
        ${num('fondo', 'Fondo', 'cm', 'min="1" step="1"')}
        ${num('giro', 'Giro del producto', '°', 'min="-180" max="180" step="5"')}
        ${num('elevacion', 'Subir el producto', 'cm', 'min="0" max="500" step="1"')}
      </fieldset>
      <fieldset class="e3d-set"><legend>Fondo</legend>
        <label class="e3d-f"><span>Tipo</span><select data-k="fondoTipo"><option value="color">Un color</option><option value="set">Un set de estudio</option><option value="locacion">Una locación</option></select></label>
        <label class="e3d-f e3d-wide"><span>Cuál</span><input type="text" data-k="fondoValor" maxlength="80" autocomplete="off"></label>
      </fieldset>
    </div>
    <details class="e3d-prompt"><summary>Texto que irá al prompt</summary>
      <p class="e3d-plbl">Para el modelo (inglés)</p><p class="e3d-en" lang="en"></p>
      <p class="e3d-plbl">Traducción</p><p class="e3d-es"></p></details>`;
  host.appendChild(root);
  const $ = s => root.querySelector(s), $$ = s => [...root.querySelectorAll(s)];
  const stageEl = $('.e3d-canvas'), labels = $('.e3d-labels'), guia = $('.e3d-guia'), frame = $('.e3d-frame');
  const live = $('.e3d-live'), anuncio = $('.e3d-vh');

  /* ---------- three.js: el escenario ---------- */
  let gl = null; // todo lo de three, o null si este navegador no tiene WebGL (los controles y la guía siguen)
  try { gl = crearEscenario(); } catch (err) {
    const p = document.createElement('p'); p.className = 'e3d-sin3d';
    p.textContent = 'Este navegador no puede dibujar el escenario 3D. Los controles de abajo y «Lo que ve la cámara» funcionan igual.';
    stageEl.appendChild(p);
  }

  function crearEscenario() {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
    stageEl.insertBefore(renderer.domElement, labels);
    const canvas = renderer.domElement; canvas.className = 'e3d-gl';
    const scene = new THREE.Scene();
    const vista = new THREE.PerspectiveCamera(42, 1, 0.02, 400);
    const controls = new OrbitControls(vista, canvas);
    controls.enableDamping = false; controls.maxPolarAngle = Math.PI / 2 - 0.04; controls.minDistance = 0.4; controls.maxDistance = 160;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x888888, 1.6));
    const sol = new THREE.DirectionalLight(0xffffff, 1.4); sol.position.set(3, 6, 4); scene.add(sol);
    const mats = []; const M = m => (mats.push(m), m); const geos = []; const Gm = g => (geos.push(g), g);
    // el piso y su rejilla: 50 cm la fina, 1 m la marcada, 40 m de lado
    const piso = new THREE.Mesh(Gm(new THREE.PlaneGeometry(80, 80)), M(new THREE.MeshBasicMaterial({ color: 0xffffff })));
    piso.rotation.x = -Math.PI / 2; piso.position.y = -0.002; scene.add(piso);
    const menor = new THREE.GridHelper(40, 80), mayor = new THREE.GridHelper(40, 40); mayor.position.y = 0.001;
    for (const g of [menor, mayor]) { geos.push(g.geometry); mats.push(g.material); scene.add(g); }
    // anillos de distancia cada metro alrededor del producto (los rótulos van en el DOM)
    const anillos = new THREE.Group(); scene.add(anillos);
    const anilloMat = M(new THREE.LineBasicMaterial({ color: 0x888888 }));
    for (let r = 1; r <= 20; r++) { const pts = []; for (let k = 0; k <= 96; k++) { const a = k / 96 * Math.PI * 2; pts.push(new THREE.Vector3(Math.sin(a) * r, 0.003, Math.cos(a) * r)); } anillos.add(new THREE.LineLoop(Gm(new THREE.BufferGeometry().setFromPoints(pts)), anilloMat)); }
    // el producto: una caja de 1×1×1 escalada a sus medidas; la cara +Z (índice 4) es el FRENTE
    const unidad = Gm(new THREE.BoxGeometry(1, 1, 1));
    const cajaMat = M(new THREE.MeshLambertMaterial({ color: 0xcccccc })), frenteMat = M(new THREE.MeshLambertMaterial({ color: 0x2B6BEB }));
    const producto = new THREE.Group(); scene.add(producto);
    const caja = new THREE.Mesh(unidad, [cajaMat, cajaMat, cajaMat, cajaMat, frenteMat, cajaMat]); producto.add(caja);
    const aristas = new THREE.LineSegments(Gm(new THREE.EdgesGeometry(unidad)), M(new THREE.LineBasicMaterial({ color: 0x151414 }))); caja.add(aristas);
    const flechaGeo = Gm(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.5, 0, 0), new THREE.Vector3(0.5, 0, 0), new THREE.Vector3(0, 0, 0.8)]));
    flechaGeo.setIndex([0, 2, 1]); flechaGeo.computeVertexNormals();
    const flecha = new THREE.Mesh(flechaGeo, M(new THREE.MeshBasicMaterial({ color: 0x2B6BEB, side: THREE.DoubleSide }))); producto.add(flecha);
    const base = new THREE.Mesh(unidad, M(new THREE.MeshLambertMaterial({ color: 0x999999, transparent: true, opacity: 0.45 }))); producto.add(base);
    // la manija para subirlo: un cono sobre la caja, con su palito
    const manija = new THREE.Group(); scene.add(manija);
    const manijaMat = M(new THREE.MeshBasicMaterial({ color: 0xA34F00 }));
    const cono = new THREE.Mesh(Gm(new THREE.ConeGeometry(0.5, 1, 20)), manijaMat); cono.position.y = 0.5; manija.add(cono);
    const palitoGeo = Gm(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0)]));
    const palito = new THREE.Line(palitoGeo, M(new THREE.LineBasicMaterial({ color: 0xA34F00 }))); scene.add(palito);
    // la cámara: un cuerpo con su lente (el +Z del grupo mira al producto) y su cono de visión hasta el plano del producto
    const cam = new THREE.Group(); scene.add(cam);
    const camMat = M(new THREE.MeshLambertMaterial({ color: 0x151414 }));
    const cuerpo = new THREE.Mesh(Gm(new THREE.BoxGeometry(1.4, 1, 0.8)), camMat); cam.add(cuerpo);
    const lente = new THREE.Mesh(Gm(new THREE.CylinderGeometry(0.32, 0.36, 0.6, 20)), camMat); lente.rotation.x = Math.PI / 2; lente.position.z = 0.65; cam.add(lente);
    const conoGeo = Gm(new THREE.BufferGeometry()); conoGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(16 * 3), 3));
    const conoVision = new THREE.LineSegments(conoGeo, M(new THREE.LineBasicMaterial({ color: 0x2B6BEB }))); scene.add(conoVision);
    const plomoGeo = Gm(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]));
    const plomo = new THREE.Line(plomoGeo, M(new THREE.LineDashedMaterial({ color: 0x888888, dashSize: 0.08, gapSize: 0.06 }))); scene.add(plomo);
    return { renderer, canvas, scene, vista, controls, piso, menor, mayor, anillos, anilloMat, producto, caja, cajaMat, frenteMat, aristas, flecha, base, manija, manijaMat, cono, palito, palitoGeo, cam, camMat, conoVision, conoGeo, plomo, plomoGeo, mats, geos };
  }

  const S = 1 / 100; // cm → m de la escena
  const tam = () => Math.max(e.producto.ancho, e.producto.alto, e.producto.fondo) * S;
  const ui = () => THREE.MathUtils.clamp(Math.max(tam(), C.distanciaLente(e) * S * 0.6) * 0.07, 0.05, 0.6); // el tamaño de la cámara y la manija
  const posCamara = (s = e) => { const p = C.camaraBase(s).pos; return new THREE.Vector3(p[0] * S, p[1] * S, p[2] * S); };
  const topeManija = (s = e) => (s.producto.elevacion + s.producto.alto) * S + ui() * 1.3;
  const posManija = (s = e) => new THREE.Vector3(0, topeManija(s) + ui() * 0.5, 0);
  const posFrente = (s = e) => { const g = s.producto.giro * Math.PI / 180, z = s.producto.fondo / 2 * S; return new THREE.Vector3(Math.sin(g) * z, (s.producto.elevacion + s.producto.alto / 2) * S, Math.cos(g) * z); };

  function tema() {
    if (!gl) return;
    const P = document.body.classList.contains('dark') ? PALETA.oscuro : PALETA.claro;
    gl.scene.background = new THREE.Color(P.fondo); gl.piso.material.color.setHex(P.piso);
    gl.menor.material.color = new THREE.Color(P.menor); gl.mayor.material.color = new THREE.Color(P.mayor);
    gl.menor.material.vertexColors = false; gl.mayor.material.vertexColors = false; gl.menor.material.needsUpdate = gl.mayor.material.needsUpdate = true;
    gl.anilloMat.color.setHex(P.anillo); gl.cajaMat.color.setHex(P.caja); gl.frenteMat.color.setHex(P.frente); gl.flecha.material.color.setHex(P.frente);
    gl.aristas.material.color.setHex(P.borde); gl.camMat.color.setHex(P.camara); gl.conoVision.material.color.setHex(P.cono);
    gl.manijaMat.color.setHex(P.manija); gl.palito.material.color.setHex(P.manija); gl.base.material.color.setHex(P.base); gl.plomo.material.color.setHex(P.anillo);
    pedirRender();
  }

  function actualizarEscenario() {
    if (!gl) return;
    const { ancho, alto, fondo, giro, elevacion } = e.producto, k = ui();
    gl.producto.rotation.y = giro * Math.PI / 180;
    gl.caja.scale.set(ancho * S, alto * S, fondo * S); gl.caja.position.y = (elevacion + alto / 2) * S;
    gl.base.visible = elevacion > 0.5; gl.base.scale.set(ancho * S * 0.92, Math.max(elevacion * S, 0.001), fondo * S * 0.92); gl.base.position.y = elevacion * S / 2;
    const f = Math.max(Math.min(ancho, fondo) * S * 0.35, 0.08); gl.flecha.scale.set(f, 1, f); gl.flecha.position.set(0, 0.004, fondo * S / 2 + f * 0.25);
    gl.manija.position.set(0, topeManija(), 0); gl.manija.scale.setScalar(k);
    gl.palitoGeo.attributes.position.setXYZ(0, 0, (elevacion + alto) * S, 0); gl.palitoGeo.attributes.position.setXYZ(1, 0, topeManija(), 0); gl.palitoGeo.attributes.position.needsUpdate = true;
    const p = posCamara(), b = C.camaraBase(e); gl.cam.position.copy(p); gl.cam.scale.setScalar(k);
    gl.cam.up.set(b.up[0], b.up[1], b.up[2]); gl.cam.lookAt(b.obj[0] * S, b.obj[1] * S, b.obj[2] * S);
    // el cono de visión: del lente a las cuatro esquinas del cuadro en el plano del producto
    const s = C.sensor(e.cuadro.proporcion), D = C.distanciaLente(e) * S, hw = s.w / 2 / e.camara.lente * D, hh = s.h / 2 / e.camara.lente * D;
    const o = new THREE.Vector3(...b.obj).multiplyScalar(S), R = new THREE.Vector3(...b.right), U = new THREE.Vector3(...b.up);
    const esq = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => o.clone().addScaledVector(R, x * hw).addScaledVector(U, y * hh));
    const arr = gl.conoGeo.attributes.position.array; let i = 0;
    const put = v => { arr[i++] = v.x; arr[i++] = v.y; arr[i++] = v.z; };
    for (let q = 0; q < 4; q++) { put(p); put(esq[q]); put(esq[q]); put(esq[(q + 1) % 4]); }
    gl.conoGeo.attributes.position.needsUpdate = true; gl.conoGeo.computeBoundingSphere();
    gl.plomoGeo.attributes.position.setXYZ(0, p.x, p.y, p.z); gl.plomoGeo.attributes.position.setXYZ(1, p.x, 0, p.z); gl.plomoGeo.attributes.position.needsUpdate = true; gl.plomo.computeLineDistances();
    const radio = Math.ceil(C.distanciaLente(e) / 100) + 1; gl.anillos.children.forEach((a, n) => { a.visible = n + 1 <= Math.max(3, radio); });
    pedirRender();
  }

  /* ---------- mirar el escenario ---------- */
  function verTodo() {
    if (!gl) return;
    const c = new THREE.Vector3(0, (e.producto.elevacion + e.producto.alto / 2) * S, 0), p = posCamara();
    const centro = c.clone().lerp(p, 0.4), radio = Math.max(c.distanceTo(p) * 0.75, tam() * 1.2, 1);
    const a = (e.camara.azimut + 55) * Math.PI / 180, el = 32 * Math.PI / 180, d = radio / Math.tan(gl.vista.fov * Math.PI / 360) * 1.05;
    gl.controls.target.copy(centro);
    gl.vista.position.set(centro.x + Math.sin(a) * Math.cos(el) * d, centro.y + Math.sin(el) * d, centro.z + Math.cos(a) * Math.cos(el) * d);
    gl.controls.update(); pedirRender();
  }

  let raf = 0;
  function pedirRender() { if (!raf) raf = requestAnimationFrame(render); }
  function render() {
    raf = 0; if (!gl) return;
    gl.renderer.render(gl.scene, gl.vista);
    rotulos();
  }
  const aPantalla = v => { const r = gl.canvas.getBoundingClientRect(), q = v.clone().project(gl.vista); return { x: (q.x + 1) / 2 * r.width, y: (1 - q.y) / 2 * r.height, z: q.z }; };
  function rotulos() {
    const fm = C.formatoDistancia, items = [
      ['Cámara', posCamara(), 'cam', 0, -26],
      ['Frente', new THREE.Vector3(Math.sin(e.producto.giro * Math.PI / 180), 0, Math.cos(e.producto.giro * Math.PI / 180)).multiplyScalar((e.producto.fondo / 2) * S + Math.max(Math.min(e.producto.ancho, e.producto.fondo) * S * 0.35, 0.08) * 1.3), 'fr', 0, 12],
      [`altura ${fm(e.camara.altura)}`, posCamara().setY(posCamara().y / 2), 'alt', 0, 0],
    ];
    // los metros, sobre los anillos, del lado derecho según se mira (no detrás del producto ni encima de la cámara)
    const r = Math.max(3, Math.ceil(C.distanciaLente(e) / 100) + 1), va = Math.atan2(gl.vista.position.x - gl.controls.target.x, gl.vista.position.z - gl.controls.target.z) + Math.PI / 2;
    for (let m = 1; m <= Math.min(r, 20); m++) items.push([`${m} m`, new THREE.Vector3(Math.sin(va) * m, 0, Math.cos(va) * m), 'm', 0, 0]);
    // por orden de importancia, sin pisarse: un rótulo que caería encima de otro no se pone
    const puestos = [], html = [];
    for (const [t, v, cls, dx, dy] of items) {
      const s = aPantalla(v); if (s.z > 1 || s.z < -1) continue;
      const x = s.x + dx, y = s.y + dy, w = t.length * 6.6 + 14, h = 18, caja = [x - w / 2, y - h / 2, x + w / 2, y + h / 2];
      if (puestos.some(q => caja[0] < q[2] && caja[2] > q[0] && caja[1] < q[3] && caja[3] > q[1])) continue;
      puestos.push(caja); html.push(`<span class="e3d-lab e3d-lab-${cls}" style="left:${x.toFixed(1)}px;top:${y.toFixed(1)}px">${esc(t)}</span>`);
    }
    labels.innerHTML = html.join('');
  }

  function tamano() {
    if (gl) { const r = stageEl.getBoundingClientRect(); if (r.width > 0 && r.height > 0) { gl.renderer.setSize(r.width, r.height, false); gl.vista.aspect = r.width / r.height; gl.vista.updateProjectionMatrix(); pedirRender(); } }
    dibujarGuia();
  }

  /* ---------- lo que ve la cámara: la imagen guía, igual que la que va al modelo ---------- */
  function dibujarGuia() {
    const a = C.razon(e.cuadro.proporcion); frame.style.setProperty('--e3d-ar', String(a));
    const r = frame.getBoundingClientRect(); if (!r.width || !r.height) return;
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2), W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    if (guia.width !== W || guia.height !== H) { guia.width = W; guia.height = H; }
    const g = C.componerGuia(e, W, H), x = guia.getContext('2d'); if (!x) return;
    const gris = v => `rgb(${v},${v},${v})`, T = C.TONOS, lw = Math.max(1, Math.round(Math.min(W, H) / 320));
    const camino = pts => { x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.closePath(); };
    x.fillStyle = gris(T.cielo); x.fillRect(0, 0, W, H);
    if (g.piso) { camino(g.piso); x.fillStyle = gris(T.piso); x.fill(); }
    x.strokeStyle = gris(T.rejilla); x.lineWidth = lw; x.beginPath(); for (const s of g.rejilla) { x.moveTo(s[0], s[1]); x.lineTo(s[2], s[3]); } x.stroke();
    if (g.horizonte != null) { x.strokeStyle = gris(T.horizonte); x.beginPath(); x.moveTo(0, g.horizonte); x.lineTo(W, g.horizonte); x.stroke(); }
    if (g.sombra) { camino(g.sombra); x.fillStyle = gris(T.sombra); x.fill(); }
    x.lineJoin = 'round';
    for (const c of g.caras) { camino(c.pts); x.fillStyle = gris(c.tono); x.fill(); x.strokeStyle = gris(T.borde); x.lineWidth = c.frente ? lw * 3 : lw * 2; x.stroke(); }
    if (g.flecha) { camino(g.flecha); x.fillStyle = gris(T.marca); x.fill(); }
    // encima, solo aquí (no en la guía del modelo): la caja que mide la ocupación
    const b = g.ocupacion.bbox; x.setLineDash([6 * dpr, 5 * dpr]); x.strokeStyle = '#2B6BEB'; x.lineWidth = 1.5 * dpr;
    x.strokeRect(Math.max(0, b.x0) * W, Math.max(0, b.y0) * H, (Math.min(1, b.x1) - Math.max(0, b.x0)) * W, (Math.min(1, b.y1) - Math.max(0, b.y0)) * H); x.setLineDash([]);
  }

  /* ---------- textos, controles y avisos ---------- */
  let anuncioT = 0;
  function textos(anunciar) {
    const d = C.describirEscena(e, fam, { movimiento: mov });
    live.textContent = d.resumen;
    $('.e3d-en').textContent = d.en; $('.e3d-es').textContent = d.es;
    $('.e3d-prop').textContent = '· ' + e.cuadro.proporcion;
    guia.setAttribute('aria-label', `Guía de composición ${e.cuadro.proporcion}: ${d.resumen}`);
    for (const b of $$('[data-dist]')) { const t = C.DISTANCIAS.find(x => x.id === b.dataset.dist); b.setAttribute('aria-pressed', String(!d.ocupacion.recortado && Math.abs(d.ocupacion.max - t.ocupacion) < 0.02)); }
    if (anunciar) { clearTimeout(anuncioT); anuncioT = setTimeout(() => { anuncio.textContent = d.resumen; }, 500); }
  }
  const largo = cm => (unidad === 'm' ? +(cm / 100).toFixed(2) : Math.round(cm));
  function controles(menos) {
    const v = {
      distancia: largo(e.camara.distancia), altura: largo(e.camara.altura), azimut: Math.round(e.camara.azimut), lente: String(e.camara.lente),
      proporcion: e.cuadro.proporcion, tipo: C.TIPOS.some(t => t.id === e.producto.tipo) ? e.producto.tipo : '__otro',
      ancho: Math.round(e.producto.ancho), alto: Math.round(e.producto.alto), fondo: Math.round(e.producto.fondo), giro: Math.round(e.producto.giro), elevacion: Math.round(e.producto.elevacion),
      fondoTipo: e.fondo.tipo, fondoValor: e.fondo.valor,
    };
    for (const el of $$('[data-k]')) if (el !== menos) {
      const k = el.dataset.k;
      if (k === 'lente' && !C.LENTES.includes(e.camara.lente) && !el.querySelector(`option[value="${e.camara.lente}"]`)) el.insertAdjacentHTML('beforeend', `<option value="${e.camara.lente}">${e.camara.lente} mm</option>`);
      if (k === 'proporcion' && !el.querySelector(`option[value="${CSS.escape(e.cuadro.proporcion)}"]`)) el.insertAdjacentHTML('beforeend', `<option value="${esc(e.cuadro.proporcion)}">${esc(e.cuadro.proporcion)}</option>`);
      if (String(el.value) !== String(v[k])) el.value = v[k];
    }
    for (const k of ['distancia', 'altura']) { const el = $(`[data-k="${k}"]`); el.step = unidad === 'm' ? '0.05' : '5'; $(`[data-u="${k}"]`).textContent = unidad; }
    for (const b of $$('[data-unidad]')) b.setAttribute('aria-pressed', String(b.dataset.unidad === unidad));
  }

  let avisarT = 0;
  function aplicar(nueva, { desde = null, anunciar = true, avisar = true } = {}) {
    e = C.normalizar(nueva);
    controles(desde); actualizarEscenario(); dibujarGuia(); textos(anunciar);
    if (avisar && typeof onChange === 'function') { cancelAnimationFrame(avisarT); avisarT = requestAnimationFrame(() => onChange(C.normalizar(e))); }
  }

  // de un atajo a otro sin saltos (nada con reduced-motion)
  let tween = 0;
  function irA(destino) {
    cancelAnimationFrame(tween);
    const ini = C.normalizar(e), fin = C.normalizar(destino);
    if (REDUCED.matches) { aplicar(fin); return; }
    const t0 = performance.now(), dur = 260, dAz = C.envolver(fin.camara.azimut - ini.camara.azimut), lerp = (a, b, t) => a + (b - a) * t;
    const paso = now => {
      const t = Math.min(1, (now - t0) / dur), k = 1 - Math.pow(1 - t, 3);
      if (t >= 1) { aplicar(fin); return; }
      const m = C.normalizar(fin);
      m.camara.distancia = lerp(ini.camara.distancia, fin.camara.distancia, k); m.camara.altura = lerp(ini.camara.altura, fin.camara.altura, k);
      m.camara.azimut = ini.camara.azimut + dAz * k; m.producto.elevacion = lerp(ini.producto.elevacion, fin.producto.elevacion, k);
      aplicar(m, { anunciar: false, avisar: false }); tween = requestAnimationFrame(paso);
    };
    tween = requestAnimationFrame(paso);
  }

  /* ---------- eventos de los controles ---------- */
  const leerNum = el => { const v = parseFloat(String(el.value).replace(',', '.')); return Number.isFinite(v) ? v : null; };
  function desdeControl(el) {
    const k = el.dataset.k, n = C.normalizar(e), v = el.tagName === 'SELECT' || el.type === 'text' ? el.value : leerNum(el);
    if (v === null || v === '') return null;
    const cm = x => (unidad === 'm' ? x * 100 : x);
    switch (k) {
      case 'distancia': n.camara.distancia = cm(v); break;
      case 'altura': n.camara.altura = cm(v); break;
      case 'azimut': n.camara.azimut = v; break;
      case 'lente': n.camara.lente = +v; break;
      case 'proporcion': n.cuadro.proporcion = v; break;
      case 'tipo': return v === '__otro' ? null : C.conTipo(n, v);
      case 'ancho': case 'alto': case 'fondo': n.producto[k] = v; break;
      case 'giro': n.producto.giro = v; break;
      case 'elevacion': n.producto.elevacion = v; break;
      case 'fondoTipo': n.fondo = { tipo: v, valor: v === 'color' ? '#FFFFFF' : v === 'set' ? 'estudio gris' : 'sala moderna' }; break;
      case 'fondoValor': n.fondo.valor = v; break;
      default: return null;
    }
    return n;
  }
  on(root, 'input', ev => { const el = ev.target.closest('[data-k]'); if (!el) return; const n = desdeControl(el); if (n) aplicar(n, { desde: el.tagName === 'SELECT' ? null : el }); });
  on(root, 'change', ev => { const el = ev.target.closest('[data-k]'); if (el) controles(null); }); // al salir del campo, el número queda normalizado
  on(root, 'click', ev => {
    const b = ev.target.closest('button'); if (!b || !root.contains(b)) return;
    if (b.dataset.toma) irA(C.aplicarToma(e, b.dataset.toma));
    else if (b.dataset.dist) irA(C.aplicarDistancia(e, b.dataset.dist));
    else if (b.dataset.unidad) { unidad = b.dataset.unidad; guardar(UNIDAD_KEY, unidad); controles(null); }
    else if (b.dataset.act === 'ver') verTodo();
    else if (b.dataset.tab) elegirPestana(b.dataset.tab, false);
  });
  // las pestañas (a 600 px o menos): ← → entre ellas, como manda el patrón de ARIA
  function elegirPestana(t, foco) {
    root.dataset.tab = t;
    for (const b of $$('[role="tab"]')) { const sel = b.dataset.tab === t; b.setAttribute('aria-selected', String(sel)); b.tabIndex = sel ? 0 : -1; if (sel && foco) b.focus(); }
    tamano();
  }
  on($('.e3d-tabs'), 'keydown', ev => { if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return; ev.preventDefault(); elegirPestana(root.dataset.tab === 'escenario' ? 'camara' : 'escenario', true); });

  /* ---------- arrastrar en el escenario ---------- */
  if (gl) {
    const local = ev => { const r = gl.canvas.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
    const ray = new THREE.Raycaster();
    function tocar(x, y, tol) {
      const cerca = (v) => { const s = aPantalla(v); return s.z <= 1 ? Math.hypot(s.x - x, s.y - y) : Infinity; };
      const dc = cerca(posCamara()), dm = cerca(posManija());
      if (Math.min(dc, dm) <= tol) return dm < dc ? 'manija' : 'camara';
      const r = gl.canvas.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2(x / r.width * 2 - 1, -(y / r.height) * 2 + 1), gl.vista);
      if (ray.intersectObject(gl.cam, true).length) return 'camara';
      if (ray.intersectObject(gl.manija, true).length) return 'manija';
      if (ray.intersectObject(gl.caja, false).length) return 'producto';
      return null;
    }
    // cuánto se mueve en pantalla un punto al cambiar un parámetro: así el arrastre sigue al dedo desde cualquier vista
    const pant = v => { const s = aPantalla(v); return [s.x, s.y]; };
    const jac = (punto, cambiar, h) => { const a = pant(punto(e)), b = pant(punto(cambiar(e, h))); return [(b[0] - a[0]) / h, (b[1] - a[1]) / h]; };
    let drag = null;
    on(stageEl, 'pointerdown', ev => {
      if (ev.button !== 0 && ev.pointerType === 'mouse') return;
      const [x, y] = local(ev), touch = ev.pointerType !== 'mouse', que = tocar(x, y, touch ? 26 : 16);
      if (!que) return; // la órbita libre de la vista (OrbitControls) se queda el gesto
      gl.controls.enabled = false; drag = { que, x, y, x0: x, y0: y, touch, movido: false, id: ev.pointerId };
      try { stageEl.setPointerCapture(ev.pointerId); } catch { /* */ }
      stageEl.classList.add('e3d-arrastrando'); ev.preventDefault();
    }, { capture: true });
    on(stageEl, 'pointermove', ev => {
      const [x, y] = local(ev);
      if (!drag) { if (ev.pointerType === 'mouse' && !ev.buttons) stageEl.dataset.sobre = tocar(x, y, 16) || ''; return; }
      if (ev.pointerId !== drag.id) return;
      if (!drag.movido && Math.hypot(x - drag.x0, y - drag.y0) <= (drag.touch ? 10 : 5)) return;
      drag.movido = true;
      const d = [x - drag.x, y - drag.y]; drag.x = x; drag.y = y;
      let n = e;
      if (drag.que === 'camara') { // azimut y órbita (arriba/abajo), por mínimos cuadrados con amortiguación
        const ja = jac(posCamara, (s, h) => C.orbitar(s, h, 0), 1), jp = jac(posCamara, (s, h) => C.orbitar(s, 0, h), 1);
        const a11 = ja[0] * ja[0] + ja[1] * ja[1] + 4, a22 = jp[0] * jp[0] + jp[1] * jp[1] + 4, a12 = ja[0] * jp[0] + ja[1] * jp[1];
        const b1 = ja[0] * d[0] + ja[1] * d[1], b2 = jp[0] * d[0] + jp[1] * d[1], det = a11 * a22 - a12 * a12 || 1;
        const dAz = THREE.MathUtils.clamp((b1 * a22 - b2 * a12) / det, -25, 25), dPhi = THREE.MathUtils.clamp((a11 * b2 - a12 * b1) / det, -25, 25);
        n = C.orbitar(e, dAz, dPhi);
      } else if (drag.que === 'producto') {
        const j = jac(posFrente, (s, h) => ({ ...s, producto: { ...s.producto, giro: s.producto.giro + h } }), 1), m = j[0] * j[0] + j[1] * j[1];
        const dg = m > 0.25 ? (j[0] * d[0] + j[1] * d[1]) / m : d[0] * 0.6;
        n = { ...e, producto: { ...e.producto, giro: e.producto.giro + THREE.MathUtils.clamp(dg, -30, 30) } };
      } else {
        const j = jac(posManija, (s, h) => ({ ...s, producto: { ...s.producto, elevacion: s.producto.elevacion + h } }), 1), m = j[0] * j[0] + j[1] * j[1];
        const de = m > 1e-4 ? (j[0] * d[0] + j[1] * d[1]) / m : -d[1];
        n = { ...e, producto: { ...e.producto, elevacion: e.producto.elevacion + THREE.MathUtils.clamp(de, -40, 40) } };
      }
      aplicar(n, { anunciar: false });
    });
    const soltar = ev => {
      if (!drag || (ev && ev.pointerId !== drag.id)) return;
      const hubo = drag.movido; drag = null; gl.controls.enabled = true; stageEl.classList.remove('e3d-arrastrando');
      if (hubo) textos(true);
    };
    on(stageEl, 'pointerup', soltar); on(stageEl, 'pointercancel', soltar); on(stageEl, 'lostpointercapture', soltar);
    gl.controls.addEventListener('change', pedirRender);
  }
  // el teclado sobre el escenario: lo mismo que arrastrar
  on(stageEl, 'keydown', ev => {
    const paso = ev.shiftKey ? 1 : 5; let n = null;
    switch (ev.key) {
      case 'ArrowLeft': n = C.orbitar(e, -paso, 0); break;
      case 'ArrowRight': n = C.orbitar(e, paso, 0); break;
      case 'ArrowUp': n = C.orbitar(e, 0, paso); break;
      case 'ArrowDown': n = C.orbitar(e, 0, -paso); break;
      case '[': n = { ...e, producto: { ...e.producto, giro: e.producto.giro - paso } }; break;
      case ']': n = { ...e, producto: { ...e.producto, giro: e.producto.giro + paso } }; break;
      case 'PageUp': n = { ...e, producto: { ...e.producto, elevacion: e.producto.elevacion + paso } }; break;
      case 'PageDown': n = { ...e, producto: { ...e.producto, elevacion: e.producto.elevacion - paso } }; break;
      case '+': case '=': { const o = C.orbita(e); n = C.enOrbita(e, o.radio * 0.92, o.phi); break; }
      case '-': case '_': { const o = C.orbita(e); n = C.enOrbita(e, o.radio / 0.92, o.phi); break; }
      default: return;
    }
    ev.preventDefault(); ev.stopPropagation(); aplicar(n);
  });

  /* ---------- tamaño y tema ---------- */
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => tamano()) : null;
  if (ro) { ro.observe(stageEl); ro.observe(frame); quita.push(() => ro.disconnect()); }
  const mo = new MutationObserver(tema); mo.observe(document.body, { attributes: true, attributeFilter: ['class'] }); quita.push(() => mo.disconnect());

  tema(); aplicar(e, { anunciar: false, avisar: false }); tamano(); verTodo();

  return {
    /** La escena actual, normalizada (una copia). */
    get: () => C.normalizar(e),
    /** Pone otra escena (no llama a onChange). */
    set(v) { cancelAnimationFrame(tween); aplicar(v || C.ESCENA_DEFECTO, { anunciar: false, avisar: false }); },
    /** Cambia la familia del modelo (y el movimiento del preset de video) del texto plegado. */
    setFamilia(f, m = mov) { fam = f || 'conversacional'; mov = m || ''; textos(false); },
    /** La escena en palabras, como describirEscena (con la familia y el movimiento de este editor). */
    describir: () => C.describirEscena(e, fam, { movimiento: mov }),
    /** La imagen guía en PNG (data URL). */
    guia: (opts) => C.guiaPNG(e, opts),
    /** Dónde caen la cámara, la manija y el frente del producto en el lienzo (px del lienzo), o null sin 3D: para las pruebas y
     *  para un recorrido guiado. */
    puntos: () => (gl ? Object.fromEntries([['camara', posCamara()], ['manija', posManija()], ['producto', posFrente()]].map(([k, v]) => { const s = aPantalla(v); return [k, { x: s.x, y: s.y }]; })) : null),
    destroy() {
      cancelAnimationFrame(raf); cancelAnimationFrame(tween); cancelAnimationFrame(avisarT); clearTimeout(anuncioT);
      for (const f of quita.splice(0)) f();
      if (gl) {
        gl.controls.dispose(); for (const g of gl.geos) g.dispose(); for (const m of gl.mats) m.dispose();
        gl.renderer.dispose(); try { gl.renderer.forceContextLoss(); } catch { /* */ } gl = null;
      }
      root.remove();
    },
  };
}
