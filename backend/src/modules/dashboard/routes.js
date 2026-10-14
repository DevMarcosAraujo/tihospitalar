const router = require('express').Router();
const db = require('../../config/db');
const { authenticate, isAdmin } = require('../../middlewares/auth');
const { wrap, toId } = require('../../utils/http');
const Q = require('../tarefas/queries');

router.use(authenticate);

// Cards + lista de tarefas. Filtro por unidade vale somente para o administrador.
// "Tarefas abertas" = ABERTA + EM_ANDAMENTO (não concluídas e ainda no prazo); atrasadas são contadas à parte.
router.get('/', wrap(async (req, res) => {
  const admin = isAdmin(req);
  const unidadeId = admin ? (req.query.unidade_id ? toId(req.query.unidade_id) : null) : (req.user.unidade_id || 0);

  const where = [];
  const params = [];
  if (unidadeId) { params.push(unidadeId); where.push(`t.unidade_id = $${params.length}`); }
  if (!admin) { params.push(req.user.id); where.push(`t.tecnico_id = $${params.length}`); }

  const [equip, unid, setor, tec, tarefas, lista] = await Promise.all([
    db.query(`SELECT count(*)::int AS n FROM equipamentos WHERE status <> 'INATIVO' AND ($1::int IS NULL OR unidade_id = $1)`, [unidadeId]),
    db.query('SELECT count(*)::int AS n FROM unidades WHERE ativo AND ($1::int IS NULL OR id = $1)', [unidadeId]),
    db.query('SELECT count(*)::int AS n FROM setores WHERE ativo AND ($1::int IS NULL OR unidade_id = $1)', [unidadeId]),
    db.query(
      `SELECT count(*)::int AS n FROM usuarios u
       WHERE u.perfil = 'TECNICO' AND u.ativo
         AND ($1::int IS NULL OR EXISTS (SELECT 1 FROM tarefas t WHERE t.tecnico_id = u.id AND t.unidade_id = $1))`,
      [unidadeId]
    ),
    Q.listar({ where, params }),
    Q.listar({
      where, params,
      order: admin ? 'x.criado_em DESC' : "(x.status = 'CONCLUIDA'), x.prazo, x.id",
      limit: admin ? 10 : 20,
    }),
  ]);

  const conta = (...s) => tarefas.filter((t) => s.includes(t.status)).length;
  res.json({
    cards: {
      total_equipamentos: equip.rows[0].n,
      total_unidades: unid.rows[0].n,
      total_setores: setor.rows[0].n,
      tecnicos_ativos: tec.rows[0].n,
      tarefas_abertas: conta('ABERTA', 'EM_ANDAMENTO'),
      tarefas_atrasadas: conta('ATRASADA'),
    },
    titulo_lista: admin ? 'Tarefas recentes' : 'Minhas tarefas',
    tarefas: lista,
  });
}));

module.exports = router;
