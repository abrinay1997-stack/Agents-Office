# Prospección de negocios locales

Para cuando la empresa le vende a pequeños negocios locales: tiendas, gimnasios, restaurantes, salones de belleza, consultorios, servicios profesionales, contratistas, inmobiliarias, estudios de entrenamiento, clínicas dentales. Es la modalidad típica de una agencia de diseño web, de redes o de publicidad local, de un proveedor de software para comercios o de un distribuidor.

Patrón: búsqueda asistida en el navegador + clasificación del estado de la web + puntaje por cercanía.

---

## Señales del cliente ideal que importan (negocio local)

### Señales de actividad

- **Negocio activo**: su ficha de Google (Perfil de Negocio) actualizada, reseñas recientes, horarios al día.
- **Actividad reciente**: abierto ahora, horario publicado, fotos recientes subidas por el dueño.
- **Trato con clientes**: el dueño responde reseñas, publica en redes, tiene agenda activa (en servicios), responde por WhatsApp Business.

### Señales de presencia en línea (el eje principal de calificación)

El **estado de la web** es la calificación principal. Cuatro estados:

| Estado | Definición | Resultado típico |
|---|---|---|
| **Sin web** | No hay una web propia creíble tras buscar y cruzar | **Prospecto caliente** para servicios de web o marketing |
| **Solo redes** | Solo Facebook, Instagram, WhatsApp, Linktree, un portal de reservas o una página en un marketplace o app de delivery; sin web propia | **Prospecto caliente** para servicios de web o marketing |
| **Web débil** | Tiene web propia pero vieja, rota, muy pobre, que no se ve bien en el celular o sin un contacto o camino claro para comprar o reservar | **Prospecto tibio** para renovar o rehacer |
| **Tiene web** | Hay una web propia creíble y moderna | **Prospecto bajo** salvo otras señales (mal posicionamiento en buscadores, diseño que no convierte) |

Si lo que vende la empresa no es una web (por ejemplo, un sistema de reservas o un servicio de fotografía), adapta el eje a la carencia que resuelve (sin reservas en línea, fotos pobres en su ficha, menú que no se ve en el celular) y dilo.

### Señales de cercanía

- **Distancia** desde la ubicación o el área de servicio de la empresa.
- **Densidad**: grupos de negocios parecidos en una zona = oportunidad de trabajar un barrio.
- **Tiempo de traslado**: útil cuando hace falta visitar, instalar o dar el servicio en persona.

### Señales de deterioro

- Cerrado permanentemente (aviso en Google Maps).
- Reseñas detenidas o ficha reportada como cerrada.
- Última actividad (reseña, publicación) hace más de 12 meses.

---

## Fuentes de búsqueda (negocio local)

### Principales

- **Google Maps** (en el navegador, a mano): busca «categoría cerca de [lugar]» y recorre los resultados visibles. Cruza los datos. No extraigas en masa.
- **Directorios locales** (Páginas Amarillas, guías de la ciudad, Yelp donde se use, TripAdvisor para restaurantes y turismo): verificación secundaria.
- **Bing Maps / Apple Maps**: otra cobertura de negocios pequeños.
- **Búsqueda de páginas en Facebook e Instagram**: muchos negocios pequeños solo están ahí.

### Para cruzar

- **La web propia del negocio** (si tiene).
- **Directorios del sector** (Doctoralia o similares para salud, plataformas de reservas de restaurantes, colegios profesionales para abogados o contadores).
- **Listados de la cámara de comercio local**.
- **Registros mercantiles** para saber si está constituido.
- **Búsqueda de «[nombre del negocio] [ciudad]»** para encontrar presencia fuera de Maps.

---

## Flujo de investigación en el navegador

(Requiere que la oficina tenga el navegador encendido o la búsqueda web; si no hay ninguno, pídele al dueño acceso o una lista de partida con `pedir_bloqueo`.)

1. Busca en Google Maps la categoría cerca de la ubicación base.
2. Arma la lista de candidatos con los resultados locales visibles, la búsqueda y los directorios públicos.
3. Para cada candidato, revisa las fuentes públicas para llenar los campos.
4. Busca el nombre exacto del negocio más la ciudad para comprobar si tiene web propia.
5. Clasifica el estado de la web con la tabla de arriba.
6. Marca la confianza: Alta (2+ fuentes), Media (1 fuente + evidencia coherente), Baja (incompleta o ambigua).

Si la lista es grande, divide los candidatos en tandas sin repetir y verifica tanda por tanda solo el estado de web, redes y contacto.

### Opcional: verificar la web del candidato de forma automática

Una vez que tienes la dirección de la web de un candidato (encontrada a mano en Maps o directorios), puedes acelerar la clasificación leyendo esa página: ¿carga?, ¿es moderna?, ¿se ve bien en el celular?, ¿tiene un camino para contactar o comprar? Si la empresa tiene conectada una herramienta de lectura de páginas (Firecrawl, Browserbase) o con el navegador de la oficina.

**Línea estricta:** solo sobre la dirección del negocio. **Nunca** sobre Google Maps, Yelp ni plataformas cuyas condiciones prohíben la extracción masiva: la búsqueda sigue siendo a mano.

---

## Lista de calificación (negocio local)

- [ ] El negocio está activo (reseñas o actividad en los últimos 6 meses).
- [ ] La categoría coincide con lo que ofrece la empresa.
- [ ] La distancia está dentro del radio objetivo.
- [ ] El estado de la web está clasificado.
- [ ] Teléfono o canal de contacto verificado.
- [ ] Al menos otra fuente confirma que opera en la dirección indicada.
- [ ] No es duplicado, sucursal de cadena fuera de alcance ni categoría fuera del encargo.
- [ ] No está cerrado permanentemente.

---

## Puntaje (negocio local)

| Puntaje | Criterio |
|---|---|
| **Caliente** | Sin web O solo redes + tiene teléfono + negocio activo + dentro del radio |
| **Tibio** | Web débil, mala presentación en línea o solo página de reservas o de marketplace |
| **Frío** | Ya tiene buena web O confianza baja |
| **Saltar** | Cerrado, duplicado, fuera del radio, categoría irrelevante o no es un prospecto |

---

## Columnas de salida (negocio local)

Tabla (hasta 15 filas):

```
| Puntaje | Negocio | Categoría | Zona | Distancia | Estado de la web | Web/Redes | Teléfono | Por qué es prospecto | Confianza |
```

CSV:

```csv
puntaje,negocio,categoria,zona,distancia_km,estado_web,web,redes,telefono,correo,fuentes,por_que,confianza,fecha_verificacion,notas
```

Reglas:
- «Por qué es prospecto» corto y accionable.
- Escribe «No encontrado» en vez de dejar campos vacíos.
- Fuentes con moderación, no todas.
- Después de la tabla, **Mejores a contactar primero** con los 3 primeros y una razón práctica cada uno.
- Si la confianza es baja, di exactamente qué queda sin confirmar.

---

## Cómo elegir a los mejores para contactar primero (negocio local)

Prioriza para los 3 más calientes:
1. **Sin web / solo redes + con teléfono** = la oportunidad de servicio más clara.
2. **Muchas reseñas** = negocio activo y establecido, con clientes reales.
3. **Reseñas respondidas por el dueño** = dueño involucrado = más probable que evalúe a un proveedor.
4. **Que el sector coincida con la especialidad de la empresa** le gana a una coincidencia genérica de categoría.

Cada uno lleva una frase que nombra la carencia y la señal: «Sin web propia (comprobado); más de 80 reseñas en Google con respuestas del dueño; a 2 km de la zona objetivo».

---

## Notas de cumplimiento (negocio local)

Es la modalidad más sensible a la extracción:
- **Las condiciones de Google Maps** prohíben la extracción masiva. Las visitas en el navegador son investigación, no obtención de datos.
- **No guardes los identificadores de lugar de Google Maps (Place IDs) en el CRM**: las condiciones limitan guardar datos de Maps.
- **Solo canales públicos del negocio**: teléfono publicado, formulario de contacto, correo info@ o el WhatsApp Business que el propio negocio publica. No contactes a empleados por sus canales personales.
- **El nombre del dueño o encargado publicado en la web del propio negocio** se puede usar. Si solo lo sacaste de LinkedIn, anota la fuente.
- **WhatsApp**: que un negocio publique su número no equivale a consentimiento para mensajes masivos; un primer contacto uno a uno, personal y pertinente, y respeta las reglas de WhatsApp y la ley de tu país (ver la habilidad sms-whatsapp).

---

## Errores comunes (negocio local)

1. **Extraer Google Maps en masa**: la forma más rápida de violar las condiciones y perder el canal.
2. **Tomar los datos de Google Maps como verdad**: las fichas se desactualizan. Cruza horarios, estado y reseñas.
3. **Saltarse la verificación del estado de la web**: que Maps no muestre web no significa que no exista; busca el nombre exacto antes de clasificar.
4. **Apuntar solo a los negocios más grandes**: ya los atienden otros proveedores. Los negocios de 2 a 5 empleados son la oportunidad desatendida.
5. **Contacto genérico a todos los calientes**: los negocios locales responden mejor a un mensaje que nombra su carencia concreta («vi que tu menú no se ve en el celular») que a una presentación genérica.
6. **Descartar cadenas y franquicias sin mirar**: a veces el franquiciado es el comprador y tiene autonomía de marketing local. Verifica antes de saltarlo.
