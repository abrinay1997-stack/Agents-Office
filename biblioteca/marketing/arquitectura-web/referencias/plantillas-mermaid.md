# Plantillas de diagramas Mermaid

Diagramas listos para copiar como mapa visual del sitio. Cambia los nombres de los nodos y las conexiones según el sitio de la empresa.

---

## Jerarquía básica

Jerarquía simple de arriba abajo.

```mermaid
graph TD
    INICIO["Inicio<br/>/"] --> FUN["Funciones<br/>/funciones"]
    INICIO --> PREC["Precios<br/>/precios"]
    INICIO --> BLOG["Blog<br/>/blog"]
    INICIO --> NOS["Quiénes somos<br/>/nosotros"]

    FUN --> F1["Analítica<br/>/funciones/analitica"]
    FUN --> F2["Automatización<br/>/funciones/automatizacion"]
    FUN --> F3["Integraciones<br/>/funciones/integraciones"]

    BLOG --> B1["Artículo: Guía SEO<br/>/blog/guia-seo"]
    BLOG --> B2["Artículo: Consejos de conversión<br/>/blog/consejos-conversion"]
```

---

## Jerarquía con zonas de navegación

Usa subgrafos para mostrar qué páginas van en cada zona del menú.

```mermaid
graph TD
    subgraph "Menú superior"
        INICIO["Inicio"]
        FUN["Funciones"]
        PREC["Precios"]
        BLOG["Blog"]
        CTA["Empieza gratis ★"]
    end

    subgraph "Páginas de funciones"
        F1["Analítica"]
        F2["Automatización"]
        F3["Integraciones"]
    end

    subgraph "Pie de página"
        NOS["Quiénes somos"]
        EMP["Empleo"]
        CONT["Contacto"]
        PRIV["Privacidad"]
        TERM["Términos"]
    end

    INICIO --> FUN
    INICIO --> PREC
    INICIO --> BLOG
    FUN --> F1
    FUN --> F2
    FUN --> F3
    INICIO --> NOS
    NOS --> EMP
    INICIO --> CONT
```

---

## Jerarquía con direcciones

Cada nodo muestra el nombre y la dirección.

```mermaid
graph TD
    INICIO["Inicio<br/><small>/</small>"] --> PROD["Producto<br/><small>/producto</small>"]
    INICIO --> PREC["Precios<br/><small>/precios</small>"]
    INICIO --> BLOG["Blog<br/><small>/blog</small>"]
    INICIO --> DOCS["Documentación<br/><small>/docs</small>"]
    INICIO --> NOS["Quiénes somos<br/><small>/nosotros</small>"]

    PROD --> P1["Analítica<br/><small>/producto/analitica</small>"]
    PROD --> P2["Informes<br/><small>/producto/informes</small>"]

    DOCS --> D1["Primeros pasos<br/><small>/docs/primeros-pasos</small>"]
    DOCS --> D2["Referencia de API<br/><small>/docs/api</small>"]
```

Para un negocio local, el mismo esquema con servicios:

```mermaid
graph TD
    INICIO["Inicio<br/><small>/</small>"] --> SERV["Servicios<br/><small>/servicios</small>"]
    INICIO --> SUC["Sucursales<br/><small>/sucursales</small>"]
    INICIO --> CONT["Contacto<br/><small>/contacto</small>"]
    SERV --> S1["Limpieza dental<br/><small>/servicios/limpieza-dental</small>"]
    SERV --> S2["Ortodoncia<br/><small>/servicios/ortodoncia</small>"]
    SUC --> C1["Sucursal Centro<br/><small>/sucursales/centro</small>"]
```

---

## Modelo de centro y radios

Una página central unida a sus artículos radio, que también se enlazan entre sí.

```mermaid
graph TD
    CENTRO["Guía SEO<br/>(página central)"]

    CENTRO --> R1["Investigación de palabras clave"]
    CENTRO --> R2["SEO en la página"]
    CENTRO --> R3["SEO técnico"]
    CENTRO --> R4["Conseguir enlaces"]

    R1 -.-> R2
    R2 -.-> R3
    R3 -.-> R4

    style CENTRO fill:#f9f,stroke:#333,stroke-width:2px
```

Leyenda:
- Líneas continuas = enlaces principales centro-radio
- Líneas discontinuas = enlaces cruzados entre radios

---

## Flujo de enlaces internos

Cómo se enlazan entre sí las secciones del sitio.

```mermaid
graph LR
    subgraph "Marketing"
        INICIO["Inicio"]
        FUN["Funciones"]
        PREC["Precios"]
    end

    subgraph "Contenido"
        BLOG["Blog"]
        GUIA["Guías"]
        CASO["Casos de éxito"]
    end

    subgraph "Producto"
        DOCS["Documentación"]
        API["Referencia de API"]
        NOV["Novedades"]
    end

    BLOG --> FUN
    BLOG --> CASO
    CASO --> FUN
    CASO --> PREC
    FUN --> DOCS
    GUIA --> BLOG
    GUIA --> DOCS
    INICIO --> FUN
    INICIO --> BLOG
    INICIO --> CASO
```

---

## Antes y después de reestructurar

Compara la estructura actual con la propuesta, lado a lado.

```mermaid
graph TD
    subgraph "Antes"
        A_INICIO["Inicio"] --> A_P1["Página 1"]
        A_INICIO --> A_P2["Página 2"]
        A_INICIO --> A_P3["Página 3"]
        A_INICIO --> A_P4["Página 4"]
        A_INICIO --> A_P5["Página 5"]
        A_INICIO --> A_P6["Página 6"]
        A_INICIO --> A_P7["Página 7"]
        A_INICIO --> A_P8["Página 8"]
    end

    subgraph "Después"
        D_INICIO["Inicio"] --> D_S1["Funciones"]
        D_INICIO --> D_S2["Recursos"]
        D_INICIO --> D_S3["Empresa"]
        D_S1 --> D_P1["Función A"]
        D_S1 --> D_P2["Función B"]
        D_S2 --> D_P3["Blog"]
        D_S2 --> D_P4["Guías"]
        D_S3 --> D_P5["Quiénes somos"]
        D_S3 --> D_P6["Contacto"]
    end
```

---

## Colores por estado

Usa estilos para marcar el estado, la prioridad o el tipo de página.

```mermaid
graph TD
    INICIO["Inicio"] --> FUN["Funciones"]
    INICIO --> PREC["Precios"]
    INICIO --> BLOG["Blog"]
    INICIO --> NUEVA["Sección nueva"]
    INICIO --> QUITAR["Página que se retira"]

    FUN --> F1["Función existente"]
    FUN --> F2["Función nueva"]

    style INICIO fill:#4CAF50,color:#fff
    style PREC fill:#4CAF50,color:#fff
    style FUN fill:#4CAF50,color:#fff
    style BLOG fill:#4CAF50,color:#fff
    style F1 fill:#4CAF50,color:#fff
    style NUEVA fill:#2196F3,color:#fff
    style F2 fill:#2196F3,color:#fff
    style QUITAR fill:#f44336,color:#fff
```

Clave de colores:
- **Verde** (`#4CAF50`): páginas que ya existen (sin cambios)
- **Azul** (`#2196F3`): páginas nuevas por crear
- **Rojo** (`#f44336`): páginas que se quitan o redirigen
- **Amarillo** (`#FFC107`): páginas que se reestructuran o mueven
- **Morado** (`#9C27B0`): páginas de alta prioridad o de acción (contacto, compra, reserva)

Cuando uses colores, pon siempre la clave debajo del diagrama: quien lo lea no tiene por qué saber qué significa cada color.
