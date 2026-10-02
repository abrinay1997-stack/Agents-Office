// La entrada del PAQUETE APARTE del Estudio (1 oct 2026, auditoría INF-09: la página tiene su presupuesto en check.mjs).
// build.mjs la empaqueta en dist/estudio-extra.js, junto a la página y no dentro: el banco de presets con su compilador y su
// buscador, el escenario 3D y los lotes. src/estudio-carga.js la carga con un <script src> la primera vez que hace falta (abrir el
// banco, el escenario o los lotes), en file:// y servida por la oficina (serve.mjs). three.js no viaja aquí: `three` es
// window.AO_THREE, lo que la página ya lleva (src/three-compartido.js).
import { initBanco } from './studio-banco.js';
import { initLotes } from './studio-lotes.js';

/* global __AO_EXTRA_VERSION__ */
window.AO_ESTUDIO_EXTRA = { initBanco, initLotes, version: typeof __AO_EXTRA_VERSION__ === 'string' ? __AO_EXTRA_VERSION__ : '' };
