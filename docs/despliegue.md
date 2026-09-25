# Llevar la oficina fuera de tu computadora (cuando quieras)

La oficina está hecha para correr en tu PC: es gratis, tus datos no salen de ella y los agentes usan tu propia sesión de Claude. Esta guía solo explica cómo moverla el día que haga falta. **Hoy no hay nada activado ni se paga nada.**

> ⚠ **Antes de exponerla:** la oficina todavía no tiene inicio de sesión ([issue #2](https://github.com/abrinay1997-stack/Agents-Office/issues/2)). Quien llegue a su dirección puede mandar a los agentes, que tienen tu Gmail y tu Chrome. Hasta cerrar ese issue, usa solo la opción 1 y protégela con una contraseña de Cloudflare Access.

## 1. Verla desde el teléfono sin mudarla (Cloudflare Tunnel, gratis)
La oficina sigue en tu PC. Cloudflare te da una dirección segura que llega hasta ella.
1. Instala `cloudflared` (en Windows: `winget install Cloudflare.cloudflared`).
2. Crea el túnel en el panel gratuito de Cloudflare Zero Trust y apúntalo a `http://localhost:4520`.
3. **Obligatorio:** añade una aplicación de **Cloudflare Access** para esa dirección, con tu correo como único permitido. Es gratis hasta 50 usuarios y pide un código por correo antes de mostrar la oficina.
4. La oficina se queda escuchando en `127.0.0.1`; no cambies `host`.

## 2. Un servidor propio (Railway, Fly, cualquier Docker), cuando se cierre el issue #2
Hay un `Dockerfile` y un `railway.json` listos.
- **Secretos del host** (en su panel de variables, nunca en archivos):
  - `ANTHROPIC_API_KEY`: la clave con la que trabajan los agentes (se paga por uso).
  - las keys del Estudio, si las usas: `HF_KEY`, `GEMINI_API_KEY`, `FAL_KEY`, …
- **Datos:** monta un volumen en `/data` (`AO_DATA=/data`). Sin volumen, las tareas se pierden en cada despliegue.
- **Salud:** el host revisa `/api/health`, y `/api/status` da el semáforo completo.
- **Conectores:** los de claude.ai (Gmail, Drive…) viven en tu cuenta. En un servidor hay que añadirlos con `claude mcp add` dentro del contenedor, o conectarlos por API.
- **Cloudflare Workers o Pages no sirven:** la oficina lanza procesos (`claude`) y escribe archivos, cosas que esa plataforma no permite. En Cloudflare se usa la opción 1.

## 3. Qué cambia en un servidor
- El Chrome del dueño (`tools.browser`) no existe allí. Apágalo con `"tools": { "browser": false }`.
- Las rutinas corren aunque tu PC esté apagada: ese es el motivo para mudarla.
- Las reglas de envío (`safety`), los topes y el registro en `data/audit/` funcionan igual.
