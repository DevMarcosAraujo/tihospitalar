const db = require('../../config/db');

// Status NUNCA é manual: deriva das atividades e do prazo (fuso America/Sao_Paulo)
//   CONCLUIDA     todas as atividades concluídas
//   ATRASADA      prazo vencido e ainda há atividade pendente
//   EM_ANDAMENTO  ao menos 1 concluída, mas não todas
//   ABERTA        nenhuma concluída
const STATUS_SQL = `
  CASE
    WHEN a.total > 0 AND a.concluidas = a.total THEN 'CONCLUIDA'
    WHEN a.concluidas < a.total AND t.prazo < (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN 'ATRASADA'
    WHEN a.concluidas > 0 THEN 'EM_ANDAMENTO'
    ELSE 'ABERTA'
  END`;

const BASE = `
  SELECT t.id, t.titulo, t.descricao, t.unidade_id, t.setor_id, t.tecnico_id, t.criado_em, t.prazo, t.prioridade,
         un.nome AS unidade_nome, se.nome AS setor_nome, tec.nome AS tecnico_nome,
         a.total, a.concluidas, a.problemas,
         ${STATUS_SQL} AS status
  FROM tarefas t
  JOIN unidades un ON un.id = t.unidade_id
  JOIN setores se ON se.id = t.setor_id
  JOIN usuarios tec ON tec.id = t.tecnico_id
  CROSS JOIN LATERAL (
    SELECT count(*)::int AS total,
           (count(*) FILTER (WHERE concluida))::int AS concluidas,
           (count(*) FILTER (WHERE resultado = 'PROBLEMA_ENCONTRADO'))::int AS problemas
    FROM atividades WHERE tarefa_id = t.id
  ) a`;

/**
 * Lista tarefas já com status/progresso calculados.
 * where/params: condições sobre o alias "t" (ex.: 't.tecnico_id = $1').
 * status: filtro opcional sobre o status calculado.
 */
async function listar({ where = [], params = [], status, order = 'x.criado_em DESC', limit } = {}) {
  const p = [...params];
  let sql = `SELECT * FROM (${BASE} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}) x`;
  if (status) { p.push(status); sql += ` WHERE x.status = $${p.length}`; }
  sql += ` ORDER BY ${order}`;
  if (limit) sql += ` LIMIT ${Number(limit)}`;
  const { rows } = await db.query(sql, p);
  return rows;
}

// Status atual de uma tarefa (aceita client de transação)
async function statusDaTarefa(client, id) {
  const { rows } = await client.query(`SELECT status FROM (${BASE} WHERE t.id = $1) x`, [id]);
  return rows[0]?.status;
}

async function obter(id) {
  const { rows } = await db.query(`${BASE} WHERE t.id = $1`, [id]);
  return rows[0];
}

module.exports = { BASE, STATUS_SQL, listar, statusDaTarefa, obter };
