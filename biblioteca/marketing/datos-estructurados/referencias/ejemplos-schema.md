# Ejemplos de marcado schema

Ejemplos completos en JSON-LD de los tipos más comunes. Los nombres de propiedad y los valores de enumeración (`InStock`, `Monday`…) van siempre en inglés, como los define schema.org; los textos (nombre, descripción, preguntas) van en el idioma de la página. Cambia cada dato de ejemplo por el real de la empresa (Cerebro, cifras de la empresa o la propia página); nunca dejes un dato de ejemplo.

## Contenido
- Organization
- WebSite (con SearchAction)
- Article / BlogPosting
- Product
- SoftwareApplication
- FAQPage
- HowTo
- BreadcrumbList
- LocalBusiness
- Event
- Varios tipos a la vez
- Ejemplo de implementación (Next.js)

## Organization

Para la página de inicio o «Quiénes somos» de una empresa o marca.

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Empresa Ejemplo",
  "url": "https://ejemplo.com",
  "logo": "https://ejemplo.com/logo.png",
  "sameAs": [
    "https://www.instagram.com/ejemplo",
    "https://www.linkedin.com/company/ejemplo",
    "https://www.facebook.com/ejemplo"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+52-55-5555-5555",
    "contactType": "customer service",
    "availableLanguage": ["Spanish"]
  }
}
```

---

## WebSite (con SearchAction)

Para la página de inicio; permite el cuadro de búsqueda dentro del resultado.

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Ejemplo",
  "url": "https://ejemplo.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://ejemplo.com/buscar?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
}
```

---

## Article / BlogPosting

Para entradas de blog y noticias.

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Cómo poner datos estructurados en tu web",
  "image": "https://ejemplo.com/imagen.jpg",
  "datePublished": "2026-01-15T08:00:00-05:00",
  "dateModified": "2026-01-20T10:00:00-05:00",
  "author": {
    "@type": "Person",
    "name": "Ana Pérez",
    "url": "https://ejemplo.com/autores/ana"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Empresa Ejemplo",
    "logo": {
      "@type": "ImageObject",
      "url": "https://ejemplo.com/logo.png"
    }
  },
  "description": "Una guía completa para poner datos estructurados…",
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://ejemplo.com/guia-schema"
  }
}
```

Como plantilla de blog, los campos dinámicos salen del CMS: `headline` ← título de la entrada, `datePublished`/`dateModified` ← fechas de publicación y edición, `author` ← ficha del autor, `image` ← imagen destacada.

---

## Product

Para páginas de producto (tienda en línea o SaaS).

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Taladro percutor 600 W",
  "image": "https://ejemplo.com/taladro.jpg",
  "description": "Taladro percutor para concreto, madera y metal",
  "sku": "TAL-600",
  "brand": {
    "@type": "Brand",
    "name": "Marca Ejemplo"
  },
  "offers": {
    "@type": "Offer",
    "url": "https://ejemplo.com/productos/taladro-600",
    "priceCurrency": "COP",
    "price": "289900",
    "availability": "https://schema.org/InStock",
    "priceValidUntil": "2026-12-31"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "reviewCount": "127"
  }
}
```

`aggregateRating` solo si las reseñas se ven en esa página y son de ese producto. Cada reseña individual puede ir como `review` (`@type: Review`, con `author`, `reviewRating` y `reviewBody`).

---

## SoftwareApplication

Para páginas de un SaaS o de una app.

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "App Ejemplo",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web, iOS, Android",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.6",
    "ratingCount": "1250"
  }
}
```

---

## FAQPage

Para páginas con preguntas frecuentes visibles.

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "¿Qué son los datos estructurados?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Son un vocabulario que ayuda a los buscadores a entender el contenido de una página…"
      }
    },
    {
      "@type": "Question",
      "name": "¿Cómo se ponen?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Lo recomendado es usar JSON-LD y poner el script en el head de la página…"
      }
    }
  ]
}
```

Directrices: cada pregunta y respuesta debe estar visible en la página, las respuestas son informativas (no publicidad) y la página la escribe la empresa (no es un foro donde los usuarios responden: eso es QAPage). Con 20 preguntas, se marcan las 20 con la misma estructura.

---

## HowTo

Para contenido instructivo y tutoriales.

```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "Cómo poner datos estructurados en tu web",
  "description": "Guía paso a paso para poner schema en JSON-LD",
  "totalTime": "PT15M",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Elige el tipo de schema",
      "text": "Identifica el tipo que corresponde al contenido de tu página…",
      "url": "https://ejemplo.com/guia#paso1"
    },
    {
      "@type": "HowToStep",
      "name": "Escribe el JSON-LD",
      "text": "Crea el marcado siguiendo las especificaciones de schema.org…",
      "url": "https://ejemplo.com/guia#paso2"
    },
    {
      "@type": "HowToStep",
      "name": "Añádelo a la página",
      "text": "Pon la etiqueta script en el head de la página…",
      "url": "https://ejemplo.com/guia#paso3"
    }
  ]
}
```

---

## BreadcrumbList

Para cualquier página con migas de pan.

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Inicio",
      "item": "https://ejemplo.com"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Blog",
      "item": "https://ejemplo.com/blog"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Guía de SEO",
      "item": "https://ejemplo.com/blog/guia-seo"
    }
  ]
}
```

---

## LocalBusiness

Para la página de un negocio con local. Usa el subtipo más preciso (`Dentist`, `Restaurant`, `CafeOrCoffeeShop`, `ClothingStore`, `HardwareStore`, `BeautySalon`…). Los datos deben ser idénticos a los de la ficha de Google del negocio.

```json
{
  "@context": "https://schema.org",
  "@type": "Dentist",
  "name": "Clínica Dental Ejemplo",
  "image": "https://ejemplo.com/clinica.jpg",
  "url": "https://ejemplo.com",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Calle 93 # 14-20, consultorio 302",
    "addressLocality": "Bogotá",
    "addressRegion": "Cundinamarca",
    "postalCode": "110221",
    "addressCountry": "CO"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "4.6767",
    "longitude": "-74.0482"
  },
  "telephone": "+57-601-555-5555",
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "opens": "08:00",
      "closes": "18:00"
    },
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": "Saturday",
      "opens": "09:00",
      "closes": "13:00"
    }
  ],
  "priceRange": "$$"
}
```

Con varias sedes: una página por sede, cada una con su propio LocalBusiness.

---

## Event

Para eventos, talleres, webinars o conferencias.

```json
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "Congreso anual de marketing",
  "startDate": "2026-06-15T09:00:00-05:00",
  "endDate": "2026-06-15T17:00:00-05:00",
  "eventAttendanceMode": "https://schema.org/OnlineEventAttendanceMode",
  "eventStatus": "https://schema.org/EventScheduled",
  "location": {
    "@type": "VirtualLocation",
    "url": "https://ejemplo.com/congreso"
  },
  "image": "https://ejemplo.com/congreso.jpg",
  "description": "Únete a nuestro congreso anual de marketing…",
  "offers": {
    "@type": "Offer",
    "url": "https://ejemplo.com/congreso/entradas",
    "price": "199",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock",
    "validFrom": "2026-01-01"
  },
  "performer": {
    "@type": "Organization",
    "name": "Empresa Ejemplo"
  },
  "organizer": {
    "@type": "Organization",
    "name": "Empresa Ejemplo",
    "url": "https://ejemplo.com"
  }
}
```

Presencial: `OfflineEventAttendanceMode` y `location` como `Place` con su `address`. Mixto: `MixedEventAttendanceMode` y las dos ubicaciones en una lista.

---

## Varios tipos a la vez

Combina varios tipos con `@graph`; `@id` permite referirse a uno desde otro.

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://ejemplo.com/#organization",
      "name": "Empresa Ejemplo",
      "url": "https://ejemplo.com"
    },
    {
      "@type": "WebSite",
      "@id": "https://ejemplo.com/#website",
      "url": "https://ejemplo.com",
      "name": "Ejemplo",
      "publisher": {
        "@id": "https://ejemplo.com/#organization"
      }
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [...]
    }
  ]
}
```

---

## Ejemplo de implementación (Next.js)

Para quien lleve la web; el agente lo entrega como código, no lo instala.

```jsx
export default function ProductPage({ product }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    // ... las demás propiedades
  };

  return (
    <>
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      </Head>
      {/* Contenido de la página */}
    </>
  );
}
```
