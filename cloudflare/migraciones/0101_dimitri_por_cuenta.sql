-- Dimitri deja de tener UNA conversación común (27 oct 2026): cada cuenta tiene la suya (lib/dimitri/chat.js → sala). Lo que había hasta hoy era el chat de «la oficina»; se lo queda la
-- cuenta del dueño, que es la de administrador más antigua. Si todavía no hay ninguna cuenta de administrador (una instalación nueva), no hay nada que mover.
--   mensajes ........ filas('subgerente')            → filas('subgerente:<dueño>')
--   resumen ......... filas('subgerente-hilo','actual') → id 'actual:<dueño>'
--   historial ....... docs('subgerente.archivo')      → docs('subgerente.archivo:<dueño>')
--   archivadas ...... filas('subgerente-arch:<id>')   → filas('subgerente-arch:<dueño>:<id>') y su resumen, id 'arch:<dueño>:<id>' (cada cuenta, lo suyo: un id ajeno en tu lista no abre la conversación de otro)
update filas set coleccion = 'subgerente:' || (select id from users where rol = 'admin' order by created_at asc, rowid asc limit 1)
 where coleccion = 'subgerente' and exists (select 1 from users where rol = 'admin');
update filas set id = 'actual:' || (select id from users where rol = 'admin' order by created_at asc, rowid asc limit 1)
 where coleccion = 'subgerente-hilo' and id = 'actual' and exists (select 1 from users where rol = 'admin');
update docs set clave = 'subgerente.archivo:' || -- secrets-ok: `clave` es la columna de la tabla, no una contraseña
    (select id from users where rol = 'admin' order by created_at asc, rowid asc limit 1)
 where clave = 'subgerente.archivo' /* secrets-ok */ and exists (select 1 from users where rol = 'admin');
update filas set coleccion = 'subgerente-arch:' || (select id from users where rol = 'admin' order by created_at asc, rowid asc limit 1) || ':' || substr(coleccion, 17)
 where coleccion like 'subgerente-arch:%' and instr(substr(coleccion, 17), ':') = 0 and exists (select 1 from users where rol = 'admin');
update filas set id = 'arch:' || (select id from users where rol = 'admin' order by created_at asc, rowid asc limit 1) || ':' || id
 where coleccion = 'subgerente-hilo' and id not like 'actual:%' and id not like 'arch:%' and exists (select 1 from users where rol = 'admin');
