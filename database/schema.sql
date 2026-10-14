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

-- Migração 005: senha de acesso remoto
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS teamviewer_senha VARCHAR(60);   -- senha de acesso remoto (uso interno)

-- Migração 006: link/pasta dos drivers por modelo
ALTER TABLE tipos_equipamento ADD COLUMN IF NOT EXISTS link_drivers VARCHAR(500);   -- link ou pasta de rede dos drivers (só o administrador edita)

-- Migração 007: nome do painel/TV
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS nome VARCHAR(80);   -- nome do painel/TV (ex.: Painel de chamada - Recepção)

-- Migração 009
-- Beira leito pertence à DIVISÃO (UTI, Centro Cirúrgico, PS/CDM), não a um setor.
ALTER TABLE equipamentos ALTER COLUMN setor_id DROP NOT NULL;
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS divisao VARCHAR(80);
ALTER TABLE equipamentos DROP CONSTRAINT IF EXISTS equip_setor_ou_divisao;
ALTER TABLE equipamentos ADD CONSTRAINT equip_setor_ou_divisao CHECK (setor_id IS NOT NULL OR divisao IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_equip_divisao ON equipamentos(divisao);

-- Login sem diferenciar maiúsculas
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_usuario_lower ON usuarios (lower(usuario));
