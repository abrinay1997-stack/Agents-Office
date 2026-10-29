# Carril J · COS-01 — caché de prompt de los agentes

- ✅ COS-01: `armarLlamada` (cloudflare/worker/lib/agentes/llm.js) pone `cache_control` en el sistema (un bloque) y en la última herramienta cuando hay herramientas (bucle de varias vueltas). Ningún mensaje se marca: el prefijo es idéntico entre vueltas (razonamiento-estable sigue verde). Llamadas sueltas sin herramientas (revisión, clasificar), Meta y sistemas ya en bloques (Dimitri) no cambian.
- ✅ Medición: el libro ya guardaba `cache_read`/`cache_write` y `costs-core` ya tenía precios de caché; se añade `cacheStats(lines)` (tasa de aciertos y ahorro estimado) con test.
- ⏳ COS-04 (Dimitri, `dimitri/modelo.js`): no se toca aquí.
- Honestidad: el ahorro real (−20 a −40 % del plan) solo se mide con tráfico real; los tests prueban la forma de la petición, no el cobro de Anthropic. No verificado contra la API real: el mínimo cacheable (≈1024 tokens en Sonnet; por debajo simplemente no se cachea).
