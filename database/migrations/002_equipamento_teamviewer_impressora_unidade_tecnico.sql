-- Técnico fixo em uma unidade; equipamento com TeamViewer e impressora ligada ao computador;
-- patrimônio deixa de ser obrigatório (o hostname identifica o computador).
ALTER TABLE usuarios     ADD COLUMN IF NOT EXISTS unidade_id INT REFERENCES unidades(id);
ALTER TABLE equipamentos ALTER COLUMN patrimonio DROP NOT NULL;
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS teamviewer  VARCHAR(40);
-- Em uma impressora: id do computador ao qual ela está ligada
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS ligado_a_id INT REFERENCES equipamentos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_equip_ligado ON equipamentos(ligado_a_id);
