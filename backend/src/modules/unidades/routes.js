const router = require('express').Router();
const db = require('../../config/db');
const { authenticate, requireAdmin } = require('../../middlewares/auth');
const { HttpError, wrap, required, flag, toId, emptyToNull } = require('../../utils/http');

router.use(authenticate);

// Leitura: todos os perfis
router.get('/', wrap(async (req, res) => {
  const { q, inativos } = req.query;
  const where = [];
  const params = [];
  if (req.user.perfil === 'TECNICO') { params.push(req.user.unidade_id || 0); where.push(`u.id = $${params.length}`); }
  if (!flag(inativos)) where.push('u.ativo = TRUE');
  if (q) { params.push(`%${q}%`); where.push(`(u.nome ILIKE $${params.length} OR u.codigo ILIKE $${params.length})`); }
  const { rows } = await db.query(
    `SELECT u.*,
            (SELECT count(*)::int FROM setores s WHERE s.unidade_id = u.id AND s.ativo) AS total_setores,
            (SELECT count(DISTINCT s.localizacao)::int FROM setores s WHERE s.unidade_id = u.id AND s.ativo AND s.localizacao IS NOT NULL) AS total_divisoes,
            (SELECT count(*)::int FROM equipamentos e WHERE e.unidade_id = u.id AND e.status <> 'INATIVO') AS total_equipamentos
     FROM unidades u ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY u.nome`,
    params
  );
  res.json(rows);
}));

// Detalhe: unidade + setores com contagem de equipamentos
router.get('/:id', wrap(async (req, res) => {
  const id = toId(req.params.id);
  if (req.user.perfil === 'TECNICO' && id !== req.user.unidade_id) throw new HttpError(404, 'Unidade não encontrada');
  const { rows } = await db.query('SELECT * FROM unidades WHERE id = $1', [id]);
  if (!rows[0]) throw new HttpError(404, 'Unidade não encontrada');
  const setores = await db.query(
    `SELECT s.id, s.nome, s.localizacao, s.ativo,
            (SELECT count(*)::int FROM equipamentos e WHERE e.setor_id = s.id AND e.status <> 'INATIVO') AS total_equipamentos
     FROM setores s WHERE s.unidade_id = $1 ${flag(req.query.inativos) ? '' : 'AND s.ativo'} ORDER BY s.nome`,
    [id]
  );
  res.json({ ...rows[0], setores: setores.rows });
}));

// Escrita: somente administrador
router.post('/', requireAdmin, wrap(async (req, res) => {
  const b = req.body;
  required(b, ['nome', 'codigo']);
  const { rows } = await db.query(
    `INSERT INTO unidades (nome, codigo, endereco, telefone, observacoes, ativo)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [b.nome.trim(), b.codigo.trim().toUpperCase(), emptyToNull(b.endereco), emptyToNull(b.telefone), emptyToNull(b.observacoes), b.ativo !== false]
  );
  res.status(201).json(rows[0]);
}));

router.put('/:id', requireAdmin, wrap(async (req, res) => {
  const b = req.body;
  required(b, ['nome', 'codigo']);
  const { rows } = await db.query(
    `UPDATE unidades SET nome=$1, codigo=$2, endereco=$3, telefone=$4, observacoes=$5, ativo=COALESCE($6, ativo)
     WHERE id=$7 RETURNING *`,
    [b.nome.trim(), b.codigo.trim().toUpperCase(), emptyToNull(b.endereco), emptyToNull(b.telefone), emptyToNull(b.observacoes),
     typeof b.ativo === 'boolean' ? b.ativo : null, toId(req.params.id)]
  );
  if (!rows[0]) throw new HttpError(404, 'Unidade não encontrada');
  res.json(rows[0]);
}));

router.patch('/:id/ativo', requireAdmin, wrap(async (req, res) => {
  if (typeof req.body.ativo !== 'boolean') throw new HttpError(400, 'Informe ativo true/false');
  const { rows } = await db.query('UPDATE unidades SET ativo=$1 WHERE id=$2 RETURNING *', [req.body.ativo, toId(req.params.id)]);
  if (!rows[0]) throw new HttpError(404, 'Unidade não encontrada');
  res.json(rows[0]);
}));

module.exports = router;
