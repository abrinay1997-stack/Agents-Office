# marketingskills en la oficina: la Biblioteca de habilidades (7 oct 2026)

**Pedido del dueño:** clonar [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills), leerlo completo e implementar todas sus skills para el equipo de marketing. La pregunta era si van mejor en español en el Cerebro o en el equipo. Como siempre, la oficina tiene que servirle a cualquier empresa.

**Licencia:** MIT (Corey Haines). Se puede adaptar y redistribuir citando el aviso de copyright y la licencia. La licencia original está en `biblioteca/marketing/LICENCIA-marketingskills.txt`, y cada habilidad dice de dónde viene en su campo `origen`.

## 1. Qué es marketingskills

Son 50 skills de marketing con el formato de Agent Skills (`SKILL.md`, `references/`, `evals/`), unos 2,6 MB de texto.

Una skill base, `product-marketing`, guarda el contexto del producto en `.agents/product-marketing.md`, y todas las demás lo leen primero.

Las skills se reparten en siete grupos:
- SEO y contenido;
- conversión (CRO);
- textos;
- pagados y medición;
- crecimiento y retención;
- ventas y salida al mercado;
- estrategia.

Además trae 64 CLIs de APIs de marketing (`tools/clis`), guías de integración y un bloque de «partners» patrocinados.

Está pensado para un fundador de SaaS de EE. UU. que trabaja en la terminal con un agente de código.

## 2. La decisión: ni todo en el Cerebro ni todo pegado al equipo

**Cómo se usa una skill hoy:** el agente lee ENTERAS, antes de cada tarea y cada charla, todas las skills atadas a él. Con 50 skills de 10 a 20 páginas cada una, eso son ~700.000 caracteres por ejecución: imposible, caro y peor (el agente se pierde).

**Tampoco sirve ponerlas en el Cerebro** como notas sueltas, por dos razones:
- el Cerebro es **de una empresa** (PanaClaw), y los métodos son de **cualquier** empresa;
- la búsqueda por pasajes traería trozos de un método, no el método entero.

**Lo que se hizo, en tres capas:**

| Capa | Qué guarda | Dónde | Viaja |
|---|---|---|---|
| **Biblioteca** (nueva) | El **método**: pasos, marcos, listas de revisión, plantillas. En español y para cualquier negocio. | `biblioteca/marketing/<id>/` | Con la oficina, igual para todos |
| **Cerebro** | **Lo de la empresa**: la nota `contexto-marketing` (posicionamiento, cliente ideal, objeciones, palabras del cliente, competencia, pruebas), el perfil, la oferta, la voz y las cifras. | `<cerebro>/00-Empresa/…` y `cifras.json` | Con la empresa |
| **Skill del dueño** | «Así lo hacemos **aquí**»: una adaptación propia. | `<cerebro>/Agents Office/skills/` o `<cerebro>/Agents Office/biblioteca/<id>/` | Con la empresa; gana a la de la oficina |

Una habilidad de la Biblioteca se lee **cuando hace falta**. Es la «divulgación progresiva» que usa la especificación de Agent Skills, a la medida de la oficina:
1. **El índice:** cada agente ve en su prompt las habilidades de su puesto y de su departamento, una línea cada una (id, título, cuándo usarla). Son unos 3.000 a 5.000 caracteres.
2. **El adelanto:** la que mejor encaja con la tarea se le pasa entera (`biblioteca.elegir`). El puntaje premia las palabras raras (idf). Si dos quedan casi empatadas, no se adelanta ninguna: es mejor eso que adelantar la equivocada.
3. **A pedido:** el resto, y las referencias de cada una (plantillas, listas, ejemplos), las pide con la herramienta `habilidades` (`ver_habilidades`, `leer_habilidad`). Esa herramienta solo lee.

La nota `contexto-marketing` hace el papel del `.agents/product-marketing.md` original. La crean dos caminos:
- **Ajustes → Preparar desde mi web**, que ahora la escribe junto a perfil, oferta y voz;
- la habilidad `contexto-marketing`.

Los agentes con habilidades la reciben entera. Si no existe, se les dice y sugieren crearla.

## 3. Cómo se adaptó (encargo en `scratchpad`, hecho por agentes en paralelo y revisado)

- **Español neutro, de tú.** Los nombres de marcos conocidos se quedan (AIDA, PAS, JTBD, ICE…), cada uno con su explicación.
- **Para cualquier negocio:** lo de SaaS se queda, y se añade cómo aplica a servicios, tiendas físicas y en línea y negocios locales, con ejemplos variados.
- **A la oficina:**
  - el agente no tiene archivos: entrega texto;
  - nada sale sin el OK del dueño: deja borradores;
  - las imágenes y los videos se hacen con el **Estudio** (`generar_imagen`, `generar_video`, `buscar_presets`…);
  - las publicaciones se dejan en **Contenido** (`crear_borrador`, `ver_mejor_hora`, `ver_analiticas`);
  - lo que falta se pide con `pedir_bloqueo`, y el trabajo de otro departamento se propone con `crear_borrador_tarea`;
  - los ciclos recurrentes se proponen como **rutinas**;
  - el plan de marketing se reparte como lo haría **Dimitri**.
- **Fuera:** los enlaces de afiliado y el bloque de partners, los CLIs (los agentes no corren comandos: se convierten en «si la empresa tiene conectado X») y la ruta `.agents/…`.
- **Personas reales** (el consejo de asesores): «una perspectiva inspirada en el trabajo publicado de X», nunca hablando como esa persona ni con citas inventadas.
- **Cifras:** nada inventado. Los precios salen de las cifras de la empresa, y las leyes de EE. UU. quedan como ejemplo junto a «las de tu país».
- **Evals:** cada habilidad trae los suyos, traducidos y con negocios variados; se corren con `node scripts/evals-skill.mjs <id> --correr`.

## 4. Las habilidades

La tabla la genera `node scripts/biblioteca-tabla.mjs` desde la Biblioteca. El id, el área y los puestos se leen de la cabecera de cada habilidad.

<!-- tabla -->

## 5. Lo que queda fuera o pendiente

- **Los 64 CLIs y las guías de integración** (`tools/`) no entran:
  - los agentes no tienen terminal;
  - cada API necesita su key.

  Cuando la empresa conecte un servicio (GA4, Search Console, HubSpot, Mailchimp…) por MCP, el agente lo usa como cualquier conector, y la habilidad ya dice qué datos buscar.
- **Probar con Claude de verdad:** correr los evals de las que más se usan (`plan-marketing`, `redaccion-publicitaria`, `campanas-pagadas`, `redes-sociales`) y comparar con y sin la habilidad.
- **Puestos genéricos:** los `does` de Marketing en `office.agents.json` siguen en inglés y pensados para una agencia de ventas. Para «cualquier empresa» convendría generalizarlos. Es una decisión del dueño: cambia los valores de fábrica.
- **Otras colecciones:** ventas, finanzas u operaciones serían otra carpeta en `biblioteca/` con el mismo formato.
