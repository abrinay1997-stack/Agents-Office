// La oficina COMPLETA en un navegador real, con la CSP real de public/_headers: ninguna violación de CSP, ninguna <img> rota y ninguna petición fallida en las vistas auditadas
// (Analíticas con las fotos de las cuentas, Contenido y el editor de una pieza con sus vistas previas, Bandeja, Anuncios, Estudio, Cerebro, Tareas, Calendario, Dimitri, Ajustes, Estado).
// Lento (~4 min con la máquina cargada): se salta sin Chromium, sin dist/ o con AO_SIN_NAVEGADOR=1. El informe de lo encontrado: docs/auditoria-csp-2026-10-25.md.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, hayDist } from './csp-ayudas.mjs';
import { montarMundo, recorrer, recorrerPublicas } from './csp-recorrido.mjs';
import { SALTAR as SIN_D1 } from './d1-memoria.mjs';

const SALTAR = SIN_D1 || process.env.AO_SIN_NAVEGADOR === '1' || (!chromium() ? 'Playwright no está instalado' : !hayDist() ? 'falta dist/ (node build.mjs)' : false);
let nav, mundo;
before(async () => { if (SALTAR) return; nav = await chromium().launch(); mundo = await montarMundo(); }, { timeout: 120000 });
after(async () => { await nav?.close(); });

test('ninguna violación de CSP, ninguna imagen rota y ninguna petición fallida en el recorrido completo (escritorio)', { skip: SALTAR, timeout: 900000 }, async () => {
  const { hallazgos, externas } = await recorrer(nav, mundo);
  const malos = hallazgos.filter((h) => ['csp', 'imagen-rota', 'peticion-fallida', 'consola', 'paso'].includes(h.tipo) || (h.tipo === 'http' && !/\/api\/media\/plantillas$/.test(h.detalle))).filter((h) => !(h.tipo === 'consola' && /status of 501/.test(h.detalle))); // el 501 de /api/media/plantillas es el aviso «no portado todavía» (fase 8b), no un fallo
  const sinPulsar = hallazgos.filter((h) => h.tipo === 'cobertura'); if (sinPulsar.length) console.log('cobertura: ' + sinPulsar.map((h) => `${h.vista}: ${h.detalle}`).join(' | ')); // un botón que tardó en aparecer en una máquina cargada: se dice, no se falla
  assert.deepEqual(malos.map((h) => `${h.vista} · ${h.tipo} · ${h.detalle}`), []);
  assert.deepEqual(externas, ['https://www.facebook.com/ads/api/preview_iframe.php'], 'el único tercero al que sale la página es el marco de la vista previa de anuncios de Meta (y sí se enmarcó)');
});

test('el acceso y la invitación (sin sesión, con su CSP estricta): ninguna violación ni petición fallida', { skip: SALTAR, timeout: 120000 }, async () => {
  const { hallazgos } = await recorrerPublicas(nav, mundo);
  assert.deepEqual(hallazgos.map((h) => `${h.vista} · ${h.tipo} · ${h.detalle}`), []);
});
