# Conectar tu IA a la oficina (9 oct 2026)

La oficina se puede manejar desde **tu propio asistente de IA** (Claude Desktop, Claude Code, Cursor, LM Studio o cualquier programa que hable MCP) con el servidor `oficina-mcp.mjs`. Ese asistente puede ver lo mismo que Dimitri y hacer los mismos cambios que Dimitri te propone, con las mismas reglas. Lo que sale de la máquina (enviar, publicar, pagar, aprobar, borrar) sigue siendo solo tuyo.

## Qué puede y qué no

| Puede | No puede (no hay herramienta para eso) |
|---|---|
| Leer el estado de la oficina tal como lo ve Dimitri, con ids (`estado_oficina`) | Aprobar nada: ni un borrador de un agente ni una pieza de Contenido |
| Leer tareas, agenda, tu lista personal, rutinas, el calendario, Contenido, lo publicado con sus cifras, los huecos de la semana y Analíticas | Enviar correos, publicar en redes, pagar |
| Hablar con Dimitri (`hablar_con_dimitri`) | Borrar tareas, rutinas, piezas o notas |
| Crear trabajo: una tarea para un departamento (siempre espera tu OK antes de enviar nada) o una tarea para tu lista | Quitarle el OK a una rutina (eso lo haces tú en el calendario) |
| Hacer cambios que se deshacen (`hacer`): crear, pausar, reanudar, editar, saltar o correr una rutina; mover o cancelar una tarea de un agente que no empezó; cambiar prioridad o fecha límite; delegar o marcar hecha una tarea tuya; crear o mover un borrador de Contenido; llenar la semana | Generar con el Estudio (gasta: se hace con GENERAR en el chat de Dimitri) |
| Deshacer un cambio durante 10 minutos (`deshacer`, con la clave que te dio) | |

Cada cambio queda en el registro de la oficina (`data/audit/AAAA-MM-DD.jsonl`, `kind: "oficina"`, `por: "asistente"`), y en el detalle de una tarea sale como «Tu asistente (IA conectada)».

## Cómo se conecta

La oficina tiene que estar abierta (doble clic en el iniciador, o `npm start`). El asistente corre en **esta misma computadora** y habla con la oficina en `http://127.0.0.1:4520`. Si la abriste en otro puerto, pon `AO_OFFICE` con la dirección.

**Claude Desktop** (Ajustes → Desarrollador → Editar configuración, archivo `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "agents-office": {
      "command": "node",
      "args": ["C:\\Users\\TU-USUARIO\\Agents-Office\\oficina-mcp.mjs"]
    }
  }
}
```

**Claude Code** (en una terminal, fuera de la carpeta de la oficina):

```
claude mcp add agents-office -- node C:\Users\TU-USUARIO\Agents-Office\oficina-mcp.mjs
```

La barra de conectores de la oficina lo mostrará como «agents-office», **bloqueado**: es para ti, y un agente no lo recibe nunca, aunque lo nombres en Ajustes (un agente con tus controles podría crear trabajo o pausar rutinas). Lo comprueba `tests/mcp-plugins.test.mjs`.

**Cursor, LM Studio, Windsurf u otro cliente MCP**: el mismo comando (`node` y la ruta de `oficina-mcp.mjs`) en su lista de servidores MCP «stdio».

Para empezar, pídele a tu asistente: «Usa como_funciona y estado_oficina y dime cómo vamos».

## ChatGPT y Meta AI

- **ChatGPT** (web y app) y **Meta AI** solo se conectan a servidores MCP **remotos** (una dirección https en internet). La oficina, a propósito, solo escucha en esta computadora y todavía no tiene inicio de sesión (issue #2). Exponerla a internet sin eso dejaría tus tareas a cualquiera.
- Cuando se cierre el issue #2 (inicio de sesión) se puede añadir el mismo servidor por HTTP con su token, y entonces ChatGPT o Meta podrían conectarse igual que Claude Desktop. Las herramientas y sus reglas serían las mismas (`oficina/rutas.mjs`).
- Mientras tanto, cualquier programa de escritorio que admita MCP local funciona hoy.

## Dimitri con otro modelo

Dimitri (y los agentes) piensan con el modelo que pongas en la oficina: Claude por defecto, o un proveedor compatible con el formato de Anthropic con `ANTHROPIC_BASE_URL` (la opción 2 del iniciador apunta a **Meta Muse Spark**; también DeepSeek, Kimi, GLM u **OpenRouter**, que da acceso a modelos de OpenAI y otros, por verificar modelo por modelo). Desde el 9 oct 2026:

- Dimitri lee su respuesta aunque el modelo escriba algo antes del JSON, ponga un ejemplo o lo meta en un bloque de código (`sub.pickJSON`).
- Lo que propone y no se puede hacer (un id que no existe, una acción que no está en la lista, una tarea tuya que se intentó cancelar) te lo dice en la respuesta, en vez de perderse.
- El mapa de la oficina (`oficina/mapa.mjs`) va en su prompt: no depende de lo que el modelo «sepa».

## Para quien mantiene la oficina

- `oficina-mcp.mjs`: el servidor MCP (stdio, sin dependencias). Sus lecturas comparten código con las de los agentes (`oficina/lecturas.mjs`).
- `oficina/rutas.mjs`: `/api/oficina/*` (mapa, estado, calendario, accion, deshacer). Valida con `sub.parseOps` y ejecuta con `runOp` de `serve.mjs`, igual que el botón HACER de Dimitri. Una acción nueva se añade en `sub.OPS`, `sub.parseOps`, `runOp`/`undoOp`, `opLabel` (`src/sub-ops.js`) y `ACCIONES`; `tests/control-oficina.test.mjs` falla si falta una.
- `oficina/mapa.mjs`: el mapa y las reglas en palabras. Si cambia algo grande de la oficina, se cambia ahí.
- Tests: `tests/control-oficina.test.mjs` (puro) y `tests/oficina-servidor.test.mjs` (serve.mjs real y el MCP).
