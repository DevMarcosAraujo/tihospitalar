const router = require('express').Router();
const db = require('../../config/db');
const { authenticate, requireAdmin } = require('../../middlewares/auth');
const { HttpError, wrap, isDate, toId } = require('../../utils/http');
const { pronto } = require('../../utils/atividade');

router.use(authenticate, requireAdmin);

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
