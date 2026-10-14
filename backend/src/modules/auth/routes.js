const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const db = require('../../config/db');
const { authenticate } = require('../../middlewares/auth');
const { HttpError, wrap, required } = require('../../utils/http');

router.post('/login', wrap(async (req, res) => {
  required(req.body, ['usuario', 'senha']);
  const { rows } = await db.query(
    `SELECT u.id, u.nome, u.usuario, u.senha_hash, u.perfil, u.ativo, u.unidade_id, u.trocar_senha, un.nome AS unidade_nome
     FROM usuarios u LEFT JOIN unidades un ON un.id = u.unidade_id WHERE u.usuario = $1`,
    [String(req.body.usuario).trim()]
  );
  const u = rows[0];
  // Mesma mensagem para usuário inexistente e senha errada
  if (!u || !(await bcrypt.compare(String(req.body.senha), u.senha_hash))) {
    throw new HttpError(401, 'Usuário ou senha inválidos');
  }
  if (!u.ativo) throw new HttpError(403, 'Usuário inativo');

  const token = jwt.sign({ sub: u.id, perfil: u.perfil }, env.jwtSecret, { expiresIn: env.jwtExpires });
  res.json({
    token,
    usuario: { id: u.id, nome: u.nome, usuario: u.usuario, perfil: u.perfil, unidade_id: u.unidade_id, unidade_nome: u.unidade_nome, trocar_senha: u.trocar_senha },
  });
}));

// Troca de senha pelo próprio usuário (obrigatória no primeiro acesso ou após redefinição pelo administrador)
router.post('/trocar-senha', authenticate, wrap(async (req, res) => {
  required(req.body, ['senha_atual', 'nova_senha']);
  const nova = String(req.body.nova_senha);
  if (nova.length < 6) throw new HttpError(400, 'A nova senha deve ter ao menos 6 caracteres');
  const { rows } = await db.query('SELECT senha_hash FROM usuarios WHERE id = $1', [req.user.id]);
  if (!(await bcrypt.compare(String(req.body.senha_atual), rows[0].senha_hash))) throw new HttpError(400, 'Senha atual incorreta');
  if (nova === String(req.body.senha_atual)) throw new HttpError(400, 'A nova senha deve ser diferente da atual');
  await db.query('UPDATE usuarios SET senha_hash = $1, trocar_senha = FALSE WHERE id = $2', [await bcrypt.hash(nova, 10), req.user.id]);
  res.json({ ok: true });
}));

router.get('/me', authenticate, (req, res) => res.json({ usuario: req.user }));

module.exports = router;
