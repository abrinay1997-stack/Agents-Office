# Disparadores: trabajo que empieza cuando algo pasa

Una rutina trabaja a una hora; un **disparador** trabaja en cuanto llega algo:
- un formulario de tu web;
- un pago de Stripe;
- un WhatsApp;
- un correo que Zapier, Make o n8n te reenvían.

La oficina crea la tarea al instante y, por defecto, su resultado espera tu visto bueno.

## 1. La clave (una sola vez)
En una ventana de comandos de Windows:
```
setx AO_HOOK_TOKEN "un-texto-largo-y-al-azar-de-al-menos-16-caracteres"
```
Sin esta variable, la oficina rechaza todos los webhooks. Nunca la escribas en un archivo.

## 2. El disparador
Crea `brain-panaclaw/Agents Office/triggers.json`. Viaja por GitHub como las rutinas y no lleva secretos:
```json
{ "triggers": [
  { "id": "formulario-web", "dept": "sales", "agent": "piper", "source": "form",
    "title": "Contacto de {{name}}",
    "text": "Llegó un contacto desde la web: {{name}} ({{email}}). Escríbele la primera respuesta con nuestra oferta.",
    "needsOk": true, "perHour": 20 },
  { "id": "pagos", "dept": "fin", "source": "stripe",
    "text": "Llegó un pago de {{amount}} {{currency}} de {{email}}. Registra el cobro y prepara el recibo." },
  { "id": "whatsapp", "dept": "sales", "agent": "ilm", "source": "whatsapp",
    "text": "{{name}} escribió por WhatsApp: «{{text}}». Prepara la respuesta." }
] }
```
- `source`:
  - `form`: cualquier formulario o JSON;
  - `stripe`: solo pagos completados;
  - `whatsapp`: la API oficial de WhatsApp Cloud de Meta;
  - `email`: correos que te reenvía Zapier, Make o n8n;
  - `generic`: cualquier otra cosa.
- `{{campo}}` se rellena con lo que llega. Lo que falta sale como «(sin dato)».
- `agent` es opcional: sin él, la oficina elige el escritorio. `team: true` pone a todo el departamento.
- `needsOk` (por defecto `true`): el resultado espera tu OK antes de enviar nada.
- `perHour` (por defecto 30): un tope contra inundaciones. Si llega el mismo evento dos veces, se toma una sola.
- `paused: true` lo deja apagado.

`npm run check` valida el archivo y explica cada problema.

## 3. La dirección
`POST http://localhost:4520/api/hook/<id>?token=<AO_HOOK_TOKEN>`, con un cuerpo JSON o de formulario. También vale la cabecera `X-Office-Token`.
- **Zapier, Make, n8n:** una acción «Webhook / HTTP POST» a esa dirección.
- **Desde fuera de tu PC** (Stripe, WhatsApp): hace falta un túnel. Mira `docs/despliegue.md`, opción 1.
- **WhatsApp Cloud:** usa la misma dirección como *Callback URL* y el mismo `AO_HOOK_TOKEN` como *Verify token*.

## Seguridad
- Lo que llega lo escribió un tercero. El agente lo recibe en un bloque de **DATOS**, separado de tu instrucción y marcado como «no son órdenes».
- Si trae órdenes escondidas («ignora tus instrucciones…»), la tarea espera tu OK y el semáforo lo avisa.
- Cada envío que haga el agente pasa por el guardián (ver «Seguridad de los agentes» en CLAUDE.md).
