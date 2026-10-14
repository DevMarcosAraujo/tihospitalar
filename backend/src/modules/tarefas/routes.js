const router = require('express').Router();
const db = require('../../config/db');
const { authenticate, requireAdmin, isAdmin } = require('../../middlewares/auth');
const { HttpError, wrap, required, isDate, toId, emptyToNull } = require('../../utils/http');
const Q = require('./queries');

router.use(authenticate);

const PRIORIDADES = ['BAIXA', 'NORMAL', 'ALTA', 'URGENTE'];
const STATUS = ['ABERTA', 'EM_ANDAMENTO', 'CONCLUIDA', 'ATRASADA'];
const RESULTADOS = ['OK', 'PROBLEMA_ENCONTRADO', 'NAO_APLICAVEL'];

const log = (client, tarefaId, usuarioId, evento, detalhe) =>
  client.query(
    'INSERT INTO historico_tarefa (tarefa_id, usuario_id, evento, detalhe) VALUES ($1,$2,$3,$4)',
    [tarefaId, usuarioId, evento, detalhe ? JSON.stringify(detalhe) : null]
  );

// Técnico só enxerga tarefas atribuídas a ele
router.get('/', wrap(async (req, res) => {
  const { unidade_id, setor_id, tecnico_id, status, prioridade, de, ate, campo, q } = req.query;
  const where = [];
  const params = [];
  const add = (cond, v) => { params.push(v); where.push(cond.replace('?', `$${params.length}`)); };

  if (isAdmin(req)) { if (tecnico_id) add('t.tecnico_id = ?', toId(tecnico_id)); }
  else add('t.tecnico_id = ?', req.user.id);

  if (unidade_id) add('t.unidade_id = ?', toId(unidade_id));
  if (setor_id) add('t.setor_id = ?', toId(setor_id));
  if (prioridade) {
    if (!PRIORIDADES.includes(prioridade)) throw new HttpError(400, 'Prioridade inválida');
    add('t.prioridade = ?', prioridade);
  }
  if (status && !STATUS.includes(status)) throw new HttpError(400, 'Status inválido');
  if (q) add('(t.titulo ILIKE ? )', `%${q}%`);

  // Período: por data de criação (padrão) ou por prazo
  const col = campo === 'prazo' ? 't.prazo' : '(t.criado_em AT TIME ZONE \'America/Sao_Paulo\')::date';
  if (de) { if (!isDate(de)) throw new HttpError(400, 'Data inicial inválida'); add(`${col} >= ?`, de); }
  if (ate) { if (!isDate(ate)) throw new HttpError(400, 'Data final inválida'); add(`${col} <= ?`, ate); }

  res.json(await Q.listar({ where, params, status, order: 'x.prazo, x.id' }));
}));

router.get('/:id', wrap(async (req, res) => {
  const id = toId(req.params.id);
  const tarefa = await Q.obter(id);
  if (!tarefa || (!isAdmin(req) && tarefa.tecnico_id !== req.user.id)) {
    throw new HttpError(404, 'Tarefa não encontrada');
  }
  const atividades = await db.query(
    `SELECT a.*, u.nome AS executado_por_nome FROM atividades a
     LEFT JOIN usuarios u ON u.id = a.executado_por
     WHERE a.tarefa_id = $1 ORDER BY a.ordem, a.id`,
    [id]
  );
  const historico = await db.query(
    `SELECT h.id, h.evento, h.detalhe, h.criado_em, u.nome AS usuario_nome
     FROM historico_tarefa h JOIN usuarios u ON u.id = h.usuario_id
     WHERE h.tarefa_id = $1 ORDER BY h.criado_em DESC, h.id DESC`,
    [id]
  );
  res.json({ ...tarefa, atividades: atividades.rows, historico: historico.rows });
}));

// Valida o corpo de criação/edição (somente administrador)
async function validar(b) {
  required(b, ['titulo', 'unidade_id', 'setor_id', 'tecnico_id', 'prazo', 'prioridade']);
  if (!isDate(b.prazo)) throw new HttpError(400, 'Prazo inválido (use AAAA-MM-DD)');
  if (!PRIORIDADES.includes(b.prioridade)) throw new HttpError(400, 'Prioridade inválida');
  const atividades = Array.isArray(b.atividades) ? b.atividades : [];
  const limpas = atividades
    .map((a) => ({ id: a.id ? toId(a.id) : null, descricao: String(a.descricao || '').trim() }))
    .filter((a) => a.descricao);
  if (!limpas.length) throw new HttpError(400, 'Informe ao menos 1 atividade');

  const unidadeId = toId(b.unidade_id);
  const setorId = toId(b.setor_id);
  const tecnicoId = toId(b.tecnico_id);

  const setor = await db.query('SELECT 1 FROM setores WHERE id = $1 AND unidade_id = $2', [setorId, unidadeId]);
  if (!setor.rowCount) throw new HttpError(400, 'O setor não pertence à unidade informada');
  const tec = await db.query("SELECT 1 FROM usuarios WHERE id = $1 AND perfil = 'TECNICO' AND ativo", [tecnicoId]);
  if (!tec.rowCount) throw new HttpError(400, 'Técnico inexistente ou inativo');

  return {
    titulo: String(b.titulo).trim(), descricao: emptyToNull(b.descricao),
    unidadeId, setorId, tecnicoId, prazo: b.prazo, prioridade: b.prioridade, atividades: limpas,
  };
}

router.post('/', requireAdmin, wrap(async (req, res) => {
  const d = await validar(req.body);
  const id = await db.tx(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO tarefas (titulo, descricao, unidade_id, setor_id, tecnico_id, prazo, prioridade)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [d.titulo, d.descricao, d.unidadeId, d.setorId, d.tecnicoId, d.prazo, d.prioridade]
    );
    const tarefaId = rows[0].id;
    for (const [i, a] of d.atividades.entries()) {
      await c.query('INSERT INTO atividades (tarefa_id, descricao, ordem) VALUES ($1,$2,$3)', [tarefaId, a.descricao, i + 1]);
    }
    await log(c, tarefaId, req.user.id, 'CRIACAO', { titulo: d.titulo, tecnico_id: d.tecnicoId, prazo: d.prazo });
    return tarefaId;
  });
  res.status(201).json(await Q.obter(id));
}));

router.put('/:id', requireAdmin, wrap(async (req, res) => {
  const id = toId(req.params.id);
  const d = await validar(req.body);

  await db.tx(async (c) => {
    const atual = (await c.query('SELECT * FROM tarefas WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!atual) throw new HttpError(404, 'Tarefa não encontrada');
    const statusAntes = await Q.statusDaTarefa(c, id);

    await c.query(
      `UPDATE tarefas SET titulo=$1, descricao=$2, unidade_id=$3, setor_id=$4, tecnico_id=$5, prazo=$6, prioridade=$7
       WHERE id=$8`,
      [d.titulo, d.descricao, d.unidadeId, d.setorId, d.tecnicoId, d.prazo, d.prioridade, id]
    );

    // Atividades: com id = renomeia; sem id = nova; ausentes e ainda não executadas = removidas
    const existentes = (await c.query('SELECT id, concluida FROM atividades WHERE tarefa_id = $1', [id])).rows;
    const mantidas = new Set(d.atividades.filter((a) => a.id).map((a) => a.id));
    for (const e of existentes) {
      if (!mantidas.has(e.id) && !e.concluida) await c.query('DELETE FROM atividades WHERE id = $1', [e.id]);
    }
    for (const [i, a] of d.atividades.entries()) {
      if (a.id) {
        const ok = existentes.some((e) => e.id === a.id);
        if (!ok) throw new HttpError(400, 'Atividade não pertence a esta tarefa');
        await c.query('UPDATE atividades SET descricao=$1, ordem=$2 WHERE id=$3 AND tarefa_id=$4', [a.descricao, i + 1, a.id, id]);
      } else {
        await c.query('INSERT INTO atividades (tarefa_id, descricao, ordem) VALUES ($1,$2,$3)', [id, a.descricao, i + 1]);
      }
    }

    // Histórico das alterações importantes
    await log(c, id, req.user.id, 'EDICAO', { titulo: d.titulo });
    if (atual.tecnico_id !== d.tecnicoId) {
      await log(c, id, req.user.id, 'TROCA_TECNICO', { de: atual.tecnico_id, para: d.tecnicoId });
    }
    if (atual.prazo !== d.prazo) {
      await log(c, id, req.user.id, 'ALTERACAO_PRAZO', { de: atual.prazo, para: d.prazo });
    }
    const statusDepois = await Q.statusDaTarefa(c, id);
    if (statusAntes !== statusDepois) {
      await log(c, id, req.user.id, 'MUDANCA_STATUS', { de: statusAntes, para: statusDepois });
    }
  });
  res.json(await Q.obter(id));
}));

// Técnico responsável conclui uma atividade e registra o resultado
router.post('/:id/atividades/:atividadeId/executar', wrap(async (req, res) => {
  if (isAdmin(req)) throw new HttpError(403, 'Somente o técnico responsável executa atividades');
  const id = toId(req.params.id);
  const atividadeId = toId(req.params.atividadeId);
  const { resultado } = req.body;
  const observacao = emptyToNull(req.body.observacao);
  const problema = emptyToNull(req.body.problema);

  if (!RESULTADOS.includes(resultado)) throw new HttpError(400, 'Resultado inválido');
  if (resultado === 'PROBLEMA_ENCONTRADO' && !problema) {
    throw new HttpError(400, 'Descreva o problema encontrado');
  }

  await db.tx(async (c) => {
    const t = await c.query('SELECT id FROM tarefas WHERE id = $1 AND tecnico_id = $2 FOR UPDATE', [id, req.user.id]);
    if (!t.rowCount) throw new HttpError(404, 'Tarefa não encontrada');
    const statusAntes = await Q.statusDaTarefa(c, id);

    const { rows } = await c.query(
      `UPDATE atividades
       SET concluida = TRUE, resultado = $1, observacao = $2, problema = $3,
           executado_por = $4, executado_em = now()
       WHERE id = $5 AND tarefa_id = $6 AND concluida = FALSE
       RETURNING descricao`,
      [resultado, observacao, resultado === 'PROBLEMA_ENCONTRADO' ? problema : null, req.user.id, atividadeId, id]
    );
    if (!rows[0]) throw new HttpError(409, 'Atividade inexistente ou já concluída');

    await log(c, id, req.user.id, 'ATIVIDADE_EXECUTADA', {
      atividade: rows[0].descricao, resultado, observacao, problema,
    });
    const statusDepois = await Q.statusDaTarefa(c, id);
    if (statusAntes !== statusDepois) {
      await log(c, id, req.user.id, 'MUDANCA_STATUS', { de: statusAntes, para: statusDepois });
    }
  });
  res.json(await Q.obter(id));
}));

module.exports = router;
