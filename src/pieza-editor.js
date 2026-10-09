// El EDITOR de una pieza de Contenido, como paquete aparte (C1, 8 oct 2026): build-pieza.mjs lo arma en dist/pieza-editor.js con su
// estilo (editor-contenido.css y contenido-preview.css) y src/pieza-carga.js lo trae la primera vez que se abre una pieza. Solo lo
// importa este archivo: si la página importa src/pieza.js o src/contenido-preview.js, build.mjs falla.
import { initPieza } from './pieza.js';
import { abrirLlenar, abrirPlantillas } from './contenido-herramientas.js'; // C3 (8 oct 2026): «Llenar la semana» y «Desde una plantilla»
import * as conversacion from './contenido-conversacion.js'; // B2 (9 oct 2026): la conversación privada abierta en la Bandeja

/* global __AO_PIEZA_VERSION__ */
window.AO_PIEZA = { init: initPieza, llenar: abrirLlenar, plantillas: abrirPlantillas, conversacion, version: typeof __AO_PIEZA_VERSION__ === 'string' ? __AO_PIEZA_VERSION__ : '' };
