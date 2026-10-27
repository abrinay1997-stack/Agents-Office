-- Dimitri deja de tener UNA conversación común (27 oct 2026): cada cuenta tiene la suya (lib/dimitri/chat.js → sala). Lo que había hasta hoy era el chat de «la oficina»; se lo queda la
-- cuenta del dueño, que es la de administrador más antigua. Si todavía no hay ninguna cuenta de administrador (una instalación nueva), no hay nada que mover.
--   mensajes ........ filas('subgerente')            → filas('subgerente:<dueño>')
--   resumen ......... filas('subgerente-hilo','actual') → id 'actual:<dueño>'
--   historial ....... docs('subgerente.archivo')      → docs('subgerente.archivo:<dueño>')   (las conversaciones archivadas en sí no cambian: su id ya es único)
update filas set coleccion = 'subgerente:' || (select id from users where rol = 'admin' order by created_at asc, rowid asc limit 1)
 where coleccion = 'subgerente' and exists (select 1 from users where rol = 'admin');
update filas set id = 'actual:' || (select id from users where rol = 'admin' order by created_at asc, rowid asc limit 1)
 where coleccion = 'subgerente-hilo' and id = 'actual' and exists (select 1 from users where rol = 'admin');
update docs set clave = 'subgerente.archivo:' || -- secrets-ok: `clave` es la columna de la tabla, no una contraseña
    (select id from users where rol = 'admin' order by created_at asc, rowid asc limit 1)
 where clave = 'subgerente.archivo' /* secrets-ok */ and exists (select 1 from users where rol = 'admin');
