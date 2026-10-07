# Patrones de navegación

Patrones de navegación detallados para distintos tipos de sitio y contextos.

---

## Menú superior

### Menú simple (4-6 elementos)

Ideal para: negocios pequeños, SaaS sencillos, portafolios, consultorios, restaurantes.

```
[Logo]   Servicios   Precios   Blog   Nosotros   [Botón de acción]
```

Reglas:
- El logo siempre lleva al inicio.
- El botón de acción va a la derecha y se distingue (botón relleno, color de contraste).
- Los elementos van por prioridad (lo más visitado primero).
- La página actual se marca (subrayado, negrita o color).

### Megamenú

Ideal para: SaaS con muchas funciones, tiendas con categorías, sitios grandes de contenido.

```
[Logo]   Producto ▾   Soluciones ▾   Recursos ▾   Precios   Docs   [Acción]
```

Al pasar el cursor o hacer clic en «Producto»:

```
┌─────────────────────────────────────────────────┐
│  Funciones          Plataforma      Integraciones│
│  ─────────          ──────────      ──────────── │
│  Analítica          Seguridad       Slack        │
│  Automatización     API             HubSpot      │
│  Informes           Cumplimiento    Salesforce   │
│  Tableros                           Zapier       │
│                                                  │
│  [Ver todas las funciones →]                     │
└─────────────────────────────────────────────────┘
```

En una tienda, las columnas serían categorías (Hombre, Mujer, Niños, Accesorios) con una imagen destacada.

Reglas del megamenú:
- De 2 a 4 columnas como máximo.
- Agrupa con lógica (por área, por caso de uso o por público).
- Incluye «Ver todo» al final.
- No anides desplegables dentro del megamenú.
- Añade una descripción corta cuando la etiqueta sola no se entienda.

### Menú dividido

Ideal para: aplicaciones con navegación de marketing y de producto.

```
[Logo]   Funciones   Precios   Blog        [Entrar]   [Crear cuenta]
├── Navegación de marketing (izquierda) ─┘  └── Acceso (derecha) ──┤
```

La derecha es para entrar o registrarse; la izquierda, para navegar las páginas.

---

## Pie de página

### Pie por columnas (el estándar)

Ideal para: la mayoría de los sitios. Organiza los enlaces en 3-5 columnas temáticas.

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  Producto         Recursos         Empresa      Legal    │
│  ─────────        ──────────       ─────────    ─────    │
│  Funciones        Blog             Nosotros     Privacidad│
│  Precios          Guías            Empleo       Términos │
│  Integraciones    Plantillas       Contacto     Datos    │
│  Novedades        Casos de éxito   Prensa                │
│  Seguridad        Webinars         Aliados               │
│                                                          │
│  [Logo]  © 2026 Nombre de la empresa                     │
│  Redes: [Instagram] [LinkedIn] [Facebook]                │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Para un negocio local, el pie suele llevar además dirección, horario, teléfono o WhatsApp y un mapa.

### Pie mínimo

Ideal para: sitios simples, páginas de aterrizaje.

```
┌──────────────────────────────────────────────────────────┐
│  [Logo]                                                  │
│  © 2026 Empresa  ·  Privacidad  ·  Términos  ·  Contacto │
└──────────────────────────────────────────────────────────┘
```

### Pie ampliado

Ideal para: sitios que usan el pie para SEO (comparativas, páginas de ciudades, recursos).

```
┌──────────────────────────────────────────────────────────┐
│  Producto    Recursos     Comparar          Casos de uso │
│  Funciones   Blog         vs Competidor A   Para pymes   │
│  Precios     Guías        vs Competidor B   Para empresas│
│  API         Plantillas   vs Competidor C   Para agencias│
│                                                          │
│  Integraciones            Artículos populares            │
│  Slack       Zapier       Cómo hacer X                   │
│  HubSpot     Salesforce   Guía de Y                      │
│                           Plantilla: Z                   │
│                                                          │
│  [Logo]  © 2026  ·  Privacidad  ·  Términos  ·  Seguridad│
└──────────────────────────────────────────────────────────┘
```

---

## Barra lateral

### Barra de documentación

Barra fija a la izquierda con secciones plegables.

```
Primeros pasos
  ├── Instalación
  ├── Inicio rápido
  └── Configuración

Guías
  ├── Autenticación
  ├── Modelos de datos
  └── Despliegue

Referencia de API
  ├── REST API
  │   ├── Usuarios
  │   ├── Proyectos
  │   └── Webhooks
  └── GraphQL

Ejemplos
  ├── Next.js
  ├── Rails
  └── Python

Novedades
```

Reglas:
- La página actual se resalta.
- Secciones plegables (la sección activa abierta por defecto).
- Buscador arriba de la barra.
- «Anterior / Siguiente» al final del contenido.
- Fija al hacer scroll (no se va).

### Barra de categorías del blog

```
Categorías
  ├── SEO (24)
  ├── Conversión (18)
  ├── Contenido (15)
  ├── Anuncios pagados (12)
  └── Analítica (9)

Artículos populares
  ├── Cómo mejorar tu SEO
  ├── Guía de páginas de aterrizaje
  └── Configurar tu analítica

Boletín
  └── [Formulario de suscripción]
```

---

## Migas de pan

### Formato estándar

```
Inicio > Funciones > Analítica
Inicio > Blog > Categoría SEO > Cómo investigar palabras clave
Inicio > Docs > Referencia de API > Autenticación
```

Reglas:
- Separador: `>` o `/` (siempre el mismo).
- Cada tramo es un enlace salvo la página actual.
- La página actual va como texto (sin enlace).
- Puedes omitir la página actual si su título ya se ve como H1.

### Con marcado de datos estructurados (microdatos)

```html
<nav aria-label="Migas de pan">
  <ol itemscope itemtype="https://schema.org/BreadcrumbList">
    <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
      <a itemprop="item" href="/"><span itemprop="name">Inicio</span></a>
      <meta itemprop="position" content="1" />
    </li>
    <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
      <a itemprop="item" href="/funciones"><span itemprop="name">Funciones</span></a>
      <meta itemprop="position" content="2" />
    </li>
    <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
      <span itemprop="name">Analítica</span>
      <meta itemprop="position" content="3" />
    </li>
  </ol>
</nav>
```

O con JSON-LD (recomendado):

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Inicio", "item": "https://ejemplo.com/" },
    { "@type": "ListItem", "position": 2, "name": "Funciones", "item": "https://ejemplo.com/funciones" },
    { "@type": "ListItem", "position": 3, "name": "Analítica" }
  ]
}
```

El detalle del marcado es de la habilidad `datos-estructurados`.

---

## Navegación en el teléfono

### Menú hamburguesa

El estándar en móvil: todo el menú se recoge en un icono.

Reglas:
- Icono de tres líneas arriba a la derecha o a la izquierda.
- Panel a pantalla completa o deslizable.
- El botón de acción se ve sin abrir el menú (cabecera fija). En un negocio local suele ser «Llamar» o «WhatsApp».
- Buscador accesible desde el menú.
- Patrón acordeón para los elementos anidados.

### Barra de pestañas inferior

Ideal para: aplicaciones web, PWA, productos pensados primero para móvil.

```
┌──────────────────────────────────────┐
│                                      │
│        [Contenido de la página]      │
│                                      │
├──────────────────────────────────────┤
│  Inicio   Buscar    Crear    Perfil  │
│   🏠       🔍        ➕       👤     │
└──────────────────────────────────────┘
```

Reglas:
- De 3 a 5 elementos como máximo.
- Icono y texto (no solo icono).
- Estado activo muy claro.
- La acción más importante al centro.

---

## Lo que hay que evitar

- **Demasiados elementos en el menú (8+):** paraliza la decisión y no cabe en pantallas pequeñas.
- **Desplegables dentro de desplegables:** se pierde la gente.
- **Iconos misteriosos:** iconos sin texto que nadie entiende.
- **Menú principal escondido en escritorio:** meter páginas importantes en una hamburguesa en pantalla grande.
- **Menú distinto entre páginas:** debe ser idéntico en todo el sitio (salvo app frente a marketing).
- **Olvidar el móvil:** un menú de escritorio que no funciona en el teléfono.
- **Pie como vertedero:** más de 50 enlaces sin orden.
- **Migas de pan que no coinciden con la dirección:** dicen «Productos > Widget» y la dirección es `/tienda/widget-pro`.

### Arreglos comunes

| Problema | Arreglo |
|---|---|
| Demasiados elementos en el menú | Agrupar en desplegables o megamenú |
| La gente no encuentra las páginas | Añadir buscador, mejorar las etiquetas |
| Muchos abandonan desde el menú | Menos opciones, etiquetas más claras |
| Páginas de SEO sin enlaces | Llevarlas al pie o a una sección de recursos |
| El menú móvil falla | Probar en teléfonos reales, usar el patrón hamburguesa |

---

## Navegación y SEO

Los enlaces del menú transmiten autoridad (PageRank). Úsalo con estrategia:

- **Los enlaces del menú superior son los más fuertes:** pon ahí tus páginas más importantes.
- **Los del pie transmiten menos, pero cuentan:** buenos para comparativas y páginas de ciudades o sucursales.
- **Los de la barra lateral** dan autoridad por sección: categorías del blog, secciones de la documentación.
- **Las migas de pan** dan señales de estructura a los buscadores: márcalas con datos estructurados.
- **Nada de menús solo en JavaScript:** los buscadores necesitan enlaces HTML que puedan rastrear.
- **Texto descriptivo:** «Funciones de analítica», no solo «Funciones».
