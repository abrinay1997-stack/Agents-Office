# Prospección B2B

Para cuando la empresa le vende a empresas que no son SaaS: servicios, agencias, fabricantes, distribuidores, empresas medianas y grandes, firmas de servicios profesionales, constructoras.

---

## Señales del cliente ideal que importan (B2B)

### Señales de perfil

- **Industria / sector**: códigos de clasificación (NAICS, SIC o la CIIU que usan muchos países de Latinoamérica) si la precisión importa.
- **Tamaño**: rango de empleados, de facturación, número de sedes.
- **Zona**: importa por husos horarios, regulación y trabajo presencial.
- **Modelo de negocio**: servicio, producto o distribución; B2B o B2B2C.
- **Propiedad**: independiente, de un fondo de inversión, que cotiza en bolsa, familiar; cambia la forma de comprar.

### Señales de compra

- **Eventos detonantes**: nuevo gerente o director, compra o venta reciente de otra empresa, salida a bolsa o inversión, apertura de una sede, cambio de marca, anuncio de expansión.
- **Señales de proveedor**: licitaciones públicas, cambios de proveedor mencionados en informes, ventanas de renovación de contratos.
- **Señales operativas**: despidos recientes (presión de costos) o contrataciones rápidas (presión de capacidad).
- **Menciones en noticias**: iniciativa nueva, entrada a un mercado nuevo, un cambio de regulación que obliga a actuar.
- **Prensa**: cualquier cosa que indique «esta empresa está cambiando ahora».

### Señales de deterioro

- Varias quiebras u operaciones desmanteladas por un fondo.
- Crecimiento negativo + titulares de recortes.
- Propiedad estancada (pequeña empresa familiar sin incentivo para crecer).
- Rotación del comprador (3 o más directores de marketing en 2 años).

---

## Fuentes de búsqueda (B2B)

Nada se da por conectado: «si la empresa tiene conectado X».

### Nivel 1: búsqueda principal

- **Apollo**: el mejor punto de partida general para perfil y contactos B2B.
- **ZoomInfo**: B2B corporativo + señales de intención (medianas en adelante).
- **LinkedIn Sales Navigator**: búsqueda por industria, puesto y señal; la referencia para ubicar a quien decide (a mano).
- **Clay**: cuando hacen falta búsquedas en cascada a medida (por ejemplo, enriquecer registros de Apollo con Hunter y Clearbit).

### Nivel 2: directorios del sector

- **Crunchbase / Pitchbook**: empresas con inversión.
- **D&B Hoovers**: perfil de grandes empresas tradicionales.
- **Registros mercantiles** del país o del estado (cámaras de comercio, registro público): datos de constitución verificados.
- **Listas de socios de gremios y asociaciones**: los gremios suelen publicar a sus miembros.
- **Listas de expositores de ferias**: indican participación activa en un sector.
- **Bases de compras y licitaciones** (portales de compras públicas, plataformas del sector como Procore en construcción): señales de cada sector.

### Nivel 3: seguimiento de eventos detonantes

- **Alertas de Google / Feedly**: palabras detonantes («adquiere», «contrata», «expansión», «recauda», «anuncia», «inaugura»).
- **Agencias de comunicados** (PR Newswire, Business Wire o las locales): anuncios controlados por la empresa.
- **Informes regulatorios** (empresas que cotizan): divulgación de cambios importantes.
- **Registros oficiales**: constitución y disolución de sociedades.

Este seguimiento se presta para una **rutina** semanal de la oficina (un agente de Ventas revisa alertas y noticias y reporta los detonantes nuevos; solo lee, no espera el OK).

---

## Lista de calificación (B2B)

- [ ] La industria / sector coincide con el cliente ideal (con una clasificación reconocida si se puede).
- [ ] El tamaño está en rango (empleados o facturación).
- [ ] La zona encaja.
- [ ] Al menos un evento detonante en los últimos 90–180 días.
- [ ] Existe el puesto de quien decide (gerente general, director de operaciones, director de X: según el perfil del comprador).
- [ ] El correo de contacto es verificable (un puesto con nombre > un info@ genérico).
- [ ] Fuentes guardadas para cada dato de perfil.
- [ ] Sin descalificadores (cerrada, comprada y en pausa, varias quiebras, fuera del perfil).

---

## Columnas de salida (B2B)

CSV recomendado:

```csv
puntaje,empresa,dominio,industria,codigo_sector,tamano,rango_facturacion,pais,ciudad,detonante,fecha_detonante,contacto_nombre,contacto_cargo,contacto_correo,estado_correo,linkedin,fuentes,por_que,confianza,fecha_verificacion,notas
```

En tabla, resume a: Puntaje | Empresa | Industria | Tamaño | Detonante | Contacto | Estado del correo | Confianza.

---

## Cómo elegir a los mejores para contactar primero (B2B)

Prioriza para los 3–5 más calientes:
1. **Lo reciente del detonante**: 30 días le gana a 6 meses.
2. **Lo concreto del detonante**: un nuevo director de marketing en el puesto de tu comprador le gana a «la empresa salió en las noticias».
3. **Acceso a quien decide**: contacto con nombre, correo verificado y LinkedIn le gana a solo el puesto.
4. **Precisión del sector**: coincidencia exacta de código le gana a «industria vecina».

Cada uno nombra el detonante y a quien decide: «Contrató nuevo VP de Marketing hace 14 días; correo verificado; fabricante mediano que encaja con el cliente ideal».

---

## Errores comunes (B2B)

1. **Tratar B2B como SaaS**: las rondas de inversión pesan menos; la propiedad por fondos y las compras de empresas pesan más.
2. **Intentar verificar con precisión la facturación de una empresa privada**: casi todas las bases públicas aproximan. Usa rangos, no cifras puntuales.
3. **Ignorar la complejidad de compras** en grandes empresas: tu lista quizá no incluye a quien aprueba de verdad.
4. **Escribir en frío a asistentes de dirección**: no son el comprador y marcarán tu mensaje como spam.
5. **Descuidar las fuentes**: sin el origen de cada dato no puedes defender un contacto ante una solicitud de acceso a datos (RGPD o la ley de tu país) ni ante un reclamo por CAN-SPAM.
6. **Quedarse en una sola fuente**: Apollo puede acertar solo un 60 % en empresas pequeñas. Cruza con LinkedIn o la web de la empresa.
