-- «Buscar por significado» (issue #45, idea 2; 27 oct 2026): un vector por PASAJE de nota, para sumar el significado a la búsqueda por palabras (BM25) de los agentes y de «Actualizar conexiones».
--   hash ...... el hash del texto del pasaje (knowledge.passages): el mismo texto comparte vector y un pasaje editado trae el suyo nuevo; los que ya no existen se borran al indexar
--   modelo .... qué modelo lo hizo (otro modelo = otros vectores: no se mezclan)
--   v ......... el vector cuantizado a enteros de 8 bits en base64 (~1,4 KB por pasaje de 1.024 números), con `escala` para volver a los números originales
-- Acotada: solo los pasajes de las notas escritas de ahora (≤ 4.000, ver lib/significado.js → MAX_PASAJES). No guarda texto de nadie: son números.
create table if not exists notas_vectores (
  hash text not null,
  modelo text not null,
  nota text not null,
  dim integer not null,
  escala real not null,
  v text not null,
  creado integer not null,
  primary key (hash, modelo)
);
create index if not exists notas_vectores_modelo on notas_vectores (modelo);
