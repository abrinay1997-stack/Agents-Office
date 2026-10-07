# La postura de Google y el fan-out de consultas

Léela una vez antes de hacer nada en una cuenta nueva.

## La postura oficial de Google frente a la realidad multiplataforma

Léelo una vez antes de hacer nada. Google ([guía de optimización para funciones de IA](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)) dice: «Las buenas prácticas de SEO siguen siendo relevantes porque nuestras funciones de IA generativa en Búsqueda se basan en nuestros sistemas centrales de ranking y calidad». Y explícitamente:
- **No se requiere marcado ni archivos especiales** para AI Overviews ni AI Mode.
- **No partas el contenido en trocitos para la IA:** escribe para personas, con títulos y párrafos normales.
- **No escribas contenido aparte «para IA»:** arriesgas la política de spam de «contenido a escala».
- Gana el contenido útil, confiable y pensado para las personas, con los mismos estándares E-E-A-T.
- **No hay informes de Search Console específicos de IA:** usa las métricas de SEO normales.

**Los otros motores (ChatGPT, Claude, Perplexity, Copilot) se comportan distinto:** premian la estructura extraíble (pasajes, preguntas frecuentes, tablas comparativas, bloques de definición), leen `llms.txt`, páginas de precios estructuradas y archivos legibles por máquina si existen, y citan fuentes de terceros (Reddit, Wikipedia, sitios de reseñas) más que las páginas mejor posicionadas.

**Qué significa:** los patrones estructurales de esta habilidad ayudan de forma material a los motores que no son de Google y tampoco dañan a Google (son buena organización normal). Para Google, optimiza para personas y para la búsqueda central: E-E-A-T fuerte, información original, HTML semántico, indexación limpia. En la duda, «escribe para personas, organiza para que se entienda».

## Fan-out de consultas (búsqueda con IA de Google)

Las funciones de IA de Google no responden solo la consulta escrita: generan **consultas relacionadas concurrentes** por debajo y recuperan resultados para cada una. Ejemplo de Google: quien pregunta «cómo arreglar el césped» dispara consultas de fondo sobre herbicidas, eliminación sin químicos, prevención de maleza… y la IA sintetiza todo.

- Apuntar una página a una palabra clave rinde menos: cubre el **grupo temático completo** para ser recuperable también en las variantes.
- La autoridad temática pesa más que la cola larga.
- Una página que responde a fondo un tema madre (con sus subpreguntas) se recupera más que páginas estrechas por consulta.

**Acción:** al planificar contenido, haz una lluvia de las 5–10 consultas relacionadas a las que probablemente se ramifique la IA y verifica que el contenido (o el sitio en conjunto) las cubra. ChatGPT también se ramifica, y se pueden extraer sus búsquedas de fondo literales (método en `volatilidad-de-formatos`); desde la 5.6 se movieron de «mejor/vs/top» hacia `site:` y «oficial».

