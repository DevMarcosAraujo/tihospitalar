-- Primeiro acesso: o usuário é obrigado a trocar a senha definida pelo administrador.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS trocar_senha BOOLEAN NOT NULL DEFAULT FALSE;

-- Parâmetros do sistema (ex.: mapeamento liberado para técnicos)
CREATE TABLE IF NOT EXISTS parametros (
  chave VARCHAR(60) PRIMARY KEY,
  valor VARCHAR(200) NOT NULL
);
