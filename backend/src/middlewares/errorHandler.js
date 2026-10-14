const { HttpError } = require('../utils/http');

// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ erro: err.message });

  // Erros do PostgreSQL
  if (err.code === '23505') return res.status(409).json({ erro: 'Já existe um registro com esse valor único (código, patrimônio ou usuário).' });
  if (err.code === '23503') return res.status(409).json({ erro: 'Referência inválida ou registro em uso.' });
  if (err.code === '23514') return res.status(400).json({ erro: 'Dados inválidos para esta operação.' });

  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
};
