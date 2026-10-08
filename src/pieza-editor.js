// El EDITOR de una pieza de Contenido, como paquete aparte (C1, 8 oct 2026): build-pieza.mjs lo arma en dist/pieza-editor.js con su
// estilo (editor-contenido.css y contenido-preview.css) y src/pieza-carga.js lo trae la primera vez que se abre una pieza. Solo lo
// importa este archivo: si la página importa src/pieza.js o src/contenido-preview.js, build.mjs falla.
import { initPieza } from './pieza.js';

/* global __AO_PIEZA_VERSION__ */
window.AO_PIEZA = { init: initPieza, version: typeof __AO_PIEZA_VERSION__ === 'string' ? __AO_PIEZA_VERSION__ : '' };
