-- ============================================================================
-- Sistema de Gestão de Infraestrutura de TI Hospitalar — migração para o Supabase
-- Gerado em 2026-10-14.
--
-- Como usar:
--   1. Supabase → SQL Editor → New query → cole este arquivo inteiro → Run.
--   2. Rode UMA vez (em banco vazio). Para recomeçar: DROP SCHEMA public CASCADE; CREATE SCHEMA public;
--   3. Em Project Settings → Database, copie a connection string (Session pooler) e coloque em
--      backend/.env como DATABASE_URL (com ?sslmode=require).
--
-- O backend Node continua sendo o único acesso aos dados: o RLS abaixo bloqueia a API pública
-- (anon/authenticated) do Supabase em todas as tabelas.
-- ============================================================================


-- 1) TABELAS
-- Sistema de Gestão de Infraestrutura de TI Hospitalar — V1
-- PostgreSQL. Nunca excluir unidades/setores/equipamentos/usuários: apenas inativar.

CREATE TABLE usuarios (
  id            SERIAL PRIMARY KEY,
  nome          VARCHAR(120) NOT NULL,
  usuario       VARCHAR(50)  NOT NULL UNIQUE,
  senha_hash    VARCHAR(100) NOT NULL,            -- bcrypt
  email         VARCHAR(120),
  telefone      VARCHAR(30),
  perfil        VARCHAR(15)  NOT NULL CHECK (perfil IN ('ADMINISTRADOR','TECNICO')),
  ativo         BOOLEAN      NOT NULL DEFAULT TRUE,
  criado_em     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE unidades (
  id          SERIAL PRIMARY KEY,
  nome        VARCHAR(120) NOT NULL,
  codigo      VARCHAR(20)  NOT NULL UNIQUE,
  endereco    VARCHAR(200),
  telefone    VARCHAR(30),
  observacoes TEXT,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE
);

-- Técnico fica fixo em uma unidade (quem troca é o administrador, editando o usuário)
ALTER TABLE usuarios ADD COLUMN unidade_id INT REFERENCES unidades(id);

CREATE TABLE setores (
  id          SERIAL PRIMARY KEY,
  unidade_id  INT NOT NULL REFERENCES unidades(id),
  nome        VARCHAR(120) NOT NULL,
  codigo      VARCHAR(20)  NOT NULL,
  andar       VARCHAR(30),
  localizacao VARCHAR(120),
  responsavel VARCHAR(120),
  ramal       VARCHAR(20),
  observacoes TEXT,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (unidade_id, codigo)
);

CREATE TABLE categorias_equipamento (
  id    SERIAL PRIMARY KEY,
  nome  VARCHAR(60) NOT NULL UNIQUE,
  -- regras de campos condicionais
  usa_hostname BOOLEAN NOT NULL DEFAULT FALSE,
  usa_ip       BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE tipos_equipamento (
  id           SERIAL PRIMARY KEY,
  categoria_id INT NOT NULL REFERENCES categorias_equipamento(id),
  nome         VARCHAR(60) NOT NULL,
  ativo        BOOLEAN NOT NULL DEFAULT TRUE,
  usa_ip       BOOLEAN,                           -- NULL = herda da categoria (ex.: só TV/Projetor, Telefone IP)
  UNIQUE (categoria_id, nome)
);

CREATE TABLE equipamentos (
  id            SERIAL PRIMARY KEY,
  patrimonio    VARCHAR(40) UNIQUE,                -- opcional; o hostname identifica o computador
  tipo_id       INT NOT NULL REFERENCES tipos_equipamento(id),
  fabricante    VARCHAR(80),
  modelo        VARCHAR(80),
  numero_serie  VARCHAR(80),
  hostname      VARCHAR(80),
  ip            VARCHAR(45),
  teamviewer    VARCHAR(40),                       -- ID de acesso remoto (computadores)
  ligado_a_id   INT REFERENCES equipamentos(id) ON DELETE SET NULL,  -- impressora → computador
  unidade_id    INT NOT NULL REFERENCES unidades(id),
  setor_id      INT NOT NULL REFERENCES setores(id),
  sala          VARCHAR(80),
  status        VARCHAR(20) NOT NULL DEFAULT 'ATIVO'
                CHECK (status IN ('ATIVO','INATIVO','EM_MANUTENCAO','FORA_DE_USO')),
  observacoes   TEXT
);
CREATE INDEX idx_equip_setor ON equipamentos(setor_id);
CREATE INDEX idx_equip_unidade ON equipamentos(unidade_id);
CREATE INDEX idx_equip_ligado ON equipamentos(ligado_a_id);

CREATE TABLE tarefas (
  id           SERIAL PRIMARY KEY,
  titulo       VARCHAR(160) NOT NULL,
  descricao    TEXT,
  unidade_id   INT NOT NULL REFERENCES unidades(id),
  setor_id     INT NOT NULL REFERENCES setores(id),
  tecnico_id   INT NOT NULL REFERENCES usuarios(id),
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
  prazo        DATE NOT NULL,
  prioridade   VARCHAR(10) NOT NULL CHECK (prioridade IN ('BAIXA','NORMAL','ALTA','URGENTE'))
  -- status NÃO é coluna: calculado a partir das atividades e do prazo
);

CREATE TABLE atividades (
  id             SERIAL PRIMARY KEY,
  tarefa_id      INT NOT NULL REFERENCES tarefas(id) ON DELETE CASCADE,
  descricao      VARCHAR(200) NOT NULL,
  ordem          INT NOT NULL DEFAULT 0,
  concluida      BOOLEAN NOT NULL DEFAULT FALSE,
  resultado      VARCHAR(25) CHECK (resultado IN ('OK','PROBLEMA_ENCONTRADO','NAO_APLICAVEL')),
  observacao     TEXT,
  problema       TEXT,
  executado_por  INT REFERENCES usuarios(id),
  executado_em   TIMESTAMPTZ,
  CHECK (resultado IS DISTINCT FROM 'PROBLEMA_ENCONTRADO' OR problema IS NOT NULL),
  CHECK (concluida = (resultado IS NOT NULL))
);

CREATE TABLE historico_tarefa (
  id          SERIAL PRIMARY KEY,
  tarefa_id   INT NOT NULL REFERENCES tarefas(id) ON DELETE CASCADE,
  usuario_id  INT NOT NULL REFERENCES usuarios(id),
  evento      VARCHAR(30) NOT NULL,   -- CRIACAO, EDICAO, TROCA_TECNICO, ALTERACAO_PRAZO, MUDANCA_STATUS, ATIVIDADE_EXECUTADA
  detalhe     JSONB,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migração 003: troca de senha no primeiro acesso + parâmetros do sistema
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS trocar_senha BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS parametros (
  chave VARCHAR(60) PRIMARY KEY,
  valor VARCHAR(200) NOT NULL
);

-- Anti-duplicidade: o hostname identifica o computador (sem diferenciar maiúsculas)
CREATE UNIQUE INDEX IF NOT EXISTS uq_equip_hostname ON equipamentos (upper(trim(hostname))) WHERE hostname IS NOT NULL;

ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS teamviewer_senha VARCHAR(60);   -- senha de acesso remoto (uso interno)

ALTER TABLE tipos_equipamento ADD COLUMN IF NOT EXISTS link_drivers VARCHAR(500);   -- link ou pasta de rede dos drivers (só o administrador edita)

ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS nome VARCHAR(80);   -- nome do painel/TV (ex.: Painel de chamada - Recepção)

-- Beira leito pertence à DIVISÃO (UTI, Centro Cirúrgico, PS/CDM), não a um setor.
ALTER TABLE equipamentos ALTER COLUMN setor_id DROP NOT NULL;
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS divisao VARCHAR(80);
ALTER TABLE equipamentos DROP CONSTRAINT IF EXISTS equip_setor_ou_divisao;
ALTER TABLE equipamentos ADD CONSTRAINT equip_setor_ou_divisao CHECK (setor_id IS NOT NULL OR divisao IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_equip_divisao ON equipamentos(divisao);

-- Login sem diferenciar maiúsculas
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_usuario_lower ON usuarios (lower(usuario));

-- 2) CATEGORIAS E TIPOS DE EQUIPAMENTO
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

-- 3) UNIDADES
INSERT INTO unidades (nome, codigo, endereco, telefone, observacoes, ativo)
VALUES ('SIG', 'SIG', 'MedSênior SIG - Brasília/DF', NULL, NULL, true)
ON CONFLICT (codigo) DO NOTHING;

-- 4) SETORES (divisão = campo localizacao)
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), 'ALMOXARIFADO', 'PSCDM-01', 'SETOR PS/CDM', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), 'AREA TECNICA', 'PSCDM-02', 'SETOR PS/CDM', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), 'COLONOSCOPIA', 'PSCDM-03', 'SETOR PS/CDM', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), 'CONSULTORIO PS', 'PSCDM-04', 'SETOR PS/CDM', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), 'ENDOSCOPIA', 'PSCDM-05', 'SETOR PS/CDM', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), 'FARMACIA', 'PSCDM-06', 'SETOR PS/CDM', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), 'GERÊNCIA CDM', 'PSCDM-07', 'SETOR PS/CDM', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), 'GERÊNCIA MEDICA', 'PSCDM-08', 'SETOR PS/CDM', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), 'GERÊNCIA OPERACIONAL', 'PSCDM-09', 'SETOR PS/CDM', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), 'INTERNAÇÃO', 'PSCDM-10', 'SETOR PS/CDM', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), 'LABORATORIO', 'PSCDM-11', 'SETOR PS/CDM', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), 'MAPA E HOLTER', 'PSCDM-12', 'SETOR PS/CDM', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), 'RECEPÇÕES', 'PSCDM-13', 'SETOR PS/CDM', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), 'RESULTADO DE EXAMES CDM', 'PSCDM-14', 'SETOR PS/CDM', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), 'SALA ADM CDM', 'PSCDM-15', 'SETOR PS/CDM', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), 'SALA DE PRESCRIÇÃO', 'PSCDM-16', 'SETOR PS/CDM', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), 'SALA MEDICAÇÃO', 'PSCDM-17', 'SETOR PS/CDM', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), 'SALA MULTI', 'PSCDM-18', 'SETOR PS/CDM', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), 'SALA VERMELHA', 'PSCDM-19', 'SETOR PS/CDM', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), 'TESTE ERGOMETRICO', 'PSCDM-20', 'SETOR PS/CDM', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), 'TOMOGRAFIA', 'PSCDM-21', 'SETOR PS/CDM', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), 'Recepção', 'UTI-01', 'UTI', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), '1-posto enfermagem black', 'UTI-02', 'UTI', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), '2-posto enfermagem posto B', 'UTI-03', 'UTI', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), '3-posto enfermagem posto A', 'UTI-04', 'UTI', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), '4-farmacia de apoio', 'UTI-05', 'UTI', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), '5-posto medico', 'UTI-06', 'UTI', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), 'Recepção Principal', 'CC-01', 'CENTRO CIRÚRGICO', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), 'Recepção Centro Cirúrgico', 'CC-02', 'CENTRO CIRÚRGICO', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), '1-posto de enfermagem 1', 'CC-03', 'CENTRO CIRÚRGICO', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), '2-farmacia sateletite', 'CC-04', 'CENTRO CIRÚRGICO', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), '3-prescrição medica', 'CC-05', 'CENTRO CIRÚRGICO', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), '4-posto enfermagem Rpa', 'CC-06', 'CENTRO CIRÚRGICO', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), '5-posto medico', 'CC-07', 'CENTRO CIRÚRGICO', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), '6-repouso medico', 'CC-08', 'CENTRO CIRÚRGICO', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), '7-sala adm', 'CC-09', 'CENTRO CIRÚRGICO', NULL, NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
INSERT INTO setores (unidade_id, nome, codigo, localizacao, andar, responsavel, ramal, observacoes, ativo)
VALUES ((SELECT id FROM unidades WHERE codigo = 'SIG'), 'UTRASSOM  1', 'CDM', 'SETOR PS/CDM', '-1', NULL, NULL, NULL, true)
ON CONFLICT (unidade_id, codigo) DO NOTHING;

-- 5) ADMINISTRADOR INICIAL
-- Usuário: admin | senha provisória: definida na geração deste arquivo (informada fora do repositório)
-- trocar_senha = TRUE: o sistema obriga a criar uma nova senha no primeiro acesso.
INSERT INTO usuarios (nome, usuario, senha_hash, perfil, ativo, trocar_senha)
VALUES ('Administrador', 'admin', '$2a$10$f/JYn7ppuuPbPm5CDp8cWuQZfb/fgSwHVZnI89Dbmgx2KRBl1xCFq', 'ADMINISTRADOR', TRUE, TRUE)
ON CONFLICT (usuario) DO NOTHING;

-- 6) SEGURANÇA: RLS ligado e sem políticas = a API pública do Supabase não lê nem grava nada.
-- (O backend conecta com o usuário "postgres", que ignora o RLS.)
ALTER TABLE usuarios                ENABLE ROW LEVEL SECURITY;
ALTER TABLE unidades                ENABLE ROW LEVEL SECURITY;
ALTER TABLE setores                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_equipamento  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_equipamento       ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipamentos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarefas                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE atividades              ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_tarefa        ENABLE ROW LEVEL SECURITY;
ALTER TABLE parametros              ENABLE ROW LEVEL SECURITY;
