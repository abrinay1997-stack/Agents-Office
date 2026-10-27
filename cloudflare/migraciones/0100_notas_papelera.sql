-- Las notas del Cerebro que el dueño o su equipo mandan a la papelera (27 oct 2026). Antes la nube no podía borrar ninguna: solo las entregas de los agentes se tiraban en la oficina de la computadora.
-- Se queda 30 días (lib/mantenimiento.js la poda) y vuelve con un clic. Lo que sale de `notas` deja de estar en el grafo, en la búsqueda y en lo que leen los agentes.
create table if not exists notas_papelera (
  id integer primary key autoincrement,
  nombre text not null,
  grupo text not null,
  oficina integer not null default 0,
  texto text not null,
  bytes integer not null default 0,
  actualizado integer not null default 0,
  tarea text,
  borrada integer not null,          -- cuándo (ms)
  por text                           -- quién la mandó a la papelera
);
create index if not exists notas_papelera_borrada on notas_papelera(borrada);
