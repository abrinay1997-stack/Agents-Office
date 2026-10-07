# Plantillas por tipo de sitio

Jerarquías completas con árbol de texto, tabla de direcciones y recomendación de menú para los tipos de sitio más comunes. Son un punto de partida: ajústalas a lo que la empresa vende de verdad (lee `00-Empresa/oferta`).

---

## Sitio de marketing de un SaaS

### Jerarquía

```
Inicio (/)
├── Funciones (/funciones)
│   ├── Función A (/funciones/funcion-a)
│   ├── Función B (/funciones/funcion-b)
│   └── Función C (/funciones/funcion-c)
├── Precios (/precios)
├── Clientes (/clientes)
│   ├── Caso de éxito 1 (/clientes/nombre-empresa)
│   └── Caso de éxito 2 (/clientes/nombre-empresa-2)
├── Recursos (/recursos)
│   ├── Blog (/blog)
│   │   └── [Artículos] (/blog/slug-del-articulo)
│   ├── Plantillas (/recursos/plantillas)
│   │   └── [Plantilla] (/recursos/plantillas/slug)
│   └── Guías (/recursos/guias)
│       └── [Guía] (/recursos/guias/slug)
├── Integraciones (/integraciones)
│   └── [Integración] (/integraciones/nombre)
├── Documentación (/docs)
│   ├── Primeros pasos (/docs/primeros-pasos)
│   ├── Guías (/docs/guias)
│   └── Referencia de API (/docs/api)
├── Nosotros (/nosotros)
│   ├── Empleo (/nosotros/empleo)
│   └── Contacto (/contacto)
├── Comparar (/comparar)
│   └── [Competidor] (/comparar/nombre-competidor)
├── Privacidad (/privacidad)
└── Términos (/terminos)
```

### Tabla de direcciones

| Página | Dirección | Ubicación en el menú | Prioridad |
|---|---|---|---|
| Inicio | `/` | Menú superior (logo) | Crítica |
| Funciones | `/funciones` | Menú superior | Alta |
| Páginas de funciones | `/funciones/{slug}` | Desplegable | Media |
| Precios | `/precios` | Menú superior | Crítica |
| Clientes | `/clientes` | Menú superior | Media |
| Casos de éxito | `/clientes/{slug}` | Desplegable de Clientes | Media |
| Blog | `/blog` | Menú superior (Recursos) | Alta |
| Artículos | `/blog/{slug}` | — | Media |
| Integraciones | `/integraciones` | Menú superior | Media |
| Documentación | `/docs` | Menú superior | Media |
| Comparativas | `/comparar/{slug}` | Pie | Alta (SEO) |
| Nosotros | `/nosotros` | Pie | Baja |
| Botón de precios | `/precios` | Menú superior (botón de acción) | Crítica |

### Navegación

**Menú superior (6 elementos + botón):** Funciones | Precios | Clientes | Recursos | Integraciones | Docs | [Empieza gratis]

**Columnas del pie:**
- Producto: Funciones, Precios, Integraciones, Novedades, Seguridad
- Recursos: Blog, Plantillas, Guías, Casos de éxito
- Empresa: Nosotros, Empleo, Contacto, Prensa
- Legal: Privacidad, Términos, Seguridad

---

## Sitio de contenido o blog

### Jerarquía

```
Inicio (/)
├── Blog (/blog)
│   ├── [Categoría: Tema A] (/blog/categoria/tema-a)
│   ├── [Categoría: Tema B] (/blog/categoria/tema-b)
│   ├── [Categoría: Tema C] (/blog/categoria/tema-c)
│   └── [Artículos] (/blog/slug)
├── Boletín (/boletin)
├── Recursos (/recursos)
│   ├── Guías (/recursos/guias)
│   │   └── [Guía] (/recursos/guias/slug)
│   └── Herramientas (/recursos/herramientas)
│       └── [Herramienta] (/recursos/herramientas/slug)
├── Nosotros (/nosotros)
├── Contacto (/contacto)
├── Privacidad (/privacidad)
└── Términos (/terminos)
```

### Tabla de direcciones

| Página | Dirección | Ubicación en el menú | Prioridad |
|---|---|---|---|
| Inicio | `/` | Menú superior (logo) | Crítica |
| Índice del blog | `/blog` | Menú superior | Alta |
| Categorías | `/blog/categoria/{slug}` | Desplegable | Media |
| Artículos | `/blog/{slug}` | — | Media |
| Boletín | `/boletin` | Menú superior (botón) | Alta |
| Guías | `/recursos/guias` | Menú superior | Media |
| Nosotros | `/nosotros` | Menú superior | Baja |

### Navegación

**Menú superior (4 elementos + botón):** Blog | Recursos | Nosotros | Contacto | [Suscríbete]

**Barra lateral** (en el blog): categorías, artículos populares, suscripción al boletín.

---

## Tienda en línea

### Jerarquía

```
Inicio (/)
├── Tienda (/tienda)
│   ├── Categoría A (/tienda/categoria-a)
│   │   ├── Subcategoría (/tienda/categoria-a/subcategoria)
│   │   │   └── [Producto] (/tienda/categoria-a/subcategoria/producto)
│   │   └── [Producto] (/tienda/categoria-a/producto)
│   ├── Categoría B (/tienda/categoria-b)
│   │   └── [Producto] (/tienda/categoria-b/producto)
│   └── Categoría C (/tienda/categoria-c)
│       └── [Producto] (/tienda/categoria-c/producto)
├── Colecciones (/colecciones)
│   └── [Colección] (/colecciones/slug)
├── Ofertas (/ofertas)
├── Blog (/blog)
│   └── [Artículos] (/blog/slug)
├── Nosotros (/nosotros)
│   └── Nuestra historia (/nosotros/historia)
├── Ayuda (/ayuda)
│   ├── Preguntas frecuentes (/ayuda/preguntas-frecuentes)
│   ├── Envíos (/ayuda/envios)
│   ├── Cambios y devoluciones (/ayuda/devoluciones)
│   └── Contacto (/contacto)
├── Carrito (/carrito)
├── Mi cuenta (/cuenta)
├── Privacidad (/privacidad)
└── Términos (/terminos)
```

### Tabla de direcciones

| Página | Dirección | Ubicación en el menú | Prioridad |
|---|---|---|---|
| Inicio | `/` | Menú superior (logo) | Crítica |
| Tienda | `/tienda` | Menú superior | Crítica |
| Categorías | `/tienda/{categoria}` | Megamenú | Alta |
| Productos | `/tienda/{categoria}/{producto}` | — | Alta |
| Colecciones | `/colecciones/{slug}` | Menú superior | Media |
| Ofertas | `/ofertas` | Menú superior (resaltado) | Alta |
| Carrito | `/carrito` | Menú superior (icono) | Crítica |
| Mi cuenta | `/cuenta` | Menú superior (icono) | Media |

### Navegación

**Menú superior (5 elementos + carrito y cuenta):** Tienda (megamenú) | Colecciones | Ofertas | Blog | Ayuda | [Carrito] [Cuenta]

**Megamenú bajo Tienda:** columnas por categoría con productos o imágenes destacadas.

Si la tienda también vende en un local físico, añade «Tiendas» o «Visítanos» (dirección, horario, mapa) y, si aplica, «Recoger en tienda» en la ayuda.

---

## Sitio de documentación

### Jerarquía

```
Inicio de la documentación (/docs)
├── Primeros pasos (/docs/primeros-pasos)
│   ├── Instalación (/docs/primeros-pasos/instalacion)
│   ├── Inicio rápido (/docs/primeros-pasos/inicio-rapido)
│   └── Configuración (/docs/primeros-pasos/configuracion)
├── Guías (/docs/guias)
│   ├── Guía A (/docs/guias/guia-a)
│   ├── Guía B (/docs/guias/guia-b)
│   └── Guía C (/docs/guias/guia-c)
├── Referencia de API (/docs/api)
│   ├── Autenticación (/docs/api/autenticacion)
│   ├── Endpoints (/docs/api/endpoints)
│   └── Webhooks (/docs/api/webhooks)
├── Ejemplos (/docs/ejemplos)
│   └── [Ejemplo] (/docs/ejemplos/slug)
├── Novedades (/docs/novedades)
└── Preguntas frecuentes (/docs/preguntas-frecuentes)
```

### Tabla de direcciones

| Página | Dirección | Ubicación en el menú | Prioridad |
|---|---|---|---|
| Inicio de la documentación | `/docs` | Menú superior | Alta |
| Primeros pasos | `/docs/primeros-pasos` | Barra lateral (arriba) | Crítica |
| Guías | `/docs/guias` | Barra lateral | Alta |
| Referencia de API | `/docs/api` | Barra lateral | Alta |
| Novedades | `/docs/novedades` | Barra lateral (abajo) | Baja |

### Navegación

**Menú superior:** Docs | API | Blog | Comunidad | GitHub | [Panel]

**Barra lateral** (fija, a la izquierda): Primeros pasos, Guías, Referencia de API, Ejemplos, Novedades, con subsecciones plegables.

**En la página:** «Anterior / Siguiente» al final de cada página.

---

## Híbrido: producto + contenido

### Jerarquía

```
Inicio (/)
├── Producto (/producto)
│   ├── Función A (/producto/funcion-a)
│   ├── Función B (/producto/funcion-b)
│   └── Función C (/producto/funcion-c)
├── Soluciones (/soluciones)
│   ├── Por caso de uso (/soluciones/caso-de-uso)
│   └── Por industria (/soluciones/industria)
├── Precios (/precios)
├── Blog (/blog)
│   ├── [Categoría] (/blog/categoria/slug)
│   └── [Artículos] (/blog/slug)
├── Recursos (/recursos)
│   ├── Guías (/recursos/guias)
│   ├── Plantillas (/recursos/plantillas)
│   ├── Webinars (/recursos/webinars)
│   └── Casos de éxito (/recursos/casos)
├── Documentación (/docs)
│   ├── Primeros pasos (/docs/primeros-pasos)
│   └── API (/docs/api)
├── Integraciones (/integraciones)
│   └── [Integración] (/integraciones/slug)
├── Comparar (/comparar)
│   └── [Competidor] (/comparar/slug)
├── Nosotros (/nosotros)
│   ├── Empleo (/nosotros/empleo)
│   └── Contacto (/contacto)
├── Privacidad (/privacidad)
└── Términos (/terminos)
```

### Navegación

**Menú superior (7 elementos + botón):** Producto | Soluciones | Precios | Recursos | Blog | Docs | Integraciones | [Prueba gratis]

Usa megamenús para Producto (lista de funciones), Soluciones (casos de uso e industrias) y Recursos (blog, guías, plantillas, webinars, casos de éxito).

---

## Negocio pequeño o local

Vale para un consultorio, una clínica dental, un restaurante, una ferretería, un taller, un despacho de abogados o un salón de belleza.

### Jerarquía

```
Inicio (/)
├── Servicios (/servicios)
│   ├── Servicio A (/servicios/servicio-a)
│   ├── Servicio B (/servicios/servicio-b)
│   └── Servicio C (/servicios/servicio-c)
├── Nosotros (/nosotros)
├── Testimonios (/testimonios)
├── Blog (/blog)
│   └── [Artículos] (/blog/slug)
├── Contacto (/contacto)
├── Privacidad (/privacidad)
└── Términos (/terminos)
```

Variantes frecuentes: un restaurante cambia «Servicios» por «Menú» y añade «Reservas»; una ferretería o tienda de barrio, «Catálogo» o «Productos» y «Cómo llegar»; un negocio con varias sedes, «Sucursales» con una página por sede (`/sucursales/{ciudad}`), cada una con dirección, horario y mapa.

### Tabla de direcciones

| Página | Dirección | Ubicación en el menú | Prioridad |
|---|---|---|---|
| Inicio | `/` | Menú superior (logo) | Crítica |
| Servicios | `/servicios` | Menú superior | Alta |
| Páginas de servicio | `/servicios/{slug}` | Desplegable | Alta |
| Nosotros | `/nosotros` | Menú superior | Media |
| Testimonios | `/testimonios` | Menú superior | Media |
| Blog | `/blog` | Menú superior | Media |
| Contacto | `/contacto` | Menú superior (botón) | Alta |

### Navegación

**Menú superior (5 elementos + botón):** Servicios | Nosotros | Testimonios | Blog | [Contáctanos] (o «Agenda tu cita», «Reserva», «Escríbenos por WhatsApp»)

Hazlo simple. Un sitio de negocio pequeño debe ser plano (1-2 niveles como máximo) y cada página debe poder alcanzarse desde el menú superior.
