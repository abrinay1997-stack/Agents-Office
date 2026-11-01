# Guía de pruebas para el dueño (31 oct 2026)

Producción: https://agents-office.abrinay1997.workers.dev. Esta guía dice qué probar, en qué orden, qué debe pasar y qué cuesta.

**Leyenda:** ON = encendido de fábrica · OFF = se publicó apagado · $ = puede gastar · SL = solo en la computadora · NC = no confirmado en el código.

## Cómo se enciende lo que está apagado

Tres caminos, del más cómodo al más a mano:

1. **Ajustes → Funciones nuevas** (solo administradores, en la nube; en el teléfono: Más → Ajustes → Funciones nuevas). Una tarjeta por función con su estado real (✓ Encendida / – Apagada), qué hace y un botón. Lo que puede abrir la puerta al gasto (lotes) pide un segundo toque. Lo que **no está construido todavía** (retoques de foto en la nube, series que gastan) no se puede encender y dice por qué. Apagar siempre se puede. Nada se enciende solo.
2. **GitHub → Actions → «Cloudflare · encender funciones»**: lo mismo, sin entrar a la oficina (útil si la oficina no abre).
3. Todo lo de esta guía que dice «Funciones nuevas» ya se enciende desde el panel o desde el botón de GitHub; ya no hay nada que pedir por la consola.

Dónde ver el cambio: recarga la página después de encender una función.

## A. Lo más seguro (solo lectura, ON, sin gasto)
1. **Cuenta de lectura** (ON). Crea una cuenta «lectura» (Equipo). Debe ver tareas, calendario, resultados de los agentes, Cerebro y Contenido; NO debe ver dinero/Costos, Anuncios, Bandeja ni Ajustes de seguridad, ni poder cambiar nada (403 «Con acceso de lectura no se cambia nada»). Falla si ve gasto o puede editar.
2. **Versión móvil** (teléfono, ventana ≤ 820 px, o Ajustes → Apariencia → Versión). Barra inferior Inicio · Tareas · Dimitri · Calendario · Más. En «Más»: Contenido, Analíticas, Anuncios, Cerebro, Estudio, Buscar, Ajustes, Conectores, Costos, Estado, Negocio, Mi perfil/Equipo. Falla si ves la oficina 3D o texto cortado.
3. **Iconos de conectores** (ON). Ajustes → Conectores MCP: un conector que añadiste muestra el icono de su dominio o, si no hay, su monograma. Solo escritorio de la nube.
4. **Imágenes de Meta**: necesita Meta conectada (no probable sin token real).

## B. Cerebro (ON)
5. **Escribir, editar, borrar notas**: Cerebro → «✎ Nueva nota», Editar, «Mover a la papelera», Papelera → Recuperar. Si dos personas editan a la vez sale 409 y no pisa. Falla: una nota que desaparece sin papelera.
6. **Subir documento** (PDF/Word/Excel/CSV): sin gasto.
7. **Actualizar conexiones** (administrador, botón en el Cerebro): los pasos 1, 3 y 5 son gratis; el 2 «Conectar con IA» $ (poco, con DESHACER); el 4 «Reacomodar el mapa» usa CPU de Worker de pago y se puede deshacer.
8. **Buscar por significado** (OFF, paso 6 del mismo panel): tiene su propio flujo Indexar → Medir → Activar y necesita una llave (GEMINI_API_KEY u OPENAI_API_KEY). $ pequeño al indexar. Si falla, busca por palabras sin error. No está en «Funciones nuevas»: solo se enlaza.

## C. Estudio
9. **Presets** (ON): Estudio → Avanzado → banco B. Compilar no gasta; GENERAR $ (tu clic, con topes).
10. **Carpetas dentro de carpetas** (Funciones nuevas). Con ella: subcarpetas; borrar una carpeta manda sus subcarpetas y archivos a la papelera 30 días, con confirmación y DESHACER. Apagada, las anidadas se ven en una sola fila; no se pierde ninguna imagen. Sin gasto.
11. **Lotes del Estudio en la nube** (Funciones nuevas, avisa del gasto). Estudio → Lotes. Un lote nace «previsto» y no hace nada solo; «Probar con 3» y «Generar todas» $ con el costo en el botón. No probado con motores reales.
12. **Retoques de foto en la nube**: **no se puede encender todavía** (el servicio de imágenes de Cloudflare nunca se probó en producción). El panel lo dice.
13. **Descripciones IA de imágenes**: SL (solo computadora).

## D. Contenido
14. **«Mejorar con Marketing» mirando fotos y video** (ON): ✨ en el editor de la pieza o «Crear publicación» en el teléfono. Debe decir «Miró 1 foto y N cuadros…». Con un modelo sin visión dice por qué no miró. $ pequeño. Falla: texto genérico sin mención de lo visto.
15. **Publicar ahora** (OFF): Ajustes → Contenido. Exige modo «Real» y Meta directo; no se puede deshacer. No probable sin Meta real; solo en simulacro.

## E. Chat del equipo
16. **Chat interno** (Funciones nuevas). Al encenderlo, todas las cuentas quedan en #general. El botón del chat está en el dock (escritorio) y junto a la lupa (teléfono). Prueba con dos cuentas: mensajes, no leídos, «escribiendo…». Un administrador NO lee los directos de otras personas. Sin gasto.
17. **Notas para cuando entres y notificaciones por persona** (Funciones nuevas, sin gasto; el botón de GitHub con «listas» también las enciende: ninguna toca dinero). Encendidas, aparece la campanita: prueba con dos cuentas dejar una nota («Mientras no estabas», hasta 500 letras, solo a quien eliges) y ver los avisos según el rol. Apagadas, la campanita desaparece; las notas ya dejadas vuelven al encender.
17b. **Avisos de agentes para cuentas de solo lectura** (Funciones nuevas, de SEGURIDAD, viene ENCENDIDA). **No cambia lo que la cuenta de lectura puede abrir ni ver en las páginas** (eso lo decide el rol, y esa prueba es la 1). Solo decide qué avisos de la campanita le llegan, y **solo se nota con «Notificaciones por persona» encendida**. Prueba: con notificaciones encendidas, haz que un agente termine una tarea; la cuenta de lectura debe ver ese aviso en su campanita. Apaga esta función: el aviso de agentes, Contenido y Cerebro deja de llegarle (los básicos siguen). Vuelve a encenderla al terminar.
18. **Telegram por cuenta**: necesita un bot real.

## F. Dimitri
19. **Un chat por cuenta** (ON): con dos administradores, lo que dice uno no lo ve el otro («solo tú ves este chat»). $.
20. **Consultas y pasos visibles** (ON con un modelo que use herramientas): «¿cuántas tareas atrasadas hay y quién las tiene?» muestra «Consulté N cosas · <IA>». $.
21. **Historial 🕘** (ON): abrir, renombrar, borrar con segundo clic.
22. **Series de imágenes en la nube** (Funciones nuevas → «Series de imágenes en la nube: ver y proponer»). Ahora tiene pantalla: **Ajustes → Series de imágenes** (en el teléfono, **Más → Series de imágenes**). Con el motor gratis «Prueba» no cuesta nada; los motores de pago siguen cerrados.
    - **Paso a paso:** (1) enciéndela en Funciones nuevas; (2) pídele a Dimitri una serie de imágenes; (3) abre la pantalla y toca la serie: verás cada plano, su estado en palabras y, si eres administrador, el **Presupuesto** (tope de la serie, lo gastado, lo reservado); (4) toca **«Probar con 3 (ver el presupuesto)»**: aparece la cifra exacta, los topes y un botón **«Sí, generar — gasta hasta US$…»**. Hasta ese segundo toque **no se ha autorizado nada** (Escape o «No, volver» lo deja como estaba); (5) al confirmar, la serie empieza sola en el siguiente minuto y la pantalla se actualiza; (6) **Pausar** frena; **Cancelar la serie** pide un segundo toque; **Ver lo que se gastó** enseña el libro línea por línea.
    - **Si algo queda «en duda»** (pudo haberse cobrado) o hay **«líneas del libro sin serie»** (por ejemplo, después de restablecer a Dimitri), la pantalla lo avisa arriba: toca **Revisar → Decidir**, elige **«Sí se cobró»** (puedes escribir cuánto fue de verdad; vacío = todo lo reservado) o **«No se cobró»**, y confirma en el segundo toque, que repite la cifra. **No se puede deshacer** (es dinero): solo anota la contabilidad, no gasta ni reanuda nada.
    - Un editor o una cuenta de solo lectura ve el avance y los estados, pero ni botones ni dinero. Si la función está apagada, la pantalla lo dice y explica cómo encenderla.
23. **Series en la computadora** (SL): flags de `office.config.local.json`, solo localhost y clic del dueño. $.

## G. Seguridad
24. **Freno al adivinar contraseñas** (Funciones nuevas). Prueba: 4 o más contraseñas malas del mismo correo → el aviso de contraseña incorrecta tarda cada vez más (1, 2, 4 s…). La correcta entra sin esperar. Nunca deja a nadie fuera. Apagado vuelve a lo de siempre.
25. **Sesión que se renueva sola** (Funciones nuevas). Encenderlo no desconecta a nadie. La pantalla de dispositivos todavía no existe (solo la API `GET /api/yo/sesiones`).
26. **Token en la dirección (?token=)** (ON, Ajustes → Seguridad): apágalo cuando `usos30d` de `GET /api/triggers` sea 0.
27. **Dominios por conector** (OFF, Ajustes → Seguridad): encendido, cada conector tiene «Dominios que puede consultar» (solo administradores). Riesgo: un dominio que acepte subidas. Sin gasto.

## Orden sugerido
1) 1, 2, 3, 5, 6, 21 (lectura/seguro) → 2) 16, 17 y 17b con dos cuentas → 3) 19 y 20 → 4) 7 (pasos gratis), 10, 24, 25, 26, 27 → 5) con gasto pequeño: 7 (paso 2), 8, 14 → 6) con gasto: 9 GENERAR, 11 → 7) al final y con cuidado: 15.

## Requieren llaves reales (no probables sin ellas)
Meta (publicar, Bandeja, Anuncios, imágenes), motores de pago del Estudio (Google, fal, Higgsfield, MiniMax…), Telegram, Zapier/Make/Stripe.
