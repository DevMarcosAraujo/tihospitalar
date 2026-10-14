-- Beira leito: computador do leito (PS, UTI e Centro Cirúrgico). Número do leito = posição; hostname + TeamViewer.
INSERT INTO categorias_equipamento (nome, usa_hostname, usa_ip) VALUES ('Beira leito', TRUE, FALSE)
  ON CONFLICT (nome) DO NOTHING;
INSERT INTO tipos_equipamento (categoria_id, nome, usa_ip)
  SELECT id, 'Beira leito', FALSE FROM categorias_equipamento WHERE nome = 'Beira leito'
  ON CONFLICT (categoria_id, nome) DO NOTHING;
