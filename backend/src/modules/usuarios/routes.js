const router = require('express').Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../../config/db');
const { authenticate, requireAdmin } = require('../../middlewares/auth');
const { HttpError, wrap, required, flag, toId, emptyToNull } = require('../../utils/http');

router.use(authenticate, requireAdmin);

const COLS = `u.id, u.nome, u.usuario, u.email, u.telefone, u.perfil, u.ativo, u.criado_em, u.unidade_id,
              (SELECT nome FROM unidades WHERE id = u.unidade_id) AS unidade_nome`;
const PERFIS = ['ADMINISTRADOR', 'TECNICO'];

// Técnico é fixo em uma unidade; administrador não tem unidade
async function unidadeDoPerfil(perfil, unidadeId) {
  if (perfil !== 'TECNICO') return null;
  if (!unidadeId) throw new HttpError(400, 'Informe a unidade do técnico');
  const { rows } = await db.query('SELECT ativo FROM unidades WHERE id = $1', [toId(unidadeId)]);
  if (!rows[0]) throw new HttpError(400, 'Unidade inexistente');
  if (!rows[0].ativo) throw new HttpError(400, 'Unidade inativa');
  return toId(unidadeId);
}

router.get('/', wrap(async (req, res) => {
  const { q, perfil, inativos, unidade_id } = req.query;
  const where = [];
  const params = [];
  if (!flag(inativos)) where.push('u.ativo = TRUE');
  if (perfil) { params.push(perfil); where.push(`u.perfil = $${params.length}`); }
  if (unidade_id) { params.push(toId(unidade_id)); where.push(`u.unidade_id = $${params.length}`); }
  if (q) { params.push(`%${q}%`); where.push(`(u.nome ILIKE $${params.length} OR u.usuario ILIKE $${params.length})`); }
  const { rows } = await db.query(
    `SELECT ${COLS} FROM usuarios u ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY u.nome`,
    params
  );
  res.json(rows);
}));

router.get('/:id', wrap(async (req, res) => {
  const { rows } = await db.query(`SELECT ${COLS} FROM usuarios u WHERE u.id = $1`, [toId(req.params.id)]);
  if (!rows[0]) throw new HttpError(404, 'Usuário não encontrado');
  res.json(rows[0]);
}));

router.post('/', wrap(async (req, res) => {
  const b = req.body;
  required(b, ['nome', 'usuario', 'senha', 'perfil']);
  if (!PERFIS.includes(b.perfil)) throw new HttpError(400, 'Perfil inválido');
  if (String(b.senha).length < 6) throw new HttpError(400, 'A senha deve ter ao menos 6 caracteres');
  const unidadeId = await unidadeDoPerfil(b.perfil, b.unidade_id);
  const hash = await bcrypt.hash(String(b.senha), 10);
  const { rows } = await db.query(
    `INSERT INTO usuarios (nome, usuario, senha_hash, email, telefone, perfil, ativo, unidade_id, trocar_senha)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8, TRUE) RETURNING id`,
    [b.nome.trim(), b.usuario.trim(), hash, emptyToNull(b.email), emptyToNull(b.telefone), b.perfil, b.ativo !== false, unidadeId]
  );
  const novo = await db.query(`SELECT ${COLS} FROM usuarios u WHERE u.id = $1`, [rows[0].id]);
  res.status(201).json(novo.rows[0]);
}));

// Senha é opcional na edição: só troca se enviada. Trocar a unidade do técnico é feito aqui.
router.put('/:id', wrap(async (req, res) => {
  const id = toId(req.params.id);
  const b = req.body;
  required(b, ['nome', 'usuario', 'perfil']);
  if (!PERFIS.includes(b.perfil)) throw new HttpError(400, 'Perfil inválido');
  if (id === req.user.id && (b.perfil !== 'ADMINISTRADOR' || b.ativo === false)) {
    throw new HttpError(400, 'Você não pode remover seu próprio acesso de administrador');
  }
  const unidadeId = await unidadeDoPerfil(b.perfil, b.unidade_id);
  let hash = null;
  if (b.senha) {
    if (String(b.senha).length < 6) throw new HttpError(400, 'A senha deve ter ao menos 6 caracteres');
    hash = await bcrypt.hash(String(b.senha), 10);
  }
  const { rowCount } = await db.query(
    `UPDATE usuarios SET nome=$1, usuario=$2, email=$3, telefone=$4, perfil=$5, unidade_id=$6,
            ativo=COALESCE($7, ativo), senha_hash=COALESCE($8, senha_hash),
            trocar_senha = CASE WHEN $8::text IS NOT NULL AND id <> $10 THEN TRUE ELSE trocar_senha END
     WHERE id=$9`,
    [b.nome.trim(), b.usuario.trim(), emptyToNull(b.email), emptyToNull(b.telefone), b.perfil, unidadeId,
     typeof b.ativo === 'boolean' ? b.ativo : null, hash, id, req.user.id]
  );
  if (!rowCount) throw new HttpError(404, 'Usuário não encontrado');
  const atual = await db.query(`SELECT ${COLS} FROM usuarios u WHERE u.id = $1`, [id]);
  res.json(atual.rows[0]);
}));

// Redefinir senha: o administrador informa uma senha provisória (ou o sistema gera uma). O usuário troca no próximo acesso.
router.post('/:id/redefinir-senha', wrap(async (req, res) => {
  const id = toId(req.params.id);
  let senha = req.body.senha ? String(req.body.senha) : '';
  if (senha && senha.length < 6) throw new HttpError(400, 'A senha deve ter ao menos 6 caracteres');
  if (!senha) senha = crypto.randomBytes(6).toString('base64url').slice(0, 8);
  const { rowCount } = await db.query('UPDATE usuarios SET senha_hash=$1, trocar_senha=TRUE WHERE id=$2', [await bcrypt.hash(senha, 10), id]);
  if (!rowCount) throw new HttpError(404, 'Usuário não encontrado');
  res.json({ senha_provisoria: senha });
}));

router.patch('/:id/ativo', wrap(async (req, res) => {
  const id = toId(req.params.id);
  if (typeof req.body.ativo !== 'boolean') throw new HttpError(400, 'Informe ativo true/false');
  if (id === req.user.id && !req.body.ativo) throw new HttpError(400, 'Você não pode inativar a si mesmo');
  const { rowCount } = await db.query('UPDATE usuarios SET ativo=$1 WHERE id=$2', [req.body.ativo, id]);
  if (!rowCount) throw new HttpError(404, 'Usuário não encontrado');
  const atual = await db.query(`SELECT ${COLS} FROM usuarios u WHERE u.id = $1`, [id]);
  res.json(atual.rows[0]);
}));

module.exports = router;
