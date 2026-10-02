---
name: catalogo-fotos
description: Cómo se prepara un catálogo de fotos de producto con el banco de presets y el escenario 3D del Estudio
agents: [gfx]
---
# Preparar un catálogo de fotos de producto

Úsala cuando la tarea pida fotos de producto para vender: «las fotos de la carpeta Bodega para la web», «el catálogo de camas», «fotos para Mercado Libre», «que se vean pro», «fondo blanco para la tienda».
Trabajas con el **Estudio** (`buscar_en_galeria`, `buscar_presets`, `aplicar_preset`, `crear_lote`, `estado_lote`, `estado_estudio`). Tú preparas; **el dueño aprueba**. Ninguna herramienta tuya aprueba nada.

## Antes de empezar
1. **Las fotos.** `buscar_en_galeria` con la carpeta que nombra la tarea. Cuenta cuántas son. Nunca inventes un id: si no las encuentras, dilo y para.
2. **El destino (canal).** Sale de la tarea («para la web», «para Mercado Libre»). Si no lo dice, usa `web` (la Web PanaClaw) y dilo en tu entrega. La lista de canales y su nombre exacto la da `buscar_presets` (parámetro `canal`); un canal no es un precio ni una medida que se inventa.
3. **La receta.** `buscar_presets` con las palabras de la tarea («catálogo para la web», «fondo blanco», «más clara»). Para la Web PanaClaw la receta de la casa es `cat-web-panaclaw` («Catálogo para la web, con margen»); para un marketplace, el `cat-…` de ese marketplace. Un preset que sale «✗ ahora no» no se usa: dilo y sigue con lo que sí se puede.
4. **El presupuesto.** `estado_estudio` antes de un lote: si no queda tope del día o del mes, no lo pidas; déjalo listo en tu entrega.

## La escena 3D (cuando la serie debe verse igual)
- El margen **no** es un porcentaje: es la **distancia** de la cámara. Pásalo en `escena`:
  - `producto`: el tipo con medidas reales (`cama-queen`, `cama-king`, `sofa`, `cafetera`, `televisor-55`, `persona`) o la palabra y sus medidas en cm;
  - `toma`: `frontal` para catálogo, `tres-cuartos` para mostrar volumen, `cenital` para lo que se ve desde arriba;
  - `encuadre`: `catalogo` (~75 %), `margen` (~60 %, el de la web), `aire` (~45 %, para recortar después);
  - `proporcion`: la del canal (la web, 1:1 o 4:5).
- **Una sola escena para toda la serie** (en `crear_lote`): así una cama queen y una king salen a su escala real, con el mismo ángulo y el mismo fondo.
- La herramienta te devuelve la escena en palabras («Frontal · a nivel de los ojos · a 6,4 m con 50 mm · ocupa ~60 % del ancho»). Cópiala en tu entrega para que el dueño sepa qué pediste.

## Hacerlo
- **Una prueba primero.** Con `aplicar_preset` sobre UNA foto (la más típica de la serie), con la misma pila, canal y escena. Mira el resultado.
- **Luego la serie.** `crear_lote` con un nombre corto («Camas bodega → web»), la carpeta (o los ids), la misma pila, el canal y la escena.
  - Por debajo del tope de un agente (por defecto, menos de 10 fotos y menos de US$2): empieza solo.
  - Por encima: **no gasta nada** y queda en ⚠ Aprobaciones con lo que costará. Es lo normal en un catálogo: no lo vuelvas a pedir, no insistas, no busques otro camino.
- Pon en tu entrega **tal cual** la línea `⏳ Estudio: lote … (lote …)` que te devuelve. La oficina la cambia por el resumen con miniaturas al terminar.
- `estado_lote` solo si la tarea te pide esperar el resultado; si no, entrega y sigue.

## La forma de la entrega
Sigue `template.md`, sección por sección.

## Reglas
- Nunca apruebes, autorices ni digas que algo «ya está publicado» o «ya está en la web»: el dueño revisa cada foto en el Estudio.
- Nunca pongas un precio en la idea ni en la foto. Un precio de oferta sale de las cifras de la empresa, y solo si la tarea lo pide.
- El producto se conserva: no pidas cambiarle el color, la forma ni la marca salvo que la tarea lo diga con esas palabras.
- Una referencia (un anuncio que le gustó al dueño) se usa solo por sus ejes (estilo, luz, composición); nunca se copian sus logos, su texto ni su producto.
- Si un preset o una foto no se pudo, dilo con la razón que te dio el Estudio. No lo escondas.
- Los números de la entrega (fotos, costo) son los que devolvió el Estudio, nunca estimados de memoria.
