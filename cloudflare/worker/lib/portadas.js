// Grupos de rutas /api/<grupo> que el Worker ya contesta de verdad. Lo demás contesta 501. Al portar uno, se añade aquí.
import { MODULOS } from '../modulos/index.js';
export const PORTADAS = ['health', 'brain', 'note', ...MODULOS.flatMap((m) => m.grupos || [])];
