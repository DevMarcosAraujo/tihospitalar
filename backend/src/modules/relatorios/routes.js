const router = require('express').Router();
const db = require('../../config/db');
const { authenticate, requireAdmin } = require('../../middlewares/auth');
const { HttpError, wrap, isDate, toId } = require('../../utils/http');
const { sendCsv } = require('../../utils/csv');
const Q = require('../tarefas/queries');

router.use(authenticate, requireAdmin);

// Responde em JSON (tabela na tela) ou CSV (?formato=csv)
function responder(req, res, nome, rows, columns) {
  if (req.query.formato === 'csv') return sendCsv(res, nome, rows, columns);
  res.json({ colunas: columns, linhas: rows });
}

function periodo(req, col, where, params) {
  const { de, ate } = req.query;
  if (de) { if (!isDate(de)) throw new HttpError(400, 'Data inicial inválida'); params.push(de); where.push(`${col} >= $${params.length}`); }
  if (ate) { if (!isDate(ate)) throw new HttpError(400, 'Data final inválida'); params.push(ate); where.push(`${col} <= $${params.length}`); }
}

// Equipamentos agrupados por unidade / setor / categoria / status
router.get('/equipamentos', wrap(async (req, res) => {
  const where = [];
  const params = [];
  if (req.query.unidade_id) { params.push(toId(req.query.unidade_id)); where.push(`e.unidade_id = $${params.length}`); }
  const rows = (await db.query(
    `SELECT u.nome AS unidade, COALESCE(s.nome, 'BEIRA LEITO - ' || e.divisao) AS setor, c.nome AS categoria, e.status, count(*)::int AS total
     FROM equipamentos e
     JOIN unidades u ON u.id = e.unidade_id
     LEFT JOIN setores s ON s.id = e.setor_id
     JOIN tipos_equipamento t ON t.id = e.tipo_id
     JOIN categorias_equipamento c ON c.id = t.categoria_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     GROUP BY u.nome, COALESCE(s.nome, 'BEIRA LEITO - ' || e.divisao), c.nome, e.status
     ORDER BY u.nome, 2, c.nome, e.status`,
    params
  )).rows;
  responder(req, res, 'equipamentos', rows, [
    { key: 'unidade', label: 'Unidade' }, { key: 'setor', label: 'Setor' },
    { key: 'categoria', label: 'Categoria' }, { key: 'status', label: 'Status' }, { key: 'total', label: 'Total' },
  ]);
}));

// Tarefas por status, técnico e período (de/ate sobre a data de criação)
router.get('/tarefas', wrap(async (req, res) => {
  const where = [];
  const params = [];
  if (req.query.tecnico_id) { params.push(toId(req.query.tecnico_id)); where.push(`t.tecnico_id = $${params.length}`); }
  periodo(req, "(t.criado_em AT TIME ZONE 'America/Sao_Paulo')::date", where, params);
  const rows = await Q.listar({ where, params, status: req.query.status || undefined, order: 'x.criado_em DESC' });
  responder(req, res, 'tarefas', rows, [
    { key: 'titulo', label: 'Tarefa' }, { key: 'unidade_nome', label: 'Unidade' }, { key: 'setor_nome', label: 'Setor' },
    { key: 'tecnico_nome', label: 'Técnico' }, { key: 'prioridade', label: 'Prioridade' }, { key: 'status', label: 'Status' },
    { key: 'concluidas', label: 'Concluídas' }, { key: 'total', label: 'Atividades' }, { key: 'problemas', label: 'Problemas' },
    { key: 'criado_em', label: 'Criada em', date: true }, { key: 'prazo', label: 'Prazo', date: true },
  ]);
}));

// Problemas encontrados por período (data da execução)
router.get('/problemas', wrap(async (req, res) => {
  const where = ["a.resultado = 'PROBLEMA_ENCONTRADO'"];
  const params = [];
  periodo(req, "(a.executado_em AT TIME ZONE 'America/Sao_Paulo')::date", where, params);
  const rows = (await db.query(
    `SELECT a.executado_em, un.nome AS unidade, se.nome AS setor, t.titulo AS tarefa, a.descricao AS atividade,
            a.problema, a.observacao, u.nome AS tecnico
     FROM atividades a
     JOIN tarefas t ON t.id = a.tarefa_id
     JOIN unidades un ON un.id = t.unidade_id
     JOIN setores se ON se.id = t.setor_id
     LEFT JOIN usuarios u ON u.id = a.executado_por
     WHERE ${where.join(' AND ')} ORDER BY a.executado_em DESC`,
    params
  )).rows;
  responder(req, res, 'problemas', rows, [
    { key: 'executado_em', label: 'Data/hora', date: true }, { key: 'unidade', label: 'Unidade' }, { key: 'setor', label: 'Setor' },
    { key: 'tarefa', label: 'Tarefa' }, { key: 'atividade', label: 'Atividade' }, { key: 'problema', label: 'Problema' },
    { key: 'observacao', label: 'Observação' }, { key: 'tecnico', label: 'Técnico' },
  ]);
}));

module.exports = router;
