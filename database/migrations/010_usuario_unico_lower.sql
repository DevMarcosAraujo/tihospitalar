-- Login sem diferenciar maiúsculas
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_usuario_lower ON usuarios (lower(usuario));
