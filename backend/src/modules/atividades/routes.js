const router = require('express').Router();
const db = require('../../config/db');
const { authenticate, requireAdmin } = require('../../middlewares/auth');
const { HttpError, wrap, isDate, toId } = require('../../utils/http');
const { pronto } = require('../../utils/atividade');

router.use(authenticate, requireAdmin);

// Painel do dashboard: novos cadastros de equipamentos feitos pelos técnicos, por unidade
router.get('/resumo', wrap(async (req, res) => {
  await pronto;
  const params = [req.user.id];
  let uni = '';
  if (req.query.unidade_id) { params.push(toId(req.query.unidade_id)); uni = `AND l.unidade_id = $${params.length}`; }
  const dia = "(l.criado_em AT TIME ZONE 'America/Sao_Paulo')::date";
  const hoje = "(now() AT TIME ZONE 'America/Sao_Paulo')::date";
  const nova = "l.criado_em > COALESCE(r.visto_ate, '1970-01-01')";
  const base = `FROM atividade_log l
                 JOIN usuarios u ON u.id = l.usuario_id AND u.perfil = 'TECNICO'
                 LEFT JOIN unidades un ON un.id = l.unidade_id
                 LEFT JOIN atividade_leitura r ON r.usuario_id = $1
                 WHERE l.acao = 'CADASTROU' AND l.entidade = 'Equipamento' ${uni}`;
  const porUnidade = (await db.query(
    `SELECT COALESCE(un.nome, 'Sem unidade') AS unidade_nome,
            count(*) FILTER (WHERE ${nova})::int AS novas,
            count(*) FILTER (WHERE ${dia} = ${hoje})::int AS hoje,
            count(*) FILTER (WHERE date_trunc('week', ${dia}) = date_trunc('week', ${hoje}))::int AS semana,
            count(*) FILTER (WHERE date_trunc('month', ${dia}) = date_trunc('month', ${hoje}))::int AS mes,
            count(*) FILTER (WHERE date_trunc('year', ${dia}) = date_trunc('year', ${hoje}))::int AS ano
     ${base} GROUP BY un.id, un.nome ORDER BY novas DESC, un.nome`, params)).rows;
  const recentes = (await db.query(
    `SELECT l.id, l.descricao, l.criado_em, u.nome AS usuario_nome, COALESCE(un.nome, '') AS unidade_nome, ${nova} AS nova
     ${base} ORDER BY l.criado_em DESC LIMIT 9`, params)).rows;
  res.json({ nao_vistas: porUnidade.reduce((s, x) => s + x.novas, 0), por_unidade: porUnidade, recentes });
}));

// Marca tudo como visto (some a notificação do dashboard)
router.post('/visto', wrap(async (req, res) => {
  await pronto;
  await db.query(
    `INSERT INTO atividade_leitura (usuario_id, visto_ate) VALUES ($1, now())
     ON CONFLICT (usuario_id) DO UPDATE SET visto_ate = now()`, [req.user.id]);
  res.json({ ok: true });
}));

// Atividades de todos os usuários no período (de/ate = AAAA-MM-DD, fuso de Brasília)
router.get('/', wrap(async (req, res) => {
  await pronto;
  const { de, ate, usuario_id, unidade_id } = req.query;
  if (!isDate(de) || !isDate(ate)) throw new HttpError(400, 'Informe o período (de e ate)');
  const where = ["(l.criado_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN $1 AND $2"];
  const params = [de, ate];
  if (usuario_id) { params.push(toId(usuario_id)); where.push(`l.usuario_id = $${params.length}`); }
  if (unidade_id) { params.push(toId(unidade_id)); where.push(`l.unidade_id = $${params.length}`); }
  const { rows } = await db.query(
    `SELECT l.id, l.acao, l.entidade, l.descricao, l.criado_em, l.usuario_id,
            COALESCE(u.nome, 'Usuário removido') AS usuario_nome, u.perfil, un.nome AS unidade_nome
     FROM atividade_log l
     LEFT JOIN usuarios u ON u.id = l.usuario_id
     LEFT JOIN unidades un ON un.id = l.unidade_id
     WHERE ${where.join(' AND ')} ORDER BY l.criado_em DESC LIMIT 2000`,
    params
  );
  res.json(rows);
}));

module.exports = router;
