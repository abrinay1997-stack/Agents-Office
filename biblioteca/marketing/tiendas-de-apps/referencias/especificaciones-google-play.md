# Google Play — especificaciones y pautas oficiales

Datos de support.google.com y developer.android.com a marzo de 2026. Google los cambia: si algo es decisivo, verifícalo en la fuente.

## Límites de caracteres

| Campo | Límite | ¿Se indexa? | Notas |
|---|---|---|---|
| Título | 30 caracteres | Sí (la señal más fuerte) | Bajó de 50 en septiembre de 2021 |
| Descripción corta | 80 caracteres | Sí | Se ve sin expandir |
| Descripción completa | 4.000 caracteres | **Sí (mucho)** | Google procesa todo el texto |
| Nombre del desarrollador | 64 caracteres | En parte | Mismas restricciones de emojis y mayúsculas que el título |

## Prohibido en los metadatos (desde septiembre de 2021)

**Título, icono, nombre del desarrollador:**
- Emojis, emoticonos, caracteres especiales repetidos.
- TODO EN MAYÚSCULAS (salvo marca registrada así).
- Afirmaciones de rendimiento: «top», «mejor», «#1», «gratis», «sin anuncios».
- Rendimiento en la tienda o respaldos engañosos.
- Llamados a la acción: «actualiza ya», «descarga ahora».

**Descripción corta:**
- Las mismas afirmaciones que en el título.
- Llamados a la acción.
- Testimonios sin atribuir.

**Capturas, gráfico de funciones, video:**
- Frases con fecha o urgencia.
- Llamados a la acción («Descarga ahora», «Juega ya»).
- Deben mostrar de verdad cómo funciona la app.

## Capturas

| Dispositivo | Mín. | Máx. | Proporción | Resolución mínima | Lado largo máx. |
|---|---|---|---|---|---|
| Teléfono | **2** | **8** | 9:16 o 16:9 | 320 px cualquier lado | 3.840 px |
| Tableta 7" | 4 | 8 | 9:16 o 16:9 | 1.080 px lado corto | 7.680 px |
| Tableta 10" | 4 | 8 | 9:16 o 16:9 | 1.080 px lado corto | 7.680 px |
| Chromebook | 4 | 8 | 9:16 o 16:9 | 1.080 px lado corto | 7.680 px |
| Wear OS | 1 | 8 | **1:1** | 384×384 | 3.840 px |
| Android TV | 1 | 8 | **16:9** | 1.920×1.080 | 3.840 px |

- **Tamaño recomendado para teléfono:** 1080×1920 (vertical).
- **Formato:** JPEG o PNG de 24 bits (sin transparencia).
- **Peso máximo:** 8 MB cada una.

**Ojo:** Google Play admite máximo 8 capturas por dispositivo, no 10 como Apple.

## Gráfico de funciones (feature graphic)

- **Tamaño:** 1024 × 500 px (exacto, obligatorio).
- **Formato:** JPEG o PNG de 24 bits (sin transparencia).
- Se muestra arriba de la ficha y en los destacados.

## Icono

- **Tamaño:** 512 × 512 px.
- **Formato:** PNG de 32 bits (con transparencia).
- **Peso máximo:** 1.024 KB.
- **Forma:** cuadrado completo (Google redondea las esquinas un 30 % solo).
- **Prohibido:** afirmaciones de ranking, número de descargas, ofertas, emojis.

## Video

- **Formato:** enlace de YouTube (público o no listado).
- **Duración:** 30 segundos a 2 minutos recomendado.
- Sin anuncios, sin monetización, que se pueda insertar, sin restricción de edad.
- **No se reproduce solo** (solo ~6 % de visitantes lo toca).

## Experimentos de la ficha (pruebas A/B)

- **Variantes:** hasta 3 por experimento (más el control).
- **Se prueban:** icono, gráfico de funciones, capturas, video, descripción corta, descripción completa.
- **Simultáneos:** no más de 1 experimento de gráficos de la ficha predeterminada a la vez.
- **Público:** solo usuarios de Google Play con sesión iniciada.
- **Métricas:** primeros instaladores y primeros instaladores retenidos (retención a 1 día).
- **Duración:** al menos 7 días (por la diferencia entre entre semana y fin de semana).
- **Idiomas:** se puede probar en hasta 5 idiomas a la vez.

## Fichas personalizadas

- **Máximo:** 50 por app (100 para socios de Play).
- **Se personalizan:** título, descripciones corta y completa, icono, capturas, gráfico de funciones, video.
- **Segmentación:** país o región, prerregistro, estado de instalación, campañas de Google Ads, usuarios inactivos (28+ días).
- **Novedad 2025:** Gemini propone textos para las fichas personalizadas en Play Console.

## Contenido promocional (LiveOps)

| Tipo | Qué es | Duración |
|---|---|---|
| Ofertas | Descuentos, artículos gratis, paquetes | Hasta 28 días |
| Eventos | Eventos dentro de la app con tiempo limitado | Deben tener fin |
| Actualización importante | Funciones nuevas relevantes | Máx. 1 semana |
| Cruces (juegos) | Colaboración entre juegos o marcas | Varía |

- Enviar **4+ días** antes del inicio (revisión normal).
- Enviar **14+ días** antes para pedir destacado.
- **Impacto:** «más del doble de adquisiciones desde Explorar durante el destacado» (Google, oficial).

## Android Vitals — umbrales que afectan el posicionamiento

Las apps que los superan pierden visibilidad en búsquedas y recomendaciones.

| Métrica | Umbral general | Umbral por dispositivo |
|---|---|---|
| Cierres inesperados percibidos | **1,09 %** | 8 % |
| ANR percibidos (la app no responde) | **0,47 %** | 8 % |
| Bloqueos de activación parciales excesivos | 5 % | N/A |

**Consecuencias:** menos visibilidad en la búsqueda, advertencias en la ficha, alertas de calidad antes de instalar.
**Recuperación:** Google lo revisa a diario con un promedio móvil de 28 días.

## Posicionamiento en la búsqueda — factores oficiales

Google confirma que influyen:
1. **Relevancia de los metadatos** — el título pesa más; Google lee título, descripción corta y completa.
2. **Calidad de la app** — Android Vitals (cierres, ANR).
3. **Calificaciones y reseñas** — estrellas y texto de las reseñas. El 85 % de las apps destacadas tienen 4,0+.
4. **Volumen y ritmo de instalaciones** — totales y frecuencia diaria o semanal.
5. **Uso y retención** — frecuencia y duración de las sesiones, retención.
6. **Frecuencia de actualización** — actualizar seguido indica mantenimiento.
7. **Localización** — palabras y visuales adaptados por región. El 59 % de las apps de EE. UU. traduce su título.

Fuentes: support.google.com/googleplay/android-developer/answer/4448378, support.google.com/googleplay/android-developer/answer/9898842, developer.android.com/topic/performance/vitals
