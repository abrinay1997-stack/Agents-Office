# Dimitri en Telegram

Habla con tu oficina desde el teléfono, aunque no la tengas abierta.
- Las aprobaciones te llegan con **✅ Aprobar y enviar** y **↩ Devolver**.
- Los fallos llegan con **↻ Reintentar**.
- Llegan también los avisos de la oficina: una rutina atrasada, un conector caído, algo que el guardián detuvo.
- Cualquier otro mensaje va a Dimitri, como en la oficina.

Funciona desde tu propia PC. La oficina le pregunta a Telegram cada pocos segundos, así que no necesita una dirección pública ni cuesta nada.

## Encenderlo (5 minutos)
1. En Telegram, abre **@BotFather**.
   - Escribe `/newbot` y ponle un nombre (p. ej. «Dimitri PanaClaw»).
   - Te da un **token** como `123456789:AA…`. No lo compartas.
2. Escríbele cualquier cosa a **@userinfobot**: te dice tu **id** (un número).
3. En Windows, en una ventana de comandos (no en un archivo), escribe:
   ```
   setx TELEGRAM_BOT_TOKEN "el-token-de-botfather"
   setx TELEGRAM_OWNER_ID "tu-id"
   ```
   Para varias personas, separa los ids con coma: `"111,222"`.
4. Cierra y vuelve a abrir la oficina. En la ventana negra debe decir `telegram: on`.
5. En Telegram, abre tu bot y escribe `/ayuda`.

**Seguridad:**
- El token y los ids viven solo en variables de entorno de Windows, nunca en un archivo del repositorio. `npm run secrets` y el hook de pre-commit bloquean un token pegado por error.
- Solo los ids de `TELEGRAM_OWNER_ID` pueden usar el bot. Cualquier otra persona recibe «este bot es privado» y la oficina lo anota.
- Aprobar desde Telegram pasa por las mismas reglas que en la página: el guardián, los destinatarios del borrador y los topes.

## Qué puedes escribirle
| Escribe | Pasa |
|---|---|
| cualquier cosa | responde Dimitri; si propone un plan, sale el botón **📤 Enviar a los jefes** |
| `/estado` | el semáforo de la oficina |
| `/pendientes` | lo que espera tu visto bueno, con botones |
| `/tarea ventas: prepara la propuesta para Sol` | una tarea para ese departamento |
| `/silencio 2` | 2 horas sin avisos, salvo lo urgente (`/silencio` solo, para volver) |

## Horario de no molestar y qué avisa
En `office.config.json` (o en `office.config.local.json`):
```json
"telegram": {
  "quiet": { "from": "21:00", "to": "07:00" },
  "notify": { "approvals": true, "failures": true, "done": false, "notices": true }
}
```
- En el horario de no molestar se guarda todo menos lo urgente (Claude sin sesión, errores graves).
- Al terminar ese horario llega un resumen, y detrás cada mensaje con sus botones.
