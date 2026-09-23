---
name: control-calidad
description: La revisión de un sitio, eBot o entregable de PanaClaw antes de dárselo al cliente
agents: [qa, dlead]
---
# Control de calidad antes de entregar
Úsalo para «revisa el sitio de X antes de entregar», «QA de este proyecto», «está listo para publicar», «revisa este texto o informe antes de mandarlo».

## Pasos
1. Identifica qué se entrega (plan, capacidades, eBot, informe) y lee `checklist-calidad`.
2. Si hay una URL, ábrela con la herramienta de web o el navegador: recorre las páginas en formato de teléfono y de computadora, prueba el botón de WhatsApp (sin enviar mensajes) y mira la velocidad si se puede medir. Solo lectura.
3. Revisa el contenido contra el estilo de la casa: jerga, relleno, datos inventados, placeholders, cifras fuera de las notas de precios, pagos únicos sumados a mensuales.
4. Comprueba las promesas del plan: panel sí o no según el plan, rondas usadas contra incluidas, dominio y código listos para pasar a nombre del cliente.
5. Commerce: confirma que se hizo una compra de prueba con cada medio de pago. eBot: que se hizo la prueba en vivo.

## La forma
Una tabla: punto · estado (OK / FALLA / NO SE PUDO VERIFICAR) · detalle · quién lo arregla. Arriba, el veredicto en una línea: listo para entregar, o qué falta.

## Reglas
- Lo que no pudiste comprobar va como «no se pudo verificar», nunca como OK.
- No publicas, no cambias nada en el sitio y no escribes al cliente.
- Una velocidad o una cifra se reporta con la fecha y la herramienta con la que se midió.
