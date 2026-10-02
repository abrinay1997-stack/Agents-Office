// three.js para lo que se carga bajo demanda (1 oct 2026). La página ya lleva three.js (el Cerebro 3D, la oficina); el paquete
// aparte del Estudio (dist/estudio-extra.js: el escenario 3D) no lo vuelve a llevar: build.mjs le cambia `three` por
// window.AO_THREE, que se llena con esto justo antes de cargarlo.
// Solo lo que usa el paquete aparte, nombrado una por una: pasar el espacio de nombres entero como valor metería TODO three.js
// en la página (src/hero.js). build.mjs y tests/estudio-extra.test.mjs comprueban que cada THREE.X del paquete aparte esté aquí.
import {
  BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry, DirectionalLight, DoubleSide, EdgesGeometry,
  Float32BufferAttribute, GridHelper, Group, HemisphereLight, Line, LineBasicMaterial, LineDashedMaterial, LineLoop, LineSegments,
  MathUtils, Mesh, MeshBasicMaterial, MeshLambertMaterial, PerspectiveCamera, PlaneGeometry, Raycaster, Scene, Vector2, Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/** → el objeto que el paquete aparte recibe como `three` (y `OrbitControls`, para su import de examples/jsm). */
export function threeCompartido() {
  return {
    BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry, DirectionalLight, DoubleSide, EdgesGeometry,
    Float32BufferAttribute, GridHelper, Group, HemisphereLight, Line, LineBasicMaterial, LineDashedMaterial, LineLoop, LineSegments,
    MathUtils, Mesh, MeshBasicMaterial, MeshLambertMaterial, PerspectiveCamera, PlaneGeometry, Raycaster, Scene, Vector2, Vector3,
    WebGLRenderer, OrbitControls,
  };
}
