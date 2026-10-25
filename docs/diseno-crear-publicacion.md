# Crear publicación: la ventana de Contenido (25 oct 2026)

Pedido del dueño: «una ventana cómoda en el centro donde todo esté muy bien repartido» y, después, «una ventana especial para crear ese
contenido programado, sería espectacular». Esto es lo decidido, y lo que queda para después.

## Decisión de fondo

No se escribe un editor nuevo: **la ventana es el editor de siempre** (`src/pieza.js`, `contenido-preview.js`, `contenido-herramientas.js`,
reglas en `contenido-reglas.js`) puesto en un diálogo centrado, más un **recorrido por pasos** (`src/ventana-pasos.js`) encima. Así no hay dos
lógicas de reglas, y las de aprobación no cambian: **guardar no aprueba y solo el dueño aprueba** (Aprobar ▾ sigue siendo el mismo botón).
Todo va en el paquete bajo demanda (`dist/pieza-editor.js`); la página no crece.

## Maqueta (≥ 820 px)

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ [BORRADOR]  Título (solo se ve aquí)                         Guardado ✓          [✕]  │
│ ① Dónde ─── ② Qué ─── ③ Medios ─── ④ Cuándo                                          │
├───────────────────────────────────────────────────┬───────────────────────────────────┤
│ Redes y formato            [2 problemas ▾]        │ ASÍ SE VERÁ        [Teléfono|PC]  │
│ [IG Instagram|Post] [FB Facebook|Post] [+ redes]  │ [IG Feed] [IG Perfil] [FB Feed]   │
│ Publicar en: @cuenta                              │ ┌───────────────┐                 │
│ ┌ LO QUE SE PUBLICA ─────────── Editar por red ┐  │ │  maqueta viva  │ (se escala sola │
│ │ texto…                                       │  │ │  de cada red   │  para verse     │
│ │ [archivos]  + Del Estudio · Crear con Estudio│  │ └───────────────┘  entera)        │
│ │ 😊 #  💬 🔗 🔖  ✨ Mejorar con Marketing     │  │                                   │
│ └──────────────────────────────────────────────┘  │                                   │
├───────────────────────────────────────────────────┴───────────────────────────────────┤
│ 2 problemas: …(clic: lleva al campo)                                                  │
│ [📅 lun 26 oct · 18:00 ▾]   Duplicar · Repetir · Plantilla · Eliminar     [Aprobar ▾] │
└───────────────────────────────────────────────────────────────────────────────────────┘
Teléfono (< 820 px): hoja a la vista completa, un paso a la vez, barra de progreso y [‹ Atrás] [Siguiente ›] grandes sobre el pie.
```

## Lo que se decidió (y por qué)

- **Pasos arriba, no una columna a la izquierda.** Con la vista previa a la derecha, una tercera columna deja ~480 px al formulario a 1120 px
  de ventana. Un recorrido horizontal ocupa 40 px de alto, sirve igual en el teléfono y no cambia el reparto de dos columnas.
- **Escritorio: los pasos son atajos, todo sigue a la vista.** ①②③ llevan a su sección dentro del formulario y ④ abre «¿Cuándo sale?» del pie.
  Quien ya sabe lo que hace no tiene que dar «Siguiente» cuatro veces. **Teléfono: un paso a la vez.**
- **Teclado:** `Alt+→` / `Alt+←` cambian de paso; `Ctrl+Enter` guarda ya (no aprueba); `Esc` cierra la ventana sin cerrar Contenido.
- **Guardado visible:** la ventana ya se guardaba sola (700 ms); ahora el estado («Escribiendo… · Guardando… · Guardado ✓ · error») se ve arriba,
  junto al título, y no solo en el pie. Si `src/accion.js` (equipo cf-estados) llega a main, este indicador se cambia por el suyo.
- **Plantillas y «Llenar la semana»** siguen donde estaban («+ Crear → Desde una plantilla…», «Llenar la semana»); no se duplican.
- **Los problemas llevan al campo:** «N problemas» y los arreglos de un clic ya existen en el editor; el semáforo del pie es el mismo.
- **Fuera de esta pasada** (se dice por honestidad): calendario pequeño dentro del paso ④ (hoy: «Día» y «Hora» con atajos y mejores horas),
  vista previa de varias redes lado a lado (hoy: pestañas por red con iconos), recorte del carrusel y «Publicar ya» dentro del paso.
