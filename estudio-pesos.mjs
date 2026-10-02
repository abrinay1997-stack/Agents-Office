// Agents Office — what counts against the Estudio's daily cap (an image or a voice-over 1, a piece of music 3, a video 5).
// Its own tiny file (1 oct 2026): src/sub-studio.js is in the page, and importing it from estudio-plan.mjs dragged the preset
// compiler, the search and the 3D scene back into the page bundle, past its budget (build.mjs keeps them in dist/estudio-extra.js).
export const WEIGHT = { video: 5, music: 3 }; // the same weights as media.mjs
export const weightOf = kind => WEIGHT[kind] || 1;
