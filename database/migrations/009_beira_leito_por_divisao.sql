-- Beira leito pertence à DIVISÃO (UTI, Centro Cirúrgico, PS/CDM), não a um setor.
ALTER TABLE equipamentos ALTER COLUMN setor_id DROP NOT NULL;
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS divisao VARCHAR(80);
ALTER TABLE equipamentos DROP CONSTRAINT IF EXISTS equip_setor_ou_divisao;
ALTER TABLE equipamentos ADD CONSTRAINT equip_setor_ou_divisao CHECK (setor_id IS NOT NULL OR divisao IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_equip_divisao ON equipamentos(divisao);
