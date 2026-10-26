const db = require('../config/db');

// Registro automático do que cada usuário faz (para o administrador acompanhar por dia, semana, mês e ano)
const pronto = db.query(
  `CREATE TABLE IF NOT EXISTS atividade_log (
     id SERIAL PRIMARY KEY,
     usuario_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
     unidade_id INT REFERENCES unidades(id) ON DELETE SET NULL,
     acao VARCHAR(20) NOT NULL,
     entidade VARCHAR(30) NOT NULL,
     descricao VARCHAR(300) NOT NULL,
     criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   CREATE INDEX IF NOT EXISTS idx_atividade_log_data ON atividade_log (criado_em);
   CREATE INDEX IF NOT EXISTS idx_atividade_log_usuario ON atividade_log (usuario_id);
   CREATE TABLE IF NOT EXISTS atividade_leitura (
     usuario_id INT PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
     visto_ate TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01'
   )`
);

// Nunca derruba a operação principal: se o registro falhar, só ignora
async function registrar(req, acao, entidade, descricao, unidadeId = null) {
  try {
    await pronto;
    await db.query(
      'INSERT INTO atividade_log (usuario_id, unidade_id, acao, entidade, descricao) VALUES ($1,$2,$3,$4,$5)',
      [req.user.id, unidadeId || req.user.unidade_id || null, acao, entidade, String(descricao).slice(0, 300)]
    );
  } catch (err) {
    console.error('Falha ao registrar atividade:', err.message);
  }
}

const nomeDoEquip = (e) => e.nome || e.hostname || e.patrimonio || [e.tipo, e.modelo].filter(Boolean).join(' ') || 'Equipamento';

module.exports = { registrar, pronto, nomeDoEquip };
