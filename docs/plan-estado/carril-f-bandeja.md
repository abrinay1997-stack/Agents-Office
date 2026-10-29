# Carril F · CON-11 paso 3 (`bandeja_items`)

Rama `mejora/ola3-f-bandeja-tabla`. **Migración 0120** (`bandeja_items`). **Flag `nube.bandejaTabla`** (config-local, APAGADO por defecto: con él apagado nada lee ni escribe la tabla). Página: +0 B (no se tocó `src/`).

- ✅ `cloudflare/worker/lib/bandeja-tabla.js`: almacén `{leer, escribir}` cargado de D1 (UNA lectura: filas + documento `bandeja.estado`), vive en memoria y `flush()` vuelca solo las filas que cambiaron (un GET no escribe). Versión por fila con `fusionarJson` en conflicto. **`enviando` es compare-and-set** (`enviando_at is null`): si otra petición ya lo puso, `flush()` lanza ANTES de llamar a Meta. Recorte a 800 del módulo = `delete` de la fila.
- ✅ Backfill: la primera vez (tabla y documento vacíos) importa `fs:data/contenido/bandeja.json` (`insert or ignore`; repetirlo no duplica). El archivo viejo se CONSERVA (camino de vuelta).
- ✅ `anuncios-nube.js`: `conBandeja` y `conAnuncios` usan la tabla con el flag y quitan `bandeja.json` de su espejo (`sinArchivoBandeja`; `bandeja-meta.json` y `cuentas.json` se quedan: son estado de la fuente de Meta, no ítems). Anuncios consulta la Bandeja por el MISMO almacén.
- ✅ Estados que no son ítems (`ultimo`, `error`, `alias`, `fuentes`, `aviso`, `avisoMensajes`) en el documento `bandeja.estado`; `abiertaAt` y los tokens de DESHACER siguen donde estaban (docs/tabla de tokens).
- ✅ TABLAS en `auditoria-transversal.test.mjs`: `bandeja_items` acotada (800 más recientes, MAX del módulo; no necesita reloj de poda).
- ✅ Pruebas: `cloudflare/tests/bandeja-tabla.test.mjs` (paridad: las 8 de `bandeja.test.mjs` con `AO_BANDEJA_TABLA=1`; importar sin duplicar; GET sin escrituras; CAS de `enviando`; unión de dos peticiones; borrado; vuelta atrás). `bandeja.test.mjs` entiende `AO_BANDEJA_TABLA`.
- Lecturas D1 de un GET en caliente: 5 con tabla (migración, inicio, espejo, filas+estado) frente a 3 sin ella; la ganancia es no traer, parsear ni comparar el archivo de hasta 1,9 MB y no reescribir nada.
- **Cómo se deshace:** apagar el flag; antes, `tablaAArchivo(db)` (lib/bandeja-tabla.js) deja el archivo al día con lo que llegó con la tabla (no hay ruta HTTP: se llama desde un script o un test); luego `drop table if exists bandeja_items; delete from docs where clave = 'bandeja.estado';`. (secrets-ok: la clave de un documento)
- **CONSERVA:** el archivo `fs:data/contenido/bandeja.json`, el documento de migración `anuncios.migracion.*` (si se vuelve a migrar con el flag encendido, el archivo importado NO se lee: manda la tabla) y los avisos.
- **No hecho (siguiente):** paginación `?cursor=` y borradores por `PATCH` por ítem (los GET siguen cargando los ≤ 800 ítems); render por lotes de 50 en el front; encender el flag en producción (decisión del dueño, tras ver la prueba en un despliegue).
- No verificado: D1 real (solo SQLite de Node), concurrencia real entre dos Workers.
