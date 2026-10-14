const router = require('express').Router();
const db = require('../../config/db');
const { authenticate, requireAdmin } = require('../../middlewares/auth');
const { HttpError, wrap, required, flag, toId, emptyToNull } = require('../../utils/http');

router.use(authenticate);

router.get('/', wrap(async (req, res) => {
  const { unidade_id, q, inativos } = req.query;
  const where = [];
  const params = [];
  if (!flag(inativos)) where.push('s.ativo = TRUE');
  const unidadeFiltro = req.user.perfil === 'TECNICO' ? (req.user.unidade_id || 0) : unidade_id;
  if (unidadeFiltro) { params.push(toId(unidadeFiltro)); where.push(`s.unidade_id = $${params.length}`); }
  if (q) { params.push(`%${q}%`); where.push(`(s.nome ILIKE $${params.length} OR s.codigo ILIKE $${params.length})`); }
  const { rows } = await db.query(
    `SELECT s.*, u.nome AS unidade_nome,
            (SELECT count(*)::int FROM equipamentos e WHERE e.setor_id = s.id AND e.status <> 'INATIVO') AS total_equipamentos
     FROM setores s JOIN unidades u ON u.id = s.unidade_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY u.nome, s.nome`,
    params
  );
  res.json(rows);
}));

// Detalhe: setor + resumo por categoria (a lista de equipamentos vem de GET /equipamentos?setor_id=)
router.get('/:id', wrap(async (req, res) => {
  const id = toId(req.params.id);
  const { rows } = await db.query(
    'SELECT s.*, u.nome AS unidade_nome FROM setores s JOIN unidades u ON u.id = s.unidade_id WHERE s.id = $1',
    [id]
  );
  if (!rows[0] || (req.user.perfil === 'TECNICO' && rows[0].unidade_id !== req.user.unidade_id)) throw new HttpError(404, 'Setor não encontrado');
  const resumo = await db.query(
    `SELECT c.id AS categoria_id, c.nome AS categoria, count(*)::int AS total
     FROM equipamentos e
     JOIN tipos_equipamento t ON t.id = e.tipo_id
     JOIN categorias_equipamento c ON c.id = t.categoria_id
     WHERE e.setor_id = $1 AND e.status <> 'INATIVO'
     GROUP BY c.id, c.nome ORDER BY c.nome`,
    [id]
  );
  res.json({ ...rows[0], resumo_categorias: resumo.rows });
}));

async function validarUnidade(unidadeId) {
  const { rows } = await db.query('SELECT ativo FROM unidades WHERE id = $1', [unidadeId]);
  if (!rows[0]) throw new HttpError(400, 'Unidade inexistente');
  if (!rows[0].ativo) throw new HttpError(400, 'Unidade inativa');
}

router.post('/', requireAdmin, wrap(async (req, res) => {
  const b = req.body;
  required(b, ['unidade_id', 'nome']);
  const unidadeId = toId(b.unidade_id);
  await validarUnidade(unidadeId);
  // O código não aparece mais na tela: se não vier, é gerado automaticamente
  b.codigo = b.codigo || `S${Date.now().toString(36).toUpperCase()}`;
  const { rows } = await db.query(
    `INSERT INTO setores (unidade_id, nome, codigo, andar, localizacao, responsavel, ramal, observacoes, ativo)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [unidadeId, b.nome.trim(), b.codigo.trim().toUpperCase(), emptyToNull(b.andar), emptyToNull(b.localizacao),
     emptyToNull(b.responsavel), emptyToNull(b.ramal), emptyToNull(b.observacoes), b.ativo !== false]
  );
  res.status(201).json(rows[0]);
}));

router.put('/:id', requireAdmin, wrap(async (req, res) => {
  const b = req.body;
  required(b, ['unidade_id', 'nome']);
  const unidadeId = toId(b.unidade_id);
  await validarUnidade(unidadeId);
  const atual = await db.query('SELECT codigo FROM setores WHERE id = $1', [toId(req.params.id)]);
  b.codigo = b.codigo || atual.rows[0]?.codigo;
  const { rows } = await db.query(
    `UPDATE setores SET unidade_id=$1, nome=$2, codigo=$3, andar=$4, localizacao=$5, responsavel=$6,
            ramal=$7, observacoes=$8, ativo=COALESCE($9, ativo)
     WHERE id=$10 RETURNING *`,
    [unidadeId, b.nome.trim(), b.codigo.trim().toUpperCase(), emptyToNull(b.andar), emptyToNull(b.localizacao),
     emptyToNull(b.responsavel), emptyToNull(b.ramal), emptyToNull(b.observacoes),
     typeof b.ativo === 'boolean' ? b.ativo : null, toId(req.params.id)]
  );
  if (!rows[0]) throw new HttpError(404, 'Setor não encontrado');
  res.json(rows[0]);
}));

router.patch('/:id/ativo', requireAdmin, wrap(async (req, res) => {
  if (typeof req.body.ativo !== 'boolean') throw new HttpError(400, 'Informe ativo true/false');
  const { rows } = await db.query('UPDATE setores SET ativo=$1 WHERE id=$2 RETURNING *', [req.body.ativo, toId(req.params.id)]);
  if (!rows[0]) throw new HttpError(404, 'Setor não encontrado');
  res.json(rows[0]);
}));

router.delete('/:id', requireAdmin, wrap(async (req, res) => {
  const id = toId(req.params.id);
  const t = await db.query('SELECT COUNT(*)::int AS n FROM equipamentos WHERE setor_id = $1', [id]);
  if (t.rows[0].n > 0) {
    throw new HttpError(409, `Este setor tem ${t.rows[0].n} equipamento(s). Exclua ou mova os equipamentos antes, ou apenas inative o setor.`);
  }
  const { rowCount } = await db.query('DELETE FROM setores WHERE id = $1', [id]);
  if (!rowCount) throw new HttpError(404, 'Setor não encontrado');
  res.json({ ok: true });
}));

module.exports = router;
