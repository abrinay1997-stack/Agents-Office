# Prospección SaaS

Para cuando la empresa vende software o servicios digitales a otras empresas de software o negocios digitales.

---

## Señales del cliente ideal que importan (SaaS)

Además del perfil de siempre (industria, tamaño, zona), un prospecto SaaS se califica por:

### Señales tecnológicas

- **Su tecnología**: ¿usa herramientas complementarias (con las que te integras) o de la competencia (oportunidad de cambio)?
- **Cambios recientes de herramientas**: sumar o quitar herramientas indica que está evaluando proveedores.
- **Hecho en casa o comprado**: las herramientas caseras suelen indicar un comprador que se beneficiaría de tu producto.
- **Plan gratis de un competidor**: puede estar listo para pasar a pago.

### Señales de crecimiento

- **Ronda de inversión**: Serie A / B / C en los últimos 6 meses = presupuesto + contrataciones + necesidad de herramientas.
- **Crecimiento de plantilla**: 10 % o más en el último trimestre indica presión por escalar.
- **Contrataciones concretas**: vacantes de un puesto (por ejemplo, «Jefe de RevOps» → cliente ideal para herramientas de revops).
- **Ritmo de producto**: lanza seguido, funciones nuevas, artículos = crecimiento sano.
- **Vacantes del puesto de tu comprador**: si vendes a operaciones de marketing y están contratando a alguien para eso, es señal.

### Señales de deterioro (bajan el puntaje)

- Despidos en el departamento objetivo.
- Ronda de inversión de hace más de 2 años sin seguimiento.
- No lanza nada desde hace 6 meses o más.
- La página del equipo solo muestra a los fundadores (muy temprano; quizá sin presupuesto).

---

## Fuentes de búsqueda (SaaS)

Combina 2 o más para cruzar datos. Nada se da por conectado: «si la empresa tiene conectado X».

### Nivel 1: búsqueda principal

- **Apollo**: perfil, tecnología y contactos. Bueno para armar listas iniciales grandes.
- **Clay**: enriquecimiento en cascada, puntuación a medida, unir varias fuentes. Lo mejor para listas pequeñas de alta calidad.
- **ZoomInfo**: perfil de nivel corporativo + señales de intención. Caro; para empresas medianas en adelante.
- **LinkedIn Sales Navigator**: ubicar a quien decide. A mano, nunca extracción masiva.

### Nivel 2: señales de tecnología y crecimiento

- **BuiltWith**: consulta qué tecnología usa un sitio; encuentra sitios que usan cierta herramienta.
- **Wappalyzer**: extensión gratuita + API; señal de tecnología más liviana.
- **Crunchbase**: rondas, plantilla, fundadores.
- **Pitchbook**: datos de inversionistas más profundos (de pago, corporativo).
- **Product Hunt**: lanzamientos recientes, público de creadores.
- **Hacker News / Show HN**: creadores técnicos lanzando productos.

### Nivel 3: señales de compra

- **Bolsas de empleo** (LinkedIn Empleos, Indeed, Computrabajo, bolsas locales): las vacantes como señal.
- **Identificación de visitantes** (RB2B, Clearbit Reveal): tráfico anónimo tibio de la web propia.
- **Estrellas y copias (forks) de repositorios de la competencia o vecinos en GitHub**: intención a nivel desarrollador. Muy fuerte para SaaS de herramientas para desarrolladores: quien marcó con estrella `vercel/next.js` la semana pasada está en el mercado de infraestructura vecina de Next.js.
- **Artículos y registros de cambios recientes**: señales de hacia dónde va su producto.
- **Reseñas en G2 o Capterra que mencionan cambiar de competidor**: insatisfacción explícita.

#### Patrón de prospección en GitHub (cuando el público son desarrolladores)

Para SaaS de herramientas para desarrolladores, GitHub es de los canales de mejor calidad:
1. Identifica 3–5 repositorios «ancla»: tus competidores directos, el líder de la categoría, herramientas complementarias que usa tu comprador.
2. Obtén quiénes les dieron estrella (o los forks, que indican más intención). El agente no corre comandos: si la empresa tiene conectado GitHub, consulta por ahí; si no, revisa las páginas públicas del repositorio o pídele al dueño la exportación.
3. Filtra a los usuarios que tienen la empresa puesta en su perfil: son los más fáciles de enriquecer.
4. Combínalo con Apollo / Clay / Hunter (si están conectados) para buscar el correo por nombre + empresa.
5. Valida el correo antes de pasarlo a la lista de contacto.

Lo que se gana y se pierde: GitHub da el correo directo de solo un ~5–20 % de usuarios. Su fuerza es la calidad de la señal: quien marca una herramienta de nicho está de verdad en el mercado, algo que el perfil de Apollo solo no te dice.

---

## Lista de calificación (SaaS)

Para cada candidato, verifica:
- [ ] La industria coincide con el cliente ideal.
- [ ] El tamaño (plantilla) está en rango.
- [ ] Su tecnología incluye (o claramente no incluye) una tecnología objetivo.
- [ ] La etapa de inversión encaja con la madurez del comprador.
- [ ] Al menos una señal de crecimiento en los últimos 90 días (inversión, contrataciones, ritmo de producto).
- [ ] El puesto de quien decide existe en la empresa (con nombre, o deducible de sus vacantes).
- [ ] El correo de contacto es verificable.
- [ ] Sin descalificadores (cerrada, comprada y en pausa, despidos, fuera del perfil).

---

## Columnas de salida (SaaS)

CSV recomendado:

```csv
puntaje,empresa,dominio,industria,tamano,pais,etapa_inversion,fecha_ultima_ronda,coincidencia_tecnologia,senal,fecha_senal,contacto_nombre,contacto_cargo,contacto_correo,estado_correo,linkedin,fuentes,por_que,confianza,fecha_verificacion,notas
```

En tabla, resume a: Puntaje | Empresa | Industria | Tamaño | Señal | Contacto | Estado del correo | Confianza.

---

## Cómo elegir a los mejores para contactar primero (SaaS)

Prioriza para los 3–5 más calientes:
1. **Lo reciente de la señal**: una ronda de hace 30 días le gana a una de hace 9 meses.
2. **Fuerza de la coincidencia tecnológica**: un socio de integración conocido le gana a un encaje deducido.
3. **Quien decide con nombre y correo verificado**: le gana a un correo adivinado por el patrón del puesto.
4. **Confianza de varias fuentes**: que Apollo y Crunchbase coincidan le gana a una sola fuente.

Cada uno lleva una frase que nombra la señal concreta: «Cerró su Serie B hace 30 días; contrata Jefe de RevOps; correo del VP de Operaciones verificado».

---

## Errores comunes (SaaS)

1. **Comprar listas de Apollo al por mayor** sin volver a verificar correos y perfil. Lo normal es que los datos estén viejos.
2. **Tomar los datos de tecnología como 100 % exactos.** BuiltWith y Wappalyzer se pierden cosas; las cascadas de Clay también. Cruza.
3. **Apuntar a empresas de Serie C en adelante cuando vendes algo de etapa temprana.** El perfil de comprador no encaja: demasiados trámites de compras.
4. **Apuntar a empresas en presemilla o semilla** con productos que piden un presupuesto importante. No tienen ni presupuesto ni tiempo para evaluar.
5. **Ignorar los datos de intención cuando existen** (ZoomInfo Intent, 6sense…): una señal previa le gana al frío siempre.
