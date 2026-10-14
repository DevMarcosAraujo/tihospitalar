-- Categorias e tipos (regras de hostname/IP da especificação)
-- IP: Computadores, Impressoras, Rede (categoria) + Telefone IP, TV e Projetor (tipo)
INSERT INTO categorias_equipamento (nome, usa_hostname, usa_ip) VALUES
  ('Computadores', TRUE,  TRUE),
  ('Impressoras',  FALSE, TRUE),
  ('Audiovisual',  FALSE, FALSE),
  ('Telefonia',    FALSE, FALSE),
  ('Rede',         FALSE, TRUE),
  ('Leitura',      FALSE, FALSE),
  ('Energia',      FALSE, FALSE),
  ('Outros',       FALSE, FALSE);

INSERT INTO tipos_equipamento (categoria_id, nome, usa_ip)
SELECT c.id, v.tipo, v.usa_ip
FROM (VALUES
  ('Computadores','Desktop',NULL),('Computadores','Notebook',NULL),('Computadores','All-in-One',NULL),
  ('Computadores','Mini PC',NULL),('Computadores','Thin Client',NULL),
  ('Impressoras','Laser',NULL),('Impressoras','Térmica',NULL),('Impressoras','Etiquetas',NULL),
  ('Impressoras','Pulseira',NULL),('Impressoras','Multifuncional',NULL),('Impressoras','Código de barras',NULL),
  ('Audiovisual','TV',TRUE),('Audiovisual','Monitor',NULL),('Audiovisual','Projetor',TRUE),
  ('Telefonia','Telefone IP',TRUE),('Telefonia','Telefone analógico',NULL),('Telefonia','Celular corporativo',NULL),
  ('Rede','Switch',NULL),('Rede','Roteador',NULL),('Rede','Firewall',NULL),('Rede','Access Point',NULL),
  ('Rede','Controladora',NULL),('Rede','ONU/ONT',NULL),('Rede','Conversor de mídia',NULL),
  ('Rede','Rack',NULL),('Rede','Patch Panel',NULL),
  ('Leitura','Scanner',NULL),('Leitura','Leitor de código de barras',NULL),('Leitura','Leitor de QR Code',NULL),
  ('Leitura','Leitor de pulseira',NULL),('Leitura','Leitor biométrico',NULL),
  ('Energia','Nobreak',NULL),('Energia','PDU',NULL),('Energia','Estabilizador',NULL),
  ('Outros','Outros equipamentos de TI',NULL)
) AS v(cat, tipo, usa_ip)
JOIN categorias_equipamento c ON c.nome = v.cat;

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

-- Beira leito: computador do leito (PS, UTI e Centro Cirúrgico). Número do leito = posição; hostname + TeamViewer.
INSERT INTO categorias_equipamento (nome, usa_hostname, usa_ip) VALUES ('Beira leito', TRUE, FALSE)
  ON CONFLICT (nome) DO NOTHING;
INSERT INTO tipos_equipamento (categoria_id, nome, usa_ip)
  SELECT id, 'Beira leito', FALSE FROM categorias_equipamento WHERE nome = 'Beira leito'
  ON CONFLICT (categoria_id, nome) DO NOTHING;
