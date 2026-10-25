#!/usr/bin/env node
// Auditoría de CSP en un navegador de verdad: recorre la oficina real (con las cabeceras reales de cloudflare/public/_headers y el Worker real) y lista cada recurso bloqueado o roto.
// Uso: node cloudflare/scripts/auditoria-csp.mjs [--antes <archivo con el nube.js de antes>] [--capturas <carpeta>]
//   sin --antes mide el estado actual; con --antes sirve ESE nube.js (p. ej. `git show origin/main:cloudflare/public/nube.js > /tmp/nube-antes.js`) para ver qué estaba roto.
// Necesita `node build.mjs` hecho (dist/) y Chromium de Playwright. No sale a la red: Meta es el de mentira.
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, hayDist } from '../tests/csp-ayudas.mjs';
import { montarMundo, recorrer } from '../tests/csp-recorrido.mjs';

const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
if (!chromium()) { console.error('Falta Playwright/Chromium.'); process.exit(2); }
if (!hayDist()) { console.error('Falta dist/: corre «node build.mjs» antes.'); process.exit(2); }
const antes = arg('--antes'), capturas = arg('--capturas');
if (capturas) mkdirSync(capturas, { recursive: true });
const nav = await chromium().launch(), mundo = await montarMundo();
let n = 0;
const r = await recorrer(nav, mundo, { nubeJs: antes ? readFileSync(antes, 'utf8') : null, captura: capturas ? async (p, nombre) => { await p.screenshot({ path: join(capturas, `${String(n++).padStart(2, '0')}-${nombre.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`), timeout: 40000 }); } : null });
await nav.close();
console.log(JSON.stringify(r, null, 1));
