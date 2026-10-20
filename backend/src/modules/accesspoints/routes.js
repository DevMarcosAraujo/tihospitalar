const router = require('express').Router();
const db = require('../../config/db');
const { authenticate, requireAdmin } = require('../../middlewares/auth');
const { HttpError, wrap, required, toId, emptyToNull } = require('../../utils/http');

// Access Points e o ponto de rede/porta do switch onde cada um está ligado.
// Siglas: AP_<NUM>_PT_<PONTO>  e  CABO_SW_<RACK>_PT_<PORTA DO RACK>
const pronto = db.query(
  `CREATE TABLE IF NOT EXISTS access_points (
     id SERIAL PRIMARY KEY,
     unidade_id INT NOT NULL REFERENCES unidades(id),
     setor_id INT REFERENCES setores(id) ON DELETE SET NULL,
     numero VARCHAR(40) NOT NULL,
     ponto VARCHAR(40) NOT NULL,
     rack VARCHAR(60) NOT NULL,
     porta VARCHAR(40) NOT NULL,
     observacoes TEXT,
     criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
   )`
);

const SELECT = `
  SELECT a.*, 'AP_' || a.numero || '_PT_' || a.ponto AS nome_ap,
         'CABO_SW_' || a.rack || '_PT_' || a.porta AS nome_cabo,
         u.nome AS unidade_nome, s.nome AS setor_nome, s.localizacao AS divisao
  FROM access_points a
  JOIN unidades u ON u.id = a.unidade_id
  LEFT JOIN setores s ON s.id = a.setor_id`;

// Só o que o técnico digita: vira maiúsculo, sem acento e com "_" no lugar de espaços
const limpa = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');

router.use(authenticate);
router.use(wrap(async (req, res, next) => { await pronto; next(); }));

router.get('/', wrap(async (req, res) => {
  const where = [];
  const params = [];
  const unidade = req.user.perfil === 'TECNICO' ? (req.user.unidade_id || 0) : req.query.unidade_id;
  if (unidade) { params.push(toId(unidade)); where.push(`a.unidade_id = $${params.length}`); }
  if (req.query.setor_id) { params.push(toId(req.query.setor_id)); where.push(`a.setor_id = $${params.length}`); }
  if (req.query.q) {
    params.push(`%${req.query.q}%`);
    where.push(`('AP_' || a.numero || '_PT_' || a.ponto ILIKE $${params.length} OR 'CABO_SW_' || a.rack || '_PT_' || a.porta ILIKE $${params.length} OR s.nome ILIKE $${params.length})`);
  }
  const { rows } = await db.query(
    `${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY u.nome, s.nome NULLS LAST, a.numero, a.id`, params);
  res.json(rows);
}));

async function preparar(b, user, selfId = null) {
  required(b, ['setor_id', 'numero', 'ponto', 'rack', 'porta']);
  const setorId = toId(b.setor_id);
  const setor = await db.query('SELECT unidade_id FROM setores WHERE id = $1 AND ativo', [setorId]);
  if (!setor.rows[0]) throw new HttpError(400, 'Setor inexistente ou inativo');
  const unidadeId = setor.rows[0].unidade_id;
  if (user.perfil === 'TECNICO' && unidadeId !== user.unidade_id) throw new HttpError(403, 'Este setor não é da sua unidade');
  const d = { unidadeId, setorId, numero: limpa(b.numero), ponto: limpa(b.ponto), rack: limpa(b.rack), porta: limpa(b.porta), observacoes: emptyToNull(b.observacoes) };
  if (!d.numero || !d.ponto || !d.rack || !d.porta) throw new HttpError(400, 'Preencha número, ponto, rack e porta');

  const achar = async (cond, params) => (await db.query(
    `SELECT a.numero, a.ponto, s.nome AS setor_nome FROM access_points a LEFT JOIN setores s ON s.id = a.setor_id
     WHERE a.unidade_id = $1 AND ${cond} AND ($2::int IS NULL OR a.id <> $2) LIMIT 1`, [unidadeId, selfId, ...params])).rows[0];
  const ap = await achar('a.numero = $3 AND a.ponto = $4', [d.numero, d.ponto]);
  if (ap) throw new HttpError(409, `Já existe o AP_${d.numero}_PT_${d.ponto} (${ap.setor_nome || 'sem setor'})`);
  const porta = await achar('a.rack = $3 AND a.porta = $4', [d.rack, d.porta]);
  if (porta) throw new HttpError(409, `A porta ${d.porta} do rack ${d.rack} já está em uso pelo AP_${porta.numero}_PT_${porta.ponto}`);
  return d;
}

// Técnico e administrador cadastram; editar e excluir é só do administrador
router.post('/', wrap(async (req, res) => {
  const d = await preparar(req.body, req.user);
  const { rows } = await db.query(
    `INSERT INTO access_points (unidade_id, setor_id, numero, ponto, rack, porta, observacoes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [d.unidadeId, d.setorId, d.numero, d.ponto, d.rack, d.porta, d.observacoes]);
  res.status(201).json((await db.query(`${SELECT} WHERE a.id = $1`, [rows[0].id])).rows[0]);
}));

router.put('/:id', requireAdmin, wrap(async (req, res) => {
  const id = toId(req.params.id);
  const d = await preparar(req.body, req.user, id);
  const { rowCount } = await db.query(
    `UPDATE access_points SET unidade_id=$1, setor_id=$2, numero=$3, ponto=$4, rack=$5, porta=$6, observacoes=$7 WHERE id=$8`,
    [d.unidadeId, d.setorId, d.numero, d.ponto, d.rack, d.porta, d.observacoes, id]);
  if (!rowCount) throw new HttpError(404, 'Access Point não encontrado');
  res.json((await db.query(`${SELECT} WHERE a.id = $1`, [id])).rows[0]);
}));

router.delete('/:id', requireAdmin, wrap(async (req, res) => {
  const { rowCount } = await db.query('DELETE FROM access_points WHERE id = $1', [toId(req.params.id)]);
  if (!rowCount) throw new HttpError(404, 'Access Point não encontrado');
  res.status(204).end();
}));

module.exports = router;
