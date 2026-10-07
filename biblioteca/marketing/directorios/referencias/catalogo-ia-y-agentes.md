# Catálogo de directorios (2 de 3): herramientas de IA, registros de agentes y MCP

Contiene los niveles 3 y 4. Solo aplican si el producto de la empresa es una herramienta de IA o expone capacidades para agentes (servidor MCP, plugin, API, `/llms.txt`). Un negocio tradicional no tiene nada que hacer aquí. Los valores de DR son aproximados y cambian: verifícalos (ver `catalogo-lanzamiento-y-software`).

---

## Nivel 3: directorios de herramientas de IA

Relevantes solo para productos nativos de IA. Se envían en las semanas 1 a 3.

### Nivel 3A: directorios de IA principales

| Directorio | DR | Tráfico mensual | Notas |
|---|---|---|---|
| **There's An AI For That (TAAFT)** | 76 | 2 M+ | El mayor directorio de IA. Búsqueda por tarea. Vale el esfuerzo listarse bien. |
| **Futurepedia** | 70 | 1 M+ | Más de 5.000 herramientas en 54 categorías. El YouTube de Matt Wolfe (más de 2 M de suscriptores) le da tráfico. |
| **Toolify.ai** | 71 | 500 mil+ | Más de 26 mil herramientas en más de 450 categorías. Sigue tendencias de tráfico. |
| **Future Tools (futuretools.io)** | 69 | 400 mil+ | Curado por Matt Wolfe. Más pequeño pero influyente. |
| **AI Tools Neilpatel** | 91 | n/d | El directorio gratuito de IA con DR más alto. |
| **Good AI Tools** | 66 | n/d | Curado, calidad sobre cantidad. |
| **NewTools.site** | 51 | n/d | Enlace dofollow por cada envío aprobado. |

### Nivel 3B: directorios de IA de gama media

| Directorio | DR est. | Notas |
|---|---|---|
| **aitools.inc** | ~66 | Posicionamiento de «multiplica tu producción por 10». |
| **AIStage** | ~66 | Incluye código abierto y noticias. |
| **AItrendytools** | ~69 | Listado completo. |
| **Grabon AI Directory** | ~70 | DR alto, audiencia amplia. |
| **TopAI.tools** | ~60 | Búsqueda por tarea parecida a TAAFT. |
| **Supertools** | ~61 | Interfaz limpia, buena categorización. |
| **AI Tools Directory** (aitoolsdirectory.com) | ~55 | Curado; ofrece ubicación destacada. |
| **AIChief** | ~35 | Orientado a negocios. |
| **LogicBalls** | ~40 | Más de 3.500 herramientas verificadas. |
| **SaasAITools** | ~30 | Cruce de SaaS e IA. |
| **PoweredByAI** | ~35 | Directorio en crecimiento con alcance por boletín. |
| **TheAISurf** | ~30 | Más nuevo, promueve activamente los envíos. |
| **AI Pedia Hub** | ~40 | «El directorio más grande, actualizado a diario». |
| **Dofollow.Tools** | ~30 | Enlaces dofollow gratuitos, de forma explícita. |
| **AIBacklinkList** | ~25 | Lista agregada de más de 2.500 oportunidades de enlaces de IA. |
| **AI Scout** | ~25 | Emergente, menos competencia. |
| **AI Tools Guide** | 77 | Directorio curado de herramientas de IA. |
| **AIToolly** | 69 | Descubrimiento de herramientas de IA. |
| **All The AI Tools** | 66 | Listado completo de herramientas de IA. |
| **Noxilo** | 66 | Directorio de herramientas de IA. |
| **AI Generation** | 55 | Directorio de herramientas de IA. |
| **Every AI** | 55 | Agregador de herramientas de IA. |
| **BAI.tools** | 53 | Directorio de herramientas de IA. |
| **The Rundown Tools** | 40 | Directorio de herramientas de un boletín de IA. |
| **AI NavHub** | 38 | Directorio de navegación de IA. |
| **WhatTheAI** | 35 | Directorio de herramientas de IA. |
| **ToolAI** | 31 | Directorio de herramientas de IA. |
| **LLM Relevance** | 30 | Directorio centrado en modelos de lenguaje. |

---

## Nivel 4: registros de agentes de IA y de servidores MCP

Relevantes solo si el producto expone capacidades de agente o servidores MCP (el protocolo con el que los asistentes de IA usan herramientas externas). Son una ventaja real para los productos nativos de IA: un producto de software tradicional no puede listarse aquí.

### Nivel 4A: publica primero en el registro oficial de MCP

El registro oficial, en `registry.modelcontextprotocol.io`, es la fuente sobre la que se construyen otros directorios de MCP. PulseMCP lee de él (y desde octubre de 2026 no recibe envíos directos), y Glama se apoya en él. Publicar primero aquí hace que aparezcan varias fichas sin envíos separados. Su propio enlace pasa poco valor de SEO: el objetivo es la distribución. El registro todavía está en «vista previa», así que puede haber reinicios de datos.

Estos pasos los hace quien desarrolla el servidor (el dueño o su equipo técnico); tú entregas la lista ordenada y qué datos hacen falta:

1. **Publica primero el paquete.** El registro guarda solo metadatos, así que el servidor ya debe estar en npm, PyPI, NuGet, crates.io, Docker/OCI o MCPB. Un servidor remoto puede saltarse esto y listar una dirección Streamable HTTP en `remotes`.
2. **Marca el paquete como tuyo.** npm: `"mcpName"` en `package.json`. PyPI y NuGet: `mcp-name: <nombre>` en el README (texto visible en crates.io). Docker: la etiqueta `io.modelcontextprotocol.server.name`.
3. **Instala la herramienta y genera `server.json`:** `brew install mcp-publisher` y luego `mcp-publisher init`. El `name` debe coincidir con la marca del paquete.
4. **Demuestra el espacio de nombres:** `mcp-publisher login github` da `io.github.<usuario>/*` (los espacios de una organización exigen ser propietario). Para `com.tudominio/*`, usa un registro DNS TXT o una clave en `/.well-known/mcp-registry-auth`.
5. **Publica:** `mcp-publisher publish`. Las versiones son inmutables una vez publicadas.

Fuente: la documentación de [modelcontextprotocol/registry](https://github.com/modelcontextprotocol/registry).

### Nivel 4B: directorios de MCP (envío directo)

| Directorio | Dominio | DR | Notas |
|---|---|---|---|
| **Smithery** | smithery.ai | ~79 | Formulario web o la herramienta de Smithery; exige iniciar sesión. Uno de los catálogos más usados |
| **Glama** | glama.ai/mcp/servers | ~75 | Se agrega desde un repositorio de GitHub. Las calificaciones de seguridad (A/B/C/F) importan: optimiza para una buena nota |
| **MCP.so** | mcp.so | ~73 | Formulario gratis (servidor, remoto, cliente, agente); vía rápida de US$39. No parece leer del registro oficial |
| **MCP Servers** | mcpservers.org | ~71 | Revisión gratis (~2 semanas); dofollow solo en el plan de US$39. ~41 mil visitas/mes |
| **MCP Market** | mcpmarket.com | ~61 | Se envía un repositorio de GitHub; acepta servidores y habilidades. Cola gratis de 4 a 6 semanas, vía rápida de US$29. ~89 mil visitas/mes |
| **APITracker MCP directory** | apitracker.io | — | Más de 110 servidores, 90 integraciones oficiales |
| **MCP Directory** | mcp.directory | ~37 | Formulario gratis. No es `mcpdirectory.app` |
| **AllMCPs** | allmcps.com | ~36 | Poco valor. No es `allmcp.com` (negocio sin relación) |
| **MCP Repository** | mcprepository.com | ~21 | Formulario gratis, poco valor |
| **AI Indigo** | aiindigo.com | ~12 | Tiene una sección de MCP, poco valor |

### Nivel 4C: directorios de agentes

| Directorio | Categoría | Notas |
|---|---|---|
| **AI Agents List (aiagentslist.com)** | Agentes | Aloja el directorio de más de 593 servidores MCP. |
| **AI Agent Store** | Agentes | Compara agentes, plataformas y marcos de trabajo. |
| **AI Agents Base** | Agentes | Directorio todo en uno. |
| **AI Agents Directory** | Agentes | Especializado, actualizado a diario. |
| **AgentHunter** | Agentes | «Descubre los mejores agentes de IA». |
| **Add AI Directory** | Agentes | Cataloga agentes y herramientas. |
| **AI Agents Live** | Agentes | Descubrimiento y para compartir. |
| **AI Agents Marketplace** | Agentes | Organizado por más de 300 equivalentes de roles humanos. |

### Nivel 4D: listas de GitHub (se abre una solicitud de cambio o PR)

GitHub marca los enlaces del README como nofollow, así que estas listas sirven para descubrimiento y para visibilidad en búsqueda con IA, no para el DR. Antes de gastar tiempo, comprueba que la lista siga aceptando cambios: muchas estrellas con cientos de solicitudes abiertas y sin cambios recientes significa que la tuya quedará esperando.

| Lista | Repositorio | Actividad (oct. 2026) | Encaje |
|---|---|---|---|
| **public-apis** | public-apis/public-apis | ~485 mil estrellas, activa, ~2 mil PR abiertos | Solo si tienes una API pública gratuita |
| **awesome-mcp-servers (TensorBlock)** | TensorBlock/awesome-mcp-servers | ~870 estrellas, más de 200 aceptados en 30 días | Servidores MCP |
| **awesome-mcp-list** | MobinX/awesome-mcp-list | ~885 estrellas, ~130 aceptados en 30 días | Servidores MCP |
| **toolsdk-mcp-registry** | toolsdk-ai/toolsdk-mcp-registry | ~190 estrellas, ~25 aceptados en 30 días | Servidores MCP |
| **xAI plugin marketplace** | xai-org/plugin-marketplace | ~275 estrellas | Plugins de Grok; se agrega una entrada a `.grok-plugin/marketplace.json`. Acepta sobre todo envíos de empresas |
| **awesome-mcp-lists** | collabnix/awesome-mcp-lists | ~34 estrellas | Poco valor |

Salta por ahora **jaw9c/awesome-remote-mcp-servers**: ~1,1 mil estrellas pero sin cambios aceptados desde junio de 2026 y más de 500 PR abiertos.

### Nivel 4E: fichas para agentes y búsqueda con IA

Fichas que los agentes y los asistentes de IA leen directamente. Son más parte del GEO (optimización para motores generativos) que del SEO.

| Ficha | Dónde | Notas |
|---|---|---|
| **Directorio de plugins de Claude** | claude.ai/directory/manage (las fichas, en claude.com/marketplace/plugins) | El directorio oficial de Anthropic para plugins y conectores en las apps de Claude y Claude Code. Se envía por el portal de desarrolladores (exige un plan de pago de Claude); cada ficha se analiza en seguridad y se revisa. No sirve para enlaces |
| **ClawHub** | clawhub.ai | Registro oficial de habilidades y plugins de OpenClaw. Se publica por la herramienta de línea de comandos o la web con inicio de sesión de GitHub. **Advertencia de seguridad:** en febrero de 2026 se encontraron 341 habilidades maliciosas; desde entonces se añadió revisión, pero dilo si lo recomiendas y mantén público el código de tu ficha |
| **Directorios de llms.txt** | llmstxt.site, directory.llmstxt.cloud, llmstxthub.com | Registra tu `/llms.txt` cuando ya exista. La vía de PR de llmstxthub es lenta (más de 400 PR abiertos): usa el formulario de su sitio |
