// Versión móvil (25 oct 2026) — el PAQUETE DE CONTENIDO, ANALÍTICAS Y ANUNCIOS (dist/movil-d.js, build-movil.mjs → construirMovilD). Pesa lo suyo (las
// reglas de las redes, el diagnóstico y la demo de Anuncios), así que NO va en dist/movil.js: la versión móvil trae solo unas pantallas «diferidas»
// (src/movil/vistas/diferidas.js) que piden este archivo la primera vez que se abre una de ellas. Aquí se registran las pantallas de verdad
// en un armazón de mentira que solo las recoge; el de verdad (shell.js) las monta cuando llegan.
import { registrar as contenido } from '../vistas/contenido.js';
import { registrar as crear } from '../vistas/crear.js';
import { registrar as analiticas } from '../vistas/analiticas.js';
import { registrar as anuncios } from '../vistas/anuncios.js';

const defs = {};
const recoge = { registrarVista(d) { if (!d || !d.id) throw new Error('registrarVista: falta el id'); defs[d.id] = d; } };
for (const r of [contenido, crear, analiticas, anuncios]) r(recoge);
window.AO_MOVIL_D = defs;
