-- Fase 5: Contenido, publicación en Meta y Analíticas. Todo `create` lleva `if not exists`.
-- Lo que en la oficina local eran notas .md y archivos de data/contenido/:
--   piezas (una nota por pieza)            → contenido_piezas
--   data/contenido/cola.json               → contenido_cola (una fila por pieza entregada)
--   candado de «una vuelta a la vez»       → contenido_candado
--   la foto diaria de métricas             → contenido_dias, contenido_pubs (las miniaturas, en R2: contenido/miniaturas/)
--   textos guardados y plantillas          → notas del Cerebro (tabla `notas`); su papelera, aquí
-- El resto (cuentas de Meta, el freno por uso, la agenda de Instagram, el simulacro, las mejores horas, lo subido a Metricool, los ajustes) va en `docs`
-- con claves `contenido.*`. Ningún token de Meta ni de Metricool se guarda en ninguna tabla: viven solo en los secretos del Worker.
create table if not exists contenido_piezas (
  id text primary key,                     -- p-AAAAMMDD-xxxx, como en la oficina local
  fecha text not null default '',          -- AAAA-MM-DD ('' = sin día)
  hora text not null default '',
  estado text not null default 'borrador' check (estado in ('idea','borrador','revision','aprobada')),
  json text not null check (json_valid(json)),   -- la pieza (lo que parsear() daba de la nota); `medidas` y `cambiadaTrasAprobar` se calculan al leer
  borrada integer not null default 0,      -- 1 = a la papelera (se conserva 30 días)
  creada text not null,
  actualizada text not null
);
create index if not exists contenido_piezas_fecha on contenido_piezas(fecha, hora);
create index if not exists contenido_piezas_estado on contenido_piezas(estado, borrada);

-- La cola: una fila por pieza entregada al conductor (espera · entregando · en_red · publicada · parcial · fallo · cancelada).
create table if not exists contenido_cola (
  pieza text primary key,
  json text not null check (json_valid(json)),
  actualizado text not null
);

-- «Una vuelta a la vez»: quien tiene el candado (con su caducidad) es el único que entrega, publica o toca la agenda de Meta.
create table if not exists contenido_candado (
  nombre text primary key,
  hasta integer not null,                  -- ms desde 1970: pasada esa hora, otro puede tomarlo
  dueno text not null
);

-- La foto diaria de cada cuenta de Meta (seguidores, alcance…) y sus publicaciones recientes con cifras.
create table if not exists contenido_dias (
  id text primary key,                     -- <cuenta>|AAAA-MM-DD
  mes text not null,                       -- AAAA-MM
  json text not null check (json_valid(json))
);
create index if not exists contenido_dias_mes on contenido_dias(mes);
create table if not exists contenido_pubs (
  id text primary key,                     -- <cuenta>|<id de la publicación en Meta>
  publicada text not null default '',
  json text not null check (json_valid(json))
);
create index if not exists contenido_pubs_fecha on contenido_pubs(publicada);

-- Lo borrado de las plantillas y de los textos guardados (nada se pierde sin querer). Los de la papelera no salen en el Cerebro.
create table if not exists contenido_papelera (
  id integer primary key autoincrement,
  tipo text not null,                      -- 'plantilla'
  nombre text not null,
  texto text not null,
  borrada integer not null
);
