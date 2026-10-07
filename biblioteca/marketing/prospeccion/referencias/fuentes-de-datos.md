# Fuentes de datos para prospectar

Guía para elegir herramientas de prospección en todas las modalidades.

**Nada se da por conectado.** Las herramientas de abajo son opciones neutras: úsalas solo si la empresa las tiene conectadas o si el dueño te pega los datos. Si no hay ninguna, mira «Alternativas gratuitas o solo con navegador» más abajo. Tú no ejecutas programas ni extraes datos: lees lo público con la búsqueda web (si está encendida) y lo que el dueño te comparta. Los datos de las herramientas y los planes (precios, límites, tamaños de base) cambian: lo que dice abajo es orientación del autor original, no una cifra verificada.

---

## Herramienta según el objetivo

| Objetivo | Herramientas principales | Notas |
|----------|--------------------------|-------|
| **Lista inicial por perfil de empresa (B2B / SaaS)** | Apollo, ZoomInfo, Clay | Apollo para amplitud, ZoomInfo para grandes empresas e intención, Clay para flujos a medida |
| **Ubicar a quien decide** | LinkedIn Sales Navigator (a mano), Apollo, ZoomInfo | Sales Navigator es la referencia. Nunca se extrae en masa. |
| **Calificar por tecnología (SaaS)** | BuiltWith, Wappalyzer | BuiltWith tiene más cobertura y planes para volumen; Wappalyzer es más ligero y gratuito para poco uso |
| **Señales de inversión (SaaS)** | Crunchbase, Pitchbook | El plan gratuito de Crunchbase basta para señales tempranas; Pitchbook para datos de inversores más profundos |
| **Descubrir el patrón del correo** | Hunter, Snov, Apollo | Adivinan el patrón, y luego se verifica |
| **Verificar que el correo se entrega** | Truelist, Hunter, NeverBounce, ZeroBounce | Siempre antes de pasar un contacto a una lista de contacto |
| **Identificar visitantes (intención cálida)** | RB2B, Clearbit Reveal | Tráfico anónimo → empresa identificada |
| **Datos de intención** | ZoomInfo Intent, 6sense, Bombora | Señales ya calentadas; precios de mediana empresa en adelante |
| **Vigilar detonantes** | Alertas de Google, un lector de noticias, alertas de Sales Navigator | Las gratuitas bastan casi siempre |
| **Descubrir negocios locales** | Google Maps (a mano), directorios locales, páginas de Facebook e Instagram | Asistido en el navegador, no extraído en masa |

---

## Apollo

**Úsalo para:** datos de perfil de empresa y de contacto, en B2B y SaaS. Buen punto de partida si no hay una lista.

**Fortalezas:**
- Base de datos muy grande de contactos y empresas.
- Buena interfaz de filtros (industria, tamaño, tecnologías, señales).
- Buscador de correo y de LinkedIn integrado.
- Planes de pago por uso y por niveles.

**Ojo con:**
- La frescura de los datos varía: vuelve a verificar antes de puntuar como «caliente».
- La exactitud de los correos suele ser parcial (el autor original habla de un 60 a 80 %): valida siempre.
- Hay límites de exportación en bloque.

---

## Clay

**Úsalo para:** enriquecer con varias fuentes, búsquedas en cascada y puntuación a medida. Cuando importa más la calidad de la lista que su tamaño.

**Fortalezas:**
- Lógica en cascada: probar primero una fuente, si no sale probar otra, y otra.
- Más de cien integraciones con proveedores de datos.
- Enriquecimiento con IA (extracción desde direcciones web).
- Columnas y fórmulas de puntuación a medida.

**Ojo con:**
- El precio por crédito se puede disparar en listas grandes.
- La complejidad: es fácil sobrediseñar los flujos.

---

## ZoomInfo

**Úsalo para:** B2B de grandes empresas y datos de intención. Perfiles de mediana empresa en adelante.

**Fortalezas:**
- Profundidad de datos de empresa de nivel corporativo.
- Señales de intención (empresas que buscan temas relacionados con tu oferta).
- Muy usado en ventas B2B de contratos grandes.

**Ojo con:**
- Es caro, y suele exigir contratos de varios años.
- Es demasiado para prospectar pymes.

---

## Clearbit

**Úsalo para:** pasar de un correo a la empresa, e identificar visitantes anónimos de la web (Reveal).

**Fortalezas:**
- Buen enriquecimiento de empresas (industria, tamaño, inversión, tecnología).
- Búsqueda de correo por dominio.
- Reveal: identifica a nivel de empresa a quienes visitan la web sin identificarse.

**Ojo con:**
- Pasó a formar parte de HubSpot (2023) y hoy se ofrece integrado en sus herramientas de inteligencia; el acceso independiente depende del plan.

---

## Hunter / Snov

**Úsalo para:** descubrir el patrón del correo y una verificación ligera en listas pequeñas.

**Hunter:**
- Descubre correos a partir del dominio.
- Verificación de entrega incluida.
- Plan gratuito razonable para uso ocasional.

**Snov:**
- Buscador de correo + campañas de contacto (se solapa con herramientas de envío).
- Verificación en bloque.
- Más barato que Hunter a volumen.

**Ojo con:**
- Las dos adivinan patrones: la exactitud depende de que el patrón de correo de la empresa se pueda deducir.
- Pasa siempre los resultados por un validador específico antes del contacto.

---

## Validar correos (Truelist y similares)

**Úsalo para:** comprobar que un correo se entrega antes de añadirlo a una lista de contacto. Es un paso de seguridad crítico.

**Qué suele devolver un validador:**
- Un estado: correcto, inválido, arriesgado, desconocido o «acepta todo».
- Un subestado: si es de un correo desechable, de un puesto genérico (info@, ventas@), o falló la comprobación del servidor.
- Sugerencias cuando hay un error de escritura evidente.
- Detecta dominios que aceptan todo, cuentas de puesto, trampas de spam y proveedores desechables.
- Se vende por correo validado.

**Por qué importa:** la reputación de quien envía en frío se desploma cuando los rebotes pasan del 2 %. Validar antes de enviar no es negociable. Los datos de las bases y de los buscadores de correo son a menudo solo parcialmente exactos: el validador atrapa el resto.

**Si no hay validador conectado:** marca esos correos como «sin validar» en la hoja, no los marques «caliente», y dilo en las preguntas abiertas.

---

## LinkedIn Sales Navigator

**Úsalo para:** descubrir a quien decide, a mano. La referencia en B2B y SaaS, pero solo como herramienta de investigación.

**Fortalezas:**
- Los datos de quien decide más precisos del sector.
- Cambios de trabajo, publicaciones y señales en tiempo real.
- Listas de prospectos, alertas y búsquedas guardadas.
- Créditos de mensajes internos (un canal aparte del correo en frío).

**Reglas duras:**
- **Nunca extraer en masa.** LinkedIn bloquea con dureza a los extractores. El riesgo de bloqueo de la cuenta es real y permanente.
- Úsalo como interfaz de investigación: abrir perfiles, leer, tomar notas, anotar los datos clave a mano.
- Apollo y otras herramientas dicen tener datos de LinkedIn por acuerdos o por copias públicas: verifica que la fuente sea legítima antes de dar por hecho que cumplen.

**Integración:** no hay acceso por programa a nivel de consumidor. Solo investigación manual (la hace el dueño o alguien del equipo; tú trabajas con lo que te pasen).

---

## BuiltWith / Wappalyzer

**Úsalo para:** calificar por tecnología (modalidad SaaS).

**BuiltWith:**
- Sigue decenas de miles de tecnologías.
- Búsquedas por programa y en bloque (de pago).
- Datos históricos (cuándo cambió la tecnología).

**Wappalyzer:**
- Extensión gratuita del navegador; acceso por programa de pago.
- Menos cobertura que BuiltWith.
- Más rápido para consultas sueltas.

Cruza las dos para señales de tecnología de alta confianza.

---

## Crunchbase

**Úsalo para:** señales de inversión (modalidad SaaS).

**Fortalezas:**
- El plan gratuito muestra eventos recientes de inversión.
- El de pago desbloquea alertas e historial profundo.
- Acceso por programa para usuarios de pago.

**Ojo con:**
- La cobertura es mejor para empresas con capital de riesgo; las que se financian solas y los negocios pequeños están poco representados.
- Los datos son autodeclarados: verifica los montos por otra vía.

---

## GitHub (quienes marcan, copian o vigilan repositorios)

**Úsalo para:** prospección por intención de desarrolladores. Especialmente potente para SaaS de herramientas para desarrolladores: quienes marcan repositorios de la competencia o de la categoría son una señal de mercado.

**Fortalezas:**
- Datos públicos, sin los problemas de la extracción.
- Señal de alta calidad (marcar un repositorio es interés explícito).
- Copiar el repositorio (fork) es una señal aún más fuerte: intención de modificarlo, no solo guardarlo.

**Ojo con:**
- Solo una parte pequeña de las personas publica su correo: combínalo con Apollo, Clay o Hunter para enriquecer.
- Los repositorios muy populares (cientos de miles de marcas) son sobre todo ruido; los más pequeños y específicos dan mejor densidad de señal.
- La mayoría de los prospectos son individuos, no contactos de una empresa: hay que deducir su empresa del campo `company` o de otra fuente pública.

---

## Leer la web de un prospecto concreto

**Úsalo para:** leer el contenido de la **web propia de un prospecto** que ya encontraste con el descubrimiento en plataformas como Google Maps o directorios. No para extraer esas plataformas.

- Sirve para: comprobar el estado de la web de un negocio local, leer la página «Nosotros» o «Equipo» de una empresa B2B, sacar campos concretos.
- Si la oficina tiene la búsqueda web o el navegador encendidos, léela con ellos; si no, pídele al dueño el texto de la página.

### La línea de cumplimiento crítica

- ✓ **Bien:** leer el contenido de la web propia de un solo negocio (por ejemplo, la cafetería del barrio) que encontraste con un descubrimiento manual.
- ✗ **Mal:** apuntar a Google Maps, a resultados de búsqueda de LinkedIn, a listados de directorios de reseñas o a cualquier plataforma cuyas condiciones prohíban la extracción masiva.

El descubrimiento ocurre en las plataformas (investigación manual asistida). La lectura de detalle ocurre en las webs públicas de cada negocio.

---

## RB2B / Clearbit Reveal

**Úsalo para:** identificar visitantes anónimos del sitio como señales de intención cálida.

**Fortalezas:**
- Identifica de visitante a empresa con un código en la web.
- Intención alta: llegaron a tu sitio, ya están investigando.
- Avisos por mensajería o correo en las visitas clave.

**Ojo con:**
- Privacidad y RGPD: verifica lo que dice tu política de privacidad.
- Identificar a nivel de persona preocupa más que a nivel de empresa.

---

## Alternativas gratuitas o solo con navegador

Cuando la empresa no tiene herramientas de pago, apóyate en:
- **Búsqueda en Google:** nombre exacto del negocio + ciudad + puesto.
- **LinkedIn** (a mano, sin extraer): páginas de empresa, búsqueda de personas.
- **Plan gratuito de Crunchbase:** eventos de inversión.
- **Extensión de Wappalyzer:** la tecnología de un vistazo.
- **Plan gratuito de Hunter:** pocas consultas al mes.
- **Google Maps:** para descubrir negocios locales.
- **Webs de los negocios y sus páginas «Nosotros»:** la fuente primaria de cualquier dato.
- **Sitios de noticias y comunicados de prensa:** vigilar detonantes con alertas de Google.
- **Directorios y cámaras de comercio del país o la ciudad**, registros mercantiles públicos y las páginas amarillas locales (útiles sobre todo en negocios locales y B2B no tecnológico).

Más lento que con herramientas, pero da listas pequeñas de buena calidad si hay voluntad de hacer el trabajo.

---

## Secuencia recomendada

Un flujo completo típico de prospección:

1. **Define el cliente ideal** a partir de `00-Empresa/marketing` (sin herramientas).
2. **Lista inicial** con Apollo o ZoomInfo (filtro de perfil de empresa), si la empresa los tiene.
3. **Enriquece** con Clay (en cascada: tecnología, inversión, detonantes).
4. **Ubica a quien decide** en LinkedIn Sales Navigator (a mano, por el equipo).
5. **Descubre el patrón del correo** con Hunter o el buscador de Apollo.
6. **Valida los correos** con un validador antes de la lista final.
7. **Pasa a `correo-en-frio`** para el texto de contacto (borradores, con el OK del dueño).

Adapta la secuencia a las herramientas que la empresa tenga de verdad.
