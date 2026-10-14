const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../../config/db');
const { authenticate, requireAdmin } = require('../../middlewares/auth');
const { HttpError, wrap, required, toId } = require('../../utils/http');

router.use(authenticate, requireAdmin);

// Alterar a própria senha
router.put('/senha', wrap(async (req, res) => {
  required(req.body, ['senha_atual', 'nova_senha']);
  if (String(req.body.nova_senha).length < 6) throw new HttpError(400, 'A nova senha deve ter ao menos 6 caracteres');
  const { rows } = await db.query('SELECT senha_hash FROM usuarios WHERE id = $1', [req.user.id]);
  if (!(await bcrypt.compare(String(req.body.senha_atual), rows[0].senha_hash))) {
    throw new HttpError(400, 'Senha atual incorreta');
  }
  const hash = await bcrypt.hash(String(req.body.nova_senha), 10);
  await db.query('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [hash, req.user.id]);
  res.json({ ok: true });
}));

// Tipos de equipamento (inclui inativos para gerenciamento)
router.get('/tipos', wrap(async (req, res) => {
  const { rows } = await db.query(
    `SELECT t.id, t.nome, t.ativo, t.categoria_id, c.nome AS categoria
     FROM tipos_equipamento t JOIN categorias_equipamento c ON c.id = t.categoria_id
     ORDER BY c.nome, t.nome`
  );
  res.json(rows);
}));

router.post('/tipos', wrap(async (req, res) => {
  required(req.body, ['categoria_id', 'nome']);
  const { rows } = await db.query(
    'INSERT INTO tipos_equipamento (categoria_id, nome, usa_ip) VALUES ($1, $2, $3) RETURNING *',
    [toId(req.body.categoria_id), req.body.nome.trim(), typeof req.body.usa_ip === 'boolean' ? req.body.usa_ip : null]
  );
  res.status(201).json(rows[0]);
}));

router.patch('/tipos/:id/ativo', wrap(async (req, res) => {
  if (typeof req.body.ativo !== 'boolean') throw new HttpError(400, 'Informe ativo true/false');
  const { rows } = await db.query('UPDATE tipos_equipamento SET ativo = $1 WHERE id = $2 RETURNING *', [req.body.ativo, toId(req.params.id)]);
  if (!rows[0]) throw new HttpError(404, 'Tipo não encontrado');
  res.json(rows[0]);
}));

module.exports = router;
