ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS teamviewer_senha VARCHAR(60);   -- senha de acesso remoto (uso interno)

-- Impressoras: 4 modelos (Multifuncional usa IP; Zebra, Pulseira e Térmica ligam-se a um PC e não têm IP)
INSERT INTO tipos_equipamento (categoria_id, nome, usa_ip)
  SELECT id, 'Zebra', FALSE FROM categorias_equipamento WHERE nome = 'Impressoras'
  ON CONFLICT (categoria_id, nome) DO NOTHING;
UPDATE tipos_equipamento SET usa_ip = TRUE
  WHERE nome = 'Multifuncional' AND categoria_id = (SELECT id FROM categorias_equipamento WHERE nome = 'Impressoras');
UPDATE tipos_equipamento SET usa_ip = FALSE
  WHERE nome IN ('Zebra', 'Pulseira', 'Térmica') AND categoria_id = (SELECT id FROM categorias_equipamento WHERE nome = 'Impressoras');
UPDATE tipos_equipamento SET ativo = FALSE
  WHERE nome IN ('Código de barras', 'Etiquetas', 'Laser') AND categoria_id = (SELECT id FROM categorias_equipamento WHERE nome = 'Impressoras');
