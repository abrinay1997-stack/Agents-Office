# Guía de CMS «headless» (sin cabeza)

Referencia para elegir, modelar e implementar un sistema de gestión de contenido (CMS) «headless» para contenido de marketing. Es un tema técnico: úsalo para orientar la decisión y para preparar un encargo claro al desarrollador o a la agencia; el agente no instala ni configura nada.

## Cuándo usar esta referencia

Úsala al elegir un CMS para un proyecto nuevo, al diseñar modelos de contenido para sitios de marketing, al definir flujos editoriales o al conectar el contenido del CMS con páginas generadas en volumen. Si la empresa es pequeña y ya tiene un sitio que funciona (WordPress, Shopify, Wix, Squarespace, Webflow), lo más probable es que **no** necesite un CMS «headless»: dilo con claridad.

---

## CMS «headless» frente a CMS tradicional

Un CMS «headless» (sin cabeza) separa la gestión del contenido de su presentación. El contenido vive en un sistema estructurado y se entrega por una API a cualquier interfaz (sitio web, aplicación móvil, correo).

### Cuándo tiene sentido «headless»

- Varias interfaces consumen el mismo contenido (web, aplicación móvil, correo).
- Los desarrolladores quieren control total de la pila del frontend.
- El contenido debe reutilizarse en varios canales.
- Se construye con un framework moderno (Next.js, Remix, Astro).
- Marketing necesita bloques de contenido estructurados y reutilizables.

### Cuándo conviene más lo tradicional

- Equipo pequeño sin desarrolladores dedicados.
- Un blog simple o un sitio de presentación.
- La edición visual (WYSIWYG) es un requisito indispensable.
- El presupuesto es ajustado y WordPress, Shopify o Webflow cumplen.

### Lista de decisión

| Factor | «Headless» | Tradicional |
|--------|------------|-------------|
| Entrega a varios canales | Sí | Limitada |
| Control del desarrollador | Total | Restringido |
| Edición sin conocimientos técnicos | Requiere preparación | Incluida |
| Tiempo de lanzamiento | Mayor | Menor |
| Reutilización de contenido | Nativa | Manual |
| Flexibilidad de alojamiento | Cualquier interfaz | Depende de la plataforma |

---

## Modelado de contenido para marketing

### Principios básicos

1. **Piensa en tipos, no en páginas.** Una «página de aterrizaje» es un tipo de contenido con campos, no un archivo HTML. Así se reutilizan los componentes entre páginas.
2. **Separa el contenido de la presentación.** Guarda el texto del titular, no el titular con estilo. La presentación pertenece al frontend.
3. **Diseña para reutilizar.** Si los testimonios aparecen en 5 páginas, crea un tipo Testimonio y refiérelo; no lo dupliques.
4. **Mantén los modelos planos.** Las estructuras muy anidadas son difíciles de consultar y mantener. Prefiere referencias a anidar.

### Tipos de contenido de marketing más comunes

| Tipo | Campos clave | Notas |
|------|--------------|-------|
| **Página de aterrizaje** | título, slug, portada (hero), secciones[], SEO | Secciones modulares para dar flexibilidad |
| **Entrada de blog** | título, slug, cuerpo, autor, categoría, etiquetas, fecha de publicación, SEO | Cuerpo en texto enriquecido o Portable Text |
| **Caso de éxito** | título, cliente, reto, solución, resultados, métricas[], logo | Enlaza con productos o funciones relacionados |
| **Testimonio** | cita, autor, cargo, empresa, avatar, calificación | Se referencia desde las páginas de aterrizaje |
| **Pregunta frecuente** | pregunta, respuesta, categoría | Agrupa por categoría para páginas generadas en volumen |
| **Autor** | nombre, biografía, avatar, redes | Se referencia desde las entradas de blog |
| **Bloque de llamada a la acción** | título, cuerpo, texto del botón, enlace del botón, variante | Reutilizable en varias páginas |

### Lista de campos de SEO

Todo tipo de contenido a nivel de página necesita:

- `metaTitle`: 50–60 caracteres
- `metaDescription`: 150–160 caracteres
- `ogImage`: vista previa social de 1200 × 630 px
- `slug`: segmento de la ruta de la dirección
- `canonicalUrl`: reemplazo opcional
- `noIndex`: booleano para excluir de los buscadores
- `structuredData`: reemplazo opcional de JSON-LD (ver `datos-estructurados`)

---

## Flujos editoriales

### Ciclo borrador → revisión → publicación

1. **Borrador:** el autor crea o edita el contenido.
2. **Revisión:** un editor revisa exactitud, voz de marca y SEO.
3. **Aprobación:** quien decide da su visto bueno (en la oficina, el dueño).
4. **Programación:** se fija fecha y hora de publicación.
5. **Publicación:** el contenido sale por la API.

### API de vista previa

Las principales plataformas «headless» admiten vistas previas de borradores:

- **Sanity:** vista previa en tiempo real con `useLiveQuery` o la herramienta Presentation.
- **Contentful:** API de vista previa (`preview.contentful.com`) con un token de acceso aparte.
- **Strapi:** sistema de Borrador y Publicación con el parámetro de consulta `status=draft` (v5; reemplaza el `publicationState` de la v4).

Configura una ruta de vista previa en el frontend (por ejemplo, `/api/preview`) que autentique y muestre el contenido en borrador. (Estos detalles cambian con las versiones: confírmalos en la documentación de cada plataforma.)

### Roles y permisos

| Rol | Puede crear | Puede editar | Puede publicar | Puede eliminar |
|-----|:-----------:|:------------:|:--------------:|:--------------:|
| Autor | Sí | Lo propio | No | Sus borradores |
| Editor | Sí | Todo | Sí | Borradores |
| Administrador | Sí | Todo | Sí | Todo |

El modelo exacto de permisos varía según la plataforma: Sanity usa acceso por roles, Contentful tiene roles a nivel de espacio y Strapi tiene un control de acceso (RBAC) granular.

---

## Comparación de plataformas

(Orientación de la guía original; precios, planes y funciones cambian: verifícalos antes de decidir.)

| Característica | Sanity | Contentful | Strapi |
|----------------|--------|------------|--------|
| Alojamiento | Nube (administrada) | Nube (administrada) | Propio o nube |
| Lenguaje de consulta | GROQ | REST / GraphQL | REST / GraphQL |
| Plan gratuito | Generoso | Limitado | Código abierto (gratis) |
| Colaboración en tiempo real | Sí (incluida) | Limitada | No |
| Ideal para | Flexibilidad para desarrolladores | Empresas con varios idiomas | Presupuesto ajustado / alojamiento propio |
| Modelado de contenido | Esquema como código | Interfaz web | Interfaz web o código |
| Manejo de medios | Gestor de activos incluido | Incluido | Mediante complementos |

### Sanity

**Fortalezas:** el lenguaje GROQ es potente y flexible. El esquema se define en código (con control de versiones). Edición colaborativa en tiempo real. Portable Text para contenido enriquecido. Plan gratuito generoso.

**A considerar:** curva de aprendizaje más empinada para quien no programa. Personalizar el Studio requiere saber React. Dependencia del proveedor por las consultas GROQ.

**Encaje en marketing:** lo mejor cuando desarrolladores y personas de marketing colaboran de cerca. Fuerte para sitios con mucho contenido y modelos complejos.

### Contentful

**Fortalezas:** plataforma empresarial madura. Excelente soporte multilingüe. Ecosistema sólido de integraciones. Contenido componible con Studio. APIs bien documentadas.

**A considerar:** el precio crece con los tipos de contenido y los idiomas. Dos APIs separadas (entrega y gestión). Los límites de uso pueden ser ajustados en los planes bajos.

**Encaje en marketing:** lo mejor para empresas con contenido en varios mercados. Bueno cuando hace falta la fiabilidad de un proveedor consolidado.

### Strapi

**Fortalezas:** código abierto, con opción de alojamiento propio. Control total de los datos. Sin precio por usuario. Panel de administración personalizable. Ecosistema de complementos. REST por defecto, GraphQL mediante complemento.

**A considerar:** alojarlo uno mismo implica encargarse de la infraestructura. Ecosistema más pequeño que el de Sanity o Contentful. La migración de V4 a V5 puede ser importante.

**Encaje en marketing:** lo mejor para equipos con capacidad de DevOps que quieren control total y ninguna dependencia de un proveedor. Bueno para proyectos de presupuesto ajustado.

### Otros que vale la pena conocer

- **Hygraph:** nativo de GraphQL, fuerte para federación y contenido de varias fuentes.
- **Keystatic:** basado en Git, bueno para flujos híbridos de desarrollo y contenido.
- **Payload:** primero TypeScript, de alojamiento propio, configurado por código como Sanity.
- **Builder.io:** editor visual con servidor «headless», bueno para personas de marketing sin conocimientos técnicos.
- **Prismic:** modelado de contenido por «slices», buena integración con Next.js.

---

## Integración con otras habilidades de marketing

### SEO programático

Usa el CMS como fuente de datos de las páginas generadas en volumen. Guarda datos estructurados (preguntas frecuentes, comparaciones, páginas por ciudad) como tipos de contenido y genera las páginas con consultas. Ver `seo-programatico`.

### Redacción publicitaria

Los modelos de contenido del CMS imponen una estructura consistente. Define campos que coincidan con tus marcos de redacción (titular, subtítulo, prueba social, llamada a la acción). Ver `redaccion-publicitaria`.

### Arquitectura del sitio

La estructura de las direcciones, la jerarquía de navegación y los enlaces internos dependen de cómo se organiza el contenido en el CMS. Planifica el modelo de contenido y la arquitectura del sitio juntos. Ver `arquitectura-web`.

### Secuencias de correo

Lleva el contenido del CMS a las plantillas de correo para mantener un mensaje consistente entre la web y el correo. Los casos de éxito, testimonios y entradas de blog pueden alimentar las secuencias de nutrición. Ver `secuencias-correo`.

---

## Lista de implementación

- [ ] Definir los tipos de contenido a partir de los tipos de página y los bloques reutilizables
- [ ] Añadir campos de SEO a cada tipo de contenido de nivel de página
- [ ] Configurar el modo de vista previa o borrador en el frontend
- [ ] Configurar los roles y permisos para tu equipo
- [ ] Crear contenido de ejemplo para cada tipo antes de construir el frontend
- [ ] Configurar notificaciones (webhooks) para los cambios de contenido (disparadores de reconstrucción)
- [ ] Documentar las pautas de contenido para los editores (descripciones de campos, límites de caracteres)
- [ ] Probar el rendimiento de entrega del contenido (CDN, caché, regeneración incremental)
- [ ] Planear la estrategia de migración si se viene de otro CMS

*Para el dueño:* esta lista y la de modelado de contenido son lo que se le entrega al desarrollador o a la agencia; el agente puede redactarla como un encargo (con `crear_borrador_tarea` si hay que proponer trabajo a otro departamento), pero no configura el sistema.
