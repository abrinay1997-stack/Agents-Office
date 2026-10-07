# Especificación de entrega de anuncios responsivos de búsqueda de Google (RSA)

Cuando el dueño pida anuncios responsivos de búsqueda (RSA) de Google Ads, tu entrega DEBE cumplir estos límites de la plataforma y estos requisitos de estructura. No entregues ningún RSA que los viole. Los límites de caracteres valen igual en español: cuenta caracteres reales, con espacios y signos (¿ ¡ y tildes cuentan como un carácter).

## Límites duros por RSA (verifícalos antes de responder)

- **Títulos:** exactamente **15** por RSA, cada uno de **≤ 30 caracteres** (cuenta los caracteres, espacios incluidos). Preséntalos como `1. ... (NN caracteres)` para que quien lea pueda verificar.
- **Descripciones:** exactamente **4** por RSA, cada una de **≤ 90 caracteres**.
- **Rutas (paths):** hasta 2 campos de ruta, cada uno de **≤ 15 caracteres**.
- **URL final:** presente, https.
- **Fijado (pinning):** declara explícitamente cualquier posición fijada. Por defecto, sin fijar, salvo que el dueño lo pida.
- **Tope por cuenta:** Google permite **3 RSA como máximo por grupo de anuncios**. Cuando se pidan más de 3, agrúpalos por grupo de anuncios.

## Piezas complementarias obligatorias (siempre, con cualquier pedido de RSA)

1. **Estructura de grupos de anuncios**, rotulada `Estructura de grupos de anuncios:`: lista cada grupo con su tema, sus palabras clave objetivo (con tipos de concordancia) y qué RSA le corresponden.
2. **Lista de palabras clave negativas**, rotulada `Palabras clave negativas:`: mínimo **8** entradas, indicando cuáles van a nivel de grupo y cuáles a nivel de campaña. (Si la cuenta ya corre y no tienes el informe de términos de búsqueda, no inventes candidatas de imaginación: pide el informe. Para una cuenta nueva, parte de las negativas universales y de las que se deduzcan del propio negocio, marcadas como punto de partida a revisar. Ver `auditoria-y-criterio.md`.)
3. **Enlaces de sitio** (≥ 4), **textos destacados** (≥ 4, ≤25 caracteres) y **fragmentos estructurados** si aplican.

## Sectores regulados (salud, derecho, finanzas…)

Si el contexto de la empresa indica que está en un sector con reglas de publicidad estrictas (una clínica o consultorio médico, un despacho de abogados, una entidad financiera), respeta las normas de su país y de su colegio profesional. El original trae como ejemplo una práctica médica en Brasil regulada por el CFM; en ese caso están **prohibidos** en títulos, descripciones, enlaces de sitio y textos destacados:

- Superlativos: «#1», «el mejor», «el mejor del país», «top», «referencia»
- Promesas de resultado: «garantizado», «garantía», «cura», «cura definitiva», «100 %», «resultado garantizado», «libre del dolor»
- Afirmaciones comparativas frente a otros médicos o clínicas

Usa un enfoque neutral: «atención», «consulta», «evaluación», «segunda opinión», «agenda tu consulta», «resuelve tus dudas». Incluye el modificador geográfico (ciudad, barrio) cuando el pedido indique una región. Si el sector es regulado y no conoces las reglas de su país, dilo y pídele al dueño que las confirme antes de aprobar.

## Orden de entrega (obligatorio; emítelo en este orden para evitar cortes)

1. **Estructura de grupos de anuncios** (breve)
2. **Palabras clave negativas** (≥8, OBLIGATORIAS: van ANTES de los RSA para que no se pierdan si la respuesta se alarga)
3. **Enlaces de sitio** (≥4)
4. **Textos destacados** (≥4)
5. **RSA1, RSA2, RSA3** (la sección más grande, al final: se puede cortar sin dañar lo demás)

## Plantilla de entrega (forma obligatoria)

```
Estructura de grupos de anuncios:
- GA1 [tema]: palabras clave (tipos de concordancia) → RSA1, RSA2
- GA2 [tema]: ...

Palabras clave negativas:
  A nivel de campaña:
    - <palabra>
    - <palabra>
    (≥4 aquí)
  A nivel de grupo:
    - GA1: <palabra>, <palabra>
    - GA2: <palabra>, <palabra>
    (≥4 más aquí; TOTAL ≥8 entradas)

Enlaces de sitio (≥4):
  - <título (≤25)> | <descripción 1 (≤35)> | <descripción 2 (≤35)> | URL

Textos destacados (≥4, cada uno ≤25 caracteres):
  - <texto destacado>

RSA1 — [nombre del grupo de anuncios]
  URL final: https://...
  Ruta 1: ...   Ruta 2: ...
  Títulos (15, cada uno ≤30 caracteres):
    1. <título> (NN caracteres)
    ...
    15. <título> (NN caracteres)
  Descripciones (4, cada una ≤90 caracteres):
    1. <descripción> (NN caracteres)
    ...
    4. <descripción> (NN caracteres)
  Fijado: T1=ninguno; T2=ninguno; ...   (o fijados explícitos)

RSA2 — ...
RSA3 — ...
```

## Autorrevisión antes de responder

Antes de enviar la entrega, repasa esta lista:

- [ ] Cada RSA tiene exactamente 15 títulos y exactamente 4 descripciones.
- [ ] Todo título tiene ≤30 caracteres; toda descripción, ≤90. Los conteos de caracteres están impresos.
- [ ] La lista de palabras clave negativas está rotulada y tiene ≥8 entradas.
- [ ] La estructura de grupos de anuncios está rotulada.
- [ ] Si el sector es regulado: no hay superlativos ni promesas de resultado prohibidos; el modificador geográfico está donde se pide; el idioma es el de la audiencia.
- [ ] Nada dice que el anuncio ya se creó o se publicó: es un borrador para que el dueño lo apruebe y lo cargue (o lo cargue quien administre la cuenta).

Si alguna revisión falla, reescribe antes de responder. No entregues RSA a medias.
