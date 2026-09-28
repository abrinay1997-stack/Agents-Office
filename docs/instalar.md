# Instalar la oficina en una computadora nueva

Guía corta para quien empieza en PanaClaw (auditoría de negocio, J3).

## Con un doble clic (Windows)

1. Pide al dueño acceso de colaborador en GitHub (`abrinay1997-stack/Agents-Office`).
2. Descarga **`Instalar-Oficina.bat`** del repositorio y ábrelo con doble clic. El instalador:
   - instala lo que falte con `winget`: Node.js LTS, Git y Claude Code (`npm i -g @anthropic-ai/claude-code`);
   - clona la oficina en `Documentos\Agents-Office` (si el archivo ya está dentro de la oficina, instala ahí);
   - corre `npm install`;
   - deja en el escritorio el acceso directo **Agents Office**.
3. Al final se abre Claude Code: escribe `/login` y entra con **tu propia cuenta**.
4. Abre la oficina con el acceso directo.

Si Windows no tiene `winget`, instala «App Installer» desde la Microsoft Store. Si Node se acaba de instalar y la ventana no lo ve, ciérrala y abre el instalador otra vez: retoma donde quedó.

## Las keys (nunca en un archivo)

Cada key va en las variables de entorno de Windows, una vez:

```bat
setx GEMINI_API_KEY "tu-key"
setx TELEGRAM_BOT_TOKEN "123:abc"
```

Cierra y vuelve a abrir la ventana para que se lean. La lista completa está en `README.md`; Telegram en `docs/telegram.md`, los webhooks en `docs/disparadores.md`.

## Primer arranque

- **Ajustes** (tecla `,`, el engranaje del dock) → «Preparar desde mi web»: la oficina lee tu web y escribe el perfil de la empresa, la oferta, la voz y las preguntas frecuentes en el Cerebro.
- **Ajustes → Cifras de la empresa**: precios, comisiones y metas que los agentes usan tal cual.
- **Ajustes → Equipo**: las personas que pueden tomar una tarea (y su Telegram para avisarles).
- Arrastra tus PDF, Word o Excel sobre el **Cerebro** (G) para que los agentes los lean.

## Mac o Linux

Instala Node 20+, Git y Claude Code (`npm i -g @anthropic-ai/claude-code`), luego:

```sh
git clone https://github.com/abrinay1997-stack/Agents-Office.git
cd Agents-Office && npm install && npm start
```
