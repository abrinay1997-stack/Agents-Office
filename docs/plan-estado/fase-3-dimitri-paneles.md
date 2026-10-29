# Fase 3 — Dimitri y paneles (carril B, rama `fase-3-dimitri-paneles`)

Archivos que toco: `src/panel-ancho.js` (nuevo), `src/dimitri-ancho.js` (nuevo), `src/studio-paneles.js`, `src/css/dimitri.css`, `src/css/estudio.css`,
`src/sub.js` (acotado: import, init, 4 llamadas, rótulo «tapada»), `src/main.js` (solo `chatLeft` + 1 listener), `src/brain.js` (auto-plegado de filtros),
`src/shell.html` (3 reglas `.bv-top`), `CLAUDE.md`, tests y `scripts/dimitri-ancho-recorrido.mjs`.
Migraciones reservadas: ninguna. Flags nuevos: ninguno (todo es aditivo y el comportamiento por defecto no cambia sin tocar el borde; la excepción declarada abajo es el umbral del banco en el Estudio).

- ✅ **3.1** `src/panel-ancho.js` (`cerca`, `anchosN` de N paneles, `bordeArrastrable`) extraído de `studio-paneles.js`; el Estudio lo usa; `anchos()` mantiene su contrato (test intacto).
- ✅ **3.1 / DIM-01/02/08 (B11-B12)** `ResizeObserver` sobre `.st-body` escribe `data-ancho` (`ancho` ≥ 1200 · `medio` ≥ 740 · `estrecho`); el banco al lado de la galería depende de ese ancho de la VISTA (antes `innerWidth ≥ 1100`); con la vista < 740 el compositor se pliega solo y vuelve solo si lo plegó el sistema. Sin `container-type` en `#studioOv`.
- ✅ **3.2 / DIM-07 (B14)** Dimitri: borde arrastrable (≥ 900 px; 340–`min(760, ventana − 480)`, `ao.sub.w`), plegar (`body.subFold`) y ampliar (`body.subMax`, `modal.open`).
- ✅ **3.2 / DIM-05** Fuente única `body{--subW}`; evento `ao:sub-ancho`; `chatLeft` lee la variable de módulo (nada de `getBoundingClientRect` por fotograma).
- ✅ **3.3 / DIM-04** Cerebro: `.bv-top` mide el % del Cerebro, no `vw`; el panel `.bv-side` se pliega solo con la vista < 800 px.
- 🟡 **3.3 / UX-10** Controles de Dimitri a 44 px con `pointer: coarse`. NO hecho: las ~55 reglas con fuente ≤ 10,5 px (backlog).
- ⏳ **3.4 / DIM-09/10** (contexto con `ids`/`resumen` y acción «navegar») NO hecho: toca el prompt/OPS de Dimitri y esta fase tiene prohibido tocarlo (`sub-conversacion` y `dimitri-auditoria` topan su tamaño).
- ⏳ **3.5 / DIM-03** PR aparte (`fase-3-5-vistas-dimitri-ancho`).

Delta de la página (`dist/command-centre-v2.html`): ver informe del PR.
