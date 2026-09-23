---
name: proposal
description: Cómo se arma una propuesta o cotización de PanaClaw para un cliente concreto
agents: [piper]
---
# Propuesta comercial de PanaClaw
Úsalo para cualquier pedido que termine en una cotización o propuesta que el cliente acepta o no: «arma una propuesta para…», «cuánto le cobro a…», «cotiza esto», «compara los planes para este caso». Es donde más caro sale un error: lo que diga se tiene que cumplir.

## Antes de escribir
1. Lee `business-model` y la nota de precios de cada producto implicado (`precios-webs`, `precios-capacidades`, `precios-ebot`, `precios-seguridad`, `precios-care`, `precios-diagnostico`). Copia las cifras, no las recuerdes.
2. Lee `decision-plan`, `condiciones-cobro`, `plazos-entrega`, `que-no-incluye` y `cancelacion`.
3. Si aparecen dos o más de Care, Seguridad, Diagnóstico de Ventas o Auditoría: `fronteras-productos`.
4. Necesitas tres datos. Si faltan, pídelos en una línea antes de cotizar: qué tiene que hacer el sitio (no qué plan quiere) · si ya tiene sitio · si necesita editar el contenido él mismo.

## Pasos
1. Elige el plan por la necesidad con la tabla de `decision-plan`. Si pide reservas, portal o panel, el mínimo es Corporate; catálogo con cobro, Commerce. Commerce ya trae inventario: no se cobra encima.
2. Suma las capacidades avanzadas, cada una con su precio. Un solo plan web por propuesta.
3. Separa los dos totales. PAGO ÚNICO: la suma de lo que se cobra una vez (50 % al empezar, 50 % al entregar). CADA MES: Care o seguridad mensual, opcional y sin permanencia. Si hay eBot, un bloque A TERCEROS: $5 al mes a Cloudflare y $1–2 al mes a la empresa de IA, que no cobra PanaClaw. Nunca un total que sume los dos. Nunca proyectar el mensual a doce meses.
4. Si hay un rango (seguridad, Care Business), ciérralo solo dentro del rango publicado y di por qué (el tramo), o cítalo entero.
5. Añade el plazo y desde cuándo cuenta, y las rondas de cambios incluidas más el precio de la extra ($40).
6. Escribe el «qué NO incluye» completo, arriba: la lista base más lo propio de cada producto. Si el plan es Start o Launch, di que no lleva panel y que los cambios los hacemos nosotros.
7. Si hay mensual de seguridad, la Auditoría de Seguridad va antes y aparte.
8. Si el caso no encaja en ningún plan, dilo: se cotiza a medida y lo decide el dueño. No inventes un plan ni un precio.

## La forma
Sigue `template.md` al lado de este archivo, sección por sección y en ese orden. «Qué NO incluye» va ANTES del precio a propósito. Es la pieza de decisión: lleva las tres promesas de riesgo, cada una con lo que le significa al cliente (el código y el dominio a su nombre · puede parar a mitad y se lleva lo hecho · el precio publicado no cambia). La longitud la decide lo que el cliente necesita para decidir.

## Reglas
- Ninguna cifra fuera de las notas de precios. Ningún total que mezcle único y mensual.
- Nunca prometer panel en Start o Launch. Nunca prometer posicionamiento en Google.
- Nunca ofrecer descuentos: el único es Care anual con dos meses gratis.
- Care se ofrece como opcional, nunca como necesario.
- Nombres completos: Diagnóstico de Ventas, Auditoría de Seguridad.
- El borrador espera la aprobación del dueño: no se envía nada.
- Al entregar, en tres líneas: qué plan y por qué (la necesidad que lo decidió) · qué queda fuera y qué se cotizaría aparte · qué decisión tomaste que el dueño podría querer distinta.
