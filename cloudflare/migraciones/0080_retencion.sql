-- Retención (revisión transversal del 25 oct 2026): `auditoria` se escribe en cada cambio de ajustes, conector, rol, invitación… y nada la leía ni la podaba.
-- El índice deja que la poda diaria (worker/lib/mantenimiento.js) borre lo viejo sin recorrer la tabla entera.
create index if not exists auditoria_at on auditoria(at);
create index if not exists invitaciones_expira on invitaciones(expires_at);
create index if not exists reinicios_expira on reinicios(expires_at);
