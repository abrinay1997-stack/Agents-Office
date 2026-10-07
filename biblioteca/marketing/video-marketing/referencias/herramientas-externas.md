# Herramientas externas de video: plantillas programáticas, avatares y edición

La oficina no ejecuta código ni usa programas de edición. Esta referencia sirve para **recomendar** la herramienta adecuada a quien sí la maneja (el dueño, un diseñador, una persona técnica o un proveedor) y para escribir la especificación que esa persona va a ejecutar. Di siempre que son opciones y que los precios y planes cambian: confirma en la página oficial de cada herramienta. Si la empresa tiene conectada alguna (por ejemplo, un servidor MCP), úsala solo si está conectada; nunca des por hecho que existe.

## Video programático (con código)

Construir videos con código. Sirve para video repetible, con plantilla o basado en datos, a escala.

### Hyperframes (HTML/CSS: recomendado para agentes de programación)

Código abierto, licencia Apache 2.0, de HeyGen. Usa HTML/CSS/JS simple, sin un lenguaje propio de un marco que aprender. Pensado para modelos de lenguaje: los modelos generan mejor HTML que componentes de React.

```bash
npx hyperframes init mi-video && cd mi-video
npx hyperframes preview               # vista previa en vivo
npx hyperframes render -o salida.mp4  # renderiza index.html
```

**Idea clave:** una composición es un solo archivo HTML. El elemento raíz fija el lienzo y la duración (`data-composition-id`, `data-duration`, `data-width`, `data-height`), cada elemento en pantalla es un clip (`class="clip"` con `data-start`, `data-duration`, `data-track-index`) y una línea de tiempo de GSAP en pausa, registrada en `window.__timelines`, dirige la animación. El paquete `hyperframes` es solo de línea de comandos; para renderizar desde código, usa `@hyperframes/producer` (`createRenderJob` + `executeRenderJob`). Sintaxis completa y un ejemplo funcional: en la guía de integración de Hyperframes del repositorio original de marketingskills.

**Mejor para:** anuncios de producto, registros de cambios, informes basados en datos, videos de contacto personalizados.

**Por qué lo prefieren los agentes:** HTML/CSS simple significa que cualquier agente de programación puede escribir una composición sin aprender un marco. Renderizado determinista: la misma entrada produce siempre la misma salida.

### Remotion (React)

Marco de código abierto maduro. Más potente que Hyperframes pero exige saber React.

```bash
npx create-video@latest
```

**Idea clave:** los componentes de React son los cuadros. Las propiedades dirigen el contenido. Se renderiza en local o con Remotion Lambda (AWS) para escalar.

```tsx
export const ProductDemo: React.FC<{ title: string; features: string[] }> = ({
  title, features
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#000", color: "#fff" }}>
      <h1>{title}</h1>
      {features.map((f, i) => (
        <Sequence from={i * 30} key={i}>
          <p>{f}</p>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
```

**Mejor para:** animaciones complejas, vistas previas interactivas, renderizado por lotes a gran escala (Lambda).

### Cuál elegir

| Factor | Hyperframes | Remotion |
|--------|-------------|----------|
| Compatibilidad con agentes | Mejor (HTML simple) | Buena (React) |
| Complejidad de animación | Líneas de tiempo de GSAP (más CSS) | Avanzada (resortes, interpolación) |
| Renderizado por lotes | Local | Lambda (AWS) para escalar |
| Curva de aprendizaje | Mínima | Moderada (React + API de Remotion) |
| Licencia | Apache 2.0 | Licencia de la empresa para uso comercial |

---

## Avatares de IA

Crean videos de una persona hablando sin filmar. Un avatar de IA dice tu guion con sincronía labial, expresiones y gestos realistas. El Estudio de la oficina no tiene avatares: se usan herramientas externas.

### HeyGen (recomendado en la fuente: tiene un servidor MCP)

La mejor sincronía labial y microexpresiones. Más de 230 avatares y más de 140 idiomas.

**Integración con agentes:** HeyGen tiene un servidor MCP oficial; los agentes pueden generar videos con avatar directamente **si la empresa lo tiene conectado**. Si no, tú entregas el guion y el dueño o diseño lo carga.

Los planes (gratuito, creador, negocio) varían en cantidad de videos y duración máxima; consulta la página oficial de precios para los valores actuales.

**Mejor para:** explicativos de producto, anuncios de funciones, contacto de ventas personalizado, contenido en varios idiomas.

**Avatares personalizados:** se sube un video de 2 a 5 minutos de la persona para crear un gemelo digital que se ve y suena como ella y genera videos a partir de guiones. Solo con el consentimiento por escrito de esa persona.

### Synthesia

Avatares de cuerpo completo con lenguaje corporal expresivo. Generación de guiones a partir de enlaces o documentos.

**Mejor para:** capacitación corporativa, videos de cumplimiento, presentaciones de empresa donde importa más el tono profesional que el realismo.

### Cuándo usar avatares y cuándo otra cosa

| Escenario | Usa avatar | Usa en su lugar |
|-----------|:---:|-----------------|
| Contenido recurrente (actualizaciones semanales) | Sí | — |
| Versiones en varios idiomas | Sí | — |
| Contacto personalizado a escala | Sí | — |
| Contenido auténtico del fundador | No | Filmar a la persona |
| Recorrido de la interfaz de un producto | No | Grabación de pantalla |
| Video creativo o artístico | No | Generación con IA (Estudio) |

---

## Herramientas de edición y reutilización

Convierten contenido existente en varios formatos de video.

| Herramienta | Qué hace | Mejor para |
|-------------|----------|------------|
| **Descript** | Edición por transcripción: editas el video editando el texto | Limpiar entrevistas, pódcast y seminarios |
| **Opus Clip** | Corta videos largos de forma automática y puntúa su potencial viral | De formato largo a corto a escala |
| **CapCut** | Efectos visuales, subtítulos y estilo propio de cada plataforma | Pulido para TikTok y Reels |
| **Captions.ai** | Subtítulos automáticos, corrección del contacto visual y doblaje con IA | Contenido de una sola persona hablando a cámara |

### Flujo de reutilización

```
Contenido largo (pódcast, seminario, demostración)
    ↓
Descript: limpiar, quitar muletillas, pulir
    ↓
Opus Clip: extraer automáticamente de 5 a 10 mejores momentos
    ↓
CapCut: añadir subtítulos, efectos y estilo de plataforma
    ↓
Distribuir: TikTok, Reels, Shorts, LinkedIn
```

La oficina aporta el **plan de cortes** (momentos, ganchos, textos) y los borradores de las piezas con `crear_borrador`; quien edita ejecuta el montaje.

---

## Flujo de producción con herramientas controlables por agentes

La combinación más potente usa herramientas que los agentes pueden controlar directamente. En una oficina con las conexiones adecuadas, se parece a:

```
El agente escribe el guion (a partir del contexto de la empresa)
    ↓
Plantilla programática (HTML → MP4)  y/o
Avatar desde el guion (si hay servidor MCP conectado)  y/o
Estudio: generar_video para material de apoyo
    ↓
Una persona ensambla el corte final
    ↓
Salida: video listo para el OK del dueño
```

Qué lo hace «nativo para agentes»: el HTML lo puede generar cualquier agente de programación, los servidores MCP se llaman directo y los modelos de video se consumen por peticiones HTTP estándar. En esta oficina el último paso (publicar) siempre es del dueño.

### Tabla de integraciones

| Herramienta | Tipo | Servidor MCP |
|-------------|------|:---:|
| **HeyGen** | Avatares de IA | Sí |
| **Hyperframes** | Video programático | — |
| **Remotion** | Video programático | — |
| **Runway** | Generación con IA | — |
