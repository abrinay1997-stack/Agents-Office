# La página de revisión creativa (tablero para que el dueño, un cliente o un socio elijan)

Una presentación ordenada de los conceptos de anuncios generados, pensada para que **quien aprueba el gasto** (el dueño, un cliente, un socio) **revise y elija**. Es la mejora visual del índice de un lote: el índice sirve a quien opera; el tablero de revisión sirve a quien decide. Muestra cada concepto como una vista previa dentro del feed de la plataforma, divide los carruseles en un guion cuadro por cuadro con etiquetas, deja alternar las variantes de texto y **declara qué está respaldado por material real**.

## Cómo se entrega en la oficina

Los agentes de la oficina no tienen archivos ni terminal, así que no arman una página web. La entrega es **el tablero en Markdown dentro de la respuesta** (formato abajo), con las imágenes del Estudio como `![…](/media/…)` donde ya existan y con un marcador de lugar (descripción de la imagen) donde todavía no. Para el dueño, eso ya es la página: lo ve en la tarea, elige y responde con `revise: …` o aprueba.

Si el dueño quiere además una **página web compartible** con vistas previas al estilo de Instagram o Facebook (para mandársela a un cliente o a un socio), el agente termina la entrega con el **bloque de datos** de abajo en JSON válido y dice que, con ese bloque, se puede pedir a Claude Code en la carpeta de la oficina que lo convierta en una página. No digas que la página existe si no la hiciste.

## Cuándo producirlo

- **Presentar un lote para aprobación**: después de generar en el modo 1 o 3, junta los mejores conceptos en un tablero en lugar de (o junto con) el índice. Elegir 5 de 50 es una decisión *visual*; quien aprueba no debería tener que leer una lista larga para hacerlo.
- **Proponer una colaboración con permiso de marca compartida** («whitelist», anuncios que corren desde el perfil de un socio o creador): muestra al socio exactamente cómo se ve el anuncio bajo cada perfil, con la mecánica del despliegue por escrito.
- **Una revisión mensual de la hoja de ruta** (modo 4): presenta los conceptos del mes para que la decisión sobre el estado de la cuenta y la elección salgan de una sola vista.

No lo produzcas para el ajuste de un solo titular ni para una verificación interna rápida: ahí la salida normal es más rápida. Úsalo cuando **una persona que no eres tú tiene que elegir**.

## El modelo de datos

Cada concepto es un **ángulo estratégico** (ver «Define tus ángulos» en `SKILL.md`). De 2 a 4 conceptos es el punto dulce: más que eso, las pestañas dejan de ser una decisión y se vuelven un menú que nadie termina.

```jsonc
{
  "proyecto": {
    "marca": "Mi Marca",              // obligatorio
    "agencia": "Nombre del socio",    // opcional: agrega la línea de co-marca y el perfil alterno
    "fecha": "2026-10-07",            // opcional
    "nota": "contexto en una línea"   // opcional
  },
  "plataformas": ["instagram", "facebook"],   // vistas previas a ofrecer; la primera es la de partida
  "conceptos": [
    {
      "nombre": "Prueba de laboratorio",          // obligatorio: el nombre del ángulo
      "resumen": "Foto de estilo de vida y luego los resultados",   // una línea: qué distingue al concepto
      "perfiles": [                                // opcional. 1 = publicación normal; 2 = alternar perfil (permiso de marca compartida)
        { "nombre": "mimarca", "alianza": "Colaboración pagada con elsocio", "iniciales": "MM" },
        { "nombre": "El Socio", "alianza": "Colaboración pagada con mimarca", "iniciales": "ES" }
      ],
      "cuadros": [                                 // 1 cuadro = anuncio simple; varios = guion de carrusel
        {
          "etiqueta": "Gancho",                    // el trabajo que hace este cuadro en la historia
          "prompt": "Bolsa del producto sobre fondo rosa suave",   // descripción de la imagen (marcador de lugar si no hay imagen)
          "imagen": "/media/…",                    // opcional: id o ruta de la galería del Estudio; sin ella, es un concepto solo de texto o aún sin generar
          "titular": "El titular que se superpone a este cuadro",  // opcional
          "tema_titular": "oscuro"                 // opcional: «oscuro» (texto blanco, por defecto) o «claro» (texto oscuro sobre imagen clara)
        }
      ],
      "titulares": [                               // variantes elegibles; la elegida va sobre el cuadro 1 en la vista previa
        "Variante 1", "Variante 2", "Variante 3"
      ],
      "texto_principal": "El pie o cuerpo del anuncio.",
      "me_gusta": "6.240",                         // opcional: conteo para la vista de Instagram; si falta, no se muestra
      "destino": { "url": "mitienda.com", "cta": "Comprar ahora", "oferta": "Oferta tomada de las cifras de la empresa" },
      "despliegue": {                              // opcional: la mecánica de cómo corre (permiso de marca compartida, plan de lanzamiento)
        "titulo": "Cómo corre la colaboración",
        "pasos": ["paso 1", "paso 2"]
      },
      "fundamento": "Qué de este concepto es real: la declaración obligatoria (ver abajo)."
    }
  ]
}
```

Reglas de forma si entregas el bloque en JSON: **JSON válido** (claves y textos entre comillas dobles, sin comentarios ni comas finales) y **escribe `<` como `<`** dentro de cualquier texto, para que un valor como `</script>` no pueda cerrar una etiqueta y romper una página hecha a partir del bloque. El `jsonc` de arriba lleva comentarios solo para explicarse; el bloque que entregues no.

## El tablero en Markdown (la entrega normal)

```
# Revisión creativa — [marca] — [fecha]
Qué se decide: [una línea]. Plataformas: [Instagram / Facebook]. Conceptos: [N].

## Concepto 1 — [Nombre del ángulo]
*[Resumen en una línea]*

**Perfil:** [publicación normal, o los dos perfiles si es de marca compartida]
**Guion (cuadro por cuadro):**
| # | Etiqueta (el trabajo del cuadro) | Imagen | Titular sobre la imagen |
|---|---|---|---|
| 1 | Gancho | ![…](/media/…) o «Por generar: [prompt]» | … |
| 2 | El problema | … | … |

**Titulares para elegir:** A. … · B. … · C. …
**Texto principal:** …
**Destino:** [url] · Botón: [CTA] · Oferta: [de las cifras]
**Cómo corre** (si aplica): pasos.
**Fundamento (obligatorio):** qué es real y de dónde sale.
**Mi recomendación:** [A / B / C y por qué, en una línea].

## Concepto 2 …

## Para decidir
- Qué necesito de ti: [elegir 1–2 conceptos y un titular de cada uno / el OK para generar las imágenes que faltan].
- Costo de generar lo que falta en el Estudio: [estimado, de `estado_estudio`].
- Nada se ha publicado ni lanzado: queda a la espera de tu OK.
```

El guion de un concepto de carrusel es una **historia con arco**: etiqueta cada cuadro por el **trabajo que hace** (`Gancho`, `El problema`, `Los resultados`, `La invitación`), no por lo que muestra. Un concepto basado en pruebas es, literalmente, Gancho → Problema → Mecanismo → Resultados → Contexto → Invitación. Para los cinco arcos de carrusel reutilizables (pila de valor, problema y prueba, lista de trucos, desahogo con señalamiento, recorrido de demostración), consulta la skill `redes-sociales` y elige el arco que encaja con el ángulo antes de escribir los cuadros.

### Imágenes y marcadores de lugar

Cada cuadro se muestra de una de dos maneras:
- **Con imagen**: el creativo real (de `generar_imagen` o de `buscar_en_galeria`) llena el cuadro.
- **Sin imagen**: se muestra la etiqueta del cuadro más su prompt. Es el estado normal de un concepto con texto y prompt de imagen que todavía no se generó: el tablero sirve **antes** de que existan las imágenes y sigue sirviendo a medida que se rellenan. Entrega tableros con marcadores de lugar sin miedo; comunican el concepto. Antes de generar las imágenes de todos los cuadros, mira `estado_estudio` y propón generar solo las de los conceptos que el dueño elija.

## El fundamento: la declaración es obligatoria

Todo concepto lleva una línea de **fundamento**, y tiene que ser verdadera. Es la misma regla de los insumos fundamentados, pero dicha al cliente: indica exactamente qué es real (qué panel de laboratorio, qué reseña, qué fotografía del producto) y, por omisión, qué es ilustrativo. Un buen modelo: *«Los resultados son el panel real de laboratorio de la marca (fecha de la prueba). Las imágenes son fotografía propia de producto y de estilo de vida de la marca.»*

Nunca presentes estadísticas inventadas, resultados de pruebas fabricados ni imágenes de banco como si fueran de la marca. Si la prueba de un concepto todavía no es real, la línea lo dice («Los resultados mostrados son ilustrativos a la espera del panel de laboratorio»): un tablero que lava ficción como si fuera hecho es peor que no tener tablero.

## Errores comunes

- **Demasiados conceptos**: 2–4 es una decisión; 10 es un menú que nadie termina. Selecciona antes de presentar.
- **Cuadros sin etiqueta o etiquetados por contenido**: etiqueta por el trabajo narrativo («La prueba»), no por lo que se ve («Captura de la tabla»).
- **Fundamento ausente o deshonesto**: todo concepto declara qué es real; la prueba ilustrativa se rotula como ilustrativa.
- **Rutas de imagen que no existen**: usa solo ids y rutas que devolvió el Estudio o la galería; no inventes enlaces.
- **Entregar solo el tablero y perder el rastro**: el índice del lote y la ficha de cada concepto siguen siendo el registro de quien opera y la pista de auditoría del fundamento; el tablero es la superficie de aprobación construida encima.
