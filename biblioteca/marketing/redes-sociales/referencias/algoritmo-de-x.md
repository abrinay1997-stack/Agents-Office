# Manual del algoritmo de X

Cómo ordena X el feed «Para ti» y qué cambiar en tu forma de publicar por eso. Se basa en el algoritmo que xAI liberó como código abierto ([xai-org/x-algorithm](https://github.com/xai-org/x-algorithm), publicación de mayo de 2026: el ordenador Phoenix y la canalización Grox de comprensión de contenido).

**Nota sobre las fuentes:** la publicación muestra la *estructura* del ranking (qué señales se puntúan y cómo se combinan), pero no los *valores* de los pesos (el archivo `params.rs` no se publicó). Cada regla va marcada **[verificado]** cuando el mecanismo se ve en el código, o **[reportado]** cuando el número o la magnitud viene de análisis de segunda mano de esa publicación. La estructura cambia despacio; los números reportados envejecen rápido: tómalos como orientación.

## Cómo funciona el ranking (la versión de un minuto)

1. Las publicaciones candidatas vienen de dos fuentes: las cuentas que sigue quien mira (Thunder) y publicaciones recuperadas por aprendizaje automático de todo el corpus (recuperación Phoenix). Siempre compites por alcance fuera de tu red, no solo por el feed de tus seguidores.
2. Los filtros quitan lo que no es elegible *antes* de puntuar: demasiado viejo, ya visto o ya servido, palabras silenciadas, autores bloqueados o silenciados.
3. El transformador Phoenix predice una probabilidad para cada tipo de interacción: no una «puntuación de calidad» única, sino unas 15 predicciones separadas.
4. La puntuación final es la suma ponderada de esas probabilidades. Las acciones positivas suman; las acciones negativas previstas (no me interesa, silenciar, bloquear, denunciar) restan.
5. Después, un puntuador de diversidad de autores reduce la puntuación de los autores repetidos dentro de una misma respuesta del feed: tus publicaciones compiten entre sí.

El modelo no tiene variables de «calidad» diseñadas a mano: aprende solo de historiales de interacción. No puedes optimizar para el algoritmo directamente; optimizas para los *comportamientos* que predice. Y fíjate cuáles son: quedarse a leer, mandárselo a un amigo, seguir al autor, entrar en la conversación. Eso es lo que produce una buena historia. Contar historias y conectar de verdad con tu público no es una estrategia aparte de la mecánica de abajo: es lo que la mecánica premia. Las reglas ajustan la distribución; la historia gana la interacción.

## Las señales con que se puntúa tu publicación [verificado]

Cada señal es un término ponderado aparte en el código de puntuación:

| Señal | Qué conviene notar |
|-------|--------------------|
| Favorito («me gusta») | La base, y la palanca más débil dadas las demás señales |
| Respuesta | Las publicaciones que abren conversación tienen una señal propia |
| Repost | Amplificación pública |
| Cita **y** clic en lo citado | Dos términos separados: la interacción con la cita *y* los clics hacia la publicación citada puntúan |
| Clic | Abrir el detalle de la publicación |
| Clic al perfil | Entrar a tu perfil es una acción puntuada por sí misma |
| Compartir, compartir por mensaje directo, compartir por copiar enlace | **Tres señales de compartir distintas**: el compartir privado se modela de forma explícita, no se mezcla en una sola |
| Vista de calidad de video | Solo se paga si el video dura más de un mínimo (`MIN_VIDEO_DURATION_MS`); un clip corto no recibe crédito de video |
| Permanencia (dos formas) | El tiempo de lectura se puntúa como umbral y como tiempo continuo |
| Ampliar foto | Tocar para agrandar una imagen |
| Seguir al autor | Una publicación que convierte a quien mira en seguidor tiene su propia señal |
| No me interesa / silenciar / bloquear / denunciar | **Pesos negativos**: el modelo también las predice y restan de tu puntuación |

## Las 10 reglas

1. **Abre con una afirmación específica en las primeras 8 palabras.** [reportado] La permanencia se puntúa de dos formas [verificado] y el desplazamiento rápido la mata. No calientes motores: el gancho *es* la publicación.

2. **Espera unos 60 minutos entre publicaciones originales.** [número reportado] El puntuador de diversidad de autores está verificado: dentro de una respuesta del feed, cada publicación adicional del mismo autor recibe una puntuación reducida. Publicar en racimo canibaliza tu alcance.

3. **Nombra tu tema en las primeras 10 palabras.** [reportado] El abastecimiento de candidatos por tema y la hidratación de temas seguidos están verificados en la canalización: el algoritmo lleva las publicaciones a quienes siguen el tema, pero solo si puede saber cuál es. Las divagaciones vagas no se enrutan.

4. **Escribe para el reenvío por mensaje directo, no para el «me gusta».** [estructura verificada; peso relativo reportado] Compartir por mensaje directo es una señal puntuada aparte. La prueba para cada publicación: «¿alguien se la mandaría a un amigo?» vale más que «¿alguien le daría me gusta?».

5. **Las citas puntúan doble.** [estructura verificada] La interacción con la cita y el clic en lo citado son términos separados. Citar con una idea añadida rinde más que un repost simple, para las dos partes.

6. **Escribe para el seguimiento.** [estructura verificada] Seguir al autor es una señal distinta. Las publicaciones que hacen que un desconocido piense «quiero más de esto» rinden más que las que lo hacen pensar «jaja, qué bien».

7. **Despierta la curiosidad suficiente para que entren a tu perfil.** [estructura verificada] Los clics al perfil se puntúan. Es el argumento mecánico para una biografía y una publicación fijada fuertes: el algoritmo premia la publicación que provoca el clic, y tu perfil lo convierte.

8. **Nombra cosas específicas.** [mecanismo verificado] Por dos razones: la especificidad permite el enrutamiento por tema (regla 3), y el filtro de palabras silenciadas elimina publicaciones *antes* de puntuar: las frases genéricas de anzuelo suelen estar silenciadas, mientras que los sustantivos específicos («Shopify», «WhatsApp Business») casi nunca.

9. **El video debe superar la duración mínima, con subtítulos.** [mecanismo verificado; ~8 s reportado] El peso de la vista de calidad solo se aplica por encima de `MIN_VIDEO_DURATION_MS`. Por debajo, el video no recibe crédito de video. Los subtítulos ayudan a la permanencia (la mayoría ve sin sonido).

10. **Estate presente los primeros 30 minutos.** [reportado] Las primeras respuestas se acumulan: cada respuesta que contestas es un evento de interacción nuevo, y las cadenas de respuestas alimentan la permanencia y la conversación. Publica cuando puedas quedarte, no cuando dispare el programador.

   *En la oficina:* por eso `ver_mejor_hora` y la programación de Contenido son orientación, y las publicaciones de X que se quieran en tiempo real las decide el dueño: el agente deja el borrador y dice a qué hora convendría que el dueño esté presente.

## Lo que mata el alcance [verificado]

- **Palabras silenciadas:** se filtran antes de puntuar. Las frases de anzuelo y el vocabulario de provocación están muy silenciados.
- **Acciones negativas previstas:** si tu patrón de publicación se parece al de contenido que la gente bloquea, silencia o marca «no me interesa», te penaliza *antes de que nadie actúe*. El anzuelo de interacción no solo molesta a las personas: es un negativo modelado.
- **Ráfagas de publicaciones:** el decaimiento por diversidad de autores (regla 2). Tu segunda publicación en una hora arranca con desventaja.
- **Contenido ya visto:** repostear lo mismo rápido choca con los filtros de «ya visto o servido». Las repeticiones de contenido perenne necesitan espacio.

## Advertencias

- **Los pesos no están publicados.** Afirmaciones como «un compartir vale N veces un me gusta» son inferencias, no fuente. La conclusión segura es qué comportamientos se puntúan *de algún modo*, y que los compartidos privados, los seguimientos, los clics al perfil y la permanencia importan por separado.
- **Esto envejece rápido.** El repositorio recibe publicaciones nuevas; si lees esto mucho después de mayo de 2026, revisa [xai-org/x-algorithm](https://github.com/xai-org/x-algorithm) antes de tratar los números como vigentes.
- **Estas reglas son de X.** Los principios generales (gancho temprano, especificidad, presencia en las respuestas) viajan a otras plataformas; la mecánica (separar 60 minutos, la cita que cuenta doble, el mínimo de video) no.
